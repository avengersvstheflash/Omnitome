/**
 * synth.mjs
 * Zero-dependency offline procedural synthesis math primitives:
 * - Phase-continuous sine & triangle oscillators with pitch contours, detuning, and FM
 * - Deterministic seeded noise via node:crypto SHA-256 + Mulberry32 PRNG
 * - Audio EQ Cookbook biquad filters (lowpass, bandpass, highpass) clamped below Nyquist
 * - ADSR amplitude envelopes with configurable curve shaping
 * - Mandatory 5ms raised-cosine boundary fade-in and fade-out
 * - Peak normalization to -3.0 dBFS with DC-offset removal and acoustic analysis
 */

import crypto from 'node:crypto';

export const TWO_PI = 2.0 * Math.PI;
export const DEFAULT_SAMPLE_RATE = 48000;
export const DEFAULT_TARGET_PEAK_DBFS = -3.0;
export const DEFAULT_BOUNDARY_FADE_MS = 5.0;

/**
 * Convert decibels relative to full scale (dBFS) to linear amplitude ratio.
 * Example: -3 dBFS -> ~0.70794578
 *
 * @param {number} dbfs
 * @returns {number}
 */
export function dbToLinear(dbfs) {
  return Math.pow(10.0, dbfs / 20.0);
}

/**
 * Convert linear amplitude ratio to dBFS.
 *
 * @param {number} linear
 * @returns {number}
 */
export function linearToDb(linear) {
  if (linear <= 1e-12) return -120.0;
  return 20.0 * Math.log10(linear);
}

/**
 * Pure sine wave function for an instantaneous phase in radians.
 *
 * @param {number} phaseRad - Phase in radians
 * @returns {number} Sample in [-1.0, 1.0]
 */
export function sineWave(phaseRad) {
  return Math.sin(phaseRad);
}

/**
 * Pure band-friendly triangle wave function for an instantaneous phase in radians.
 * Constructed continuously so phase = 0 yields 0.0 (rising zero-crossing),
 * matching sine phase polarity.
 *
 * @param {number} phaseRad - Phase in radians
 * @returns {number} Sample in [-1.0, 1.0]
 */
export function triangleWave(phaseRad) {
  // Normalize phase into [0, 1)
  const norm = ((phaseRad / TWO_PI) % 1.0 + 1.0) % 1.0;
  if (norm < 0.25) {
    return norm * 4.0;
  }
  if (norm < 0.75) {
    return 2.0 - norm * 4.0;
  }
  return norm * 4.0 - 4.0;
}

/**
 * Create a deterministic PRNG returning floats in [0, 1) and signed floats in [-1, 1],
 * seeded via SHA-256 hash using node:crypto. Never uses Math.random().
 *
 * @param {string | number} seedInput - Seed number or string identifier
 * @returns {{ nextFloat: () => number, nextSigned: () => number }}
 */
export function createSeededRng(seedInput) {
  const hash = crypto
    .createHash('sha256')
    .update(String(seedInput), 'utf8')
    .digest();

  // Initialize 32-bit state from first 4 bytes of SHA-256 digest
  let state = hash.readUInt32LE(0) || 0x6d2b79f5;

  function nextFloat() {
    // Mulberry32 deterministic PRNG
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296.0;
  }

  function nextSigned() {
    return nextFloat() * 2.0 - 1.0;
  }

  return { nextFloat, nextSigned };
}

/**
 * Generate a buffer of deterministic seeded white noise in [-1.0, 1.0].
 *
 * @param {number} numSamples - Number of samples
 * @param {string | number} seed - Deterministic seed
 * @returns {Float64Array}
 */
export function generateSeededNoise(numSamples, seed = 17001) {
  const rng = createSeededRng(seed);
  const out = new Float64Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    out[i] = rng.nextSigned();
  }
  return out;
}

/**
 * Apply a 2nd-order RBJ biquad filter ('lowpass', 'bandpass', or 'highpass')
 * with optional cutoff sweep from startFreqHz to endFreqHz.
 * Cutoff is strictly clamped inside [20 Hz, 0.45 * sampleRate] below Nyquist.
 *
 * @param {Float64Array} input - Input buffer
 * @param {object} config - Filter parameters
 * @param {'lowpass' | 'bandpass' | 'highpass'} [config.type='bandpass']
 * @param {number} [config.cutoffHz=2000] - Static cutoff/center frequency in Hz
 * @param {number} [config.endCutoffHz] - Optional final cutoff for swept filter textures
 * @param {number} [config.q=1.2] - Filter quality factor Q
 * @param {number} [sampleRate=48000]
 * @returns {Float64Array}
 */
