import React, { useState, useEffect, useRef } from 'react';
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
import { apiUrl } from '../../api/client';
import { queryClient } from '../../api/queryClient';
import { useImportQueueStore } from '../../store/useImportQueueStore';

const STARTER_MD_FILES = [
  '/samples/md/the_curious_world_of_cats.md',
  '/samples/md/the_art_and_science_of_reading.md',
  '/samples/md/the_asterion_expedition.md',
  '/samples/md/machine_learning_field_notes.md',
  '/samples/md/The_Making_of_Omnitome.md',
  '/samples/md/The_Omnitome_Field_Guide.md',
];

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
  const [progressLabel, setProgressLabel] = useState<string>('Processing in background...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isInstallingRef = useRef(false);

  const handleInstallStarterPack = async () => {
    if (isInstallingRef.current) return;
    isInstallingRef.current = true;
    setErrorMessage(null);
    playSound('ui.button.primary');
    setStatus('installing');
    setProgress(0);
    setProgressLabel('Processing in background...');

    try {
      for (let i = 0; i < STARTER_MD_FILES.length; i++) {
        const url = STARTER_MD_FILES[i];
        const filename = url.split('/').pop() || `book_${i + 1}.md`;
        setProgressLabel(`Processing in background... (${i + 1}/${STARTER_MD_FILES.length})`);

        const fileRes = await fetch(url);
        if (!fileRes.ok) {
          throw new Error(`Failed to fetch ${url} (${fileRes.status})`);
        }
        const blob = await fileRes.blob();
        const file = new File([blob], filename, { type: 'text/markdown' });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('files', file);
        formData.append('title', filename.replace(/\.md$/i, '').replace(/[_-]/g, ' '));
        formData.append('replace', 'true');
        formData.append('contentType', 'novel');

        // Omnitome backend import:
        // Try POST /api/books first per task specification.
        // If not ok (e.g. route without multipart parsing), fallback to the background queue
        // endpoint (/api/import/queue/files) or synchronous import (/api/books/import).
        let importRes: Response;
        try {
          importRes = await fetch(apiUrl('/api/books'), {
            method: 'POST',
            body: formData,
          });
        } catch {
          importRes = { ok: false, status: 500 } as Response;
        }

        if (!importRes.ok) {
          try {
            importRes = await fetch(apiUrl('/api/import/queue/files'), {
              method: 'POST',
              body: formData,
            });
          } catch {
            importRes = { ok: false, status: 500 } as Response;
          }
        }

        if (!importRes.ok && importRes.status !== 409) {
          try {
            importRes = await fetch(apiUrl('/api/books/import'), {
              method: 'POST',
              body: formData,
            });
          } catch {
            importRes = { ok: false, status: 500 } as Response;
          }
        }

        if (!importRes.ok && importRes.status !== 409) {
          throw new Error(`Import failed for ${filename} (${importRes.status})`);
        }

        setProgress(Math.round(((i + 1) / STARTER_MD_FILES.length) * 100));
      }

      setProgress(100);
      setStatus('installed');
      playSound('operation.success');
      queryClient.invalidateQueries({ queryKey: ['books'] });
      void useImportQueueStore.getState().fetchQueue();
    } catch (err: unknown) {
      console.error('[StarterPack] Error installing starter pack:', err);
      setStatus('idle');
      setProgress(0);
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to install starter library. Please try again.'
      );
      playSound('ui.button.secondary');
    } finally {
      isInstallingRef.current = false;
    }
  };

  useEffect(() => {
    if (status === 'installing' && !isInstallingRef.current) {
      void handleInstallStarterPack();
    }
  }, [status]);

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
            {errorMessage && (
              <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 rounded-xl max-w-md text-center">
                {errorMessage}
              </div>
            )}
            <button
              type="button"
              onClick={handleInstallStarterPack}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-accent-ink font-medium text-xs sm:text-sm shadow-md shadow-accent/20 hover:opacity-95 active:scale-[0.98] transition-all"
            >
              <Download className="w-4 h-4" />
              <span>{errorMessage ? 'Retry Starter Library Installation' : 'Install Starter Library'}</span>
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
              onClick={handleInstallStarterPack}
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
