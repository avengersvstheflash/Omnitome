import React from 'react';
import { Zap, Palette, Volume2, ArrowRight } from 'lucide-react';

interface StepWelcomeProps {
  onNext: () => void;
}

export const StepWelcome: React.FC<StepWelcomeProps> = ({ onNext }) => {
  return (
    <div className="flex flex-col items-center text-center justify-between h-full py-2">
      {/* Hero Sigil with ambient glow */}
      <div className="relative my-4 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-accent/25 blur-2xl animate-pulse" />
        <div className="relative p-5 rounded-3xl bg-[rgb(var(--surface)/0.80)] border border-line/60 backdrop-blur-md shadow-xl shadow-accent/10">
          <svg
            className="w-16 h-16 select-none animate-pulse transition-all duration-700"
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="24" cy="24" r="22" stroke="currentColor" className="text-accent/40" strokeWidth="1.5" strokeDasharray="3 2" />
            <circle cx="24" cy="24" r="16" stroke="currentColor" className="text-accent/70" strokeWidth="1" />
            <rect x="10.5" y="10.5" width="27" height="27" stroke="currentColor" className="text-accent" strokeWidth="1.2" />
            <rect x="10.5" y="10.5" width="27" height="27" stroke="currentColor" className="text-accent" strokeWidth="1.2" transform="rotate(45 24 24)" />
            <circle cx="24" cy="24" r="7.5" stroke="currentColor" className="text-brand" strokeWidth="1.2" />
            <polygon points="24,19 28,24 24,29 20,24" fill="currentColor" className="text-ink" />
            <circle cx="24" cy="2" r="1.8" fill="currentColor" className="text-accent" />
            <circle cx="24" cy="46" r="1.8" fill="currentColor" className="text-accent" />
            <circle cx="2" cy="24" r="1.8" fill="currentColor" className="text-accent" />
            <circle cx="46" cy="24" r="1.8" fill="currentColor" className="text-accent" />
            <circle cx="8.4" cy="8.4" r="1.2" fill="currentColor" className="text-accent/80" />
            <circle cx="39.6" cy="8.4" r="1.2" fill="currentColor" className="text-accent/80" />
            <circle cx="8.4" cy="39.6" r="1.2" fill="currentColor" className="text-accent/80" />
            <circle cx="39.6" cy="39.6" r="1.2" fill="currentColor" className="text-accent/80" />
          </svg>
        </div>
      </div>

      {/* Headline & Subtitle */}
      <div className="space-y-2.5 max-w-lg mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink font-display">
          Welcome to Omnitome
        </h1>
        <p className="text-sm text-ink-muted leading-relaxed">
          Your offline-first neural library and intelligent synthesizer. Transform
          historical texts, technical monographs, and classical literature into
          connected semantic knowledge.
        </p>
      </div>

      {/* Feature Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full my-6">
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[rgb(var(--surface)/0.60)] border border-line/60 backdrop-blur-sm text-left shadow-sm">
          <div className="p-2 rounded-lg bg-accent/15 text-accent flex-shrink-0 mt-0.5">
            <Zap className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-semibold text-ink">Offline Synthesis</h4>
            <p className="text-[11px] text-ink-muted leading-tight">
              Local neural models keep your library completely private and zero-egress.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[rgb(var(--surface)/0.60)] border border-line/60 backdrop-blur-sm text-left shadow-sm">
          <div className="p-2 rounded-lg bg-accent/15 text-accent flex-shrink-0 mt-0.5">
            <Palette className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-semibold text-ink">Thematic Canvases</h4>
            <p className="text-[11px] text-ink-muted leading-tight">
              Bespoke typography, lighting, and textures tuned for deep concentration.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[rgb(var(--surface)/0.60)] border border-line/60 backdrop-blur-sm text-left shadow-sm">
          <div className="p-2 rounded-lg bg-accent/15 text-accent flex-shrink-0 mt-0.5">
            <Volume2 className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-semibold text-ink">Dynamic Audio</h4>
            <p className="text-[11px] text-ink-muted leading-tight">
              Acoustic UI stems and Kokoro-82M TTS narration built for reading.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <div className="pt-2 w-full flex justify-center">
        <button
          type="button"
          onClick={onNext}
          className="group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-accent text-accent-ink font-medium text-sm shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:opacity-95 active:scale-[0.98] transition-all"
        >
          <span>Get Started</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
};
