# Omnitome — Session Handoff

> Last updated: 2026-10-19 (S14 In Progress)
> Repository: github.com/avengersvstheflash/Omnitome
> Purpose: Full orientation in one turn for any assistant.

---

## 1. Current State

- **HEAD:** `058da19` (`fix(supervisor): strictly validate node paths and add spawn logging`)
- **Tree:** clean
- **Origin:** synced with `main`
- **Tests:** 14 Rust unit tests / 59 Node test suites
- **License:** AGPL-3.0-only (Public) / MIT (Private V2)

### Recent Commit Trail
- `058da19` — Strict Node path validation + spawn logging
- `80286b5` — Move supervisor to background thread
- `340fec3` — Remove incompatible NSIS hooks
- `9813d4b` — Splash screen and installer notice

---

## 2. S14 Status: Blocked by Node Path Bug

The NSIS installer pipeline is fully functional. We have a 1.66 GB installer that successfully:
1. Installs `node.exe`, the production backend, and `sidecar.7z`.
2. Shows the animated Splash Screen on first launch.
3. Unpacks the 1.36 GB sidecar to `%LOCALAPPDATA%\Omnitome\sidecar\`.
4. Boots the Python sidecar flawlessly.

**The Blocker:** 
Node.js crashes instantly with `EISDIR: lstat 'C:'`. 
The Rust supervisor is passing `C:` to Node as the script argument instead of the full path to `server.js`.

**Next Session Action:**
Run the installed `omnitome.exe` from a **Windows PowerShell terminal** (not via the Start Menu, so we can see `eprintln!` output). Look for `[Supervisor] About to spawn Node: ...`. Use that output to fix the path resolution in `find_node_executable`.

---

## 3. Standing Rules
- **Raw Evidence Over Summaries.**
- **Strict Blast Radius.**
- **Node Owns SQLite.**
- **Use PowerShell for GUI app debugging** (to see stdout/stderr).
