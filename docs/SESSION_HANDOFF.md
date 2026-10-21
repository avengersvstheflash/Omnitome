# Omnitome — Session Handoff

> Last updated: 2026-10-22 (Post-v1.0.2 Release: Packaging Complete, cuDNN Bundling, Shared AudioContext TTS & Thematic Sound Engine)  
> Repository: github.com/avengersvstheflash/Omnitome  
> Purpose: Full orientation in one turn for any incoming assistant or engineer.

---

## 1. Current State

- **Active Release:** `v1.0.2 Stable`
- **Current HEAD:** `77c5906` (`fix(frontend): resolve TTS AudioContext autoplay, wire missing SFX, and fix onboarding redirect`)
- **Working Tree:** Clean / fully synced with `origin/main`
- **Application Status:** Fully packaged Windows installer (`.exe`), installed, and verified working end-to-end (Neural TTS + 90-Stem Thematic UI Sound Engine + Ingestion Pipeline).
- **Test Suites Status:**
  - **Procedural Sound Engine:** 90 / 90 files verified (`npm run sounds:test`, `npm run sounds:verify`)
  - **Frontend (Vite + React):** TypeScript check (`tsc --noEmit`) and production build pass with 0 errors (`npm --prefix frontend run build`)
  - **Rust Supervisor (Tauri v2):** 17 / 17 Cargo unit tests (`cargo test --manifest-path src-tauri/Cargo.toml`)
  - **Backend (Node.js Express 5):** 60 / 60 Regression suites + 1 Network suite (`npm test`)
  - **Corpus Release Gate (F42):** 10 / 10 multi-format fixtures (Classes A, B, C)
  - **Dossier & Queue Integration:** 10 / 10 pipeline tests (`node backend/tests/import_queue_pipeline_test.js`)
  - **Sidecar TTS Integration:** 10 / 10 tests (`node backend/tests/f85_kokoro_tts_sidecar_test.js`)
  - **v1.0.1 Polish & Deduplication:** 4 / 4 test groups (`node backend/tests/v101_polish_verification_test.js`)
- **License:** AGPL-3.0-only (Public) / Commercial-ready dual licensing

### Recent Commit Trail
- `77c5906` — fix(frontend): resolve TTS AudioContext autoplay, wire missing SFX, and fix onboarding redirect
- `dac217a` — feat(release): v1.0.1 TTS cudnn fix, UX polish, and 90-file thematic UI sound system
- `3bab9ad` — feat(ux): v1.0.1 polish - onboarding redirect, progress fix, dedup, chapter search, and basic SFX
- `cedda5a` — feat(release): v1.0.1 TTS spaCy fix, custom scrollbars, and comprehensive docs update
- `ce2f68c` — fix(v1.0.1): bundle espeak-ng-data for Kokoro TTS, fix Queue false-positive, and add independent Research scrolling

---

## 2. Key Architecture & Milestone Solutions

