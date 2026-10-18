use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc::{channel, Sender};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use regex::Regex;
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Serialize, Deserialize, Default, Debug)]
struct PidsFile {
    sidecar_pid: Option<u32>,
    node_pid: Option<u32>,
}

struct ProcessManager {
    sidecar: Mutex<Option<Child>>,
    node: Mutex<Option<Child>>,
    sidecar_pid: u32,
    node_pid: u32,
    app_dir: PathBuf,
}

impl ProcessManager {
    fn shutdown(&self) {
        // Forcefully terminate Python sidecar and all sub-processes (PaddleOCR, Uvicorn, etc.)
        kill_pid(self.sidecar_pid);
        if let Ok(mut lock) = self.sidecar.lock() {
            if let Some(mut child) = lock.take() {
                kill_pid(child.id());
                let _ = child.kill();
            }
        }
        // Forcefully terminate Node backend and any child processes
        kill_pid(self.node_pid);
        if let Ok(mut lock) = self.node.lock() {
            if let Some(mut child) = lock.take() {
                kill_pid(child.id());
                let _ = child.kill();
            }
        }
        // Sweep any recorded PIDs from disk
        cleanup_stale_pids(&self.app_dir);
    }
}

impl Drop for ProcessManager {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn get_app_data_dir() -> PathBuf {
    let local = std::env::var("LOCALAPPDATA")
        .unwrap_or_else(|_| std::env::var("USERPROFILE").unwrap_or_else(|_| ".".into()));
    let base = PathBuf::from(local).join("Omnitome");
    let _ = fs::create_dir_all(base.join("logs"));
    let _ = fs::create_dir_all(base.join("models"));
    base
}

fn rotate_log_if_needed(log_path: &Path) {
    if let Ok(meta) = fs::metadata(log_path) {
        if meta.len() > 5 * 1024 * 1024 {
            let old_path = log_path.with_extension("old.log");
            let _ = fs::rename(log_path, old_path);
        }
    }
}

fn kill_pid(pid: u32) {
    if pid == 0 {
        return;
    }
    #[cfg(windows)]
    {
        let mut cmd = Command::new("taskkill");
        cmd.args(["/F", "/T", "/PID", &pid.to_string()]);
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd.stdout(Stdio::null());
        cmd.stderr(Stdio::null());
        let _ = cmd.status();
    }
    #[cfg(not(windows))]
    {
        let mut cmd = Command::new("kill");
        cmd.args(["-9", &pid.to_string()]);
        cmd.stdout(Stdio::null());
        cmd.stderr(Stdio::null());
        let _ = cmd.status();
    }
}

fn cleanup_stale_pids(app_dir: &Path) {
    let pids_path = app_dir.join("pids.json");
    if pids_path.exists() {
        if let Ok(content) = fs::read_to_string(&pids_path) {
            if let Ok(pids) = serde_json::from_str::<PidsFile>(&content) {
                if let Some(pid) = pids.sidecar_pid {
                    kill_pid(pid);
                }
                if let Some(pid) = pids.node_pid {
                    kill_pid(pid);
                }
            }
        }
        let _ = fs::remove_file(&pids_path);
    }
}

fn write_atomic_pids(app_dir: &Path, sidecar_pid: u32, node_pid: u32) {
    let pids = PidsFile {
        sidecar_pid: Some(sidecar_pid),
        node_pid: Some(node_pid),
    };
    let tmp_path = app_dir.join("pids.json.tmp");
    let final_path = app_dir.join("pids.json");
    if let Ok(json) = serde_json::to_string_pretty(&pids) {
        if fs::write(&tmp_path, json).is_ok() {
            let _ = fs::rename(tmp_path, final_path);
        }
    }
}

fn find_project_root() -> PathBuf {
    if let Ok(dir) = std::env::current_dir() {
        if dir.join("backend").join("server.js").exists() {
            return dir;
        }
    }
    if let Ok(mut exe) = std::env::current_exe() {
        while exe.pop() {
            if exe.join("backend").join("server.js").exists() {
                return exe;
            }
        }
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn unpack_sidecar_zip(zip_path: &Path, target_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    eprintln!("[Supervisor] Unpacking sidecar engine from {:?} to {:?}", zip_path, target_dir);
    let file = fs::File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(file)?;

    let staging_dir = target_dir.with_extension("staging");
    if staging_dir.exists() {
        let _ = fs::remove_dir_all(&staging_dir);
    }
    fs::create_dir_all(&staging_dir)?;

    archive.extract(&staging_dir)?;

    if target_dir.exists() {
        let _ = fs::remove_dir_all(target_dir);
    }
    fs::rename(&staging_dir, target_dir)?;

    // Delete sidecar.zip to reclaim 1.3 GB of disk space
    if let Err(e) = fs::remove_file(zip_path) {
        eprintln!("[Supervisor] Notice: Could not remove archive {:?}: {}", zip_path, e);
    } else {
        eprintln!("[Supervisor] Removed sidecar archive {:?} to reclaim disk space", zip_path);
    }

    Ok(())
}

fn find_sidecar_executable(app: &tauri::App, project_root: &Path) -> (PathBuf, Vec<String>, PathBuf) {
    // 1. In dev mode (debug_assertions), prefer venv python main.py
    #[cfg(debug_assertions)]
    {
        let venv_python = project_root.join("sidecars").join("python").join(".venv").join("Scripts").join("python.exe");
        let script = project_root.join("sidecars").join("python").join("main.py");
        if venv_python.exists() && script.exists() {
            return (venv_python, vec![script.to_string_lossy().to_string()], project_root.to_path_buf());
        }
    }

    // 2. In release/packaged mode:
    // First, check if extracted sidecar already exists in %LOCALAPPDATA%\Omnitome\sidecar\
    let app_data = get_app_data_dir();
    let local_sidecar_dir = app_data.join("sidecar");
    let local_sidecar_exe = local_sidecar_dir.join("omnitome-sidecar.exe");

    if local_sidecar_exe.exists() {
        return (local_sidecar_exe, vec![], local_sidecar_dir);
    }

    // If missing, check if sidecar.zip is available in Tauri's resource_dir
    if let Ok(resource_dir) = app.path().resource_dir() {
        let sidecar_zip = resource_dir.join("sidecar.zip");
        if sidecar_zip.exists() {
            if let Err(e) = unpack_sidecar_zip(&sidecar_zip, &local_sidecar_dir) {
                eprintln!("[Supervisor] Error unpacking sidecar archive: {}", e);
            } else if local_sidecar_exe.exists() {
                return (local_sidecar_exe, vec![], local_sidecar_dir);
            }
        }

        // Also check if already extracted directly in resource_dir/sidecar/
        let bundled_exe = resource_dir.join("sidecar").join("omnitome-sidecar.exe");
        if bundled_exe.exists() {
            let working_dir = bundled_exe.parent().unwrap_or(&resource_dir).to_path_buf();
            return (bundled_exe, vec![], working_dir);
        }
    }

    // 3. Fallback: check dist-sidecar in project root or adjacent to exe
    let local_frozen = project_root.join("dist-sidecar").join("omnitome-sidecar").join("omnitome-sidecar.exe");
    if local_frozen.exists() {
        let working_dir = local_frozen.parent().unwrap_or(project_root).to_path_buf();
        return (local_frozen, vec![], working_dir);
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            let alongside = parent.join("resources").join("sidecar").join("omnitome-sidecar.exe");
            if alongside.exists() {
                let working_dir = alongside.parent().unwrap_or(parent).to_path_buf();
                return (alongside, vec![], working_dir);
            }
        }
    }

    // Dev fallback
    let venv_python = project_root.join("sidecars").join("python").join(".venv").join("Scripts").join("python.exe");
    let script = project_root.join("sidecars").join("python").join("main.py");
    (venv_python, vec![script.to_string_lossy().to_string()], project_root.to_path_buf())
}

fn find_node_executable(app: &tauri::App, project_root: &Path) -> (PathBuf, Vec<String>, PathBuf) {
    let server_js = project_root.join("backend").join("server.js");

    // 1. In dev mode (debug_assertions), prefer project backend and local/nvm node
    #[cfg(debug_assertions)]
    {
        let nvm_node = PathBuf::from(r"C:\Users\Godsa\AppData\Local\Author Software\nvm\installs\v22.23.2\node.exe");
        if nvm_node.exists() && server_js.exists() {
            return (nvm_node, vec![server_js.to_string_lossy().to_string()], project_root.to_path_buf());
        }
        if server_js.exists() {
            return ("node".into(), vec![server_js.to_string_lossy().to_string()], project_root.to_path_buf());
        }
    }

    // 2. In release/packaged mode, check Tauri resource_dir
    if let Ok(resource_dir) = app.path().resource_dir() {
        let bundled_node = resource_dir.join("node").join("node.exe");
        let bundled_server = resource_dir.join("backend").join("server.js");
        if bundled_node.exists() && bundled_server.exists() {
            let working_dir = resource_dir.join("backend");
            return (bundled_node, vec![bundled_server.to_string_lossy().to_string()], working_dir);
        }
    }

    // 3. Fallback: alongside current executable
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(parent) = exe_path.parent() {
            let alongside_node = parent.join("resources").join("node").join("node.exe");
            let alongside_server = parent.join("resources").join("backend").join("server.js");
            if alongside_node.exists() && alongside_server.exists() {
                let working_dir = parent.join("resources").join("backend");
                return (alongside_node, vec![alongside_server.to_string_lossy().to_string()], working_dir);
            }
        }
    }

    // 4. Dev mode fallback / unpacked release fallback
    let nvm_node = PathBuf::from(r"C:\Users\Godsa\AppData\Local\Author Software\nvm\installs\v22.23.2\node.exe");
    if nvm_node.exists() {
        return (nvm_node, vec![server_js.to_string_lossy().to_string()], project_root.to_path_buf());
    }
    ("node".into(), vec![server_js.to_string_lossy().to_string()], project_root.to_path_buf())
}

fn stream_output(
    prefix: &'static str,
    stream: impl std::io::Read + Send + 'static,
    log_file: PathBuf,
    expected_service: &'static str,
    port_sender: Option<Sender<u16>>,
) {
    thread::spawn(move || {
        let reader = BufReader::new(stream);
        let regex = Regex::new(r"^__OMNITOME_BOOT__\s+([a-zA-Z0-9_\-]+)\s+port=(\d+)\s*$").unwrap();
        let mut sender = port_sender;

        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_file)
            .ok();

        for line in reader.lines() {
            if let Ok(line) = line {
                let ts = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
                let log_entry = format!("[{}] [{}] {}\n", ts, prefix, line);

                if let Some(ref mut f) = file {
                    let _ = f.write_all(log_entry.as_bytes());
                    let _ = f.flush();
                }

                #[cfg(debug_assertions)]
                eprintln!("[{}] {}", prefix, line);

                // Check for sentinel line
                if let Some(s) = sender.take() {
                    let trimmed = line.trim();
                    if let Some(caps) = regex.captures(trimmed) {
                        let service = caps.get(1).map_or("", |m| m.as_str());
                        let port_str = caps.get(2).map_or("", |m| m.as_str());
                        if service == expected_service {
                            if let Ok(port) = port_str.parse::<u16>() {
                                let _ = s.send(port);
                            } else {
                                sender = Some(s);
                            }
                        } else {
                            sender = Some(s);
                        }
                    } else {
                        sender = Some(s);
                    }
                }
            }
        }
    });
}

