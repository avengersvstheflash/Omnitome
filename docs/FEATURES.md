# Omnitome Features & Capabilities Catalog

> Technical reference manual for Omnitome's document ingestion engines, semantic compression contracts, neural speech synthesis, procedural acoustics, and visual typography systems.

---

## 🎯 Core Philosophy: "Compression, Not Summarization"

Omnitome differentiates itself fundamentally from conventional generative AI reading tools through **loss-bounded, provenance-aware semantic compression**. Conventional reading tools discard technical arguments and flatten nuance to answer *"what is the gist?"*. Omnitome performs mathematical semantic compression ($\sim 7:1$ target ratio) engineered to preserve distinct concepts, technical arguments, and factual claims while redundant connective syntax is condensed.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        COMPRESSION VS. SUMMARIZATION PARADIGM                          │
├───────────────────────────────────────────┬────────────────────────────────────────────┤
│         STANDARD SUMMARIZATION            │         OMNITOME SEMANTIC COMPRESSION      │
├───────────────────────────────────────────┼────────────────────────────────────────────┤
│ • Discards technical depth & nuances      │ • Retains core theorems, arguments, & steps│
│ • Invents narrative connective tissue      │ • Retains authorial framing & structure    │
│ • Unanchored synthetic prose              │ • Clickable, audited sentence provenance   │
│ • Floating, lossy, unverified text        │ • Loss-bounded range: 250–360 words/unit   │
└───────────────────────────────────────────┴────────────────────────────────────────────┘
```

### The Two-Representation Invariant

Omnitome maintains an architectural boundary separating immutable ground truth from derived reading lenses:

| Representation | Placement | Philosophy & Governance |
| :--- | :--- | :--- |
| 📄 **Original Reading** | **Research View** | **Immutable Ground Truth.** The verbatim document exactly as uploaded. Nothing in the system modifies, truncates, or rewrites it. Governed by **Law 1: *"Source is paper"*** — calm, neutral typography providing authoritative reference. |
| 🧠 **Omni Reading** | **Library View** | **Derived Reading Lens.** An adaptively synthesized representation ($\sim 250–360$ words per chapter unit). Governed by **Law 2: *"The lens is tinted"*** and **Law 3: *"Derivation never masquerades as source"*** — every sentence retains deterministic citation backlinks to the source passage. |

### Deterministic Provenance & Grounding

- **Clickable Sentence-Level Citations:** Every claim in an Omni reading links directly to its origin paragraph in the Research dossier.
- **Bi-directional Navigation:** Clicking a citation in Omni view instantly jumps the Research view to the corresponding passage, highlighting the exact supporting text.
- **Visual Defect Indication:** Any sentence synthesized without verified provenance is rendered in `text-ink-muted` with a dotted underline, providing complete transparency.
- **Source Detached State:** If a heavy source file is purged to conserve disk space, the lightweight Omni reading remains fully intact with an explicit *"Source detached"* status badge.
- **Self-Healing Lifecycle Reconciliation:** Books completing synthesis automatically sync `in_library = 1` and `lifecycle_state = 'active'`, guaranteeing that imported works with generated smart chapters immediately appear in the Library catalog without manual intervention.

---

## 📚 Industrial Multi-Format Ingestion Engine

Omnitome features a high-throughput document ingestion pipeline capable of extracting, normalizing, and structuring complex multi-lingual documents:

| Format | Status | Ingestion Mechanism | Benchmark Fixture Tested |
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
| **Chinese (GB18030 / Big5)** | ✅ | Tier 2 charset + CJK `countWords` calculation ($W_{\text{eff}} = W_{\text{white}} + \sum 0.7$) | *Daodejing*, *Reverend Insanity* |

### Tier 1 + Tier 2 Statistical Charset Detection
- **Tier 1 Fast Path (<0.3 ms):** Probes for UTF-8 Byte Order Marks (BOM) and clean multi-byte sequences. Standard modern documents incur zero statistical overhead.
- **Tier 2 Statistical Fallback:** Evaluates character distributions using `jschardet` for legacy encodings (Shift-JIS, Windows-1252, GB18030, EUC-KR).
- **F23 Legacy PUA Font Normalizer:** Detects and resolves private-use area (PUA) codepoints common in older mathematical PDFs (such as Adobe Symbol and Mac MathType encodings).

---

## 🧠 Semantic Compression & Editorial Synthesis

Omnitome processes long-form texts into structured, highly readable reading units through a multi-stage editorial pipeline:

1. **Semantic Chunking:** Text is split into 1,500–2,500 word editorial units with 75-word merge-back thresholds to avoid stranded sentence fragments, guarded by an 8,000-character ceiling.
2. **Dense Vectorization (BGE-M3):** Computes 1024-dimensional dense vectors using FP16 CUDA acceleration with sequence-bounded attention (2,048 tokens).
3. **Cross-Encoder Reranking (BGE Reranker v2):** Refines candidate passages with input-calibrated dynamic timeouts ($\mathcal{T}_{\text{rerank}} \in [8\text{s}, 60\text{s}]$) to prevent centroid fallbacks on large chapters.
4. **Range-Contract Synthesis:** Compresses each chapter into an optimal $[250, 360]$ word range (dynamic range $[240, 500]$, hard bounds $[150, 500]$ words), ensuring consistent pacing across entire volumes.
5. **Dossier Append Pipeline:** Allows appending supplementary materials (web articles, notes, commentary) directly into an existing Research dossier with persistent timeline logging.

---

## 🎙️ Local Neural Text-to-Speech (Kokoro-82M)

Omnitome includes an offline neural audio narration system designed for deep, long-form listening:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        KOKORO-82M NEURAL SPEECH PIPELINE                              │
├───────────────────┬────────────────────────────────────────────────────────────────────┤
│ 1. Segmentation   │ Sentence-boundary splitting with citation bracket filtering        │
│ 2. Text Normalizer│ Strips citation tags ([p12], [4]); emits 250ms synthetic silence   │
│ 3. Phonemization  │ Local espeakng_loader dictionaries + spaCy en_core_web_sm          │
│ 4. Neural Engine  │ Kokoro-82M ONNX/PyTorch model (FP16 CUDA with CPU fallback)        │
│ 5. Dual-Deck Deck │ Native Web Audio AudioBufferSourceNode prefetching next sentence   │
│ 6. Real-Time Sync │ Sentence highlighting and auto-scroll with manual gesture override │
└───────────────────┴────────────────────────────────────────────────────────────────────┘
```

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

