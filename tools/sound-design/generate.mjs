#!/usr/bin/env node
/**
 * generate.mjs
 * Main CLI script that reads a JSON sound profile config (themes & events),
 * synthesizes all 18 canonical UI sound events across all 5 Omnitome themes (90 WAV files),
 * enforces 5ms boundary fades and -3.0 dBFS peak normalization,
 * writes RIFF/WAVE PCM16 mono 48kHz files to disk, and outputs manifest.json
 * with SHA-256 digests and measured acoustic metrics.
 *
 * Supports:
 *   node generate.mjs [--write] [--config ./profiles.json] [--out ./sounds]
 *   node generate.mjs --check   [--config ./profiles.json] [--out ./sounds]
 *
 * Uses ONLY Node.js built-in modules (node:fs, node:path, node:crypto, node:url).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_SAMPLE_RATE,
  encodeWavPcm16Mono,
  writeWavFile,
  verifyWavHeader,
} from './wav-writer.mjs';
import {
  DEFAULT_TARGET_PEAK_DBFS,
  DEFAULT_BOUNDARY_FADE_MS,
  renderSoundRecipe,
  analyzeAudioBuffer,
} from './synth.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * The 18 canonical UI sound events from Section 6.3 of OMNITOME_PROCEDURAL_SOUND_DESIGN_SPEC.md.
 */
export const CANONICAL_EVENTS = [
  'button-primary',
  'button-secondary',
  'toggle-on',
  'toggle-off',
  'nav-primary',
  'tab-switch',
  'nav-back',
  'panel-open',
  'panel-close',
  'book-open',
  'mode-original',
  'mode-omni',
  'citation-jump',
  'import-start',
  'operation-success',
  'operation-error',
  'operation-cancel',
  'theme-switch',
];

/**
 * Derive a deterministic recipe for any of the 18 canonical events if a theme
 * profile defines theme-level defaults (`defaults`) and only overrides key showcase events.
 *
 * @param {string} eventKey - Canonical event name
 * @param {object} themeProfile - Theme configuration object
 * @returns {object} Complete event recipe for `renderSoundRecipe`
 */
