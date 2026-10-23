#!/usr/bin/env node
/**
 * tools/process_samples.mjs
 *
 * Processes and organizes the Omnitome Synthetic Archive into frontend/public/samples:
 * - Copies 6 core markdown books to frontend/public/samples/md/
 * - Copies 6 clean PDFs to frontend/public/samples/clean/
 * - Copies 4 OCR plate PDFs to frontend/public/samples/ocr/
 * - Generates degraded PDF versions using pdf-lib (1.5° rotation, faint gray wash, random artifacts)
 *   and saves to frontend/public/samples/degraded/
 * - Copies ground truth markdown files to frontend/public/samples/ground_truth/
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, rgb, degrees } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const DEFAULT_ARCHIVE_PATH = 'C:\\Users\\Godsa\\OneDrive\\Desktop\\Omnitome_Synthetic_Archive_Publication_Ready';
const archivePath = process.argv[2] || process.env.ARCHIVE_PATH || DEFAULT_ARCHIVE_PATH;

const OUT_DIR = path.resolve(ROOT, 'frontend', 'public', 'samples');
const MD_DIR = path.join(OUT_DIR, 'md');
const CLEAN_DIR = path.join(OUT_DIR, 'clean');
const OCR_DIR = path.join(OUT_DIR, 'ocr');
const DEGRADED_DIR = path.join(OUT_DIR, 'degraded');
const GROUND_TRUTH_DIR = path.join(OUT_DIR, 'ground_truth');

const TARGET_MD_FILES = new Set([
  'the_curious_world_of_cats.md',
  'the_art_and_science_of_reading.md',
  'the_asterion_expedition.md',
  'machine_learning_field_notes.md',
  'The_Making_of_Omnitome.md',
  'The_Omnitome_Field_Guide.md',
]);

const TARGET_CLEAN_PDFS = new Set([
  'the_curious_world_of_cats_Publication_Edition.pdf',
  'the_art_and_science_of_reading_Publication_Edition.pdf',
  'the_asterion_expedition_Publication_Edition.pdf',
  'machine_learning_field_notes_Publication_Edition.pdf',
  'The_Making_of_Omnitome.pdf',
  'The_Omnitome_Field_Guide.pdf',
]);

const TARGET_OCR_PDFS = new Set([
  'the_curious_world_of_cats_OCR_Test_Plates.pdf',
  'the_art_and_science_of_reading_OCR_Test_Plates.pdf',
  'the_asterion_expedition_OCR_Test_Plates.pdf',
  'machine_learning_field_notes_OCR_Test_Plates.pdf',
]);

function ensureDirs() {
  [OUT_DIR, MD_DIR, CLEAN_DIR, OCR_DIR, DEGRADED_DIR, GROUND_TRUTH_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function findFilesRecursive(dir) {
  let results = [];
  if (!fs.existsSync(dir)) {
    return results;
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

// Pseudo-random generator for consistent degradation noise
function createRng(seed = 42) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

async function generateDegradedPdf(srcPath, destPath) {
  console.log(`[Degrade] Generating: ${path.basename(destPath)} from ${path.basename(srcPath)}`);
  const srcBytes = fs.readFileSync(srcPath);
  const srcDoc = await PDFDocument.load(srcBytes);
  const outDoc = await PDFDocument.create();

  const pageIndices = srcDoc.getPageIndices();
  const embeddedPages = await outDoc.embedPdf(srcDoc, pageIndices);

  const rng = createRng(1337);

  const angleRad = (1.5 * Math.PI) / 180;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  for (let i = 0; i < embeddedPages.length; i++) {
    const embedded = embeddedPages[i];
    const newPage = outDoc.addPage([embedded.width, embedded.height]);

    // Center the 1.5-degree rotation around the page center to avoid margin clipping
    const cx = embedded.width / 2;
    const cy = embedded.height / 2;
    const tx = cx - (cx * cosA - cy * sinA);
    const ty = cy - (cx * sinA + cy * cosA);

    // 1. Apply a 1.5-degree rotation
    newPage.drawPage(embedded, {
      rotate: degrees(1.5),
      x: tx,
      y: ty,
    });

    // 2. Overlay a faint gray wash
    newPage.drawRectangle({
      x: 0,
      y: 0,
      width: embedded.width,
      height: embedded.height,
      color: rgb(0.5, 0.5, 0.5),
      opacity: 0.08,
    });

    // 3. Draw random black/gray rectangles
    const rectCount = 8 + Math.floor(rng() * 10);
    for (let r = 0; r < rectCount; r++) {
      const rx = rng() * (embedded.width - 40);
      const ry = rng() * (embedded.height - 20);
      const rw = 10 + rng() * 45;
      const rh = 3 + rng() * 14;
      const gray = 0.05 + rng() * 0.35;
      const opacity = 0.2 + rng() * 0.45;

      newPage.drawRectangle({
        x: rx,
        y: ry,
        width: rw,
        height: rh,
        color: rgb(gray, gray, gray),
        opacity: opacity,
      });
    }
  }

  const outBytes = await outDoc.save();
  fs.writeFileSync(destPath, outBytes);
  console.log(`[Degrade] Saved: ${destPath} (${outBytes.length} bytes, ${embeddedPages.length} pages)`);
}

async function main() {
  console.log('=== Omnitome Synthetic Archive Processor ===');
  console.log(`Archive source: ${archivePath}`);
  console.log(`Output destination: ${OUT_DIR}`);

  if (!fs.existsSync(archivePath)) {
    console.error(`Error: Archive directory not found at ${archivePath}`);
    process.exit(1);
  }

  ensureDirs();

  const allFiles = findFilesRecursive(archivePath);
  console.log(`Discovered ${allFiles.length} files in archive.\n`);

  const copiedMd = [];
  const copiedClean = [];
  const copiedOcr = [];
  const copiedGroundTruth = [];

  for (const filePath of allFiles) {
    const fileName = path.basename(filePath);

    // 1. Match Markdown files (6 target books)
    if (TARGET_MD_FILES.has(fileName)) {
      const dest = path.join(MD_DIR, fileName);
      fs.copyFileSync(filePath, dest);
      copiedMd.push(fileName);
      console.log(`[MD] Copied: ${fileName}`);
    }

    // 2. Match Clean PDFs (6 target publication PDFs)
    if (TARGET_CLEAN_PDFS.has(fileName)) {
      const dest = path.join(CLEAN_DIR, fileName);
      fs.copyFileSync(filePath, dest);
      copiedClean.push({ src: dest, name: fileName });
      console.log(`[Clean] Copied: ${fileName}`);
    }

    // 3. Match OCR PDFs (4 target plates)
    if (TARGET_OCR_PDFS.has(fileName)) {
      const dest = path.join(OCR_DIR, fileName);
      fs.copyFileSync(filePath, dest);
      copiedOcr.push(fileName);
      console.log(`[OCR] Copied: ${fileName}`);
    }

    // 4. Match ground_truth.md and ocr_ground_truth.md
    if (fileName === 'ground_truth.md' || fileName === 'ocr_ground_truth.md') {
      const parentDir = path.basename(path.dirname(filePath));
      const prefixedName = `${parentDir}_${fileName}`;
      const destFlat = path.join(GROUND_TRUTH_DIR, prefixedName);
      fs.copyFileSync(filePath, destFlat);

      // Also copy to subfolder to support nested lookups
      const nestedDir = path.join(GROUND_TRUTH_DIR, parentDir);
      if (!fs.existsSync(nestedDir)) {
        fs.mkdirSync(nestedDir, { recursive: true });
      }
      const destNested = path.join(nestedDir, fileName);
      fs.copyFileSync(filePath, destNested);

      // Keep root copy as well
      const destRoot = path.join(GROUND_TRUTH_DIR, fileName);
      fs.copyFileSync(filePath, destRoot);

      copiedGroundTruth.push(prefixedName);
      console.log(`[GroundTruth] Copied: ${prefixedName} & ${parentDir}/${fileName}`);
    }
  }

  // 5. Generate Degraded PDFs for all 6 clean PDFs
  console.log('\nGenerating degraded PDF versions with pdf-lib...');
  const degradedFiles = [];
  for (const clean of copiedClean) {
    const baseName = path.basename(clean.name, '.pdf');
    const degradedFileName = `${baseName}_degraded.pdf`;
    const dest = path.join(DEGRADED_DIR, degradedFileName);
    await generateDegradedPdf(clean.src, dest);
    degradedFiles.push(degradedFileName);
  }

  console.log('\n=== Summary of Processed Samples ===');
  console.log(`- Markdown (${copiedMd.length}/6): ${copiedMd.join(', ')}`);
  console.log(`- Clean PDFs (${copiedClean.length}/6): ${copiedClean.map((c) => c.name).join(', ')}`);
  console.log(`- OCR PDFs (${copiedOcr.length}/4): ${copiedOcr.join(', ')}`);
  console.log(`- Degraded PDFs (${degradedFiles.length}/6): ${degradedFiles.join(', ')}`);
  console.log(`- Ground Truth files (${copiedGroundTruth.length}): ${copiedGroundTruth.join(', ')}`);
  console.log('\nAll samples successfully processed and verified!');
}

main().catch((err) => {
  console.error('Fatal error processing samples:', err);
  process.exit(1);
});