## 🔊 Procedural UI Sound Engine

Omnitome features an offline procedural auditory feedback engine designed to provide tactile, acoustic confirmation of interactions without introducing jarring digital noises or network latency:

- **Mathematical DSP Synthesis:** All 90 WAV audio stems are generated via a deterministic Node.js DSP pipeline (`tools/sound-design/generate.mjs`) employing subtractive FM synthesis, biquad resonant filtering, pink/white noise, ADSR envelope shaping, and -3dBFS peak normalization.
- **Five Bespoke Sound Palettes:** Sound designs mirror the application's visual themes:
  - **Classic:** Warm marimba and organic mallet textures calibrated for calm reading.
  - **Paper:** Fibrous page turns, parchment slides, and tactile card deck clicks.
  - **Terminal:** Retro monochrome CRT blips, resonant square chirps, and telemetry tones.
  - **Soft:** Gentle sine hums, ambient chimes, and smooth micro-damped transients.
  - **Mechanical:** Tactile mechanical switch clacks, heavy latches, and weighted spring detents.
- **18 Semantic Interaction Events:** Comprehensive coverage across the interface:
  - Primary, secondary, ghost, danger, and toggle button clicks (`ui.button.*`).
  - Navigation tabs (`nav.primary.*`) for Library, Research, and Import.
  - Book opening and closing transitions (`library.book.*`).
  - Operation start, completion, and warning cues (`operation.*`, `import.start`).
  - Theme switching motifs (`settings.theme.switch`) playing the signature audio motif of the incoming theme.
- **Pure Web Audio API Playback:** Stems are preloaded on application boot into native memory (`AudioBuffer`) via `preloadUiSounds()`, completely eliminating disk read pauses, garbage collection hiccups, and playback jitter.
- **Shared AudioContext Architecture:** Unlocks a single master `AudioContext` on first user gesture across both UI sound effects (`soundPlayer.ts`) and neural speech synthesis (`useTtsPlayer.ts`), permanently neutralizing WebView2 and modern browser autoplay restrictions.
- **Narration Ducking & User Controls:** Automatically suppresses operational sound effects while Kokoro neural voice narration is active. Includes master volume attenuation (0.0 to 1.0) and global mute toggles in user settings.

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
- **Auto-Minimizing Import Drawer with Hover Immunity:** Persistent bottom-right drawer (`PersistentImportWidget.tsx`) that automatically expands during batch ingestion to show monotonic stage progress. Upon task completion, it begins a 3-second auto-collapse countdown into a compact pill, equipped with hover immunity (`onMouseEnter` pauses timer, `onMouseLeave` resumes) to prevent accidental collapse during inspection.

