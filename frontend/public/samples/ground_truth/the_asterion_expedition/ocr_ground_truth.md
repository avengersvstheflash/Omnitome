# OCR Ground Truth & Image-Rendered Test Page Inventory: *The Asterion Expedition*

**Publisher:** Omnitome Publishing — Synthetic Archive (October 2026 Premium Edition)  
**Target PDF:** `the_asterion_expedition_Premium.pdf`  
**Designated Image-Rendered OCR Test Pages:** **Page 132** (`ocr_test_pages/ocr_page_1.png`) and **Page 133** (`ocr_test_pages/ocr_page_2.png`)  
**Vector Text Count on OCR Pages (Verified via `pypdf`):** `0` chars on Page 132 and `0` chars on Page 133 (Confirming 100% pure raster image embedding; all ordinary book pages retain full selectable vector text)  
**OCR Engine Executed:** Tesseract OCR (`/usr/bin/tesseract` via `pytesseract`) at 300 DPI (`1801 × 2700 px`)  

---

## 1. Summary of Image-Rendered OCR Plates

| Plate ID | Source Image File | PDF Page Number | Physical & Pixel Resolution | Vector Chars on PDF Page | Layout Archetype Tested | Executed Tesseract Word Recall | Executed Sequence Similarity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **OCR-C1** | `ocr_test_pages/ocr_page_1.png` | **Page 132** | 1801×2700 px (300 DPI, 6×9 in) | `0` chars (Pure Raster) | Single-column archival shipboard document facsimile with monospace telemetry headers, body narrative, and mathematical delay-line identity | **92.19%** | **92.65%** |
| **OCR-C2** | `ocr_test_pages/ocr_page_2.png` | **Page 133** | 1801×2700 px (300 DPI, 6×9 in) | `0` chars (Pure Raster) | Two-column technical mission log and compact 72-hour telemetry table testing tabular extraction and multi-column reading order | **90.4%** | **65.07%** |

---

## 2.1 OCR-C1 — Archival OCR Plate I — Recovered Titanium Foil Ledger Facsimile (Single-Column Dispatch) (PDF Page 132)

- **PDF Location:** Page **132** of `the_asterion_expedition_Premium.pdf`
- **Raster Source Image:** `ocr_test_pages/ocr_page_1.png` (`1801 × 2700 px` at 300 DPI)
- **Layout Features Tested:** Single-column archival shipboard document facsimile with monospace telemetry headers, body narrative, and mathematical delay-line identity
- **OCR-Sensitive Notation & Formatting:** Hexadecimal checksums (0x7F3A, 0x00036EE8), prime pulse arrays ([2, 3, 5, 7, 11, 13 ms]), megapascals (403.8 MPa), and acoustic transit equations (14.87 s + 2.13 s = 17.00 s).
- **Executed Tesseract OCR Accuracy:** Word Vocabulary Recall = **92.19%**, Normalized Linear Sequence Similarity = **92.65%** *(Note: Linear sequence similarity reflects horizontal line scanning across side-notes/tables or ASCII mapping of Greek math symbols)*

### Canonical Ground-Truth Text (Exact Expected Extraction)

```text
ARCHIVAL OCR BENCHMARK PLATE I: VANGUARD-3 TITANIUM FOIL LEDGER (SHEET 1 & 7)
VESSEL: Bathyscaphe Vanguard-3 (Registry PED-DSV-03)
LOCATION: Orpheus Caldera, Chimney Nine (Depth 41.20 km // Hydrostatic Load 403.8 MPa)
AUTHORS: Dr. Mara Lin (Chief Geophysicist) & Cdr. Ravi Solano (Commanding Pilot)
EPOCH: 2147-08-20T03:40:00Z (MET 54:10:00)

1. Engineering Certification of the Fluorocarbon Manifold (Annex B)
For the permanent record of the Interplanetary Science Council: the perfluorohexane thermal-ballast manifold calibrated by Dr. Elena Rostova prior to our launch performed with zero leakage across the entire 403.8-megapascal descent. On our mid-water stop at 26.80 kilometers (the Halocline Shelf), we manually unbolted our dorsal emergency crush-beacon using a counter-clockwise manipulator wrench and scribed 'CH-9 // 41.2 // INTACT' in fluorescein silicone grease between Bolts 2 and 3.

2. Piezoelectric Delay-Line Equation of the Silicate Choir
The Orpheus Trench hosts a continuous, planet-scale chemotrophic organo-silicate lattice whose conductive greigite/pyrite (Fe3S4/FeS2) cores are sheathed in piezoelectric barium titanate (BaTiO3). When interrogated at its resonant half-wavelength frequency of 412.0 Hz (lambda = 3.78 m), the lattice buffers the incoming wave across 3,320 meters of internal crystal delay lines before re-emitting our prime-synced Polynesia-7 checksum:
t_total = t_water (14.87 s) + t_choir_buffer (2.13 s) = 17.000 seconds [SYNC: 2-3-5-7-11-13 ms // CRC: 0x7F3A]
```

