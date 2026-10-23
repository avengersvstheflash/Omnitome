# OCR Ground Truth & Image-Rendered Test Page Inventory: *The Curious World of Cats*

**Publisher:** Omnitome Publishing — Synthetic Archive (October 2026 Premium Edition)  
**Target PDF:** `the_curious_world_of_cats_Premium.pdf`  
**Designated Image-Rendered OCR Test Pages:** **Page 93** (`ocr_test_pages/ocr_page_1.png`) and **Page 94** (`ocr_test_pages/ocr_page_2.png`)  
**Vector Text Count on OCR Pages (Verified via `pypdf`):** `0` chars on Page 93 and `0` chars on Page 94 (Confirming 100% pure raster image embedding; all ordinary book pages retain full selectable vector text)  
**OCR Engine Executed:** Tesseract OCR (`/usr/bin/tesseract` via `pytesseract`) at 300 DPI (`1801 × 2700 px`)  

---

## 1. Summary of Image-Rendered OCR Plates

| Plate ID | Source Image File | PDF Page Number | Physical & Pixel Resolution | Vector Chars on PDF Page | Layout Archetype Tested | Executed Tesseract Word Recall | Executed Sequence Similarity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **OCR-A1** | `ocr_test_pages/ocr_page_1.png` | **Page 93** | 1801×2700 px (300 DPI, 6×9 in) | `0` chars (Pure Raster) | Conventional single-column natural-history book page with running header, section heading, body paragraphs, and displayed dental formula | **94.83%** | **63.66%** |
| **OCR-A2** | `ocr_test_pages/ocr_page_2.png` | **Page 94** | 1801×2700 px (300 DPI, 6×9 in) | `0` chars (Pure Raster) | Composite page featuring a left marginal field side-note, main explanatory paragraph, compact 5-clade palaeogenetic data table, and figure/table caption | **97.2%** | **57.66%** |

---

## 2.1 OCR-A1 — Archival OCR Plate I — Conventional Single-Column Monograph Page (PDF Page 93)

- **PDF Location:** Page **93** of `the_curious_world_of_cats_Premium.pdf`
- **Raster Source Image:** `ocr_test_pages/ocr_page_1.png` (`1801 × 2700 px` at 300 DPI)
- **Layout Features Tested:** Conventional single-column natural-history book page with running header, section heading, body paragraphs, and displayed dental formula
- **OCR-Sensitive Notation & Formatting:** Dental formula fraction notation (I 3/3, C 1/1, P 3/2, M 1/1 = 30), Greek psi pseudogene symbol (ψTas1r2), degree Celsius symbols (38.5°C), and scientific binomial italics (Felis lybica, Felis catus).
- **Executed Tesseract OCR Accuracy:** Word Vocabulary Recall = **94.83%**, Normalized Linear Sequence Similarity = **63.66%** *(Note: Linear sequence similarity reflects horizontal line scanning across side-notes/tables or ASCII mapping of Greek math symbols)*

### Canonical Ground-Truth Text (Exact Expected Extraction)

```text
ARCHIVAL OCR BENCHMARK PLATE I: CRANIAL OSTEOLOGY AND METABOLIC HYPERCARNIVORY
Omnitome Synthetic Archive • Volume A Supplementary Insert

1. Craniodental Specialization in Felis catus
Across all forty-one extant species of the family Felidae, the shortening of the facial rostrum and reduction of the post-carnassial molar arcade reflect an uncompromising evolutionary commitment to vertebrate predation. In the adult domestic cat (Felis catus) and its Near Eastern progenitor (Felis lybica), the permanent dental formula is strictly conserved at thirty teeth:
Dental Formula: I 3/3, C 1/1, P 3/2, M 1/1 (x 2 = 30 teeth)

The upper third premolar (P3) and lower first molar (M1) form the sectorial carnassial shear. Because the feline temporomandibular joint is a tight cylindrical hinge encased by deep bony processes, lateral chewing excursion is eliminated, concentrating masseter and temporalis force along a vertical scissor plane capable of severing avian tendons and rodent cervical vertebrae.

2. Enzymatic Rigidity and the Sweet-Receptor Pseudogene (psi-Tas1r2)
Unlike facultative carnivores such as the domestic dog (Canis familiaris), the feline liver maintains constitutively high activity of transaminases and deaminases regardless of dietary protein intake. Furthermore, a 247-base-pair microdeletion in exon 3 of the Tas1r2 gene renders the mammalian T1R2/T1R3 sweet taste receptor non-functional (Li et al., 2005), while leaving the T1R1/T1R3 umami receptor tuned to L-amino acids and purine nucleotides at prey body temperature (35°C to 38.5°C).
```

