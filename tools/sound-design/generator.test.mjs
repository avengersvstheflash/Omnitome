/**
 * tools/sound-design/generator.test.mjs
 * Automated Node.js built-in test suite (`node --test generator.test.mjs`)
 * validating:
 * 1. Complete 90-file generation across all 5 themes and 18 canonical events
 * 2. RIFF/WAVE PCM16 mono 48kHz binary header compliance
 * 3. Exact -3.0 dBFS peak normalization and 5ms zero-crossing boundary fades
 * 4. Deterministic SHA-256 reproducibility and `--check` verification
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { verifyWavHeader } from './wav-writer.mjs';
import { generateSoundPack, CANONICAL_EVENTS } from './generate.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Omnitome Procedural Sound Generator - 90-file determinism, WAV headers, and -3dBFS normalization', () => {
  const configPath = path.join(__dirname, 'profiles.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnitome-sfx-test-'));

  try {
    // 1. Generate all 90 files
    const firstRun = generateSoundPack(config, { outputDir: tmpDir, checkOnly: false });
    assert.equal(firstRun.totalFiles, 90, 'Expected 90 total WAV files (5 themes x 18 events)');
    assert.ok(firstRun.totalBytes < 3 * 1024 * 1024, 'Total WAV bundle must stay under 3 MiB');

    // 2. Verify manifest.json structure and every generated WAV file
    const manifestPath = path.join(tmpDir, 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    assert.equal(manifest.schemaVersion, 1);
    assert.deepEqual(manifest.themes, ['omni', 'sakura', 'spring', 'coffee', 'cyberpunk']);
    assert.equal(Object.keys(manifest.assets).length, 90);

    for (const theme of manifest.themes) {
      for (const eventKey of CANONICAL_EVENTS) {
        const assetId = `${theme}.${eventKey}`;
        const entry = manifest.assets[assetId];
        assert.ok(entry, `Missing manifest entry for ${assetId}`);
        assert.equal(entry.peakDbfs, -3, `Expected -3.0 dBFS peak for ${assetId}`);

        const wavPath = path.join(tmpDir, entry.path);
        assert.ok(fs.existsSync(wavPath), `Missing WAV file at ${wavPath}`);

        const buf = fs.readFileSync(wavPath);
        const headerVerdict = verifyWavHeader(buf, 48000);
        assert.equal(
          headerVerdict.valid,
          true,
          `Invalid WAV header for ${assetId}: ${headerVerdict.errors.join(', ')}`
        );

        // Verify first and last PCM16 samples are exactly 0 (5ms fade-in/out boundary check)
        const firstSample = buf.readInt16LE(44);
        const lastSample = buf.readInt16LE(buf.length - 2);
        assert.equal(firstSample, 0, `First sample of ${assetId} must be 0`);
        assert.equal(lastSample, 0, `Last sample of ${assetId} must be 0`);
      }
    }

    // 3. Verify Cyberpunk theme-switch is the shortest signature among the 5 themes
    const cyberSwitchDur = manifest.assets['cyberpunk.theme-switch'].durationMs;
    for (const theme of ['omni', 'sakura', 'spring', 'coffee']) {
      assert.ok(
        cyberSwitchDur < manifest.assets[`${theme}.theme-switch`].durationMs,
        `Cyberpunk theme-switch (${cyberSwitchDur}ms) must be shorter than ${theme}`
      );
    }

    // 4. Verify --check mode passes with zero hash drift
    const checkRun = generateSoundPack(config, { outputDir: tmpDir, checkOnly: true });
    assert.equal(checkRun.verified, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
