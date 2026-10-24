# Omnitome — Continuity

> **Purpose.** If the current strategic-partner chat (or its model) becomes
> unavailable, any fresh capable model reading this file plus
> `SESSION_HANDOFF.md` and `PRODUCT_VISION.md` is fully oriented.
> Read in 60 seconds. Act in the next turn.

---

## Where the project is right now

**Repo:** https://github.com/avengersvstheflash/Omnitome
**Release:** `v1.1.0 Stable`
**HEAD:** (check with `git log -1 --oneline`)
**Test suite:** 61 Unit & Regression Suites | 17 Rust Supervisor Tests | 10/10 Corpus Gate (plus 90 procedural audio stems verified). Verify with `npm test`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `npm run sounds:test`.
**Vision:** Loss-bounded semantic compression engine (~7:1 ratio), not a summarizer. See `PRODUCT_VISION.md`.

**Working now:**
- Universal multi-format ingestion (PDF layout-aware & OCR, EPUB, DOCX, RTF, Markdown, Web, plain text with statistical charset detection)
- FastAPI Python sidecar (`127.0.0.1:8765`) running PyTorch FP16 CUDA acceleration for BGE-M3 (1024d) and BGE Reranker v2
- Kokoro-82M offline neural voice narration (`POST /v1/tts/synthesize`) with dual-deck gapless playback, sentence highlighting, and podcast auto-advance
- Loss-bounded progressive Smart Chapter compression with interactive sentence-level citations linking directly back to verbatim source paragraphs
- Self-healing library lifecycle reconciliation guaranteeing imported books with synthesized smart chapters immediately populate the Library catalog
- Tauri v2 native desktop shell (Rust supervisor, child process tree management, dynamic port allocation, 3D animated CSS splash screen, and 7z LZMA extraction to `%LOCALAPPDATA%\Omnitome\sidecar\`)
- 5 custom visual themes (Omni, Sakura, Spring, Coffee, Cyberpunk), procedural SVG cover generation, and native KaTeX math typesetting
- 90-stem procedural Web Audio UI sound engine across all 5 themes with narration ducking
- 5-step Welcome Wizard with theme auditioning, AI provider setup (OpenRouter / Ollama), and 1-click Synthetic Archive installation
- 6 curated Synthetic Archive starter books (*The Curious World of Cats*, *The Art and Science of Reading*, *The Asterion Expedition*, *Machine Learning Field Notes*, *The Making of Omnitome*, *The Omnitome Field Guide*) backed by 4-layer author attribution defense
- Auto-minimizing import drawer with monotonic progress tracking and hover immunity

**Current milestone & immediate focus:**
- **v1.1.0 Released:** Desktop packaging, Kokoro TTS integration, onboarding wizard, synthetic archive, and bug bash complete.
- **Next Action Items (v1.2+ Roadmap):**
  1. **F55 — Domain-Aware Structure Engine:** Content-adaptive TOC extraction for papers, legal briefs, technical docs, and prose.
  2. **Cross-Platform Packaging (macOS / Linux):** Sidecar recipes for Linux AppImage / deb and macOS Universal binary.
  3. **Windows Code Signing:** Configure EV certificate for SmartScreen trust.

## How we work

**Standard:** Confidence through raw evidence. Every claim verified against
actual CLI execution and stdout/stderr. No commits on dirty tree or failing tests.
Strict blast radius: touch only modules directly required for the fix, maintaining
backward compatibility with existing databases and fixtures.

**Core working files:**
- `docs/SESSION_HANDOFF.md` — current state, recent commit trail, standing invariants, next steps
- `docs/PRODUCT_VISION.md` — north star (compression, two-representation invariant)
- `docs/FEATURES.md` — complete feature catalog and operational details
- `docs/BENCHMARKS.md` — empirical throughput and historical development milestones

**Read these on orientation:**
1. This file (`docs/CONTINUITY.md`)
2. `docs/SESSION_HANDOFF.md` — where we are, recent commits, standing invariants, next steps
3. `docs/PRODUCT_VISION.md` — the north star
4. `docs/FEATURES.md` — system feature specifications

## Tools & Runtimes

- **Tauri v2 / Rust:** Native desktop container and child-process supervisor
- **Node.js 22 LTS (Express 5):** Sole writer to SQLite (`better-sqlite3` in WAL mode) via F65 await barrier
- **Python 3.10+ / FastAPI:** PyTorch FP16 CUDA sidecar with automated idle VRAM eviction
- **Vite + React (TypeScript):** Desktop frontend with TanStack Query and Lucide icons

## Guardrails

- `npm test` and `cargo test --manifest-path src-tauri/Cargo.toml` must stay 100% green through every commit.
- Node.js orchestrator is the SOLE writer to SQLite (`better-sqlite3` in WAL mode). Sidecars and frontend interact exclusively via Node APIs.
- Raw output over paraphrase in every report.
- Never commit `.env`, API keys, or large binary model weights.
- Offline-first resilience: local features must never depend on active network connections when local models are installed.

## If the chat is lost

1. Open fresh chat with any capable model.
2. Paste: *"Read docs/CONTINUITY.md, docs/SESSION_HANDOFF.md, and docs/PRODUCT_VISION.md. Confirm orientation. Tell me what phase is next and what to fire."*
3. The fresh model orients in one turn and is ready to work.

---

*End of continuity doc. Updated 2026-10-24 for v1.1.0 release.*