### Evaluation Answer Key for This OCR Page

- **Q1:** What is the permanent adult dental formula of Felis catus and which teeth form the carnassial shear? -> I 3/3, C 1/1, P 3/2, M 1/1 = 30 teeth; the upper third premolar (P3) and lower first molar (M1).
- **Q2:** What genetic alteration disables sweet taste perception in cats? -> A 247-base-pair microdeletion in exon 3 of the Tas1r2 gene (psi-Tas1r2).

### Actual Executed Tesseract OCR Output (`pytesseract` at 300 DPI)

```text
ARCHIVAL OCR BENCHMARK PLATE | ¢ SINGLE-COLUMN NATURAL
HISTORY MONOGRAPH

1. Craniodental Specialization in Felis catus

Across all forty-one extant species of the family Felidae, the shortening of the
facial rostrum and reduction of the post-carnassial molar arcade reflect an
uncompromising evolutionary commitment to vertebrate predation. In the
adult domestic cat (Felis catus) and its Near Eastern progenitor (Felis lybica),
the permanent dental formula is strictly conserved at thirty teeth:

| Dental Formula: 13/3, C1/1, P3/2, M1/1 (x 2 =30 teeth)

The upper third premolar (P) and lower first molar (M,) form the sectorial

carnassial shear. Because the feline temporomandibular joint is a tight
cylindrical hinge encased by deep bony processes, lateral chewing excursion is
eliminated, concentrating masseter and temporalis force along a vertical
scissor plane capable of severing avian tendons and rodent cervical vertebrae.

2. Enzymatic Rigidity and the Sweet-Receptor Pseudogene
(wTasir2)

Unlike facultative carnivores such as the domestic dog (Canis familiaris), the
feline liver maintains constitutively high activity of transaminases and
deaminases regardless of dietary protein intake. Furthermore, a 247-base-pair
microdeletion in exon 3 of the Tasir2 gene renders the mammalian T1R2/T1R3
sweet taste receptor non-functional (Li et al., 2005), while leaving the T1R1/
T1R3 umami receptor tuned to L-amino acids and purine nucleotides at prey
body temperature (35°C to 38.5°C).

Omnitome Synthetic Archive * Volume A OCR Verification Plate | (300 DPI Raster Reference)
```

---

## 2.2 OCR-A2 — Archival OCR Plate II — Marginal Side-Note, Caption, and Comparative Data Table (PDF Page 94)

- **PDF Location:** Page **94** of `the_curious_world_of_cats_Premium.pdf`
- **Raster Source Image:** `ocr_test_pages/ocr_page_2.png` (`1801 × 2700 px` at 300 DPI)
- **Layout Features Tested:** Composite page featuring a left marginal field side-note, main explanatory paragraph, compact 5-clade palaeogenetic data table, and figure/table caption
- **OCR-Sensitive Notation & Formatting:** Roman numerals (Clade I–V), mitochondrial haplotype codes (IV-A, IV-C), frequency ranges (48 Hz–85 kHz), and multi-column table alignment with marginal side-note separation.
- **Executed Tesseract OCR Accuracy:** Word Vocabulary Recall = **97.2%**, Normalized Linear Sequence Similarity = **57.66%** *(Note: Linear sequence similarity reflects horizontal line scanning across side-notes/tables or ASCII mapping of Greek math symbols)*

### Canonical Ground-Truth Text (Exact Expected Extraction)

