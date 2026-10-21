/**
 * useSoundEffects Hook
 * Provides subtle, premium UI audio feedback for primary interactions.
 * - playClick: Soft, gentle tactile click for button presses (Save, Import, Synthesize).
 * - playSuccess: Warm, pleasant ascending harmonic chime for operation completions.
 *
 * Implements Web Audio API synthesis with fallback to /sounds/*.wav.
 */

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      void sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function playClickSound() {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Subtle soft transient: 600Hz down to 220Hz in 35ms
      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.035);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.036);
      return;
    }

    // Fallback to HTML5 audio element
    const audio = new Audio('/sounds/click.wav');
    audio.volume = 0.25;
    void audio.play().catch(() => {});
  } catch {
    // Audio playback errors are non-fatal
  }
}

export function playSuccessSound() {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      const now = ctx.currentTime;

      // Ascending harmonic chime: C5 (523.25Hz) -> E5 (659.25Hz) -> G5 (783.99Hz)
      const notes = [
        { freq: 523.25, time: 0.0, dur: 0.35, vol: 0.10 },
        { freq: 659.25, time: 0.08, dur: 0.38, vol: 0.12 },
        { freq: 783.99, time: 0.16, dur: 0.45, vol: 0.15 },
      ];

      for (const note of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.freq, now + note.time);

        gain.gain.setValueAtTime(0.001, now + note.time);
        gain.gain.linearRampToValueAtTime(note.vol, now + note.time + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + note.time);
        osc.stop(now + note.time + note.dur + 0.01);
      }
      return;
    }

    // Fallback to HTML5 audio element
    const audio = new Audio('/sounds/success.wav');
    audio.volume = 0.3;
    void audio.play().catch(() => {});
  } catch {
    // Audio playback errors are non-fatal
  }
}

export function useSoundEffects() {
  return {
    playClick: playClickSound,
    playSuccess: playSuccessSound,
  };
}

export default useSoundEffects;
