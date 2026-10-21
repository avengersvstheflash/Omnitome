# Omnitome Productization Strategy (v1.1 & Beyond)

## Core Philosophy

Omnitome will never sell "features" or cripple the open-source version. The Community edition will always be fully functional and capable. The Store edition sells convenience, curation, and a polished first-run experience for non-technical readers who value their time.

---

## 1. The Two Editions

### Omnitome Community (GitHub)
- **Target Audience:** Developers, enthusiasts, tinkerers, and contributors.
- **Core Engine:** 100% Full functionality. No artificial limits on OCR, TTS, or compression.
- **Onboarding:** Basic setup wizard and minimal starter pack.
- **Monetization:** GitHub Sponsors / "Buy Me a Coffee" (optional donations).

### Omnitome Store Edition (Paid)
- **Target Audience:** Non-technical readers, professionals, and users who want a "just works" experience.
- **Core Engine:** The exact same engine as Community.
- **Onboarding:** Highly polished, interactive guided tour (driver.js or similar) highlighting the UI, citations, and themes.
- **The "Archive Pack":** An expanded, curated library of pre-processed synthetic books so users can experience Omnitome without waiting for an import.
- **Presets:** One-click setup for OpenRouter or Local LLMs with visual step-by-step guides.
- **Monetization:** One-time purchase or "pay what you want" (via Lemon Squeezy, Stripe, or Microsoft Store).

---

## 2. The Synthetic Archive (Testing + Marketing)

We will generate our own original, copyright-free content using LLMs, lay it out programmatically, and intentionally degrade some pages to test our OCR/parsing pipeline.

### The Samples:
- **The Clean Archive:** Pristine document (headings, tables, footnotes) for baseline OCR.
- **The Damaged Archive:** Low-res, faded ink, skewed pages, compression artifacts.
- **The Technical Gauntlet:** Multi-column, formulas, dense tables, diagrams.
- **The Long Chronicle:** A massive original sci-fi/fantasy text to prove 7:1 long-form narrative compression.

### The Secret Weapon:
For every generated PDF, we keep the raw text as "Ground Truth". This allows us to run automated regression tests (comparing OCR output to ground truth) to continuously improve our pipeline.

---

## 3. The "Experience Before Generation" Onboarding

The biggest friction point is making a user wait 5 minutes for their first import.

**The Flow:** Launch App -> Welcome Wizard -> "Click here to read a sample book we prepared earlier" -> User clicks a citation, sees the Source View, and understands the magic -> "Now, connect your AI to process your own books."

---

## 4. Implementation Phasing

- **Phase 1 (v1.0.x):** Stabilize the core desktop app. Fix TTS, UI bugs, and installer. (COMPLETED)
- **Phase 2 (v1.1):** Build the Welcome Wizard, Sound Effects, First-Run API routing, and GitHub Sponsor button. (CURRENT)
- **Phase 3 (v1.2):** Create the Synthetic Archive and implement the "Demo Mode" toggle.
- **Phase 4 (v2.0):** Package the Store Edition.