export function resolveEventRecipe(eventKey, themeProfile) {
  if (themeProfile.events && themeProfile.events[eventKey]) {
    return themeProfile.events[eventKey];
  }

  const d = themeProfile.defaults ?? {};
  const root = d.rootHz ?? 440.0;
  const sub = d.subHz ?? root * 0.25;
  const bodyWave = d.bodyWaveform ?? 'sine';
  const accentWave = d.accentWaveform ?? 'triangle';
  const ratios = Array.isArray(d.intervalRatios) && d.intervalRatios.length >= 3
    ? d.intervalRatios
    : [1.0, 1.25, 1.5, 2.0];
  const detune = d.detuneCents ?? 1.5;
  const isCyber = themeProfile.id === 'cyberpunk';
  const speedScale = isCyber ? 0.72 : 1.0;

  const baseNoise = d.noiseTexture ?? {
    enabled: true,
    filterType: 'bandpass',
    bandHz: isCyber ? [2400, 5600] : [1500, 4000],
    gain: isCyber ? 0.06 : 0.03,
  };

  const seedBase = themeProfile.noiseTexture?.seed ?? themeProfile.seedBase ?? 17001;

  const makeNoise = (durMs, gainMult = 1.0, sweepUp = true) => ({
    enabled: baseNoise.enabled !== false,
    seed: `${themeProfile.id}:${eventKey}:${seedBase}`,
    filterType: baseNoise.filterType ?? 'bandpass',
    bandHz: baseNoise.bandHz,
    cutoffHz: isCyber ? (sweepUp ? 2200 : 4200) : undefined,
    endCutoffHz: isCyber ? (sweepUp ? 4600 : 2000) : undefined,
    q: isCyber ? 2.5 : 1.4,
    durationMs: Math.round(durMs * 0.65),
    gain: (baseNoise.gain ?? 0.03) * gainMult,
    adsr: {
      attackMs: isCyber ? 2 : 5,
      decayMs: Math.max(12, Math.round(durMs * 0.35)),
      sustainLevel: 0.05,
      releaseMs: Math.max(10, Math.round(durMs * 0.25)),
    },
  });

  switch (eventKey) {
    case 'button-secondary': {
      const durationMs = Math.round(68 * speedScale);
      return {
        durationMs,
        tones: [
          {
            waveform: bodyWave,
            freqHz: root * 0.9,
            endFreqHz: root * 0.88,
            gain: 0.8,
            adsr: { attackMs: 4, decayMs: 32, sustainLevel: 0.1, releaseMs: 25, curvePower: 2.2 },
          },
        ],
        noise: makeNoise(durationMs, 0.7, false),
      };
    }

    case 'toggle-on': {
      const durationMs = Math.round(115 * speedScale);
      return {
        durationMs,
        tones: [
          {
            waveform: bodyWave,
            freqHz: root,
            endFreqHz: root * ratios[1],
            gain: 0.75,
            adsr: { attackMs: 5, decayMs: 55, sustainLevel: 0.15, releaseMs: 45, curvePower: 2.0 },
          },
          {
            waveform: accentWave,
            startMs: Math.round(28 * speedScale),
            durationMs: Math.round(85 * speedScale),
            freqHz: root * ratios[2],
            detuneCents: detune,
            gain: 0.45,
            adsr: { attackMs: 5, decayMs: 42, sustainLevel: 0.12, releaseMs: 38, curvePower: 2.1 },
          },
        ],
        noise: makeNoise(durationMs, 0.8, true),
      };
    }

    case 'toggle-off': {
      const durationMs = Math.round(110 * speedScale);
      return {
        durationMs,
        tones: [
          {
            waveform: bodyWave,
            freqHz: root * ratios[1],
            endFreqHz: root * 0.85,
            gain: 0.75,
            adsr: { attackMs: 5, decayMs: 50, sustainLevel: 0.12, releaseMs: 45, curvePower: 2.1 },
          },
          {
            waveform: accentWave,
            startMs: Math.round(25 * speedScale),
            durationMs: Math.round(80 * speedScale),
            freqHz: root * 0.75,
            gain: 0.38,
            adsr: { attackMs: 5, decayMs: 40, sustainLevel: 0.08, releaseMs: 35, curvePower: 2.2 },
          },
        ],
        noise: makeNoise(durationMs, 0.65, false),
      };
    }

    case 'nav-primary': {
      const durationMs = Math.round(135 * speedScale);
      return {
        durationMs,
        tones: [
          {
            waveform: bodyWave,
            freqHz: root,
            gain: 0.78,
            adsr: { attackMs: 5, decayMs: 65, sustainLevel: 0.18, releaseMs: 55, curvePower: 1.9 },
          },
          {
            waveform: accentWave,
            startMs: Math.round(32 * speedScale),
            durationMs: Math.round(100 * speedScale),
            freqHz: root * ratios[1],
            detuneCents: detune,
            gain: 0.46,
            adsr: { attackMs: 5, decayMs: 50, sustainLevel: 0.14, releaseMs: 42, curvePower: 2.0 },
          },
        ],
        noise: makeNoise(durationMs, 0.75, true),
      };
    }

    case 'tab-switch': {
      const durationMs = Math.round(115 * speedScale);
      return {
        durationMs,
        tones: [
          {
            waveform: bodyWave,
            freqHz: root * ratios[1],
            endFreqHz: root * ratios[2],
            gain: 0.74,
            adsr: { attackMs: 5, decayMs: 52, sustainLevel: 0.14, releaseMs: 46, curvePower: 2.1 },
          },
        ],
        noise: makeNoise(durationMs, 0.7, true),
      };
    }

    case 'nav-back': {
      const durationMs = Math.round(110 * speedScale);
      return {
        durationMs,
        tones: [
          {
            waveform: bodyWave,
            freqHz: root * ratios[1],
            endFreqHz: root * 0.9,
            gain: 0.76,
            adsr: { attackMs: 4, decayMs: 50, sustainLevel: 0.14, releaseMs: 46, curvePower: 2.0 },
          },
        ],
        noise: makeNoise(durationMs, 0.65, false),
      };
    }

    case 'panel-open': {
      const durationMs = Math.round(92 * speedScale);
      return {
        durationMs,
        tones: [
          {
            waveform: bodyWave,
            freqHz: root * 0.95,
            endFreqHz: root * ratios[1],
            gain: 0.72,
            adsr: { attackMs: 5, decayMs: 44, sustainLevel: 0.15, releaseMs: 36, curvePower: 2.0 },
          },
        ],
        noise: makeNoise(durationMs, 0.8, true),
      };
    }

    case 'panel-close': {
      const durationMs = Math.round(82 * speedScale);
      return {
        durationMs,
        tones: [
          {
            waveform: bodyWave,
            freqHz: root * ratios[1],
            endFreqHz: root * 0.9,
            gain: 0.68,
            adsr: { attackMs: 4, decayMs: 38, sustainLevel: 0.1, releaseMs: 32, curvePower: 2.2 },
          },
        ],
        noise: makeNoise(durationMs, 0.6, false),
      };
    }

    case 'mode-original': {
      const durationMs = Math.round(150 * speedScale);
      return {
        durationMs,
        tones: [
          {
            waveform: 'triangle',
            freqHz: sub * 2.0,
            gain: 0.42,
            adsr: { attackMs: 6, decayMs: 70, sustainLevel: 0.16, releaseMs: 65, curvePower: 1.9 },
          },
          {
            waveform: 'sine',
            freqHz: root,
            gain: 0.76,
            adsr: { attackMs: 6, decayMs: 75, sustainLevel: 0.18, releaseMs: 62, curvePower: 1.9 },
          },
        ],
        noise: makeNoise(durationMs, 0.6, false),
      };
    }

    case 'mode-omni': {
      const durationMs = Math.round(175 * speedScale);
      return {
        durationMs,
        tones: [
          {
            waveform: bodyWave,
            freqHz: root,
            gain: 0.72,
            adsr: { attackMs: 7, decayMs: 80, sustainLevel: 0.2, releaseMs: 75, curvePower: 1.9 },
          },
          {
            waveform: accentWave,
            startMs: Math.round(30 * speedScale),
            durationMs: Math.round(140 * speedScale),
            freqHz: root * ratios[2],
            detuneCents: detune,
            gain: 0.44,
            adsr: { attackMs: 8, decayMs: 65, sustainLevel: 0.16, releaseMs: 62, curvePower: 2.0 },
          },
        ],
        noise: makeNoise(durationMs, 0.85, true),
      };
    }

    case 'citation-jump': {
      const durationMs = Math.round(145 * speedScale);
      return {
        durationMs,
        tones: [
          {
            waveform: bodyWave,
            freqHz: root * ratios[1],
            endFreqHz: root * ratios[1] * 0.98,
            gain: 0.75,
            adsr: { attackMs: 5, decayMs: 62, sustainLevel: 0.16, releaseMs: 65, curvePower: 2.0 },
          },
          {
            waveform: accentWave,
            startMs: Math.round(28 * speedScale),
            durationMs: Math.round(110 * speedScale),
            freqHz: root * ratios[2],
            detuneCents: detune,
            gain: 0.44,
            adsr: { attackMs: 5, decayMs: 48, sustainLevel: 0.12, releaseMs: 52, curvePower: 2.1 },
          },
        ],
        noise: makeNoise(durationMs, 0.65, true),
      };
    }

    case 'import-start': {
      const durationMs = Math.round(125 * speedScale);
      return {
        durationMs,
        tones: [
          {
            waveform: bodyWave,
            freqHz: root * 0.9,
            endFreqHz: root * ratios[1],
            gain: 0.76,
            adsr: { attackMs: 5, decayMs: 58, sustainLevel: 0.16, releaseMs: 52, curvePower: 2.0 },
          },
        ],
        noise: makeNoise(durationMs, 0.75, true),
      };
    }

    case 'operation-success': {
      const durationMs = Math.round(295 * speedScale);
      return {
        durationMs,
        tones: [
          {
            waveform: bodyWave,
            startMs: 0,
            durationMs: Math.round(180 * speedScale),
            freqHz: root,
            gain: 0.68,
            adsr: { attackMs: 6, decayMs: 80, sustainLevel: 0.2, releaseMs: 80, curvePower: 1.9 },
          },
          {
            waveform: bodyWave,
            startMs: Math.round(52 * speedScale),
            durationMs: Math.round(195 * speedScale),
            freqHz: root * ratios[1],
            detuneCents: detune,
            gain: 0.72,
            adsr: { attackMs: 6, decayMs: 90, sustainLevel: 0.22, releaseMs: 88, curvePower: 1.9 },
          },
          {
            waveform: accentWave,
            startMs: Math.round(105 * speedScale),
            durationMs: Math.round(185 * speedScale),
            freqHz: root * ratios[2],
            detuneCents: -detune,
            gain: 0.54,
            adsr: { attackMs: 8, decayMs: 85, sustainLevel: 0.18, releaseMs: 85, curvePower: 2.0 },
          },
        ],
        noise: makeNoise(durationMs, 0.8, true),
      };
    }

    case 'operation-error': {
      const durationMs = Math.round(215 * speedScale);
      return {
        durationMs,
        tones: [
          {
            waveform: 'triangle',
            startMs: 0,
            durationMs: Math.round(115 * speedScale),
            freqHz: root * 0.68,
            endFreqHz: root * 0.65,
            gain: 0.75,
            adsr: { attackMs: 5, decayMs: 55, sustainLevel: 0.16, releaseMs: 48, curvePower: 2.1 },
          },
          {
            waveform: 'sine',
            startMs: Math.round(68 * speedScale),
            durationMs: Math.round(140 * speedScale),
            freqHz: root * 0.61,
            endFreqHz: root * 0.58,
            gain: 0.72,
            adsr: { attackMs: 5, decayMs: 65, sustainLevel: 0.14, releaseMs: 60, curvePower: 2.1 },
          },
        ],
        noise: makeNoise(durationMs, 0.75, false),
      };
    }

    case 'operation-cancel': {
      const durationMs = Math.round(110 * speedScale);
      return {
        durationMs,
        tones: [
          {
            waveform: bodyWave,
            freqHz: root,
            endFreqHz: root * 0.74,
            gain: 0.72,
            adsr: { attackMs: 4, decayMs: 50, sustainLevel: 0.1, releaseMs: 46, curvePower: 2.2 },
          },
        ],
        noise: makeNoise(durationMs, 0.6, false),
      };
    }

    default: {
      const durationMs = Math.round(90 * speedScale);
      return {
        durationMs,
        tones: [
          {
            waveform: bodyWave,
            freqHz: root,
            gain: 0.8,
            adsr: { attackMs: 4, decayMs: 45, sustainLevel: 0.12, releaseMs: 35, curvePower: 2.0 },
          },
        ],
        noise: makeNoise(durationMs, 0.7, true),
      };
    }
  }
}

