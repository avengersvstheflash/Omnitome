import { create } from 'zustand';
import {
  playUiSound,
  getUiSoundSettings,
  setUiSoundEnabled,
  setUiSoundVolume,
  setUiThemeSwitchSoundEnabled,
  subscribeUiSoundSettings,
  type UiSoundEvent,
  type PlayUiSoundOptions,
  type ThemeId,
} from '../audio/soundPlayer';

export interface SoundStoreState {
  enabled: boolean;
  volume: number;
  themeSwitchEnabled: boolean;

  // Actions
  playSound: (event: UiSoundEvent, options?: PlayUiSoundOptions) => void;
  playClick: () => void;
  playSuccess: () => void;
  playThemeSwitch: (theme?: ThemeId) => void;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  setThemeSwitchEnabled: (enabled: boolean) => void;
}

export const useSoundStore = create<SoundStoreState>((set) => {
  const initial = getUiSoundSettings();

  return {
    enabled: initial.enabled,
    volume: initial.volume,
    themeSwitchEnabled: initial.themeSwitchEnabled,

    playSound: (event, options) => {
      playUiSound(event, options);
    },
    playClick: () => {
      playUiSound('ui.button.primary');
    },
    playSuccess: () => {
      playUiSound('operation.success');
    },
    playThemeSwitch: (theme) => {
      playUiSound('settings.theme.switch', { theme });
    },
    setEnabled: (enabled) => {
      setUiSoundEnabled(enabled);
      set({ enabled });
    },
    setVolume: (volume) => {
      setUiSoundVolume(volume);
      set({ volume });
    },
    setThemeSwitchEnabled: (enabled) => {
      setUiThemeSwitchSoundEnabled(enabled);
      set({ themeSwitchEnabled: enabled });
    },
  };
});

if (typeof window !== 'undefined') {
  subscribeUiSoundSettings((settings) => {
    useSoundStore.setState({
      enabled: settings.enabled,
      volume: settings.volume,
      themeSwitchEnabled: settings.themeSwitchEnabled,
    });
  });
}
