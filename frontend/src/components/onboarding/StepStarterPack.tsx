import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  History,
  Cpu,
  Download,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { STARTER_ARCHETYPES, ArchetypeBook } from './types';
import { useSoundStore } from '../../store/useSoundStore';

interface StepStarterPackProps {
  status: 'idle' | 'installing' | 'installed' | 'skipped';
  progress: number;
  setStatus: (status: 'idle' | 'installing' | 'installed' | 'skipped') => void;
  setProgress: (progress: number) => void;
}

export const StepStarterPack: React.FC<StepStarterPackProps> = ({
  status,
  progress,
  setStatus,
  setProgress,
}) => {
  const playSound = useSoundStore((s) => s.playSound);
  const [progressLabel, setProgressLabel] = useState<string>('Initializing archive unpacker...');

  useEffect(() => {
    if (status !== 'installing') return;

    let current = 0;
    const interval = setInterval(() => {
      current += 6;
      if (current < 35) {
        setProgressLabel('Extracting "The Synthetica Codex: Volume I"...');
      } else if (current < 70) {
        setProgressLabel('Reconstructing "Chronicles of the Iron Vault" folios...');
      } else if (current < 95) {
        setProgressLabel('Compiling "Neural Graph Traversal" equations & schemas...');
      } else {
        setProgressLabel('Indexing synthetic library dossiers...');
      }

      if (current >= 100) {
        current = 100;
        clearInterval(interval);
        setProgress(100);
        setStatus('installed');
        playSound('operation.success');
      } else {
        setProgress(current);
      }
    }, 120);

    return () => clearInterval(interval);
  }, [status, setProgress, setStatus, playSound]);

  const handleInstallClick = () => {
    playSound('ui.button.primary');
    setStatus('installing');
    setProgress(0);
  };

  const renderIcon = (name: ArchetypeBook['iconName']) => {
    switch (name) {
      case 'sparkles':
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
      case 'history':
        return <History className="w-4 h-4 text-amber-400" />;
      case 'cpu':
        return <Cpu className="w-4 h-4 text-purple-400" />;
      default:
        return <BookOpen className="w-4 h-4 text-accent" />;
    }
  };

  return (
    <div className="flex flex-col h-full py-1">
      {/* Header */}
      <div className="space-y-1.5 text-center mb-4">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink font-display">
          Install the Synthetic Archive
        </h2>
        <p className="text-xs sm:text-sm text-ink-muted max-w-md mx-auto">
          Explore Omnitome immediately with three pre-synthesized archetype books
          demonstrating text restoration, formatting, and analysis.
        </p>
      </div>

      {/* 3 Archetype Preview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-auto">
        {STARTER_ARCHETYPES.map((book) => (
          <div
            key={book.id}
            className="flex flex-col justify-between p-3.5 rounded-xl border border-line/60 bg-[rgb(var(--surface)/0.50)] text-left hover:border-line transition-all duration-200"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span
                  className={`text-[9px] font-mono font-semibold uppercase px-2 py-0.5 rounded-md border ${book.badgeColor}`}
                >
                  {book.badge}
                </span>
                {renderIcon(book.iconName)}
              </div>

              <div>
                <h4 className="text-xs font-semibold text-ink line-clamp-1 font-display">
                  {book.title}
                </h4>
                <p className="text-[10px] text-ink-muted">{book.subtitle}</p>
              </div>

              <p className="text-[11px] text-ink-muted leading-relaxed line-clamp-3">
                {book.description}
              </p>
            </div>

            {/* Feature Pills */}
            <div className="pt-3 border-t border-line/40 flex flex-wrap gap-1 mt-3">
              {book.features.map((f, i) => (
                <span
                  key={i}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-[rgb(var(--subtle)/0.60)] text-ink-muted"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Action / Progress Area */}
      <div className="mt-4 pt-3 border-t border-line/40 flex flex-col items-center gap-2">
        {status === 'idle' && (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-accent-ink font-medium text-xs sm:text-sm shadow-md shadow-accent/20 hover:opacity-95 active:scale-[0.98] transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Install Starter Library (3 Books)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playSound('ui.button.secondary');
                setStatus('skipped');
              }}
              className="text-[11px] text-ink-muted hover:text-ink transition-colors underline"
            >
              Skip this step (start with empty library)
            </button>
          </div>
        )}

        {status === 'skipped' && (
          <div className="flex items-center gap-3 py-1">
            <span className="text-xs text-ink-muted">Starting with clean, empty library.</span>
            <button
              type="button"
              onClick={handleInstallClick}
              className="text-xs text-accent underline hover:opacity-80 font-medium"
            >
              Install starter pack anyway
            </button>
          </div>
        )}

        {status === 'installing' && (
          <div className="w-full max-w-md space-y-2 py-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-ink font-medium">{progressLabel}</span>
              <span className="text-accent font-mono font-semibold">{progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-subtle overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-150 rounded-full shadow-sm shadow-accent/40"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {status === 'installed' && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Starter Library Ready!</span>
          </div>
        )}
      </div>
    </div>
  );
};