---

## 🚀 First-Run Onboarding, Welcome Wizard & Ingestion Hygiene

Omnitome v1.1 introduces a comprehensive, multi-step onboarding wizard, the Synthetic Archive starter library, and robust catalog maintenance tools:

- **v1.1 Welcome Wizard (5-Step Onboarding):**
  - *Step 1 — Welcome:* Introduces Omnitome's core philosophy ("Loss-bounded semantic compression, not summarization; Navigable provenance").
  - *Step 2 — Theme Selection:* Live palette switcher across all 5 themes (`omni`, `sakura`, `spring`, `coffee`, `cyberpunk`) with instant auditory theme motif playback.
  - *Step 3 — Connect AI:* Flexible connection to cloud inference via OpenRouter (with custom API key and model selection defaulting to `deepseek/deepseek-v4-flash`) or local inference via Ollama (`http://127.0.0.1:11434/v1`) and LM Studio.
  - *Step 4 — Starter Pack:* 1-click batch installation of 6 pre-formatted Synthetic Archive titles.
  - *Step 5 — Ready to Read:* Sound-confirmed transition into the populated Library catalog.
- **Synthetic Archive Starter Pack (6 Curated Volumes):**
  - Bundles 6 foundational works pre-formatted for Omnitome's provenance engine: *The Curious World of Cats* (Omnitome Publishing), *The Art and Science of Reading* (Omnitome Publishing), *The Asterion Expedition* (Omnitome Publishing), *Machine Learning Field Notes* (Omnitome Publishing), *The Making of Omnitome* (The Omnitome Engineering Team), and *The Omnitome Field Guide* (Omnitome Publishing).
  - **4-Layer Attribution Defense:** Maximizes metadata attribution fidelity even across atypical PDF titles (verified across 10/10 corpus gate fixtures):
    1. *Parser Info Extraction:* Reads embedded PDF Info dictionary fields (`author`, `title`).
    2. *Bibliographer Heuristics:* Comprehensive regex parser supporting middle initials and generational suffixes.
    3. *Database Self-Healing:* Automatic startup and migration backfill query in SQLite repairing any mismatched historical records.
    4. *Client Fallback Attributor:* Explicit metadata forwarding during onboarding batch injection.
- **Non-Blocking Offline Exploration:** Users who wish to read without configuring an AI can click the prominent *"Skip for now (Explore offline)"* button, granting immediate access to the Library to inspect verbatim documents and existing structured extracts.
- **Cryptographic SHA-256 Deduplication:** When importing documents or pasting raw text, the ingestion pipeline computes a SHA-256 digest of the content. If an identical document already exists in the SQLite repository, Omnitome prompts the user with an explicit decision modal: replace the existing record or abort the import.
- **Live Chapter Filtering & Search:** A responsive search input in `BookDetailsRoute` allows readers to instantly filter chapter lists by title or index in real time, essential for navigating large multi-volume works (e.g. 500K-word texts with 30+ chapters).
- **One-Click Re-Synthesis Queueing:** If a chapter synthesis was interrupted or fell back to heuristic compression due to upstream LLM timeouts, a prominent *"Re-synthesize all"* button resets generated chapters and re-enqueues them with fresh vector context.
- **Research Dossier & Source Deletion:** Users can directly purge individual dossiers or uncompressed standalone research documents from the `ResearchViewerRoute` toolbar with cascade removal of associated SQLite chunks.

---

## 🔒 Privacy, Local-First Storage & Cost Accounting

- **Zero Cloud Dependence (Local Mode):** Works entirely offline with local LLM runtimes (Ollama, LM Studio) and local PyTorch sidecars. Zero data leaves your machine. When cloud synthesis is configured via OpenRouter, document chunks are sent exclusively to your selected endpoint.
- **SQLite WAL Architecture:** Complete application state resides in a single, high-performance SQLite database (`storage/data.db`) operating in Write-Ahead Log (WAL) mode.
- **Accountant-Model Cost Ledger:** Tracks all token consumption. When using local LLM models, displays actual cost as **$0.00** while showing estimated cloud cost savings.
