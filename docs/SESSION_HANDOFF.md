# Omnitome — Session Handoff

> Last updated: 2026-10-24 (Post-v1.1.0 Release: Desktop Packaging, Neural TTS, Welcome Wizard, Synthetic Archive & Oct 24 Bug Bash)  
> Repository: github.com/avengersvstheflash/Omnitome  
> Purpose: Full orientation in one turn for any incoming assistant or engineer.

---

## 1. Current State

- **Active Release:** `v1.1.0 Stable`
- **Current HEAD:** (release prep commit)
- **Working Tree:** Clean / synced with `origin/main`
- **Application Status:** Fully packaged Windows installer (`.exe`), verified end-to-end (Neural TTS + 90-Stem Thematic UI Sound Engine + 5-Step Welcome Wizard + Ingestion Pipeline + 6-Book Synthetic Archive Starter Pack: *The Curious World of Cats*, *The Art and Science of Reading*, *The Asterion Expedition*, *Machine Learning Field Notes*, *The Making of Omnitome*, *The Omnitome Field Guide*).
- **Test Suites Status:** 61 Unit & Regression Suites | 17 Rust Supervisor Tests | 10/10 Corpus Gate
  - **Procedural Sound Engine:** 90 / 90 files verified (`npm run sounds:test`, `npm run sounds:verify`)
  - **Frontend (Vite + React):** TypeScript check (`tsc --noEmit`) and production build pass with 0 errors (`npm --prefix frontend run build`)
  - **Rust Supervisor (Tauri v2):** 17 / 17 Cargo unit tests (`cargo test --manifest-path src-tauri/Cargo.toml`)
  - **Backend (Node.js Express 5):** 61 Unit & Regression Suites (60 regression suites + 1 network suite, `npm test`)
  - **Corpus Release Gate (F42):** 10 / 10 multi-format fixtures (Classes A, B, C)
  - **Dossier & Queue Integration:** 10 / 10 pipeline tests (`node backend/tests/import_queue_pipeline_test.js`)
  - **Sidecar TTS Integration:** 10 / 10 tests (`node backend/tests/f85_kokoro_tts_sidecar_test.js`)
  - **v1.0.1 Polish & Deduplication:** 4 / 4 test groups (`node backend/tests/v101_polish_verification_test.js`)
- **License:** AGPL-3.0-only (Public) / Commercial-ready dual licensing

### Recent Commit Trail
- `6c723a3` — fix(v1.1): auto-minimize import drawer and harden synthetic archive author attribution
- `f7fc932` — fix(v1.1): resolve playtest bugs (onboarding 400, queue blanking, research lock, TTS abort, bibliographer regex, CSP)
- `b31d95f` — fix(onboarding): remove backend default seeders and wire StepStarterPack to the 6 Synthetic Archive books
- `c1dc70b` — feat(onboarding): generate synthetic archive PDFs and wire Starter Pack installation
- `8a9eab2` — feat(onboarding): implement v1.1 Welcome Wizard, SoundStore, and Theme Catalog
- `a7a25e4` — docs: add GitHub Sponsors funding config and Productization Strategy
- `e25b9e2` — docs: comprehensive v1.0.2 session close-out, handoff, and feature updates
- `77c5906` — fix(frontend): resolve TTS AudioContext autoplay, wire missing SFX, and fix onboarding redirect
- `dac217a` — feat(release): v1.0.1 TTS cudnn fix, UX polish, and 90-file thematic UI sound system

---

## 2. Bug Bash Resolution Status (Oct 24 Sprint — All Closed)

All P0 and P1 defects identified during the v1.1 playtest cycle have been resolved, verified, and closed:

| Bug ID / Area | Severity | Root Cause | Resolution | Status |
| :--- | :---: | :--- | :--- | :---: |
| **Starter Pack Upload 400** | P0 | Multi-file payload posted to single-item `/api/import/queue` | Re-routed to multipart `/api/import/queue/files` with `FormData` | **CLOSED** |
| **Import Queue Blanking Race** | P0 | Zustand store overwritten with empty arrays during TanStack Query background refetches | Monotonic task state reconciliation preserving in-flight tasks until terminal states | **CLOSED** |
| **Research Viewer Chapter Lock** | P0 | Circular `useEffect` dependency loop resetting scroll container to chapter 1 | Decoupled nav param updates from internal scroll tracking via ref guards | **CLOSED** |
| **TTS DOMException AbortError** | P1 | Rapid pause/seek rejecting `play()` promises without handled cancellation | Explicit `AbortError` / `DOMException` error catch guards in `useTtsPlayer.ts` | **CLOSED** |
| **Bibliographer Regex & Info** | P1 | Regex failing on initials and generational suffixes ("Loyd L. Fueston, Jr."); omitted PDF dictionary Info | Enhanced regex parser + added native PyMuPDF/PDF.js metadata extraction | **CLOSED** |
| **Synthetic Archive Attribution** | P1 | Missing author attribution on certain pre-rendered starter books | Deployed 4-layer attribution defense (Parser info, Bibliographer, DB self-healing, client fallback) | **CLOSED** |
| **Import Drawer Auto-Minimize** | P2 | Queue drawer stayed open after import completion or snapped shut abruptly | Auto-collapse after 3s on queue completion with hover immunity pausing the timer | **CLOSED** |

---

## 3. Operational Hazards & Known Artifacts

### ⚠️ Known Dev-Mode Artifact: Slow TTS Boot Times in `tauri:dev`
- **Behavior:** In local development mode (`npm run tauri:dev`), the first audio synthesis request after application launch may experience an initial latency spike of 8–15 seconds before speech plays.
- **Root Cause (Hardware Baseline):** On machines with 4 GB VRAM (e.g., RTX 3050 mobile baseline), running Vite HMR, Tauri IPC, the BGE-M3 1024d embedder, and Kokoro-82M concurrently causes PyTorch memory contention and CUDA stream initialization delays.
- **Production Status:** In production builds (`tauri build`), lazy loading ensures only BGE-M3 warms at boot, and Kokoro initializes rapidly (~1.5s). The F43 `LifecycleManager` evicts idle models after their TTL (300s for TTS), cleanly reclaiming 3.2 GB of VRAM.
- **Action for Developers:** Do not attempt to force all models to warm simultaneously during dev sessions; allow lazy loading to execute naturally.

---

## 4. Key Architecture & Milestone Solutions

### A. NSIS Packaging & 7z Compression Architecture (v1.0.0 – v1.1.0)
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

### D. Thematic 90-File Procedural Sound System & Welcome Wizard
- **Deterministic Synthesis Engine:** Bundles an offline DSP engine (`tools/sound-design/`) that generates 90 PCM16 48kHz mono WAV files (18 canonical stems $\times$ 5 themes: Omni, Sakura, Spring, Coffee, Cyberpunk) normalized to -3dBFS peak.
- **5-Step Onboarding Wizard:** Welcome orientation, live theme selection with auditory feedback, AI provider pairing (OpenRouter / local Ollama / LM Studio), 1-click Synthetic Archive installation (6 volumes: *The Curious World of Cats*, *The Art and Science of Reading*, *The Asterion Expedition*, *Machine Learning Field Notes*, *The Making of Omnitome*, *The Omnitome Field Guide*), and graceful entry into the Library.

---

## 5. Standing Invariants & Rules

1. **Raw Evidence Over Assumptions:** Never report a test or build as passing without executing the command and verifying zero exit codes.
2. **Strict Blast Radius:** Touch only the modules directly required for the task; preserve backward compatibility with existing databases and fixtures.
3. **Node.js Owns SQLite:** The Node.js orchestrator (`better-sqlite3` in WAL mode) is the sole writer to SQLite. Sidecars and frontend interact with the database exclusively via Node REST APIs.
4. **Offline-First Guarantee:** Core application capabilities (model inference, text extraction, speech synthesis, and vector search) must function completely offline without live external network calls when local models are active.
5. **Clean Working Tree:** Keep the working tree clean and all code uncommitted unless explicitly instructed to commit.

---

## 6. Next Session Priorities: v1.2 Roadmap

1. **F55 — Domain-Aware Structure Engine:**
   - Implement intelligent, document-type-adaptive table-of-contents extraction.
   - Differentiate parsing strategies for academic papers (Abstract, Methods, Results), legal briefs (Statutes, Holdings, Analysis), technical API specs, and multi-part literature.
2. **Cross-Platform Readiness (macOS / Linux):**
   - Audit sidecar build recipes for Linux AppImage / Debian `.deb` and macOS `.dmg` (Universal binary).
   - Evaluate CPU-only Kokoro fallback latencies on non-CUDA environments.
3. **Store Packaging & Code Signing:**
   - Configure EV code signing certificates for Windows SmartScreen trust.
   - Prepare Microsoft Store submission assets.
