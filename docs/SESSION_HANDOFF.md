# Omnitome — Session Handoff

> Last updated: 2026-10-20 (Post-S14 Packaging, Kokoro Offline & Library Self-Healing)
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
  - **TTS & Library Verification:** 5 / 5 integration tests (`node backend/tests/tts_and_library_fix_test.js`)
  - **Sidecar TTS Integration:** 10 / 10 tests (`node backend/tests/f85_kokoro_tts_sidecar_test.js`)
  - **Frontend (Vite + React):** Production build passes cleanly with zero errors (`npm --prefix frontend run build`)
- **License:** AGPL-3.0-only (Public) / MIT (Private V2)

### Recent Commit Trail
- `b67c806` — feat(tts,library): offline Kokoro voice resolution, library lifecycle self-healing, and S14 doc sync
- `7ebb600` — chore(tts): add bundled kokoro config fallback
- `6405fa3` — fix(ingestion,tts): resolve Kokoro offline mode and PDF TOC leakage
- `a6423c0` — fix(dev): resolve venv and backend paths when running from src-tauri
- `f5c5557` — feat(security): comprehensive hardening and edge-case fixes
- `7ae3ad7` — config(models): update model URLs to Cloudflare R2 and fix marker files
- `0584480` — feat(sidecar): fix pyinstaller missing imports and upgrade splash animation
- `68d86c1` — fix(supervisor): strip windows verbatim path prefix for node v22 compatibility
- `ed586fc` — docs: S14 in progress status and session handoff

---

## 2. Key Accomplishments & Architectural Solutions

### A. NSIS Installer & 7z Extraction Architecture (S14)
- **Overcoming the 2GB NSIS Limit:** Tauri's NSIS bundler crashes on the 4.6 GB PyInstaller sidecar due to the 32-bit `makensis` file size ceiling. Solved by pre-compressing the frozen sidecar into `resources/sidecar.7z` (1.36 GB) with LZMA via 7-Zip.
- **Runtime Rust Unpacker:** The Rust supervisor extracts `sidecar.7z` to `%LOCALAPPDATA%\Omnitome\sidecar\` on first boot via `sevenz-rust`. Implemented `wipe_dir` in Rust to cleanly handle Windows read-only locks on existing files during staging cleanup.
- **Dynamic Path Resolution:** Rewrote path resolution across `src-tauri/src/lib.rs` using `std::env::current_exe()` parent directory to resolve resources dynamically regardless of installation directory. Added `strip_windows_verbatim` to sanitize `\\?\` prefixes that caused Node v22 `EISDIR: lstat 'C:'` crashes.
- **Dev-Mode Flexibility:** Fixed dev-mode path resolution to check both `src-tauri` and the repository root for the Python virtual environment (`.venv`).

### B. Animated Splash Screen
- Created `frontend/public/splashscreen.html` featuring a pure CSS 3D flipping book animation and 3-phase initialization text cycling.
- Offloaded the supervisor setup to a background thread (`std::thread::spawn`) in `src-tauri/src/lib.rs`, preventing UI thread hangs and allowing smooth 60fps splash animations during archive extraction.

### C. Sidecar Dependencies & Packaging
- Added `transformers.models.metaclip_2`, `thinc` data files, and `language_tags` JSON data to `sidecar.spec` to eliminate PyInstaller runtime import failures.
- Resolved embedding 503 errors in `sidecars/python/embed/routes.py` by supporting both `pytorch_model.bin` and safetensors and preventing spurious 503s when models are already in memory.

### D. Kokoro TTS Engine Hardening
- **Offline Mode Fix:** Fixed `OfflineModeIsEnabled` crash when running without an internet connection (`HF_HUB_OFFLINE=1`). Kokoro's upstream `load_single_voice` was calling `hf_hub_download`. Implemented `_resolve_voice_path` across local directory hierarchies and Hugging Face snapshot caches, monkeypatching `_engine.load_single_voice` to use `torch.load(..., weights_only=True)`.
- **Citation-Only Sentences:** Empty/citation-only sentences (e.g. `[p12]`) now synthesize a 250ms silence WAV buffer instead of raising `ValueError("Text cannot be empty after sanitization")`, preventing dual-deck audio player stalls.
- **Whitelisted Preloading:** Pre-loads and validates all whitelisted voices (`af_heart`, `am_adam`, `bf_alice`, `bm_george`) at startup and exposes `availableVoices` on `GET /v1/tts/status`.

### E. Library Ingestion & Lifecycle Self-Healing
- **Root Cause Solved:** Fixed issue where imported books (such as *"corpsex"*) generated smart chapters but failed to appear in the Library tab due to early lifecycle record creation defaulting `in_library = 0`.
- **Multi-Layer Self-Healing:**
  - `backend/services/bookService.js`: Reconciles `in_library = 1` and `lifecycle_state = 'active'` upon smart chapter generation and post-ingest pipeline completion.
  - `backend/services/ingestion/importQueueService.js`: Reconciles `in_library = 1` on task completion.
  - `backend/services/lifecycle/bookLifecycleService.js`: Dynamic reconciliation inside `ensureLifecycle`, and default `in_library: 1` for non-research books.
  - `backend/db/database.js`: Startup schema backfill automatically reconciles pre-existing books with smart chapters.
- **Dynamic UI Cache Sync:**
  - `frontend/src/hooks/useBooks.ts`: Configured `refetchOnMount: 'always'`.
  - `frontend/src/routes/LibraryRoute.tsx`: Refetches on mount and listens for the custom `'omnitome:books-changed'` event.
  - `frontend/src/store/useImportQueueStore.ts`: Dispatches `'omnitome:books-changed'` upon import completion.

---

## 3. Standing Invariants & Rules

1. **Raw Evidence Over Summaries:** Never report a test as passing without running the command and verifying stdout/stderr.
2. **Strict Blast Radius:** Touch only the modules directly required for the fix; maintain backward compatibility with existing databases and fixtures.
3. **Node Owns SQLite:** The Node.js orchestrator (`better-sqlite3` in WAL mode) is the sole writer to the SQLite database. Sidecars and the frontend communicate with SQLite solely via Node APIs.
4. **Offline-First Resilience:** The app must be fully functional offline; model inference, text extraction, speech synthesis, and vector search must never depend on live external connections when models are installed locally.
5. **Use PowerShell for GUI App Debugging:** When debugging Tauri and child processes on Windows, execute via PowerShell to observe process exit codes and streamed logs.

---

## 4. Next Session Action Items

1. **Test Full NSIS Lightweight Build:**
   ```powershell
   .\scripts\build-installers.ps1 -Type Lightweight
   ```
2. **Verify Fresh Installation Flow:**
   - Execute the compiled installer in a clean VM or test directory.
   - Confirm splash screen animation, background 7z extraction to `%LOCALAPPDATA%\Omnitome\sidecar\`, and smooth main window transition.
3. **Verify Complete End-to-End User Journey:**
   - Import PDF/EPUB -> Verify live 5-stage progress -> Confirm immediate appearance in Library tab -> Test Kokoro TTS offline playback with dual-deck auto-advance.