/**
 * Compute SHA-256 hex digest of a Buffer using node:crypto.
 *
 * @param {Buffer} buffer
 * @returns {string}
 */
export function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Generate or verify all configured themes and events from a loaded profile config object.
 *
 * @param {object} config - Parsed profiles.json object
 * @param {object} [options]
 * @param {string} [options.outputDir] - Target output directory
 * @param {boolean} [options.checkOnly=false] - Verify existing files against deterministic render
 * @returns {{ manifest: object, totalFiles: number, totalBytes: number, outputDir: string, verified: boolean }}
 */
export function generateSoundPack(config, options = {}) {
  const outputDir = path.resolve(options.outputDir ?? path.join(__dirname, 'sounds'));
  const checkOnly = Boolean(options.checkOnly);
  const sampleRate = config.sampleRateHz ?? DEFAULT_SAMPLE_RATE;
  const targetPeakDbfs = config.targetPeakDbfs ?? DEFAULT_TARGET_PEAK_DBFS;
  const boundaryFadeMs = config.boundaryFadeMs ?? DEFAULT_BOUNDARY_FADE_MS;
  const eventList = Array.isArray(config.canonicalEvents) && config.canonicalEvents.length > 0
    ? config.canonicalEvents
    : CANONICAL_EVENTS;

  const themesObj = config.themes ?? {};
  const themeIds = Object.keys(themesObj);
  if (themeIds.length === 0) {
    throw new Error('No themes found in configuration JSON.');
  }

  const manifest = {
    schemaVersion: config.schemaVersion ?? 1,
    generatorVersion: config.generatorVersion ?? '1.0.0',
    format: {
      container: 'wav',
      codec: 'pcm_s16le',
      sampleRateHz: sampleRate,
      channels: 1,
      bitsPerSample: 16,
    },
    themes: themeIds,
    assets: {},
  };

  let totalFiles = 0;
  let totalBytes = 0;
  const driftErrors = [];

  for (const themeId of themeIds) {
    const themeProfile = themesObj[themeId];

    for (const eventKey of eventList) {
      const rawRecipe = resolveEventRecipe(eventKey, themeProfile);
      const recipe = {
        ...rawRecipe,
        targetPeakDbfs: rawRecipe.targetPeakDbfs ?? targetPeakDbfs,
        boundaryFadeMs: rawRecipe.boundaryFadeMs ?? boundaryFadeMs,
      };

      const samples = renderSoundRecipe(recipe, sampleRate);
      const metrics = analyzeAudioBuffer(samples, sampleRate);

      // Guardrail checks: zero-crossing boundaries and -3 dBFS peak
      if (Math.abs(metrics.startSample) > 1e-6 || Math.abs(metrics.endSample) > 1e-6) {
        throw new Error(
          `Boundary fade check failed for ${themeId}.${eventKey}: start=${metrics.startSample}, end=${metrics.endSample}`
        );
      }
      if (Math.abs(metrics.peakDbfs - targetPeakDbfs) > 0.05) {
        throw new Error(
          `Peak normalization check failed for ${themeId}.${eventKey}: expected ${targetPeakDbfs} dBFS, got ${metrics.peakDbfs} dBFS`
        );
      }

      const relPath = path.posix.join('themes', themeId, `${eventKey}.wav`);
      const absPath = path.join(outputDir, 'themes', themeId, `${eventKey}.wav`);

      // Path traversal safety check
      if (!absPath.startsWith(outputDir + path.sep)) {
        throw new Error(`Unsafe asset path outside output directory: ${relPath}`);
      }

      const wavBuffer = encodeWavPcm16Mono(samples, sampleRate);
      const headerCheck = verifyWavHeader(wavBuffer, sampleRate);
      if (!headerCheck.valid) {
        throw new Error(
          `WAV header verification failed for ${relPath}: ${headerCheck.errors.join('; ')}`
        );
      }

      const hash = sha256Hex(wavBuffer);

      if (checkOnly) {
        if (!fs.existsSync(absPath)) {
          driftErrors.push(`Missing file on disk: ${relPath}`);
        } else {
          const diskBuf = fs.readFileSync(absPath);
          const diskHash = sha256Hex(diskBuf);
          if (diskHash !== hash) {
            driftErrors.push(`Hash drift for ${relPath}: expected ${hash}, found ${diskHash}`);
          }
        }
      } else {
        writeWavFile(absPath, samples, sampleRate);
      }

      manifest.assets[`${themeId}.${eventKey}`] = {
        path: relPath,
        durationMs: metrics.durationMs,
        peakDbfs: metrics.peakDbfs,
        rmsDbfs: metrics.rmsDbfs,
        sha256: hash,
      };

      totalFiles += 1;
      totalBytes += wavBuffer.length;
    }
  }

  const manifestPath = path.join(outputDir, 'manifest.json');
  if (checkOnly) {
    if (!fs.existsSync(manifestPath)) {
      driftErrors.push('Missing manifest.json in output directory.');
    } else {
      const diskManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const expectedKeys = Object.keys(manifest.assets);
      for (const k of expectedKeys) {
        if (!diskManifest.assets?.[k]) {
          driftErrors.push(`Missing asset key in manifest.json: ${k}`);
        } else if (diskManifest.assets[k].sha256 !== manifest.assets[k].sha256) {
          driftErrors.push(`Manifest SHA-256 mismatch for ${k}`);
        }
      }
    }
    if (driftErrors.length > 0) {
      throw new Error(`Verification failed:\n  - ${driftErrors.join('\n  - ')}`);
    }
  } else {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  }

  return {
    manifest,
    totalFiles,
    totalBytes,
    outputDir,
    verified: driftErrors.length === 0,
  };
}

/**
 * CLI entry point
 */
function parseCliArgs(argv) {
  const args = {
    configPath: path.join(__dirname, 'profiles.json'),
    outputDir: path.join(__dirname, 'sounds'),
    checkOnly: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if ((arg === '--config' || arg === '-c') && argv[i + 1]) {
      args.configPath = path.resolve(argv[++i]);
    } else if ((arg === '--out' || arg === '-o') && argv[i + 1]) {
      args.outputDir = path.resolve(argv[++i]);
    } else if (arg === '--check') {
      args.checkOnly = true;
    } else if (arg === '--write') {
      args.checkOnly = false;
    }
  }
  return args;
}

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMainModule) {
  const { configPath, outputDir, checkOnly } = parseCliArgs(process.argv);
  const rawJson = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(rawJson);

  const result = generateSoundPack(config, { outputDir, checkOnly });
  const kb = (result.totalBytes / 1024).toFixed(1);
  const modeLabel = checkOnly ? 'Verified' : 'Generated';

  console.log(
    `[Omnitome Sound Generator] ${modeLabel} ${result.totalFiles} PCM16 48kHz mono WAV files (${kb} KiB) -> ${result.outputDir}`
  );
}