fn setup_supervisor(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_dir = get_app_data_dir();
    let logs_dir = app_dir.join("logs");
    let models_dir = app_dir.join("models");

    // 1. Clean stale processes from previous crashes
    cleanup_stale_pids(&app_dir);

    // 2. Setup log paths and rotation
    let sidecar_log = logs_dir.join("sidecar.log");
    rotate_log_if_needed(&sidecar_log);
    let node_log = logs_dir.join("node.log");
    rotate_log_if_needed(&node_log);

    let project_root = find_project_root();

    // 3. Spawn Python sidecar
    let (sidecar_bin, mut sidecar_args, sidecar_cwd) = find_sidecar_executable(app, &project_root);
    sidecar_args.extend(["--port".into(), "0".into()]);

    let mut sidecar_cmd = Command::new(&sidecar_bin);
    sidecar_cmd.args(&sidecar_args);
    sidecar_cmd.current_dir(&sidecar_cwd);
    sidecar_cmd.env("OMNITOME_MODEL_DIR", &models_dir);
    sidecar_cmd.env("PYTHONUNBUFFERED", "1");
    sidecar_cmd.stdout(Stdio::piped());
    sidecar_cmd.stderr(Stdio::piped());

    #[cfg(windows)]
    sidecar_cmd.creation_flags(CREATE_NO_WINDOW);

    let mut sidecar_child = sidecar_cmd.spawn()
        .map_err(|e| format!("Failed to spawn Python sidecar ({:?}): {}", sidecar_bin, e))?;

    let sidecar_pid = sidecar_child.id();

    let (sidecar_port_tx, sidecar_port_rx) = channel();
    let sidecar_stdout = sidecar_child.stdout.take().ok_or("Failed to capture sidecar stdout")?;
    let sidecar_stderr = sidecar_child.stderr.take().ok_or("Failed to capture sidecar stderr")?;

    stream_output("sidecar", sidecar_stdout, sidecar_log.clone(), "python-sidecar", Some(sidecar_port_tx));
    stream_output("sidecar:err", sidecar_stderr, sidecar_log, "python-sidecar", None);

    // Await sidecar boot sentinel
    let sidecar_port = sidecar_port_rx.recv_timeout(Duration::from_secs(30))
        .map_err(|_| "Timeout (30s) waiting for Python sidecar boot handshake sentinel".to_string())?;

    // 4. Spawn Node backend with OMNITOME_SIDECAR_PORT
    let (node_bin, mut node_args, node_cwd) = find_node_executable(app, &project_root);
    node_args.extend(["--port".into(), "0".into()]);

    let mut node_cmd = Command::new(&node_bin);
    node_cmd.args(&node_args);
    node_cmd.current_dir(&node_cwd);
    node_cmd.env("OMNITOME_SIDECAR_PORT", sidecar_port.to_string());
    node_cmd.env("PYTHON_SIDECAR_URL", format!("http://127.0.0.1:{}", sidecar_port));
    node_cmd.env("OMNITOME_MODEL_DIR", &models_dir);

    #[cfg(not(debug_assertions))]
    {
        node_cmd.env("STORAGE_DIR", &app_dir);
        node_cmd.env("DB_PATH", app_dir.join("data.db"));
        node_cmd.env("SETTINGS_FILE_PATH", app_dir.join("settings.json"));
    }

    node_cmd.stdout(Stdio::piped());
    node_cmd.stderr(Stdio::piped());

    #[cfg(windows)]
    node_cmd.creation_flags(CREATE_NO_WINDOW);

    let mut node_child = node_cmd.spawn()
        .map_err(|e| format!("Failed to spawn Node backend ({:?}): {}", node_bin, e))?;

    let node_pid = node_child.id();

    let (node_port_tx, node_port_rx) = channel();
    let node_stdout = node_child.stdout.take().ok_or("Failed to capture node stdout")?;
    let node_stderr = node_child.stderr.take().ok_or("Failed to capture node stderr")?;

    stream_output("node", node_stdout, node_log.clone(), "node-backend", Some(node_port_tx));
    stream_output("node:err", node_stderr, node_log, "node-backend", None);

    // Await Node backend boot sentinel
    let node_port = node_port_rx.recv_timeout(Duration::from_secs(30))
        .map_err(|_| "Timeout (30s) waiting for Node backend boot handshake sentinel".to_string())?;

    // 5. Write atomic PID record
    write_atomic_pids(&app_dir, sidecar_pid, node_pid);

    // Register process manager in app state
    app.manage(ProcessManager {
        sidecar: Mutex::new(Some(sidecar_child)),
        node: Mutex::new(Some(node_child)),
        sidecar_pid,
        node_pid,
        app_dir,
    });

    // 6. Programmatically build WebviewWindow only AFTER both ports are confirmed live!
    let init_script = format!(
        "window.__OMNITOME__ = Object.freeze({{ nodePort: {}, sidecarPort: {} }});",
        node_port, sidecar_port
    );

    tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::default())
        .title("Omnitome")
        .inner_size(1280.0, 800.0)
        .min_inner_size(900.0, 600.0)
        .resizable(true)
        .initialization_script(&init_script)
        .build()?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if let Some(pm) = window.app_handle().try_state::<ProcessManager>() {
                    pm.shutdown();
                }
            }
        })
        .setup(|app| {
            setup_supervisor(app)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        match event {
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
                if let Some(pm) = app_handle.try_state::<ProcessManager>() {
                    pm.shutdown();
                }
            }
            tauri::RunEvent::WindowEvent { event: tauri::WindowEvent::CloseRequested { .. }, .. } => {
                if let Some(pm) = app_handle.try_state::<ProcessManager>() {
                    pm.shutdown();
                }
            }
            tauri::RunEvent::WindowEvent { event: tauri::WindowEvent::Destroyed, .. } => {
                if let Some(pm) = app_handle.try_state::<ProcessManager>() {
                    pm.shutdown();
                }
            }
            _ => {}
        }
    });
}
