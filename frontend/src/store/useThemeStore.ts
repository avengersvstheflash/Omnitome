import { create } from 'zustand';
import { Theme } from '../types/domain';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cycleTheme: () => void;
}

export interface ThemeMetadata {
  id: Theme;
  name: string;
  tagline: string;
  category: 'dark' | 'light' | 'warm';
  accentColor: string;
  surfaceColor: string;
  previewBg: string;
  accentRgb: string;
}

export const THEME_CATALOG: Record<Theme, ThemeMetadata> = {
  omni: {
    id: 'omni',
    name: 'Omni Arcane',
    tagline: 'Deep obsidian with arcanic violet & magenta neon',
    category: 'dark',
    accentColor: '#a855f7',
    surfaceColor: '#121622',
    previewBg: '#0a0c14',
    accentRgb: '168 85 247',
  },
  sakura: {
    id: 'sakura',
    name: 'Sakura Petal',
    tagline: 'Japanese washi paper with delicate blush rose accents',
    category: 'light',
    accentColor: '#f472b6',
    surfaceColor: '#fff5f7',
    previewBg: '#fdf2f4',
    accentRgb: '244 114 182',
  },
  spring: {
    id: 'spring',
    name: 'Spring Botanic',
    tagline: 'Crisp editorial parchment with vibrant emerald accents',
    category: 'light',
    accentColor: '#10b981',
    surfaceColor: '#f0fdf4',
    previewBg: '#f8fafc',
    accentRgb: '16 185 129',
  },
  coffee: {
    id: 'coffee',
    name: 'Coffee Archive',
    tagline: 'Warm aged sepia parchment with rich mahogany & espresso',
    category: 'warm',
    accentColor: '#d97706',
    surfaceColor: '#fef3c7',
    previewBg: '#fbf7ee',
    accentRgb: '217 119 6',
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk Night',
    tagline: 'High-contrast midnight obsidian with electric cyan & gold',
    category: 'dark',
    accentColor: '#06b6d4',
    surfaceColor: '#0f172a',
    previewBg: '#020617',
    accentRgb: '6 182 212',
  },
};

export const THEMES: Theme[] = ['omni', 'sakura', 'spring', 'coffee', 'cyberpunk'];

function getInitialTheme(): Theme {
  try {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('sr.theme') : null;
    if (stored === 'dark')    return 'cyberpunk';
    if (stored === 'neon')    return 'omni';
    if (stored === 'warm')    return 'coffee';
    if (stored === 'glass')   return 'spring';
    if (stored === 'default') return 'sakura';
    if (stored && (THEMES as string[]).includes(stored)) return stored as Theme;
  } catch {}
  return 'spring';
}

export const useThemeStore = create<ThemeState>((set) => {
  const initial = getInitialTheme();
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', initial);
  }

  return {
    theme: initial,
    setTheme: (theme) => {
      try {
        localStorage.setItem('sr.theme', theme);
      } catch {}
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
      }
      set({ theme });
    },
    cycleTheme: () => {
      set((state) => {
        const idx = THEMES.indexOf(state.theme);
        const next = THEMES[(idx + 1) % THEMES.length];
        try {
          localStorage.setItem('sr.theme', next);
        } catch {}
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', next);
        }
        return { theme: next };
      });
    },
  };
});