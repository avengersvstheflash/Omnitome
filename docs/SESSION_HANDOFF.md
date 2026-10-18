# Omnitome — Session Handoff

> Last updated: 2026-10-19 (S14 In Progress)
> Repository: github.com/avengersvstheflash/Omnitome
> Purpose: Full orientation in one turn for any assistant.

---

## 1. Current State

- **HEAD:** `d833192` (`fix(supervisor): strip windows verbatim path prefix for node v22 compatibility`)
- **Tree:** clean
- **Origin:** synced with `main`
- **Tests:** 17 Rust unit tests / 59 Node test suites
- **License:** AGPL-3.0-only (Public) / MIT (Private V2)

### Recent Commit Trail
- `d833192` — Strip Windows verbatim path prefix for Node v22 compatibility
- `ed586fc` — S14 in progress status and session handoff
- `058da19` — Strict Node path validation + spawn logging
- `80286b5` — Move supervisor to background thread
- `340fec3` — Remove incompatible NSIS hooks
- `9813d4b` — Splash screen and installer notice

---

## 2. S14 Status: Verbatim Path Bug Fixed & Ready for Rebuild

The NSIS installer pipeline is fully functional. We have a 1.66 GB installer architecture that successfully:
1. Installs `node.exe`, the production backend, and `sidecar.7z`.
2. Shows the animated Splash Screen on first launch.
3. Unpacks the 1.36 GB sidecar to `%LOCALAPPDATA%\Omnitome\sidecar\`.
4. Boots the Python sidecar flawlessly.

**The Bug & Fix:** 
Node.js previously crashed with `EISDIR: lstat 'C:'` due to an upstream Node v22 regression where verbatim paths (`\\?\C:\...`) cause `realpathSync` to truncate the path to `'C:'`.
In `src-tauri/src/lib.rs`, `strip_windows_verbatim` was added to strip verbatim prefixes, dynamic installation path resolution via `current_exe()` parent directory was implemented, and root/empty path guards were added. 17/17 Rust unit tests pass.

**Next Session Action:**
Run `.\scripts\build-installers.ps1 -Type Lightweight` to generate the updated installer and verify the first-launch extraction, splash screen animation, and backend initialization end-to-end.

---

## 3. Standing Rules
- **Raw Evidence Over Summaries.**
- **Strict Blast Radius.**
- **Node Owns SQLite.**
- **Use PowerShell for GUI app debugging** (to see stdout/stderr).