export function applyBiquadFilter(input, config = {}, sampleRate = DEFAULT_SAMPLE_RATE) {
  const type = config.type ?? 'bandpass';
  const startCutoff = config.cutoffHz ?? 2000;
  const endCutoff = config.endCutoffHz ?? startCutoff;
  const q = Math.max(0.1, Math.min(20.0, config.q ?? 1.2));
  const maxSafeHz = sampleRate * 0.45; // Strictly below Nyquist (24kHz at 48kHz)

  const out = new Float64Array(input.length);
  let x1 = 0.0, x2 = 0.0, y1 = 0.0, y2 = 0.0;
  let b0 = 1.0, b1 = 0.0, b2 = 0.0, a1 = 0.0, a2 = 0.0;

  function updateCoeffs(freqHz) {
    const fc = Math.max(20.0, Math.min(maxSafeHz, freqHz));
    const w0 = (TWO_PI * fc) / sampleRate;
    const cosW0 = Math.cos(w0);
    const sinW0 = Math.sin(w0);
    const alpha = sinW0 / (2.0 * q);
    const a0Inv = 1.0 / (1.0 + alpha);

    if (type === 'lowpass') {
      const oneMinusCos = 1.0 - cosW0;
      b0 = (oneMinusCos * 0.5) * a0Inv;
      b1 = oneMinusCos * a0Inv;
      b2 = b0;
    } else if (type === 'highpass') {
      const onePlusCos = 1.0 + cosW0;
      b0 = (onePlusCos * 0.5) * a0Inv;
      b1 = -onePlusCos * a0Inv;
      b2 = b0;
    } else {
      // Constant 0 dB peak gain bandpass
      b0 = alpha * a0Inv;
      b1 = 0.0;
      b2 = -alpha * a0Inv;
    }
    a1 = (-2.0 * cosW0) * a0Inv;
    a2 = (1.0 - alpha) * a0Inv;
  }

  updateCoeffs(startCutoff);
  const isSwept = Math.abs(endCutoff - startCutoff) > 0.5;
  const lastIdx = Math.max(1, input.length - 1);

  for (let i = 0; i < input.length; i++) {
    // Recompute coefficients every 16 samples during a sweep for smooth modulation
    if (isSwept && (i & 15) === 0) {
      const progress = i / lastIdx;
      const currentHz = startCutoff * Math.pow(endCutoff / startCutoff, progress);
      updateCoeffs(currentHz);
    }

    const x0 = input[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    out[i] = y0;
  }

  return out;
}

/**
 * Generate an ADSR amplitude envelope buffer of length `numSamples`.
 *
 * Segments:
 *   1. Attack  : 0.0 -> 1.0 over `attackMs`
 *   2. Decay   : 1.0 -> `sustainLevel` over `decayMs`
 *   3. Sustain : holds `sustainLevel` over `sustainMs` (or remaining time before release)
 *   4. Release : current level -> 0.0 over remaining samples (`releaseMs`)
 *
 * @param {number} numSamples - Total envelope length in samples
 * @param {object} adsr - ADSR parameters
 * @param {number} [adsr.attackMs=5] - Attack time in ms (enforced >= 0.5ms to avoid click)
 * @param {number} [adsr.decayMs=80] - Decay time in ms
 * @param {number} [adsr.sustainLevel=0.35] - Sustain amplitude in [0, 1]
 * @param {number} [adsr.releaseMs=100] - Release time in ms
 * @param {number} [adsr.curvePower=1.8] - Exponential curvature (>1 gives natural decay/release)
 * @param {number} [sampleRate=48000]
 * @returns {Float64Array}
 */
export function generateAdsrEnvelope(numSamples, adsr = {}, sampleRate = DEFAULT_SAMPLE_RATE) {
  const env = new Float64Array(numSamples);
  if (numSamples <= 0) return env;

  const attackMs = Math.max(0.5, adsr.attackMs ?? 5.0);
  const decayMs = Math.max(1.0, adsr.decayMs ?? 80.0);
  const sustainLevel = Math.max(0.0, Math.min(1.0, adsr.sustainLevel ?? 0.35));
  const releaseMs = Math.max(2.0, adsr.releaseMs ?? 100.0);
  const curvePower = Math.max(0.5, adsr.curvePower ?? 1.8);

  let attackSamples = Math.max(1, Math.round((attackMs / 1000.0) * sampleRate));
  let decaySamples = Math.max(1, Math.round((decayMs / 1000.0) * sampleRate));
  let releaseSamples = Math.max(1, Math.round((releaseMs / 1000.0) * sampleRate));

  // Scale down segments proportionally if ADSR exceeds total clip duration
  const minTotal = attackSamples + decaySamples + releaseSamples;
  if (minTotal > numSamples) {
    const scale = numSamples / minTotal;
    attackSamples = Math.max(1, Math.floor(attackSamples * scale));
    decaySamples = Math.max(1, Math.floor(decaySamples * scale));
    releaseSamples = Math.max(1, numSamples - attackSamples - decaySamples);
  }

  const sustainSamples = Math.max(0, numSamples - attackSamples - decaySamples - releaseSamples);
  const decayEnd = attackSamples + decaySamples;
  const sustainEnd = decayEnd + sustainSamples;

  for (let i = 0; i < numSamples; i++) {
    if (i < attackSamples) {
      // Smooth raised-sine attack curve
      const t = i / attackSamples;
      env[i] = Math.sin(t * 0.5 * Math.PI);
    } else if (i < decayEnd) {
      const t = (i - attackSamples) / decaySamples;
      const shaped = Math.pow(1.0 - t, curvePower);
      env[i] = sustainLevel + (1.0 - sustainLevel) * shaped;
    } else if (i < sustainEnd) {
      env[i] = sustainLevel;
    } else {
      const relIdx = i - sustainEnd;
      const t = Math.min(1.0, relIdx / releaseSamples);
      const startVal = sustainSamples > 0 || decaySamples > 0 ? sustainLevel : 1.0;
      env[i] = startVal * Math.pow(1.0 - t, curvePower);
    }
  }

  return env;
}

/**
 * Synthesize a single oscillator tone layer (sine or triangle) with support for:
 * - Start delay offset (`startMs`) and explicit note duration (`durationMs`)
 * - Exponential or linear frequency sweep (`freqHz` -> `endFreqHz`)
 * - Fine pitch detuning (`detuneCents`)
 * - Optional subtle phase/frequency modulation (`fmFreqHz`, `fmIndex`)
 * - Layer-specific ADSR amplitude envelope
 *
 * @param {number} totalSamples - Total output buffer length in samples
 * @param {object} layer - Tone layer definition
 * @param {number} [sampleRate=48000]
 * @returns {Float64Array}
 */
export function synthesizeToneLayer(totalSamples, layer, sampleRate = DEFAULT_SAMPLE_RATE) {
  const out = new Float64Array(totalSamples);
  const startSample = Math.max(0, Math.round(((layer.startMs ?? 0) / 1000.0) * sampleRate));
  if (startSample >= totalSamples) return out;

  const remainingSamples = totalSamples - startSample;
  const layerSamples = layer.durationMs
    ? Math.min(remainingSamples, Math.max(1, Math.round((layer.durationMs / 1000.0) * sampleRate)))
    : remainingSamples;

  const waveform = layer.waveform === 'triangle' ? triangleWave : sineWave;
  const detuneRatio = Math.pow(2.0, (layer.detuneCents ?? 0.0) / 1200.0);
  const startFreq = Math.max(20.0, (layer.freqHz ?? 440.0) * detuneRatio);
  const endFreq = Math.max(20.0, (layer.endFreqHz ?? layer.freqHz ?? 440.0) * detuneRatio);
  const gain = layer.gain ?? 1.0;

  const fmFreqHz = layer.fmFreqHz ?? 0.0;
  const fmIndex = layer.fmIndex ?? 0.0;

  const env = generateAdsrEnvelope(layerSamples, layer.adsr ?? {}, sampleRate);

  let phase = 0.0;
  let modPhase = 0.0;
  const lastIdx = Math.max(1, layerSamples - 1);
  const hasSweep = Math.abs(endFreq - startFreq) > 0.05;

  for (let i = 0; i < layerSamples; i++) {
    const progress = i / lastIdx;
    const instFreq = hasSweep
      ? startFreq * Math.pow(endFreq / startFreq, progress)
      : startFreq;

    let fmOffset = 0.0;
    if (fmFreqHz > 0.0 && fmIndex > 0.0) {
      fmOffset = Math.sin(modPhase) * fmIndex;
      modPhase += (TWO_PI * fmFreqHz) / sampleRate;
      if (modPhase >= TWO_PI) modPhase -= TWO_PI;
    }

    out[startSample + i] = waveform(phase + fmOffset) * env[i] * gain;

    phase += (TWO_PI * instFreq) / sampleRate;
    if (phase >= TWO_PI) {
      phase -= TWO_PI;
    }
  }

  return out;
}

/**
 * Synthesize a seeded, band-limited noise layer with its own ADSR envelope.
 *
 * @param {number} totalSamples - Total output buffer length in samples
 * @param {object} noiseCfg - Noise layer definition
 * @param {number} [sampleRate=48000]
 * @returns {Float64Array}
 */
export function synthesizeNoiseLayer(totalSamples, noiseCfg, sampleRate = DEFAULT_SAMPLE_RATE) {
  const out = new Float64Array(totalSamples);
  if (!noiseCfg || noiseCfg.enabled === false) return out;

  const startSample = Math.max(0, Math.round(((noiseCfg.startMs ?? 0) / 1000.0) * sampleRate));
  if (startSample >= totalSamples) return out;

  const remainingSamples = totalSamples - startSample;
  const layerSamples = noiseCfg.durationMs
    ? Math.min(remainingSamples, Math.max(1, Math.round((noiseCfg.durationMs / 1000.0) * sampleRate)))
    : remainingSamples;

  const rawNoise = generateSeededNoise(layerSamples, noiseCfg.seed ?? 'default-seed');

  // If bandHz [low, high] is supplied, derive geometric center frequency and Q
  let filterType = noiseCfg.filterType ?? 'bandpass';
  let cutoffHz = noiseCfg.cutoffHz ?? 2200;
  let endCutoffHz = noiseCfg.endCutoffHz ?? cutoffHz;
  let q = noiseCfg.q ?? 1.4;

  if (Array.isArray(noiseCfg.bandHz) && noiseCfg.bandHz.length === 2) {
    const lowHz = Math.max(40, noiseCfg.bandHz[0]);
    const highHz = Math.max(lowHz + 50, noiseCfg.bandHz[1]);
    cutoffHz = Math.sqrt(lowHz * highHz);
    q = Math.max(0.5, Math.min(12.0, cutoffHz / (highHz - lowHz)));
    if (!noiseCfg.endCutoffHz) {
      endCutoffHz = cutoffHz;
    }
  }

  const filtered = applyBiquadFilter(
    rawNoise,
    { type: filterType, cutoffHz, endCutoffHz, q },
    sampleRate
  );

  const env = generateAdsrEnvelope(layerSamples, noiseCfg.adsr ?? {}, sampleRate);
  const gain = noiseCfg.gain ?? 0.04;

  for (let i = 0; i < layerSamples; i++) {
    out[startSample + i] = filtered[i] * env[i] * gain;
  }

  return out;
}

/**
 * Remove any DC offset by subtracting the mean sample value.
 *
 * @param {Float64Array} samples
 * @returns {Float64Array}
 */
export function removeDcOffset(samples) {
  if (samples.length === 0) return samples;
  let sum = 0.0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i];
  }
  const mean = sum / samples.length;
  if (Math.abs(mean) < 1e-9) return samples;

  for (let i = 0; i < samples.length; i++) {
    samples[i] -= mean;
  }
  return samples;
}