### Evaluation Answer Key for This OCR Page

- **Q1:** What message did Mara Lin and Ravi Solano scribe onto Vanguard-3's unbolted beacon at 26.80 km? -> 'CH-9 // 41.2 // INTACT' in UV-fluorescent silicone grease between Bolts 2 and 3.
- **Q2:** How does the Silicate Choir produce the exact 17.000-second echo delay? -> 14.87 seconds of acoustic water transit (at 1,560 m/s across 23.2 km) plus 2.13 seconds of internal piezoelectric delay-line buffering across 3,320 meters of BaTiO3/silicate fibers.

### Actual Executed Tesseract OCR Output (`pytesseract` at 300 DPI)

```text
ARCHIVAL OCR BENCHMARK PLATE |  VANGUARD-3 TITANIUM FOIL
FACSIMILE

VESSEL: Bathyscaphe Vanguard-3 (Registry PED-DSV-@3)

LOCATION: Orpheus Caldera, Chimney Nine (Depth 41.20 km // Load
403.8 MPa)

AUTHORS: Dr. Mara Lin (Chief Geophysicist) & Cdr. Ravi Solano
(Pilot)

EPOCH: 2147-@8-20T03:40:Q@0Z (MET 54:10:00)

1. Engineering Certification of the Fluorocarbon Manifold (Annex
B)

For the permanent record of the Interplanetary Science Council: the
perfluorohexane thermal-ballast manifold calibrated by Dr. Elena Rostova
prior to our launch performed with zero leakage across the entire 403.8-
megapascal descent. On our mid-water stop at 26.80 kilometers (the Halocline
Shelf), we manually unbolted our dorsal emergency crush-beacon using a
counter-clockwise manipulator wrench and scribed CH-9 // 41.2 // INTACT
in fluorescein silicone grease between Bolts 2 and 3.

2. Piezoelectric Delay-Line Equation of the Silicate Choir

The Orpheus Trench hosts a continuous, planet-scale chemotrophic organo-

silicate lattice whose conductive greigite/pyrite (Fe,S,/FeS.,) cores are sheathed
in piezoelectric barium titanate (BaTiO,). When interrogated at its resonant

half-wavelength frequency of 412.0 Hz (A = 3.78 m), the lattice buffers the
incoming wave across 3,320 meters of internal crystal delay lines before re-
emitting our prime-synced Polynesia-7 checksum:

Coren = Geers (14.87 s) + “aatie Tnuitiae (2.13 s) = 17.000 seconds

[SYNC: 2-3-5-7-11-13 ms // CRC: 0x7F3A]

Omnitome Synthetic Archive * Volume C OCR Verification Plate | (300 DPI Raster Reference)
```

---

## 2.2 OCR-C2 — Archival OCR Plate II — Two-Column Mission Telemetry & Medical Continuity Manifest (PDF Page 133)

- **PDF Location:** Page **133** of `the_asterion_expedition_Premium.pdf`
- **Raster Source Image:** `ocr_test_pages/ocr_page_2.png` (`1801 × 2700 px` at 300 DPI)
- **Layout Features Tested:** Two-column technical mission log and compact 72-hour telemetry table testing tabular extraction and multi-column reading order
- **OCR-Sensitive Notation & Formatting:** Mission Elapsed Time format (MET 00:00 to MET 71:42:18), hexadecimal timer (0x00036EE8 = MET 62:00:00), and anatomical injury descriptions (left 4th metacarpal fracture vs. right hand Grade 2 frostbite).
- **Executed Tesseract OCR Accuracy:** Word Vocabulary Recall = **90.4%**, Normalized Linear Sequence Similarity = **65.07%** *(Note: Linear sequence similarity reflects horizontal line scanning across side-notes/tables or ASCII mapping of Greek math symbols)*

### Canonical Ground-Truth Text (Exact Expected Extraction)

