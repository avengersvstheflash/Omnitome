import React from 'react';
import { CheckCircle2, Palette, Cpu, BookOpen, ArrowRight } from 'lucide-react';
import { Theme } from '../../types/domain';
import { THEME_CATALOG } from '../../store/useThemeStore';

interface StepFinishProps {
  selectedTheme: Theme;
  aiProvider: 'openrouter' | 'local';
  openrouterModel: string;
  localPreset: 'ollama' | 'lmstudio' | 'custom';
  localModel: string;
  starterPackStatus: 'idle' | 'installing' | 'installed' | 'skipped';
  onEnterLibrary: () => void;
}

export const StepFinish: React.FC<StepFinishProps> = ({
  selectedTheme,
  aiProvider,
  openrouterModel,
  localPreset,
  localModel,
  starterPackStatus,
  onEnterLibrary,
}) => {
  const themeMeta = THEME_CATALOG[selectedTheme] ?? THEME_CATALOG.omni;

  const getProviderSummary = () => {
    if (aiProvider === 'openrouter') {
      const modelShort = openrouterModel.split('/').pop() || openrouterModel;
      return `OpenRouter Cloud (${modelShort || 'DeepSeek'})`;
    }
    const presetName = localPreset === 'ollama' ? 'Ollama' : localPreset === 'lmstudio' ? 'LM Studio' : 'Custom Local';
    return `${presetName} (${localModel || 'llama3'})`;
  };

  const getLibrarySummary = () => {
    if (starterPackStatus === 'installed') {
      return '6 Synthetic Archive books installed';
    }
    return 'Clean initial library';
  };

  return (
    <div className="flex flex-col items-center text-center justify-between h-full py-2">
      {/* Celebration Icon with harmonic glowing halo */}
      <div className="relative my-4 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-accent/30 blur-2xl animate-pulse" />
        <div className="relative p-4 rounded-full bg-[rgb(var(--surface)/0.80)] border border-line/60 backdrop-blur-md shadow-xl shadow-accent/20 text-accent">
          <CheckCircle2 className="w-16 h-16 stroke-[1.5]" />
        </div>
      </div>

      {/* Headline & Subtitle */}
      <div className="space-y-2 max-w-md mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink font-display">
          You&apos;re All Set!
        </h2>
        <p className="text-sm text-ink-muted leading-relaxed">
          Your neural library is configured and ready for reading, annotation,
          and intelligent synthesis.
        </p>
      </div>

      {/* Configuration Summary Card */}
      <div className="w-full max-w-md my-6 p-4 rounded-2xl bg-[rgb(var(--surface)/0.60)] border border-line/60 backdrop-blur-sm space-y-3 text-left shadow-sm">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-line/40">
          <div className="flex items-center gap-2 text-ink-muted">
            <Palette className="w-4 h-4 text-accent" />
            <span>Active Aesthetic:</span>
          </div>
          <span className="font-semibold text-ink flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block shadow-xs"
              style={{ backgroundColor: themeMeta.accentColor }}
            />
            {themeMeta.name}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs pb-2 border-b border-line/40">
          <div className="flex items-center gap-2 text-ink-muted">
            <Cpu className="w-4 h-4 text-accent" />
            <span>Intelligence Engine:</span>
          </div>
          <span className="font-semibold text-ink font-mono text-[11px]">
            {getProviderSummary()}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-ink-muted">
            <BookOpen className="w-4 h-4 text-accent" />
            <span>Starting Corpus:</span>
          </div>
          <span className="font-semibold text-ink">
            {getLibrarySummary()}
          </span>
        </div>
      </div>

      {/* CTA Button */}
      <div className="pt-2 w-full flex justify-center">
        <button
          type="button"
          onClick={onEnterLibrary}
          className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-accent text-accent-ink font-medium text-sm shadow-xl shadow-accent/25 hover:shadow-accent/40 hover:opacity-95 active:scale-[0.98] transition-all"
        >
          <span>Enter Library</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
};