```text
ARCHIVAL OCR BENCHMARK PLATE II: PHYLOGEOGRAPHY AND SENSORY THRESHOLDS
FIELD MARGIN NOTE: Key Diagnostic Rule — Only Clade IV (Felis lybica) exhibits the calm hypothalamic-pituitary-adrenal (HPA) stress profile required for Neolithic granary commensalism; Clade I (European F. silvestris) remains hyper-defensive even when hand-reared.

Palaeogenetic Clade Architecture (Driscoll et al., 2007; Ottoni et al., 2017)
Mitochondrial ND5/ND6 sequencing across 979 wild and domestic felids partitions Felis silvestris sensu lato into five phylogeographic clades. Ancient DNA from 209 archaeological remains confirms two dispersal waves: Wave 1 (IV-A) from Neolithic Anatolia (~8000-4400 BCE) and Wave 2 (IV-C) from Classical Egypt (~1500 BCE - 500 CE).

Clade | Taxonomic Subspecies | Geographic Distribution | Domestication Contribution
Clade I | Felis silvestris silvestris | Europe & Scotland | None (occasional hybrid introgression)
Clade II | Felis lybica cafra | Southern Africa | None (diverged ~131,000 years ago)
Clade III | Felis lybica ornata | Central Asia & India | None (secondary trade admixture only)
Clade IV | Felis lybica lybica | Near East & North Africa | Sole maternal ancestor (IV-A to IV-E)
Clade V | Felis bieti | Tibetan Plateau Margin | None (distinct alpine lineage)

Table OCR-A2.1: Comparative phylogeography of the five wildcat clades and their maternal contribution to modern Felis catus.
```

### Evaluation Answer Key for This OCR Page

- **Q1:** Which wildcat clade is the sole maternal ancestor of modern domestic cats, and which two subclades drove Wave 1 and Wave 2 dispersal? -> Clade IV (Felis lybica lybica); subclade IV-A (Anatolia) and subclade IV-C (Egypt).
- **Q2:** According to the marginal field note, why did Clade I fail to undergo domestication? -> Clade I (European F. silvestris) remains hyper-defensive even when hand-reared, lacking Clade IV's calmer HPA stress profile.

### Actual Executed Tesseract OCR Output (`pytesseract` at 300 DPI)

```text
ARCHIVAL OCR BENCHMARK PLATE II ¢ SIDE-NOTE & STRUCTURED
TABLE LAYOUT

FIELD MARGIN NOTE

Key Diagnostic Rule:
Only Clade IV (Felis
lybica) exhibits the calm
hypothalamic-pituitary-
adrenal (HPA) stress
profile required for
Neolithic granary
commensalism; Clade |
(European F. silvestris)
remains hyper-defensive
even when hand-reared.

Palaeogenetic Clade Architecture

Mitochondrial ND5/ND6 sequencing across 979
wild and domestic felids (Driscoll et al. 2007)
partitions Felis silvestris sensu lato into five
phylogeographic clades. Ancient DNA from 209
archaeological remains (Ottoni et al, 2017)
confirms two dispersal waves: Wave 1 (IV-A) from
Neolithic Anatolia (~8000-4400 BCE) and Wave 2
(IV-C) from Classical Egypt (~1500 BCE-500 CE).

Taxonomic Geographic Domestication Contribution
Subspecies Distribution

CladeI Felis silvestris
silvestris

Clade Felis lybica cafra
II

Clade Felis lybica ornata
Ill

Clade Felis lybica lybica
IV

Clade V_ Felis bieti

Europe & Scotland None (occasional hybrid
introgression)

Southern Africa None (diverged ~131,000 years
ago)

Central Asia & India None (secondary trade
admixture only)

Near East & North Sole maternal ancestor (IV-A
Africa to IV-E)

Tibetan Plateau None (distinct alpine lineage)
Margin

Table OCR-A2.1: Comparative phylogeography of the five wildcat clades and their
maternal contribution to modern Felis catus.

Omnitome Synthetic Archive * Volume A OCR Verification Plate II (300 DPI Raster Reference)
```

---