/**
 * Apply a 5ms raised-cosine (half-Hann) fade-in and fade-out at the start and end
 * of the audio buffer to guarantee zero-crossing boundaries and prevent clicks.
 *
 * @param {Float64Array} samples - Audio buffer (modified in place and returned)
 * @param {number} [sampleRate=48000]
 * @param {number} [fadeMs=5.0] - Fade duration in milliseconds (default 5ms = 240 samples @ 48kHz)
 * @returns {Float64Array}
 */
export function applyBoundaryFades(
  samples,
  sampleRate = DEFAULT_SAMPLE_RATE,
  fadeMs = DEFAULT_BOUNDARY_FADE_MS
) {
  const len = samples.length;
  if (len === 0) return samples;

  const requestedFadeSamples = Math.max(1, Math.round((fadeMs / 1000.0) * sampleRate));
  const fadeSamples = Math.min(requestedFadeSamples, Math.floor(len / 2));

  for (let i = 0; i < fadeSamples; i++) {
    // Raised-cosine ramp from 0.0 at i=0 to 1.0 at i=fadeSamples
    const gain = 0.5 * (1.0 - Math.cos((Math.PI * i) / fadeSamples));
    samples[i] *= gain;
    samples[len - 1 - i] *= gain;
  }

  // Explicitly pin exact endpoints to 0.0
  samples[0] = 0.0;
  samples[len - 1] = 0.0;

  return samples;
}

