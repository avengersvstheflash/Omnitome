/**
 * wav-writer.mjs
 * Zero-dependency RIFF/WAVE PCM16 Mono 48kHz writer and validator.
 * Uses only Node.js built-in modules (node:fs, node:path).
 */

import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_SAMPLE_RATE = 48000;
export const NUM_CHANNELS = 1;
export const BITS_PER_SAMPLE = 16;
export const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8; // 2 bytes
export const BLOCK_ALIGN = NUM_CHANNELS * BYTES_PER_SAMPLE; // 2 bytes per frame
export const WAV_HEADER_BYTES = 44;

/**
 * Clamp a floating-point sample in [-1.0, 1.0] and convert to signed 16-bit PCM integer.
 * Uses symmetric rounding and guards against NaN/Infinity.
 *
 * @param {number} sample - Normalized float sample in [-1.0, 1.0]
 * @returns {number} Signed 16-bit integer in [-32768, 32767]
 */
export function floatToPcm16(sample) {
  if (!Number.isFinite(sample)) {
    return 0;
  }
  const clamped = Math.max(-1.0, Math.min(1.0, sample));
  return clamped < 0
    ? Math.max(-32768, Math.round(clamped * 32768))
    : Math.min(32767, Math.round(clamped * 32767));
}

/**
 * Encode a Float32Array or Float64Array of mono audio samples into a standard
 * 44-byte RIFF/WAVE PCM16 little-endian Buffer.
 *
 * Header layout (44 bytes total):
 *   00..03: "RIFF" (ASCII)
 *   04..07: ChunkSize = 36 + dataChunkSize (uint32 LE)
 *   08..11: "WAVE" (ASCII)
 *   12..15: "fmt " (ASCII)
 *   16..19: Subchunk1Size = 16 for PCM (uint32 LE)
 *   20..21: AudioFormat = 1 (Linear PCM, uint16 LE)
 *   22..23: NumChannels = 1 (Mono, uint16 LE)
 *   24..27: SampleRate = 48000 (uint32 LE)
 *   28..31: ByteRate = SampleRate * NumChannels * BytesPerSample (uint32 LE)
 *   32..33: BlockAlign = NumChannels * BytesPerSample (uint16 LE)
 *   34..35: BitsPerSample = 16 (uint16 LE)
 *   36..39: "data" (ASCII)
 *   40..43: Subchunk2Size = numSamples * NumChannels * BytesPerSample (uint32 LE)
 *   44..N : Signed 16-bit little-endian PCM sample payload
 *
 * @param {Float32Array | Float64Array | number[]} samples - Mono float samples in [-1, 1]
 * @param {number} [sampleRate=48000] - Sample rate in Hz
 * @returns {Buffer} Complete RIFF/WAVE file buffer
 */
export function encodeWavPcm16Mono(samples, sampleRate = DEFAULT_SAMPLE_RATE) {
  if (!samples || typeof samples.length !== 'number' || samples.length === 0) {
    throw new Error('encodeWavPcm16Mono requires a non-empty array of samples.');
  }
  if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
    throw new Error(`Invalid sampleRate: ${sampleRate}. Expected a positive integer.`);
  }

  const numSamples = samples.length;
  const numChannels = NUM_CHANNELS;
  const bitsPerSample = BITS_PER_SAMPLE;
  const bytesPerSample = BYTES_PER_SAMPLE;

  const blockAlign = numChannels * bytesPerSample; // 2
  const byteRate = sampleRate * blockAlign;        // 96000 at 48kHz
  const dataChunkSize = numSamples * blockAlign;   // Always even because blockAlign === 2
  const riffChunkSize = 36 + dataChunkSize;

  const buffer = Buffer.allocUnsafe(WAV_HEADER_BYTES + dataChunkSize);

  // RIFF container descriptor
  buffer.write('RIFF', 0, 4, 'ascii');
  buffer.writeUInt32LE(riffChunkSize, 4);
  buffer.write('WAVE', 8, 4, 'ascii');

  // "fmt " sub-chunk
  buffer.write('fmt ', 12, 4, 'ascii');
  buffer.writeUInt32LE(16, 16);             // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);              // AudioFormat (1 = PCM integer)
  buffer.writeUInt16LE(numChannels, 22);    // NumChannels (1 = mono)
  buffer.writeUInt32LE(sampleRate, 24);     // SampleRate (48000 Hz)
  buffer.writeUInt32LE(byteRate, 28);       // ByteRate (96000 B/s)
  buffer.writeUInt16LE(blockAlign, 32);     // BlockAlign (2 bytes)
  buffer.writeUInt16LE(bitsPerSample, 34);  // BitsPerSample (16 bits)

  // "data" sub-chunk
  buffer.write('data', 36, 4, 'ascii');
  buffer.writeUInt32LE(dataChunkSize, 40);

  // Write signed 16-bit little-endian PCM payload
  let offset = WAV_HEADER_BYTES;
  for (let i = 0; i < numSamples; i++) {
    const pcmValue = floatToPcm16(samples[i]);
    buffer.writeInt16LE(pcmValue, offset);
    offset += bytesPerSample;
  }

  return buffer;
}