```text
ARCHIVAL OCR BENCHMARK PLATE II: NEREID-7 MISSION & CONTINUITY MANIFEST
Column 1: Mechanical & Ordnance Forensics
Three 42.0-kg canisters loaded into External Utility Rack C by Specialist Soren Vance carried an internal specific gravity of 6.8 g/cm3 (vs. 4.5 g/cm3 for pure barite), concealing 180-MJ aluminothermic-RDX sterilization charges under Directive Chiaroscuro. At MET 11:48 (11.2 km), Basal Relay Bravo's Channel 14 pyrotechnic bus registered a 0.42-A trickle draw with a local fallback countdown of 0x00036EE8 ms (MET 62:00:00).

Column 2: Crew Medical & EVA Continuity
At MET 27:40 (26.80 km), a 60-knot Halocline soliton bent the starboard manipulator wrist 15 degrees and fractured Dr. Ilyas Corvo's left fourth metacarpal (immobilized in an aluminum-foam volar splint; Corvo operated one-handed with his right hand for Chapters 6-14). At MET 66:52 (19.40 km, 190.1 MPa), Vance exited in the Mark-VIII Hard-Shell Suit to lever Rack C off Ballast Bay 2, sustaining Grade 2 frostbite on his right hand when the falling bracket severed his heater umbilical.

MET Timestamp | Depth (km) | Pressure (MPa) | Power (%) | Critical Mission Event
MET 00:00:00 | 0.00 km | 0.1 MPa | 100.0% | Launch from Borehole Collar Kestrel-Alpha
MET 18:22:00 | 18.00 km | 176.4 MPa | 82.0% | Basal breakout; Tether Alpha severed by clathrate spall
MET 27:40:00 | 26.80 km | 262.6 MPa | 72.0% | Beacon recovered; Corvo left 4th metacarpal fractured
MET 47:05:00 | 41.20 km | 403.8 MPa | 48.0% | Caldera touchdown; 1.8 mm hull contraction jams Bay 2
MET 62:00:00 | 36.78 km | 360.4 MPa | 19.0% | Relay Bravo detonates at 18 km; fault chimney mapped
MET 71:42:18 | 0.00 km | 0.1 MPa | 4.0% | Surface breach & Dual-Representation S-band broadcast
```

### Evaluation Answer Key for This OCR Page

- **Q1:** Contrast the hand injuries sustained by Ilyas Corvo and Soren Vance during Expedition 44-Omega. -> Corvo fractured his left 4th metacarpal at MET 27:40 (26.80 km) from manipulator feedback; Vance suffered Grade 2 frostbite on his right hand at MET 67:05 (19.40 km) when the falling Rack C frame severed his hard-suit heater umbilical.
- **Q2:** What were the depth, pressure, and remaining fuel-cell power at touchdown (MET 47:05) and surface breach (MET 71:42:18)? -> Touchdown: 41.20 km, 403.8 MPa, 48.0% power; Surface breach: 0.00 km, 0.1 MPa, 4.0% power.

### Actual Executed Tesseract OCR Output (`pytesseract` at 300 DPI)

```text
ARCHIVAL OCR BENCHMARK PLATE II e TWO-COLUMN LOG &
TELEMETRY TABLE

Expedition 44-Omega Master Forensic & Telemetry Ledger

1. Ordnance & Pinch Forensics

Three 42.0-kg canisters loaded into
External Utility Rack C by Specialist
Soren Vance carried an_ internal
specific gravity of 6.8 g/cm? (vs. 4.5 g/
cm? for pure barite), concealing 180-
MJ aluminothermic-RDX sterilization
charges under Directive Chiaroscuro.
At MET 11:48 (11.2 km), Basal Relay
Bravo's Channel 14 pyrotechnic bus
registered a 0.42-A trickle draw with a
local fallback countdown of
0x00036EE8 ms (MET 62:00:00).

2. Crew Medical Continuity

At MET 27:40 (26.80 km), a 60-knot
Halocline soliton bent the starboard
manipulator wrist 15° and fractured
Dr. Ilyas Corvo's left fourth metacarpal
(immobilized in an aluminum-foam
volar splint; Corvo operated one-
handed with his right hand for
Chapters 6-14). At MET 66:52 (19.40
km, 190.1 MPa), Vance exited in the
Mark-VII Hard-Shell Suit to lever Rack
C off Ballast Bay 2, sustaining Grade 2
frostbite on his right hand when the
falling bracket severed his heater
umbilical.

Critical Mission Event
Timestamp

0.00 0.1 MPa

90:00:00

MET
18:22:00

MET
27:40:00

MET
47:05:00

MET
62:00:00

MET
71:42:18

100.0%

82.0%

72.0%

48.0%

19.0%

Launch from Borehole Collar Kestrel-
Alpha

Basal breakout; Tether Alpha severed
by clathrate spall

Beacon recovered; Corvo left 4th
metacarpal fractured

Caldera touchdown; 1.8 mm hull
contraction jams Bay 2

Relay Bravo detonates at 18 km; fault
chimney mapped

Surface breach & Dual-
Representation S-band broadcast

Omnitome Synthetic Archive * Volume C OCR Verification Plate II (300 DPI Raster Reference)
```

---