/**
 * Peak-normalize an audio buffer to `targetDbfs` (default -3.0 dBFS).
 *
 * @param {Float64Array} samples - Audio buffer (modified in place and returned)
 * @param {number} [targetDbfs=-3.0] - Target peak level in dBFS
 * @returns {Float64Array}
 */
export function peakNormalize(samples, targetDbfs = DEFAULT_TARGET_PEAK_DBFS) {
  let maxAbs = 0.0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > maxAbs) maxAbs = abs;
  }

  if (maxAbs <= 1e-12) {
    return samples;
  }

  const targetLinear = dbToLinear(targetDbfs);
  const scale = targetLinear / maxAbs;

  for (let i = 0; i < samples.length; i++) {
    samples[i] *= scale;
  }

  return samples;
}

/**
 * Measure peak dBFS, RMS dBFS, DC offset, and boundary sample safety.
 *
 * @param {Float64Array} samples
 * @param {number} [sampleRate=48000]
 * @returns {{ durationMs: number, peakDbfs: number, rmsDbfs: number, dcOffset: number, startSample: number, endSample: number }}
 */
export function analyzeAudioBuffer(samples, sampleRate = DEFAULT_SAMPLE_RATE) {
  const len = samples.length;
  if (len === 0) {
    return {
      durationMs: 0,
      peakDbfs: -120,
      rmsDbfs: -120,
      dcOffset: 0,
      startSample: 0,
      endSample: 0,
    };
  }

  let peak = 0.0;
  let sumSq = 0.0;
  let sum = 0.0;

  for (let i = 0; i < len; i++) {
    const s = samples[i];
    const abs = Math.abs(s);
    if (abs > peak) peak = abs;
    sumSq += s * s;
    sum += s;
  }

  const rms = Math.sqrt(sumSq / len);
  const durationMs = Math.round((len / sampleRate) * 1000 * 10) / 10;

  return {
    durationMs,
    peakDbfs: Math.round(linearToDb(peak) * 100) / 100,
    rmsDbfs: Math.round(linearToDb(rms) * 100) / 100,
    dcOffset: sum / len,
    startSample: samples[0],
    endSample: samples[len - 1],
  };
}

