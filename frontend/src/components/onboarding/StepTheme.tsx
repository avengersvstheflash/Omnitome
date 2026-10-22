import React from 'react';
import { Check } from 'lucide-react';
import { Theme } from '../../types/domain';
import { THEME_CATALOG, THEMES } from '../../store/useThemeStore';

interface StepThemeProps {
  selectedTheme: Theme;
  onSelectTheme: (theme: Theme) => void;
}

export const StepTheme: React.FC<StepThemeProps> = ({
  selectedTheme,
  onSelectTheme,
}) => {
  return (
    <div className="flex flex-col h-full py-1">
      {/* Step Header */}
      <div className="space-y-1.5 text-center mb-5">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink font-display">
          Choose Your Reading Aesthetic
        </h2>
        <p className="text-xs sm:text-sm text-ink-muted max-w-md mx-auto">
          Omnitome dynamically adapts typography, lighting contrasts, and acoustic UI stems
          to suit your reading rhythm.
        </p>
      </div>

      {/* Theme Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 my-auto">
        {THEMES.map((themeId) => {
          const meta = THEME_CATALOG[themeId];
          const isSelected = selectedTheme === themeId;

          return (
            <button
              key={themeId}
              type="button"
              onClick={() => onSelectTheme(themeId)}
              className={`group relative flex flex-col justify-between p-3.5 rounded-xl text-left transition-all duration-200 border ${
                isSelected
                  ? 'border-accent ring-2 ring-accent/30 bg-surface shadow-md shadow-accent/10 -translate-y-0.5'
                  : 'border-line/60 bg-[rgb(var(--surface)/0.50)] hover:bg-surface hover:border-line hover:-translate-y-0.5'
              }`}
            >
              {/* Header inside card: Name + Indicator */}
              <div className="flex items-center justify-between w-full mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: meta.accentColor }}
                  />
                  <span className="font-semibold text-xs sm:text-sm text-ink font-display">
                    {meta.name}
                  </span>
                </div>
                {isSelected ? (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent text-accent-ink shadow-sm">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                ) : (
                  <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded border border-line/50 text-ink-muted">
                    {meta.category}
                  </span>
                )}
              </div>

              {/* Tagline */}
              <p className="text-[11px] text-ink-muted line-clamp-2 leading-relaxed mb-3">
                {meta.tagline}
              </p>

              {/* Micro Palette Swatch */}
              <div
                className="w-full h-8 rounded-lg border border-line/40 p-1 flex items-center gap-1.5 overflow-hidden"
                style={{ backgroundColor: meta.previewBg }}
              >
                <div
                  className="w-5 h-full rounded shadow-xs"
                  style={{ backgroundColor: meta.surfaceColor, border: '1px solid rgba(120, 120, 120, 0.2)' }}
                />
                <div
                  className="flex-1 h-2 rounded-full"
                  style={{ backgroundColor: meta.accentColor }}
                />
                <div
                  className="w-2 h-2 rounded-full opacity-60"
                  style={{ backgroundColor: meta.accentColor }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-center mt-3">
        <span className="text-[11px] text-ink-muted">
          Active theme: <strong className="text-accent">{THEME_CATALOG[selectedTheme]?.name ?? 'Omni Arcane'}</strong> — switches immediately across all surfaces
        </span>
      </div>
    </div>
  );
};