### A. NSIS Packaging & 7z Compression Architecture (v1.0.0 – v1.0.2)
- **Overcoming the 2GB NSIS Limit:** Pre-compressed the 4.6 GB PyInstaller sidecar into `resources/sidecar.7z` (1.36 GB) with LZMA via 7-Zip, bypassing the 32-bit `makensis` file size ceiling.
- **Runtime Rust Unpacker:** The Rust supervisor extracts `sidecar.7z` to `%LOCALAPPDATA%\Omnitome\sidecar\` on first launch via `sevenz-rust`. Implemented `wipe_dir` in Rust to handle Windows file locks cleanly during staging cleanup.
- **Dynamic Path Resolution:** All paths across `src-tauri/src/lib.rs` resolve relative to `std::env::current_exe()`. Strips Windows `\\?\` verbatim prefixes that cause Node v22 `EISDIR` path errors.
- **Strict Content Security Policy (CSP):** Enforces strict execution boundaries (`default-src 'self' ... connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:*`) inside `tauri.conf.json`.

### B. PyTorch CUDA/cuDNN Freezing (`sidecar.spec`)
- **Exhaustive Dependency Harvest:** Replaced ad-hoc `collect_dynamic_libs('torch')` calls with `collect_all('torch')` and automated PEP 420 namespace traversal of `nvidia.*` wheel packages (`nvidia.cudnn`, `nvidia.cuda_runtime`).
- **Zero Missing DLL Crashes:** Bundles all necessary dynamic runtime libraries (including `cudnn_engines_precompiled64_9.dll`) directly into the root `_internal` directory, enabling 100% offline Kokoro-82M speech synthesis on NVIDIA RTX hardware.

### C. Unified Web Audio & TTS Playback Architecture
- **Autoplay Immunity via Shared Context:** WebView2 enforces strict autoplay policies when media plays asynchronously outside a user click handler. Solved by sharing a unified, unlocked `AudioContext` from `frontend/src/audio/soundPlayer.ts` with `useTtsPlayer.ts`.
- **Dual Playback Pipeline:** Decodes backend Kokoro WAV array buffers into native `AudioBuffer`s for gapless, zero-latency Web Audio playback, falling back to `HTMLAudioElement` only when verified via `hasRealAudio`.
- **Narration SFX Shielding:** Automatically suppresses non-critical operation and import completion chimes while Kokoro speech narration is actively running.

### D. Thematic 90-File Procedural Sound System
- **Deterministic Synthesis Engine:** Bundles an offline DSP engine (`tools/sound-design/`) that generates 90 PCM16 48kHz mono WAV files (18 canonical stems $\times$ 5 themes: Omni, Sakura, Spring, Coffee, Cyberpunk) normalized to -3dBFS peak.
- **Settings & Volume Control:** Features an exponential perceptual volume slider (0–100%), master toggle, theme switch sound toggle, and "Preview Motif" signature audition in `SettingsRoute.tsx`.

### E. Ingestion Queue, Deduplication & Onboarding Hygiene
- **Monotonic Progress Tracking:** Standardized stage weights (`ingest: 15%`, `semantic_index: 30%`, `classify: 45%`, `outline: 55%`, `synopsis: 60%`, `synthesis: 70%`, `attribution: 85%`, `done: 100%`), eliminating progress stalling at 35% during Semantic Indexing.
- **SHA-256 Deduplication:** Hashes incoming files and text pastes, raising HTTP 409 conflicts on duplicate imports with an interactive prompt to replace the old version or cancel.
- **First-Run Onboarding Flow:** Auto-detects unconfigured AI providers on fresh launches, guiding users to `/settings?onboarding=true` with a clear explanation and an offline explore bypass option.
- **Research Source Deletion:** Full deletion flow in `ResearchViewerRoute.tsx` for both dossiers and standalone source files, ensuring complete database and semantic chunk cleanup.

---

## 3. Standing Invariants & Rules

1. **Raw Evidence Over Assumptions:** Never report a test or build as passing without executing the command and verifying zero exit codes.
2. **Strict Blast Radius:** Touch only the modules directly required for the task; preserve backward compatibility with existing databases and fixtures.
3. **Node.js Owns SQLite:** The Node.js orchestrator (`better-sqlite3` in WAL mode) is the sole writer to SQLite. Sidecars and frontend interact with the database exclusively via Node REST APIs.
4. **Offline-First Guarantee:** Core application capabilities (model inference, text extraction, speech synthesis, and vector search) must function completely offline without live external network calls when local models are active.
5. **Clean Working Tree:** Keep the working tree clean and all code uncommitted unless explicitly instructed to commit.

---

## 4. Next Session Priority: v1.1 Productization Phase

1. **Welcome Wizard Polish:**
   - Evolve the first-run settings redirect into an interactive, multi-step onboarding wizard.
   - Guide users through downloading local Ollama models (`llama3`, `deepseek-r1`) or validating an OpenRouter API key with instant latency checks.
2. **Synthetic Archive Generation:**
   - Build CLI and automated scripts to pre-generate offline reference archives for public domain literary and technical works.
3. **Distribution & Store Strategy:**
   - Formalize the pipeline for Community Edition (open-source AGPL-3.0-only GitHub releases) versus commercial Windows Store Edition.
4. **Funding & GitHub Sponsors:**
   - Add `.github/FUNDING.yml` and embed an optional, tasteful sponsor button in the Settings and About panels.
