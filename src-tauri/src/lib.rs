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

#[derive(Clone, Copy, Debug)]
pub struct DynamicPorts {
    pub node_port: u16,
    pub sidecar_port: u16,
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

fn log_crash(error_msg: &str) {
    let app_dir = get_app_data_dir();
    let crash_log = app_dir.join("logs").join("crash.log");
    rotate_log_if_needed(&crash_log);
    let ts = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
    let entry = format!("[{}] [CRASH] {}\n", ts, error_msg);
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&crash_log) {
        let _ = f.write_all(entry.as_bytes());
        let _ = f.flush();
    }
    eprintln!("[CRASH] {}", error_msg);
}

#[cfg(windows)]
fn show_error_dialog(title: &str, message: &str) {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    let title_wide: Vec<u16> = OsStr::new(title).encode_wide().chain(Some(0)).collect();
    let msg_wide: Vec<u16> = OsStr::new(message).encode_wide().chain(Some(0)).collect();

    #[link(name = "user32")]
    extern "system" {
        fn MessageBoxW(hwnd: *mut std::ffi::c_void, text: *const u16, caption: *const u16, utype: u32) -> i32;
    }

    unsafe {
        // MB_OK (0x0) | MB_ICONERROR (0x10) | MB_SYSTEMMODAL (0x1000) | MB_SETFOREGROUND (0x10000) | MB_TOPMOST (0x40000) = 0x51010
        MessageBoxW(std::ptr::null_mut(), msg_wide.as_ptr(), title_wide.as_ptr(), 0x51010);
    }
}

#[cfg(not(windows))]
fn show_error_dialog(title: &str, message: &str) {
    eprintln!("{}: {}", title, message);
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

#[cfg(debug_assertions)]
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

fn wipe_dir(dir: &Path) -> std::io::Result<()> {
    if !dir.exists() {
        return Ok(());
    }

    // Attempt direct removal first
    if fs::remove_dir_all(dir).is_ok() {
        return Ok(());
    }

    // On Windows, read-only file attributes or indexing can cause remove_dir_all to fail.
    // Recursively clear read-only permissions and retry with backoff.
    fn unset_readonly_recursive(p: &Path) {
        if let Ok(entries) = fs::read_dir(p) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Ok(meta) = entry.metadata() {
                    let mut perms = meta.permissions();
                    if perms.readonly() {
                        perms.set_readonly(false);
                        let _ = fs::set_permissions(&path, perms);
                    }
                    if meta.is_dir() {
                        unset_readonly_recursive(&path);
                    }
                }
            }
        }
    }
    unset_readonly_recursive(dir);

    let mut last_err = None;
    for attempt in 0..5 {
        match fs::remove_dir_all(dir) {
            Ok(()) => return Ok(()),
            Err(e) => {
                last_err = Some(e);
                thread::sleep(Duration::from_millis(50 * (attempt + 1)));
            }
        }
    }

    if dir.exists() {
        Err(last_err.unwrap_or_else(|| std::io::Error::new(std::io::ErrorKind::Other, "Failed to remove directory")))
    } else {
        Ok(())
    }
}

fn atomic_rename_dir(from: &Path, to: &Path) -> std::io::Result<()> {
    let mut last_err = None;
    for attempt in 0..5 {
        match fs::rename(from, to) {
            Ok(()) => return Ok(()),
            Err(e) => {
                last_err = Some(e);
                thread::sleep(Duration::from_millis(50 * (attempt + 1)));
            }
        }
    }
    Err(last_err.unwrap_or_else(|| std::io::Error::new(std::io::ErrorKind::Other, "Failed to rename directory")))
}

