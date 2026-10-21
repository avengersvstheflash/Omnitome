# Omnitome Features & Capabilities

> Complete catalog of ingestion engines, neural compression contracts, speech synthesis, and visual themes.

---

## 🎯 Core Philosophy: "Compression, Not Summarization"

Omnitome differentiates itself from conventional AI reading tools through **loss-bounded, provenance-aware semantic compression**. It does not discard complexity or produce generic high-level summaries; it adaptively compresses source text (~7:1 ratio) while preserving arguments, nuances, and technical precision.

### The Two-Representation Invariant

Omnitome maintains an architectural split between immutable source material and derived syntheses:

| Representation | Placement | Philosophy & Moat |
| :--- | :--- | :--- |
| 📄 **Original Reading** | **Research View** | **Immutable Ground Truth.** The document exactly as uploaded. Nothing in the system modifies or truncates it. Governed by **Law 1: *"Source is paper"*** — calm, neutral typography providing authoritative reference. |
| 🧠 **Omni Reading** | **Library View** | **Derived Reading Lens.** An adaptively synthesized representation (~250–360 words per chapter unit). Governed by **Law 2: *"The lens is tinted"*** and **Law 3: *"Derivation never masquerades as source"*** — every sentence retains deterministic citation backlinks to the source passage. |

### Deterministic Provenance & Grounding
- **Clickable Sentence Citations:** Every claim in an Omni reading links directly to its origin paragraph in the Research dossier.
- **Bi-directional Navigation:** Clicking a citation in Omni view instantly jumps the Research view to the corresponding passage, highlighting the exact supporting text.
- **Source Detached State:** If a heavy source file is purged to conserve disk space, the lightweight Omni reading remains fully intact with an explicit *"Source detached"* status badge.
- **Self-Healing Lifecycle Reconciliation:** Books completing synthesis automatically sync `in_library = 1` and `lifecycle_state = 'active'`, guaranteeing that imported works with generated smart chapters immediately appear in the Library catalog without manual intervention.

---

## 📚 Multi-Format Ingestion Engine

Omnitome features an industrial-grade document ingestion pipeline capable of extracting, normalizing, and structuring complex multi-lingual documents:

| Format | Status | Ingestion Mechanism | Example Fixture Tested |
| :--- | :---: | :--- | :--- |
| **PDF (Text)** | ✅ | Layout-aware PyMuPDF + automatic table-of-contents detection | Reddi *ML Systems* (508K words, 27 ch) |
| **PDF (Scanned/OCR)** | ✅ | Sidecar PaddleOCR fallback triggered on zero-character pages | *Boston Art Annual*, Kaggle Dojo |
| **EPUB** | ✅ | Native XML/XHTML spine parser extracting clean semantic blocks | *Moby Dick*, *Pride and Prejudice*, *Overlord* |
| **DOCX** | ✅ | Python sidecar `python-docx` extraction preserving structural headers | Technical documentation sample |
| **RTF** | ✅ | Python sidecar `striprtf` extraction stripping legacy formatting | Formatted legal brief sample |
| **Markdown** | ✅ | CommonMark AST parser with fast-path and dialogue segmentation | Research transcripts (`chat_11.md`) |
| **Raw Text / Paste** | ✅ | UTF-8 buffer sniffer with paste wizard and mojibake correction | Clipboard buffers, prose snippets |
| **Web Article / URL** | ✅ | Readability parser + automated metadata extractors (arXiv / Gutenberg / IETF) | Academic papers, Wikipedia, Gutenberg texts |
| **Japanese (Aozora / ShiftJIS)** | ✅ | Tier 2 `jschardet` + `AOZORA_HEADING_REGEX` heading normalizer | *Chijin no Ai* (*痴人の愛*, 201K chars) |
| **French / European (UTF-8)** | ✅ | UTF-8 fast-path + C1-aware accent normalization rules | *Les Misérables*, *Monsieur Vénus* |
| **Russian (CP1251 / KOI8-R)** | ✅ | Tier 2 statistical charset detection and Cyrillic block support | Russian classic prose excerpts |
| **Chinese (GB18030 / Big5)** | ✅ | Tier 2 charset + CJK `countWords` calculation ($words = tokens + chars \times 0.7$) | *Daodejing*, *Reverend Insanity* |

### Tier 1 + Tier 2 Statistical Charset Detection
- **Tier 1 Fast Path (<0.3 ms):** Probes for UTF-8 Byte Order Marks (BOM) and clean multi-byte sequences. Standard modern documents incur zero statistical overhead.
- **Tier 2 Statistical Fallback:** Evaluates character distributions using `jschardet` for legacy encodings (Shift-JIS, Windows-1252, GB18030, EUC-KR).
- **F23 Legacy PUA Font Normalizer:** Detects and resolves private-use area (PUA) codepoints common in older mathematical PDFs (such as Adobe Symbol and Mac MathType encodings).

---

## 🧠 Semantic Compression & Editorial Synthesis

Omnitome processes long-form texts into structured, highly readable reading units through a multi-stage editorial pipeline:

1. **Semantic Chunking:** Text is split into 1,500–2,500 word editorial units with 75-word merge-back thresholds to avoid stranded sentence fragments.
2. **Dense Vectorization (BGE-M3):** Computes 1024-dimensional dense vectors using FP16 CUDA acceleration with sequence-bounded attention (2,048 tokens).
3. **Cross-Encoder Reranking (BGE Reranker v2):** Refines candidate passages with input-calibrated dynamic timeouts ($8\text{s}$ to $60\text{s}$) to prevent centroid fallbacks on large chapters.
4. **Range-Contract Synthesis:** Compresses each chapter into an optimal $[250, 360]$ word range (with a strict 500-word ceiling), ensuring consistent pacing across entire volumes.
5. **Dossier Append Pipeline:** Allows appending supplementary materials (web articles, notes, commentary) directly into an existing Research dossier with persistent timeline logging.

---

## 🎙️ Local Neural Text-to-Speech (Kokoro-82M)

Omnitome includes an offline neural audio narration system designed for deep, long-form listening:

- **100% Offline Synthesis & Frozen Sidecar Bundling:** Powered by Kokoro-82M running locally via PyTorch FP16 CUDA (with transparent CPU fallback). Fully verified in offline isolation (`HF_HUB_OFFLINE=1`). Pre-bundles `espeakng_loader` phoneme dictionaries and `spaCy en_core_web_sm` model assets directly into the PyInstaller binary, eliminating runtime pip or web download dependencies.
- **Chapter Title Narration:** Intelligently reads and visually highlights chapter titles prior to the first paragraph, maintaining flawless dual-deck audio queue synchronization.
- **Citation-Only Sentence Resilience:** Generates a synthetic 250ms silence WAV buffer when encountering citation-only sentences (e.g. `[p12]`), preventing audio pipeline stalls without throwing client-side playback exceptions.
- **Curated Neural Voices:** Four expressive, balanced voices preloaded and verified at boot:
  - `af_heart`: Warm, gentle American female voice.
  - `am_adam`: Grounded, authoritative American male voice.
  - `bf_alice`: Crisp, articulate British female voice.
  - `bm_george`: Resonant, literary British male voice.
- **Dual-Deck Gapless Playback:** Preloads and synthesizes adjacent sentence WAV buffers ahead of the playhead, eliminating audio stutter and pause latency.
- **Synchronized Highlighting & Auto-Scroll:** Highlights the sentence currently being narrated in real time and smoothly scrolls the viewport, automatically yielding control if the user manually scrolls.
- **Podcast Auto-Advance Mode (F89):** Seamlessly navigates across chapters upon audio completion, enabling hands-free listening across entire books.
- **Filesystem LRU Audio Cache:** Content-addressed disk cache (`storage/cache/tts/`) with user-configurable disk limits (default 500 MB) and automatic least-recently-used eviction.
- **Lifecycle Idle Eviction:** Sidecar automatically evicts Kokoro weights after 5 minutes of inactivity, freeing ~500 MB of VRAM with a fast ~1.5s reload on next playback.

---

## 🎨 Theme System & Visual Aesthetics

Omnitome's interface follows three strict aesthetic laws:
1. *Source is paper:* The original reading view renders with neutral, book-like typography.
2. *The lens is tinted:* The Omni reading view carries quiet, distinctive thematic styling.
3. *Derivation never masquerades as source:* Every synthesized statement provides unambiguous provenance markers.

### The Five Adaptive Themes
- 🌸 **Sakura:** Gentle cherry blossom palette with light pink accents and refined editorial typography.
- 🌿 **Spring:** Calming sage-green tones with generous whitespace and organic contrast.
- ☕ **Coffee:** Warm sepia and amber hues inspired by antique paper, leather bindings, and corner libraries.
- ⚡ **Cyberpunk:** High-contrast dark mode with glowing neon cyan and magenta accents.
- 🌌 **Omni:** Signature brand theme featuring cosmic deep-violet backdrops and glowing purple sigils.

### Procedural Art & Mathematical Typesetting
- **Procedural Geometric Covers:** Automatically generates unique SVG book covers based on title hashes and theme aesthetics, including distinct "Source Only" and "Empty" status badging for uncompressed source books.
- **KaTeX Mathematical Typesetting:** Renders inline and block math formulas ($E = mc^2$, $\sum_{i=1}^n x_i$) with native LaTeX typography.
- **Universal Full-Screen & Windowed Modes:** Toggle true distraction-free reading with a global <kbd>F11</kbd> hotkey or top-bar UI buttons, complete with automatic two-way state synchronization on <kbd>Esc</kbd>.
- **Theme-Reactive Custom Scrollbars:** Elegant 10px WebKit scrollbars utilizing active theme `--accent` color variables with translucent tracks, rounded padding-box thumbs, and smooth hover feedback.
- **Library Batch Management:** Multi-select checkboxes for bulk book deletion with cascading SQLite foreign-key removal and automatic queue synchronization.
- **Responsive 48px Import Dock:** Persistent right-side collapsible dock displaying active import queues and stage checklists without obstructing reading flow.

---

## 🔒 Privacy, Local-First Storage & Cost Accounting

- **Zero Cloud Dependence:** Works entirely offline with local LLM runtimes (Ollama, LM Studio) and local PyTorch sidecars.
- **SQLite WAL Architecture:** Complete application state resides in a single, high-performance SQLite database (`storage/data.db`) operating in Write-Ahead Log (WAL) mode.
- **Accountant-Model Cost Ledger:** Tracks all token consumption. When using local LLM models, displays actual cost as **$0.00** while showing estimated cloud cost savings.

