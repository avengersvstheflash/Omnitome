/**
 * frontend/src/hooks/useSoundEffects.ts
 * Subtle, premium procedural UI sound feedback hook and standalone dispatchers.
 * Routes semantic events through the pre-rendered theme-aware sound system
 * in frontend/src/audio/soundPlayer.ts.
 */

import {
  playUiSound,
  type PlayUiSoundOptions,
  type UiSoundEvent,
  type ThemeId,
} from '../audio/soundPlayer';

/**
 * Primary tactile button click sound (Save, Import, Synthesize, Tab switch).
 * Routes to semantic event 'ui.button.primary'.
 */
export function playClickSound(options?: PlayUiSoundOptions): void {
  playUiSound('ui.button.primary', options);
}

/**
 * Operation success harmonic chime (Save completed, Import finished, Cache cleared).
 * Routes to semantic event 'operation.success'.
 */
export function playSuccessSound(options?: PlayUiSoundOptions): void {
  playUiSound('operation.success', options);
}

/**
 * Import processing start auditory cue.
 * Routes to semantic event 'import.start'.
 */
export function playImportStartSound(options?: PlayUiSoundOptions): void {
  playUiSound('import.start', options);
}

/**
 * Theme switch signature motif for the active or requested theme palette.
 * Routes to semantic event 'settings.theme.switch'.
 */
export function playThemeSwitchSound(theme?: ThemeId, options?: PlayUiSoundOptions): void {
  playUiSound('settings.theme.switch', { ...options, theme });
}

export function useSoundEffects() {
  return {
    playClick: playClickSound,
    playSuccess: playSuccessSound,
    playImportStart: playImportStartSound,
    playThemeSwitch: playThemeSwitchSound,
    playSound: (event: UiSoundEvent, options?: PlayUiSoundOptions) => playUiSound(event, options),
    playUiSound,
  };
}

export { playUiSound };
export type { PlayUiSoundOptions, UiSoundEvent, ThemeId };
export default useSoundEffects;