fn unpack_sidecar_7z(archive_path: &Path, target_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    eprintln!("[Supervisor] Unpacking sidecar engine from {:?} to {:?}", archive_path, target_dir);

    let staging_dir = target_dir.with_extension("staging");
    if staging_dir.exists() {
        eprintln!("[Supervisor] Cleaning stale staging directory {:?}", staging_dir);
        wipe_dir(&staging_dir)
            .map_err(|e| format!("Failed to remove stale staging directory {:?}: {}", staging_dir, e))?;
    }
    fs::create_dir_all(&staging_dir)
        .map_err(|e| format!("Failed to create staging directory {:?}: {}", staging_dir, e))?;

    if let Err(e) = sevenz_rust::decompress_file(archive_path, &staging_dir) {
        let _ = wipe_dir(&staging_dir);
        return Err(format!("Failed to decompress 7z archive {:?}: {}", archive_path, e).into());
    }

    if target_dir.exists() {
        wipe_dir(target_dir)
            .map_err(|e| format!("Failed to remove existing target directory {:?}: {}", target_dir, e))?;
    }
    atomic_rename_dir(&staging_dir, target_dir)
        .map_err(|e| format!("Failed to move unpacked sidecar from {:?} to {:?}: {}", staging_dir, target_dir, e))?;

    // Delete sidecar.7z to reclaim disk space
    if let Err(e) = fs::remove_file(archive_path) {
        eprintln!("[Supervisor] Notice: Could not remove archive {:?}: {}", archive_path, e);
    } else {
        eprintln!("[Supervisor] Removed sidecar archive {:?} to reclaim disk space", archive_path);
    }

    Ok(())
}

fn resolve_node_paths(resource_dir: Option<&Path>, exe_dir: Option<&Path>) -> Option<(PathBuf, Vec<String>, PathBuf)> {
    // 1. Check resource_dir: node/node.exe and backend/server.js
    if let Some(res_dir) = resource_dir {
        let bundled_node = res_dir.join("node").join("node.exe");
        let bundled_server = res_dir.join("backend").join("server.js");
        if bundled_node.exists() && bundled_server.exists() {
            let working_dir = res_dir.join("backend");
            return Some((bundled_node, vec![bundled_server.to_string_lossy().to_string()], working_dir));
        }
    }

    // 2. Check exe_dir/resources: resources/node/node.exe and resources/backend/server.js
    if let Some(e_dir) = exe_dir {
        let alongside_node = e_dir.join("resources").join("node").join("node.exe");
        let alongside_server = e_dir.join("resources").join("backend").join("server.js");
        if alongside_node.exists() && alongside_server.exists() {
            let working_dir = e_dir.join("resources").join("backend");
            return Some((alongside_node, vec![alongside_server.to_string_lossy().to_string()], working_dir));
        }
    }

    None
}

fn resolve_bundled_sidecar_exe(resource_dir: Option<&Path>, exe_dir: Option<&Path>) -> Option<(PathBuf, Vec<String>, PathBuf)> {
    if let Some(res_dir) = resource_dir {
        let bundled_exe = res_dir.join("sidecar").join("omnitome-sidecar.exe");
        if bundled_exe.exists() {
            let working_dir = bundled_exe.parent().unwrap_or(res_dir).to_path_buf();
            return Some((bundled_exe, vec![], working_dir));
        }
    }

    if let Some(e_dir) = exe_dir {
        let alongside_exe = e_dir.join("resources").join("sidecar").join("omnitome-sidecar.exe");
        if alongside_exe.exists() {
            let working_dir = alongside_exe.parent().unwrap_or(e_dir).to_path_buf();
            return Some((alongside_exe, vec![], working_dir));
        }
    }

    None
}

fn get_candidate_sidecar_archives(resource_dir: Option<&Path>, exe_dir: Option<&Path>) -> Vec<PathBuf> {
    let mut candidate_archives = Vec::new();
    if let Some(res_dir) = resource_dir {
        candidate_archives.push(res_dir.join("sidecar.7z"));
    }
    if let Some(e_dir) = exe_dir {
        candidate_archives.push(e_dir.join("resources").join("sidecar.7z"));
    }
    candidate_archives
}