/**
 * Write normalized float samples to disk as a RIFF/WAVE PCM16 mono file.
 * Automatically creates parent directories if they do not exist.
 *
 * @param {string} filePath - Destination path on disk
 * @param {Float32Array | Float64Array | number[]} samples - Mono float samples
 * @param {number} [sampleRate=48000] - Sample rate in Hz
 * @returns {{ filePath: string, bytesWritten: number, numSamples: number, durationMs: number, buffer: Buffer }}
 */
export function writeWavFile(filePath, samples, sampleRate = DEFAULT_SAMPLE_RATE) {
  const resolvedPath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const buffer = encodeWavPcm16Mono(samples, sampleRate);
  fs.writeFileSync(resolvedPath, buffer);

  const durationMs = Math.round((samples.length / sampleRate) * 1000 * 100) / 100;
  return {
    filePath: resolvedPath,
    bytesWritten: buffer.length,
    numSamples: samples.length,
    durationMs,
    buffer,
  };
}

/**
 * Validate a WAV Buffer's RIFF/WAVE PCM16 header integrity.
 *
 * @param {Buffer} buffer - Raw WAV file buffer
 * @param {number} [expectedSampleRate=48000] - Expected sample rate in Hz
 * @returns {{ valid: boolean, errors: string[], metadata: object }}
 */
export function verifyWavHeader(buffer, expectedSampleRate = DEFAULT_SAMPLE_RATE) {
  const errors = [];
  if (!Buffer.isBuffer(buffer) || buffer.length < WAV_HEADER_BYTES) {
    return {
      valid: false,
      errors: [`Buffer too short (${buffer ? buffer.length : 0} bytes < 44 bytes).`],
      metadata: {},
    };
  }

  const riff = buffer.toString('ascii', 0, 4);
  const riffChunkSize = buffer.readUInt32LE(4);
  const wave = buffer.toString('ascii', 8, 12);
  const fmt = buffer.toString('ascii', 12, 16);
  const fmtChunkSize = buffer.readUInt32LE(16);
  const audioFormat = buffer.readUInt16LE(20);
  const numChannels = buffer.readUInt16LE(22);
  const sampleRate = buffer.readUInt32LE(24);
  const byteRate = buffer.readUInt32LE(28);
  const blockAlign = buffer.readUInt16LE(32);
  const bitsPerSample = buffer.readUInt16LE(34);
  const dataId = buffer.toString('ascii', 36, 40);
  const dataChunkSize = buffer.readUInt32LE(40);

  const expectedBlockAlign = numChannels * (bitsPerSample / 8);
  const expectedByteRate = sampleRate * expectedBlockAlign;

  if (riff !== 'RIFF') errors.push(`Expected "RIFF", got "${riff}"`);
  if (wave !== 'WAVE') errors.push(`Expected "WAVE", got "${wave}"`);
  if (fmt !== 'fmt ') errors.push(`Expected "fmt ", got "${fmt}"`);
  if (fmtChunkSize !== 16) errors.push(`Expected fmt chunk size 16, got ${fmtChunkSize}`);
  if (audioFormat !== 1) errors.push(`Expected PCM audioFormat 1, got ${audioFormat}`);
  if (numChannels !== 1) errors.push(`Expected mono (1 channel), got ${numChannels}`);
  if (sampleRate !== expectedSampleRate) {
    errors.push(`Expected sampleRate ${expectedSampleRate}, got ${sampleRate}`);
  }
  if (bitsPerSample !== 16) errors.push(`Expected 16 bitsPerSample, got ${bitsPerSample}`);
  if (blockAlign !== expectedBlockAlign) {
    errors.push(`Expected blockAlign ${expectedBlockAlign}, got ${blockAlign}`);
  }
  if (byteRate !== expectedByteRate) {
    errors.push(`Expected byteRate ${expectedByteRate}, got ${byteRate}`);
  }
  if (dataId !== 'data') errors.push(`Expected "data" chunk ID, got "${dataId}"`);
  if (riffChunkSize !== 36 + dataChunkSize) {
    errors.push(`RIFF chunk size (${riffChunkSize}) !== 36 + dataChunkSize (${36 + dataChunkSize})`);
  }
  if (buffer.length !== WAV_HEADER_BYTES + dataChunkSize) {
    errors.push(
      `Buffer length (${buffer.length}) !== 44 + dataChunkSize (${WAV_HEADER_BYTES + dataChunkSize})`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    metadata: {
      sampleRate,
      numChannels,
      bitsPerSample,
      byteRate,
      blockAlign,
      dataChunkSize,
      numSamples: dataChunkSize / expectedBlockAlign,
    },
  };
}

/**
 * Class wrapper for object-oriented consumers.
 */
export class WavWriter {
  /**
   * @param {object} [options]
   * @param {number} [options.sampleRate=48000]
   */
  constructor(options = {}) {
    this.sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
  }

  encode(samples) {
    return encodeWavPcm16Mono(samples, this.sampleRate);
  }

  write(filePath, samples) {
    return writeWavFile(filePath, samples, this.sampleRate);
  }

  static encode(samples, sampleRate = DEFAULT_SAMPLE_RATE) {
    return encodeWavPcm16Mono(samples, sampleRate);
  }

  static write(filePath, samples, sampleRate = DEFAULT_SAMPLE_RATE) {
    return writeWavFile(filePath, samples, sampleRate);
  }

  static verify(buffer, expectedSampleRate = DEFAULT_SAMPLE_RATE) {
    return verifyWavHeader(buffer, expectedSampleRate);
  }
}

export default WavWriter;
