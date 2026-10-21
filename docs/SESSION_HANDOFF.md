# Omnitome — Session Handoff

> Last updated: 2026-10-21 (Post-v1.0.1 Packaging Fixes, Kokoro/spaCy TTS Bundling & UI Polish)  
> Repository: github.com/avengersvstheflash/Omnitome  
> Purpose: Full orientation in one turn for any assistant.

---

## 1. Current State

- **Branch:** `main` (synced with `origin/main`)
- **Working Tree:** Clean (all changes staged and verified)
- **Tests Passing:**
  - **Rust (Tauri):** 17 / 17 Cargo unit tests (`cargo test --manifest-path src-tauri/Cargo.toml`)
  - **Backend (Node.js):** 60 / 60 Regression suites + 1 Network suite (`npm test`)
  - **Corpus Release Gate (F42):** 10 / 10 multi-format fixtures (Classes A, B, C)
  - **Dossier & Queue Integration:** 10 / 10 pipeline tests (`node backend/tests/import_queue_pipeline_test.js`)
  - **Dossier Append Tests:** 8 / 8 tests (`node backend/tests/f79b_append_source_test.js`)
  - **Sidecar TTS Integration:** 10 / 10 tests (`node backend/tests/f85_kokoro_tts_sidecar_test.js`)
  - **Frontend (Vite + React):** TypeScript check (`tsc --noEmit`) and production build pass with 0 errors (`npm --prefix frontend run build`)
- **License:** AGPL-3.0-only (Public) / MIT (Private V2)

### Recent Commit Trail
- `ce2f68c` — fix(v1.0.1): bundle espeak-ng-data for Kokoro TTS, fix Queue false-positive, and add independent Research scrolling
- `28d5bc0` — chore(release): generate custom app icons and enforce strict CSP
- `82e2b84` — feat(ui): add F11 fullscreen toggle and global state sync
- `9b62607` — feat(ux): import queue hygiene, research dossier append/delete, library batch delete, and 404 handling
- `b67c806` — feat(tts,library): offline Kokoro voice resolution, library lifecycle self-healing, and S14 doc sync

---

## 2. Key Accomplishments & Architectural Solutions

### A. NSIS Installer & 7z Extraction Architecture (S14 & v1.0.1)
- **Overcoming the 2GB NSIS Limit:** Tauri's NSIS bundler crashes on the 4.6 GB PyInstaller sidecar due to the 32-bit `makensis` file size ceiling. Solved by pre-compressing the frozen sidecar into `resources/sidecar.7z` (1.36 GB) with LZMA via 7-Zip.
- **Runtime Rust Unpacker:** The Rust supervisor extracts `sidecar.7z` to `%LOCALAPPDATA%\Omnitome\sidecar\` on first boot via `sevenz-rust`. Implemented `wipe_dir` in Rust to cleanly handle Windows read-only locks on existing files during staging cleanup.
- **Dynamic Path Resolution:** Rewrote path resolution across `src-tauri/src/lib.rs` using `std::env::current_exe()` parent directory to resolve resources dynamically regardless of installation directory. Added `strip_windows_verbatim` to sanitize `\\?\` prefixes that caused Node v22 `EISDIR: lstat 'C:'` crashes.
- **Security Hardening (CSP):** Enforces strict Content Security Policy (`default-src 'self' ... connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:*`) inside `tauri.conf.json`.

### B. Kokoro TTS Engine & Phonemizer Freezing
- **Phonetic Dictionaries (`espeak-ng`):** Bundled `espeakng_loader` data files (38 files) and `espeak-ng.dll` in `sidecar.spec` to prevent `RuntimeError: data path not exists` in frozen environments.
- **spaCy Local Model Bundling (`en_core_web_sm`):** Kokoro's `misaki` dependency requires `en_core_web_sm`. Bundled the model via `collect_all('en_core_web_sm')` and added `spacy` submodules and metadata to `sidecar.spec`, eliminating runtime pip download crashes.
- **Offline Voice Loader:** Monkeypatched `_engine.load_single_voice` with `_resolve_voice_path` across local directory hierarchies and Hugging Face snapshot caches, enabling 100% offline synthesis (`HF_HUB_OFFLINE=1`).
- **Citation-Only Sentences:** Empty/citation-only sentences (e.g. `[p12]`) synthesize a 250ms silence WAV buffer instead of raising `ValueError`, preventing dual-deck audio player stalls.

### C. Import Queue & Research Dossier State Synchronization
- **Fresh Task Cache Invalidation:** In `QueueManager.tsx`, tasks completed within 60 seconds are designated as fresh; opening a fresh book triggers `queryClient.refetchQueries({ queryKey: ['books'], type: 'all' })` rather than showing a false-positive deleted toast.
- **Ghost Entry Pruning:** Automatically prunes completed/failed tasks from SQLite when their `book_id` has been deleted from the `books` table.
- **Dual Independent Scrolling:** Constrained `ResearchViewerRoute.tsx` container to `h-[calc(100vh-var(--header-height,10rem))]`, providing independent vertical scrollbars for the chapter index and source text pane, with automated scroll reset on chapter changes.

### D. Full-Screen (F11) & Themed Scrollbars
- **Global Fullscreen Hook (`useFullscreen.ts`):** Supports HTML5 Fullscreen API with standard <kbd>F11</kbd> hotkey and UI toggle buttons in `Header.tsx` and `ReaderRoute.tsx`. State is kept in sync via `fullscreenchange` when exiting with <kbd>Esc</kbd>.
- **Omnitome Themed Scrollbars:** Replaced generic gray scrollbars with theme-reactive WebKit scrollbars (`--accent` tint with rounded padding-box clips) in `frontend/src/index.css`.

---

## 3. Standing Invariants & Rules

1. **Raw Evidence Over Summaries:** Never report a test as passing without running the command and verifying stdout/stderr.
2. **Strict Blast Radius:** Touch only the modules directly required for the fix; maintain backward compatibility with existing databases and fixtures.
3. **Node Owns SQLite:** The Node.js orchestrator (`better-sqlite3` in WAL mode) is the sole writer to the SQLite database. Sidecars and the frontend communicate with SQLite solely via Node APIs.
4. **Offline-First Resilience:** The app must be fully functional offline; model inference, text extraction, speech synthesis, and vector search must never depend on live external connections when models are installed locally.
5. **Use PowerShell for GUI App Debugging:** When debugging Tauri and child processes on Windows, execute via PowerShell to observe process exit codes and streamed logs.

---

## 4. Next Session Action Items

1. **Freeze Python Sidecar with spaCy Model:**
   ```powershell
   cd sidecars/python
   .\.venv\Scripts\activate
   pyinstaller sidecar.spec --noconfirm
   ```
2. **Re-pack 7z Archive:**
   Compress `sidecars/python/dist/omnitome-sidecar/` into `resources/sidecar.7z` using 7-Zip (`7z a -t7z -m0=lzma2 -mx=9 resources\sidecar.7z .\sidecars\python\dist\omnitome-sidecar\*`).
3. **Build Final v1.0.1 Installer:**
   ```powershell
   npm run tauri:build
   ```
4. **Verify Clean Installation:**
   Install and test on a clean Windows machine without python/node pre-installed; verify Kokoro TTS playback, custom scrollbars, and F11 fullscreen mode.