fn find_sidecar_executable(app: &tauri::App, _project_root: &Path) -> Result<(PathBuf, Vec<String>, PathBuf), Box<dyn std::error::Error>> {
    // 1. In dev mode (debug_assertions), prefer venv python main.py or local frozen sidecar
    #[cfg(debug_assertions)]
    {
        let venv_python = _project_root.join("sidecars").join("python").join(".venv").join("Scripts").join("python.exe");
        let script = _project_root.join("sidecars").join("python").join("main.py");
        if venv_python.exists() && script.exists() {
            return Ok((venv_python, vec![script.to_string_lossy().to_string()], _project_root.to_path_buf()));
        }
        let local_frozen = _project_root.join("dist-sidecar").join("omnitome-sidecar").join("omnitome-sidecar.exe");
        if local_frozen.exists() {
            let working_dir = local_frozen.parent().unwrap_or(_project_root).to_path_buf();
            return Ok((local_frozen, vec![], working_dir));
        }
    }

    // 2. In release/packaged mode:
    // First, check if extracted sidecar already exists in %LOCALAPPDATA%\Omnitome\sidecar\
    let app_data = get_app_data_dir();
    let local_sidecar_dir = app_data.join("sidecar");
    let local_sidecar_exe = local_sidecar_dir.join("omnitome-sidecar.exe");

    if local_sidecar_exe.exists() {
        return Ok((local_sidecar_exe, vec![], local_sidecar_dir));
    }
    let nested_local_exe = local_sidecar_dir.join("omnitome-sidecar").join("omnitome-sidecar.exe");
    if nested_local_exe.exists() {
        let nested_dir = local_sidecar_dir.join("omnitome-sidecar");
        return Ok((nested_local_exe, vec![], nested_dir));
    }

    let resource_dir = app.path().resource_dir().ok();
    let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|p| p.to_path_buf()));

    // If missing, check candidate locations for bundled sidecar.7z
    #[allow(unused_mut)]
    let mut candidate_archives = get_candidate_sidecar_archives(resource_dir.as_deref(), exe_dir.as_deref());
    #[cfg(debug_assertions)]
    {
        candidate_archives.push(_project_root.join("resources").join("sidecar.7z"));
    }

    for archive_path in candidate_archives {
        if archive_path.exists() {
            unpack_sidecar_7z(&archive_path, &local_sidecar_dir)?;
            if local_sidecar_exe.exists() {
                return Ok((local_sidecar_exe, vec![], local_sidecar_dir));
            }
            if nested_local_exe.exists() {
                let nested_dir = local_sidecar_dir.join("omnitome-sidecar");
                return Ok((nested_local_exe, vec![], nested_dir));
            }
            return Err(format!(
                "Unpacked sidecar archive {:?} into {:?}, but executable {:?} was not found",
                archive_path, local_sidecar_dir, local_sidecar_exe
            ).into());
        }
    }

    // 3. Pre-bundled sidecar executable (if pre-extracted in resource_dir or alongside exe)
    if let Some(paths) = resolve_bundled_sidecar_exe(resource_dir.as_deref(), exe_dir.as_deref()) {
        return Ok(paths);
    }

    Err(format!(
        "Failed to locate Omnitome sidecar executable. Checked local directory ({:?}) and resources directory.",
        local_sidecar_exe
    ).into())
}