/**
 * Complete offline event renderer:
 * 1. Sums all configured harmonic/tone layers (`tones`)
 * 2. Sums any seeded filtered noise layer (`noise`)
 * 3. Removes DC offset
 * 4. Applies 5ms boundary fade-in and fade-out
 * 5. Peak-normalizes to -3.0 dBFS
 *
 * @param {object} recipe - Complete event recipe
 * @param {number} [sampleRate=48000]
 * @returns {Float64Array}
 */
export function renderSoundRecipe(recipe, sampleRate = DEFAULT_SAMPLE_RATE) {
  const durationMs = Math.max(25, recipe.durationMs ?? 120);
  const totalSamples = Math.max(16, Math.round((durationMs / 1000.0) * sampleRate));
  const mix = new Float64Array(totalSamples);

  const tones = Array.isArray(recipe.tones) ? recipe.tones : [];
  for (const tone of tones) {
    const layerBuf = synthesizeToneLayer(totalSamples, tone, sampleRate);
    for (let i = 0; i < totalSamples; i++) {
      mix[i] += layerBuf[i];
    }
  }

  if (recipe.noise && recipe.noise.enabled !== false) {
    const noiseBuf = synthesizeNoiseLayer(totalSamples, recipe.noise, sampleRate);
    for (let i = 0; i < totalSamples; i++) {
      mix[i] += noiseBuf[i];
    }
  }

  removeDcOffset(mix);
  applyBoundaryFades(mix, sampleRate, recipe.boundaryFadeMs ?? DEFAULT_BOUNDARY_FADE_MS);
  peakNormalize(mix, recipe.targetPeakDbfs ?? DEFAULT_TARGET_PEAK_DBFS);

  // Re-apply boundary fade after normalization in case DC removal shifted endpoints prior to fade
  applyBoundaryFades(mix, sampleRate, recipe.boundaryFadeMs ?? DEFAULT_BOUNDARY_FADE_MS);
  peakNormalize(mix, recipe.targetPeakDbfs ?? DEFAULT_TARGET_PEAK_DBFS);

  return mix;
}