fn find_node_executable(app: &tauri::App, _project_root: &Path) -> Result<(PathBuf, Vec<String>, PathBuf), Box<dyn std::error::Error>> {
    // 1. In dev mode (debug_assertions), prefer project backend and local/nvm node
    #[cfg(debug_assertions)]
    {
        let server_js = _project_root.join("backend").join("server.js");
        let nvm_node = PathBuf::from(r"C:\Users\Godsa\AppData\Local\Author Software\nvm\installs\v22.23.2\node.exe");
        if nvm_node.exists() && server_js.exists() {
            return Ok((nvm_node, vec![server_js.to_string_lossy().to_string()], _project_root.to_path_buf()));
        }
        if server_js.exists() {
            return Ok(("node".into(), vec![server_js.to_string_lossy().to_string()], _project_root.to_path_buf()));
        }
    }

    // 2. In release/packaged mode: ONLY check resource_dir and exe_dir/resources
    let resource_dir = app.path().resource_dir().ok();
    let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|p| p.to_path_buf()));

    if let Some(paths) = resolve_node_paths(resource_dir.as_deref(), exe_dir.as_deref()) {
        return Ok(paths);
    }

    Err("Could not find bundled Node.js or backend/server.js".into())
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

    #[cfg(debug_assertions)]
    let project_root = find_project_root();
    #[cfg(not(debug_assertions))]
    let project_root = PathBuf::new();

    // 3. Spawn Python sidecar
    let (sidecar_bin, mut sidecar_args, sidecar_cwd) = find_sidecar_executable(app, &project_root)?;
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
    stream_output("sidecar:err", sidecar_stderr, sidecar_log.clone(), "python-sidecar", None);

    // Await sidecar boot sentinel with responsive child exit detection
    let start_sidecar = std::time::Instant::now();
    let timeout = Duration::from_secs(30);
    let sidecar_port = loop {
        match sidecar_port_rx.recv_timeout(Duration::from_millis(200)) {
            Ok(port) => break port,
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                if let Ok(Some(status)) = sidecar_child.try_wait() {
                    return Err(format!(
                        "Python sidecar exited prematurely with {}. Check {:?} for details.",
                        status, sidecar_log
                    ).into());
                }
                if start_sidecar.elapsed() >= timeout {
                    let _ = sidecar_child.kill();
                    return Err(format!(
                        "Timeout (30s) waiting for Python sidecar boot handshake sentinel. Check {:?} for details.",
                        sidecar_log
                    ).into());
                }
            }
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                let status_msg = match sidecar_child.try_wait() {
                    Ok(Some(status)) => format!("exited with {}", status),
                    _ => "stdout/stderr stream closed unexpectedly".into(),
                };
                return Err(format!(
                    "Python sidecar stream disconnected ({}). Check {:?} for details.",
                    status_msg, sidecar_log
                ).into());
            }
        }
    };

    // 4. Spawn Node backend with OMNITOME_SIDECAR_PORT
    let (node_bin, mut node_args, node_cwd) = find_node_executable(app, &project_root)?;
    node_args.extend(["--port".into(), "0".into()]);

    eprintln!("[Supervisor] Spawning Node: {:?} {:?} in {:?}", node_bin, node_args, node_cwd);

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
    stream_output("node:err", node_stderr, node_log.clone(), "node-backend", None);

    // Await Node backend boot sentinel with responsive child exit detection
    let start_node = std::time::Instant::now();
    let node_port = loop {
        match node_port_rx.recv_timeout(Duration::from_millis(200)) {
            Ok(port) => break port,
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                if let Ok(Some(status)) = node_child.try_wait() {
                    let _ = sidecar_child.kill();
                    return Err(format!(
                        "Node backend exited prematurely with {}. Check {:?} for details.",
                        status, node_log
                    ).into());
                }
                if start_node.elapsed() >= timeout {
                    let _ = node_child.kill();
                    let _ = sidecar_child.kill();
                    return Err(format!(
                        "Timeout (30s) waiting for Node backend boot handshake sentinel. Check {:?} for details.",
                        node_log
                    ).into());
                }
            }
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                let _ = node_child.kill();
                let _ = sidecar_child.kill();
                let status_msg = match node_child.try_wait() {
                    Ok(Some(status)) => format!("exited with {}", status),
                    _ => "stdout/stderr stream closed unexpectedly".into(),
                };
                return Err(format!(
                    "Node backend stream disconnected ({}). Check {:?} for details.",
                    status_msg, node_log
                ).into());
            }
        }
    };

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

    // 6. Set dynamic ports on pre-configured main window
    app.manage(DynamicPorts {
        node_port,
        sidecar_port,
    });

    let init_script = format!(
        "try {{ sessionStorage.setItem('omnitome_ports', JSON.stringify({{ nodePort: {}, sidecarPort: {} }})); }} catch(e) {{}} window.__OMNITOME__ = Object.freeze({{ nodePort: {}, sidecarPort: {} }}); window.dispatchEvent(new CustomEvent('omnitome:ready', {{ detail: window.__OMNITOME__ }}));",
        node_port, sidecar_port, node_port, sidecar_port
    );

    if let Some(main) = app.get_webview_window("main") {
        let _ = main.eval(&init_script);
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .on_page_load(|webview, payload| {
            if webview.label() == "main" && payload.event() == tauri::webview::PageLoadEvent::Finished {
                if let Some(ports) = webview.try_state::<DynamicPorts>() {
                    let script = format!(
                        "try {{ sessionStorage.setItem('omnitome_ports', JSON.stringify({{ nodePort: {}, sidecarPort: {} }})); }} catch(e) {{}} window.__OMNITOME__ = Object.freeze({{ nodePort: {}, sidecarPort: {} }}); window.dispatchEvent(new CustomEvent('omnitome:ready', {{ detail: window.__OMNITOME__ }}));",
                        ports.node_port, ports.sidecar_port, ports.node_port, ports.sidecar_port
                    );
                    let _ = webview.eval(&script);
                }
            }
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { .. } = event {
                    if let Some(pm) = window.app_handle().try_state::<ProcessManager>() {
                        pm.shutdown();
                    }
                }
            }
        })
        .setup(|app| {
            match setup_supervisor(app) {
                Ok(()) => {
                    if let Some(splash) = app.get_webview_window("splashscreen") {
                        let _ = splash.close();
                    }
                    if let Some(main) = app.get_webview_window("main") {
                        let _ = main.show();
                        let _ = main.set_focus();
                    }
                    Ok(())
                }
                Err(e) => {
                    if let Some(splash) = app.get_webview_window("splashscreen") {
                        let _ = splash.close();
                    }
                    let err_str = e.to_string();
                    log_crash(&err_str);
                    let crash_log_path = get_app_data_dir().join("logs").join("crash.log");
                    let dialog_msg = format!(
                        "Omnitome encountered a fatal error during startup:\n\n{}\n\nA detailed crash log was written to:\n{}",
                        err_str,
                        crash_log_path.to_string_lossy()
                    );
                    show_error_dialog("Omnitome Startup Error", &dialog_msg);
                    Err(e)
                }
            }
        });

    let app = match builder.build(tauri::generate_context!()) {
        Ok(app) => app,
        Err(err) => {
            let err_str = format!("Fatal error building Tauri application: {}", err);
            log_crash(&err_str);
            show_error_dialog("Omnitome Fatal Error", &err_str);
            std::process::exit(1);
        }
    };

    app.run(|app_handle, event| {
        match event {
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
                if let Some(pm) = app_handle.try_state::<ProcessManager>() {
                    pm.shutdown();
                }
            }
            tauri::RunEvent::WindowEvent { label, event: tauri::WindowEvent::CloseRequested { .. }, .. } => {
                if label == "main" {
                    if let Some(pm) = app_handle.try_state::<ProcessManager>() {
                        pm.shutdown();
                    }
                }
            }
            tauri::RunEvent::WindowEvent { label, event: tauri::WindowEvent::Destroyed, .. } => {
                if label == "main" {
                    if let Some(pm) = app_handle.try_state::<ProcessManager>() {
                        pm.shutdown();
                    }
                }
            }
            _ => {}
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_unpack_sidecar_7z_success() {
        let temp_dir = std::env::temp_dir().join("omnitome_test_unpack_success");
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let src_dir = temp_dir.join("src_sidecar");
        fs::create_dir_all(&src_dir).unwrap();
        fs::write(src_dir.join("omnitome-sidecar.exe"), b"mock binary content").unwrap();
        fs::write(src_dir.join("config.json"), b"mock config").unwrap();

        let archive_path = temp_dir.join("sidecar.7z");
        sevenz_rust::compress_to_path(&src_dir, &archive_path).unwrap();
        assert!(archive_path.exists());

        let target_dir = temp_dir.join("sidecar");
        let staging_dir = target_dir.with_extension("staging");

        let res = unpack_sidecar_7z(&archive_path, &target_dir);
        assert!(res.is_ok(), "unpack_sidecar_7z failed: {:?}", res.err());

        assert!(target_dir.join("omnitome-sidecar.exe").exists());
        assert!(target_dir.join("config.json").exists());
        assert!(!staging_dir.exists(), "staging directory should not exist after rename");
        assert!(!archive_path.exists(), "archive file should have been deleted");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_unpack_sidecar_7z_cleans_stale_staging() {
        let temp_dir = std::env::temp_dir().join("omnitome_test_unpack_stale");
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let src_dir = temp_dir.join("src_sidecar");
        fs::create_dir_all(&src_dir).unwrap();
        fs::write(src_dir.join("omnitome-sidecar.exe"), b"mock binary content").unwrap();

        let archive_path = temp_dir.join("sidecar.7z");
        sevenz_rust::compress_to_path(&src_dir, &archive_path).unwrap();

        let target_dir = temp_dir.join("sidecar");
        let staging_dir = target_dir.with_extension("staging");
        fs::create_dir_all(&staging_dir).unwrap();
        fs::write(staging_dir.join("stale_garbage.txt"), b"stale data").unwrap();

        let res = unpack_sidecar_7z(&archive_path, &target_dir);
        assert!(res.is_ok(), "unpack_sidecar_7z failed: {:?}", res.err());

        assert!(target_dir.join("omnitome-sidecar.exe").exists());
        assert!(!target_dir.join("stale_garbage.txt").exists(), "stale staging contents should be wiped");
        assert!(!staging_dir.exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_unpack_sidecar_7z_corrupt_archive_fails_cleanly() {
        let temp_dir = std::env::temp_dir().join("omnitome_test_unpack_corrupt");
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let archive_path = temp_dir.join("corrupt.7z");
        fs::write(&archive_path, b"not a real 7z archive file").unwrap();

        let target_dir = temp_dir.join("sidecar");
        let staging_dir = target_dir.with_extension("staging");

        let res = unpack_sidecar_7z(&archive_path, &target_dir);
        assert!(res.is_err(), "unpack_sidecar_7z should fail on corrupt archive");
        assert!(!staging_dir.exists(), "staging dir should be cleaned up on error");
        assert!(!target_dir.exists(), "target dir should not have been created");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_unpack_sidecar_7z_cleans_stale_staging_with_readonly_file() {
        let temp_dir = std::env::temp_dir().join("omnitome_test_unpack_readonly");
        let _ = wipe_dir(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let src_dir = temp_dir.join("src_sidecar");
        fs::create_dir_all(&src_dir).unwrap();
        fs::write(src_dir.join("omnitome-sidecar.exe"), b"mock binary content").unwrap();

        let archive_path = temp_dir.join("sidecar.7z");
        sevenz_rust::compress_to_path(&src_dir, &archive_path).unwrap();

        let target_dir = temp_dir.join("sidecar");
        let staging_dir = target_dir.with_extension("staging");
        fs::create_dir_all(&staging_dir).unwrap();
        let ro_file = staging_dir.join("readonly_stale.txt");
        fs::write(&ro_file, b"cannot delete me easily").unwrap();
        let mut perms = fs::metadata(&ro_file).unwrap().permissions();
        perms.set_readonly(true);
        fs::set_permissions(&ro_file, perms).unwrap();

        let res = unpack_sidecar_7z(&archive_path, &target_dir);
        assert!(res.is_ok(), "unpack_sidecar_7z failed with readonly file in staging: {:?}", res.err());

        assert!(target_dir.join("omnitome-sidecar.exe").exists());
        assert!(!staging_dir.exists());

        let _ = wipe_dir(&temp_dir);
    }

    #[test]
    fn test_unpack_sidecar_7z_created_by_7z_exe() {
        let candidate_7z = [
            r"C:\Program Files\7-Zip\7z.exe",
            r"C:\Program Files (x86)\7-Zip\7z.exe",
        ];
        let mut seven_zip = None;
        for c in &candidate_7z {
            if Path::new(c).exists() {
                seven_zip = Some(*c);
                break;
            }
        }
        let Some(seven_zip_path) = seven_zip else {
            eprintln!("Skipping test_unpack_sidecar_7z_created_by_7z_exe: 7z.exe not found");
            return;
        };

        let temp_dir = std::env::temp_dir().join("omnitome_test_unpack_7z_exe");
        let _ = wipe_dir(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        let src_dir = temp_dir.join("src_sidecar");
        fs::create_dir_all(&src_dir).unwrap();
        fs::write(src_dir.join("omnitome-sidecar.exe"), b"real 7z binary content").unwrap();
        fs::create_dir_all(src_dir.join("_internal")).unwrap();
        fs::write(src_dir.join("_internal").join("test_dll.dll"), b"mock internal dll").unwrap();

        let archive_path = temp_dir.join("sidecar.7z");
        let mut cmd = Command::new(seven_zip_path);
        cmd.args(["a", "-t7z", "-mx=5", &archive_path.to_string_lossy(), "*"]);
        cmd.current_dir(&src_dir);
        let status = cmd.status().expect("failed to execute 7z.exe");
        assert!(status.success(), "7z.exe compression failed");
        assert!(archive_path.exists());

        let target_dir = temp_dir.join("sidecar");
        let res = unpack_sidecar_7z(&archive_path, &target_dir);
        assert!(res.is_ok(), "unpack_sidecar_7z failed on 7z.exe archive: {:?}", res.err());

        assert!(target_dir.join("omnitome-sidecar.exe").exists());
        assert!(target_dir.join("_internal").join("test_dll.dll").exists());
        assert!(!archive_path.exists(), "archive file should have been removed to save space");

        let _ = wipe_dir(&temp_dir);
    }

    #[test]
    fn test_log_crash() {
        let unique_marker = format!("TEST_CRASH_MARKER_{}", chrono::Local::now().timestamp_nanos_opt().unwrap_or(0));
        log_crash(&unique_marker);

        let crash_log = get_app_data_dir().join("logs").join("crash.log");
        assert!(crash_log.exists());
        let content = fs::read_to_string(&crash_log).unwrap();
        assert!(content.contains(&unique_marker));
    }

    #[test]
    fn test_resolve_node_paths_resource_dir_valid() {
        let temp_dir = std::env::temp_dir().join("omnitome_test_node_res_dir");
        let _ = wipe_dir(&temp_dir);
        let node_dir = temp_dir.join("node");
        let backend_dir = temp_dir.join("backend");
        fs::create_dir_all(&node_dir).unwrap();
        fs::create_dir_all(&backend_dir).unwrap();
        fs::write(node_dir.join("node.exe"), b"mock node").unwrap();
        fs::write(backend_dir.join("server.js"), b"mock server").unwrap();

        let resolved = resolve_node_paths(Some(&temp_dir), None);
        assert!(resolved.is_some());
        let (bin, args, cwd) = resolved.unwrap();
        assert_eq!(bin, node_dir.join("node.exe"));
        assert_eq!(args, vec![backend_dir.join("server.js").to_string_lossy().to_string()]);
        assert_eq!(cwd, backend_dir);

        let _ = wipe_dir(&temp_dir);
    }

    #[test]
    fn test_resolve_node_paths_exe_resources_valid() {
        let temp_dir = std::env::temp_dir().join("omnitome_test_node_exe_resources");
        let _ = wipe_dir(&temp_dir);
        let res_dir = temp_dir.join("resources");
        let node_dir = res_dir.join("node");
        let backend_dir = res_dir.join("backend");
        fs::create_dir_all(&node_dir).unwrap();
        fs::create_dir_all(&backend_dir).unwrap();
        fs::write(node_dir.join("node.exe"), b"mock node").unwrap();
        fs::write(backend_dir.join("server.js"), b"mock server").unwrap();

        let resolved = resolve_node_paths(None, Some(&temp_dir));
        assert!(resolved.is_some());
        let (bin, args, cwd) = resolved.unwrap();
        assert_eq!(bin, node_dir.join("node.exe"));
        assert_eq!(args, vec![backend_dir.join("server.js").to_string_lossy().to_string()]);
        assert_eq!(cwd, backend_dir);

        let _ = wipe_dir(&temp_dir);
    }

    #[test]
    fn test_resolve_node_paths_partial_or_missing_fails() {
        let temp_dir = std::env::temp_dir().join("omnitome_test_node_missing");
        let _ = wipe_dir(&temp_dir);
        let node_dir = temp_dir.join("node");
        fs::create_dir_all(&node_dir).unwrap();
        fs::write(node_dir.join("node.exe"), b"mock node").unwrap();

        // Node exists but server.js is missing
        assert!(resolve_node_paths(Some(&temp_dir), None).is_none());
        assert!(resolve_node_paths(None, Some(&temp_dir)).is_none());
        assert!(resolve_node_paths(None, None).is_none());

        let _ = wipe_dir(&temp_dir);
    }

    #[test]
    fn test_resolve_bundled_sidecar_exe_locations() {
        let temp_dir = std::env::temp_dir().join("omnitome_test_sidecar_bundled");
        let _ = wipe_dir(&temp_dir);

        // 1. resource_dir hit
        let sidecar_dir1 = temp_dir.join("res").join("sidecar");
        fs::create_dir_all(&sidecar_dir1).unwrap();
        fs::write(sidecar_dir1.join("omnitome-sidecar.exe"), b"mock exe").unwrap();
        let res = resolve_bundled_sidecar_exe(Some(&temp_dir.join("res")), None);
        assert!(res.is_some());
        let (bin, _, cwd) = res.unwrap();
        assert_eq!(bin, sidecar_dir1.join("omnitome-sidecar.exe"));
        assert_eq!(cwd, sidecar_dir1);

        // 2. exe_dir/resources hit
        let sidecar_dir2 = temp_dir.join("app").join("resources").join("sidecar");
        fs::create_dir_all(&sidecar_dir2).unwrap();
        fs::write(sidecar_dir2.join("omnitome-sidecar.exe"), b"mock exe").unwrap();
        let res2 = resolve_bundled_sidecar_exe(None, Some(&temp_dir.join("app")));
        assert!(res2.is_some());
        let (bin2, _, cwd2) = res2.unwrap();
        assert_eq!(bin2, sidecar_dir2.join("omnitome-sidecar.exe"));
        assert_eq!(cwd2, sidecar_dir2);

        let _ = wipe_dir(&temp_dir);
    }

    #[test]
    fn test_get_candidate_sidecar_archives_strict_order() {
        let res_dir = PathBuf::from(r"C:\App\resources_dir");
        let exe_dir = PathBuf::from(r"C:\App\bin");
        let archives = get_candidate_sidecar_archives(Some(&res_dir), Some(&exe_dir));
        assert_eq!(archives.len(), 2);
        assert_eq!(archives[0], res_dir.join("sidecar.7z"));
        assert_eq!(archives[1], exe_dir.join("resources").join("sidecar.7z"));
    }

    #[test]
    fn test_tauri_conf_windows_and_nsis_configuration() {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let conf_path = manifest_dir.join("tauri.conf.json");
        assert!(conf_path.exists(), "tauri.conf.json must exist");

        let content = fs::read_to_string(&conf_path).expect("failed to read tauri.conf.json");
        let v: serde_json::Value = serde_json::from_str(&content).expect("invalid json in tauri.conf.json");

        let windows = v["app"]["windows"].as_array().expect("app.windows should be an array");
        assert_eq!(windows.len(), 2, "must configure exactly 2 windows");

        let main_win = windows.iter().find(|w| w["label"] == "main").expect("main window missing");
        assert_eq!(main_win["url"], "index.html");
        assert_eq!(main_win["visible"], false, "main window must start hidden");

        let splash_win = windows.iter().find(|w| w["label"] == "splashscreen").expect("splashscreen window missing");
        assert_eq!(splash_win["url"], "splashscreen.html");
        assert_eq!(splash_win["width"], 450);
        assert_eq!(splash_win["height"], 300);
        assert_eq!(splash_win["center"], true);
        assert_eq!(splash_win["decorations"], false);
        assert_eq!(splash_win["alwaysOnTop"], true);
        assert_eq!(splash_win["visible"], true);
        assert_eq!(splash_win["resizable"], false);

        let nsis = &v["bundle"]["windows"]["nsis"];
        assert_eq!(nsis["installMode"], "currentUser");
        assert!(nsis.get("installerHooks").is_none(), "installerHooks must not be configured");
    }

    #[test]
    fn test_splashscreen_html_content() {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let splash_path = manifest_dir.parent().unwrap().join("frontend").join("public").join("splashscreen.html");
        assert!(splash_path.exists(), "splashscreen.html must exist in frontend/public");

        let content = fs::read_to_string(&splash_path).expect("failed to read splashscreen.html");
        assert!(content.contains("Unpacking neural engine..."));
        assert!(content.contains("First launch may take 1-2 minutes."));
    }
}

