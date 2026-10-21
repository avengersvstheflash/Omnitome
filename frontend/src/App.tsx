import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/queryClient';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ModalHost } from './components/shared/ModalHost';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { LibraryRoute } from './routes/LibraryRoute';
import BookDetailsRoute from './routes/BookDetailsRoute';
import ReaderRoute from './routes/ReaderRoute';
import { ImportRoute } from './routes/ImportRoute';
import { ResearchRoute } from './routes/ResearchRoute';
import ResearchViewerRoute from './routes/ResearchViewerRoute';
import { SettingsRoute } from './routes/SettingsRoute';
import { HelpRoute } from './routes/HelpRoute';
import { useEffect, useState } from 'react';
import { ThemeDecor } from './components/decor/ThemeDecor';
import { useResourceStore } from './store/useResourceStore';
import { FirstRunScreen } from './components/resources/FirstRunScreen';
import { useSettings } from './hooks/useSettings';

function OnboardingRedirect() {
  const location = useLocation();
  const navigate = useNavigate();
  const { settings, isLoading } = useSettings();

  useEffect(() => {
    if (isLoading || !settings) return;
    if (location.pathname === '/settings') return;

    const hasApiKey = Boolean(settings.openrouter?.apiKey && settings.openrouter.apiKey.trim().length > 0);
    const hasLocal = Boolean(
      settings.local?.apiKey?.trim() ||
      (settings.local?.preset && settings.local.baseUrl && (settings.aiProvider === 'local' || settings.aiProvider === 'ollama'))
    );
    const hasSkipped = typeof window !== 'undefined' && (
      localStorage.getItem('omnitome_onboarding_skipped') === 'true' ||
      sessionStorage.getItem('omnitome_onboarding_skipped') === 'true'
    );

    if (!hasApiKey && !hasLocal && !hasSkipped) {
      navigate('/settings?onboarding=true', { replace: true });
    }
  }, [settings, isLoading, location.pathname, navigate]);

  return null;
}

export default function App() {
  const isTauri = typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined';
  const [nodePort, setNodePort] = useState<number | undefined>(() => {
    const direct = (window as unknown as { __OMNITOME__?: { nodePort?: number } }).__OMNITOME__?.nodePort;
    if (direct) return direct;
    try {
      const cached = sessionStorage.getItem('omnitome_ports');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.nodePort) {
          (window as unknown as { __OMNITOME__?: unknown }).__OMNITOME__ = parsed;
          return parsed.nodePort;
        }
      }
    } catch {}
    return undefined;
  });
  const [hasTimeout, setHasTimeout] = useState(false);

  const { status, isLoading, error, fetchStatus } = useResourceStore();

  useEffect(() => {
    if (!isTauri || nodePort) return;
    const timer = setTimeout(() => {
      setHasTimeout(true);
    }, 20000);
    return () => clearTimeout(timer);
  }, [isTauri, nodePort]);

  useEffect(() => {
    if (nodePort) return;
    const checkPort = () => {
      let port = (window as unknown as { __OMNITOME__?: { nodePort?: number } }).__OMNITOME__?.nodePort;
      if (!port) {
        try {
          const cached = sessionStorage.getItem('omnitome_ports');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed?.nodePort) {
              (window as unknown as { __OMNITOME__?: unknown }).__OMNITOME__ = parsed;
              port = parsed.nodePort;
            }
          }
        } catch {}
      }
      if (port) {
        setNodePort(port);
      }
    };
    checkPort();
    window.addEventListener('omnitome:ready', checkPort);
    const interval = setInterval(checkPort, 50);
    return () => {
      window.removeEventListener('omnitome:ready', checkPort);
      clearInterval(interval);
    };
  }, [nodePort]);

  useEffect(() => {
    if (isTauri && !nodePort) return;
    console.log('[App] Calling fetchStatus()...');
    fetchStatus();
  }, [fetchStatus, isTauri, nodePort]);

  useEffect(() => {
    const handleBooksChanged = () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['book'] });
      queryClient.invalidateQueries({ queryKey: ['chapters'] });
      queryClient.invalidateQueries({ queryKey: ['chapter'] });
      queryClient.invalidateQueries({ queryKey: ['smart-chapters'] });
      queryClient.invalidateQueries({ queryKey: ['editorial'] });
      queryClient.invalidateQueries({ queryKey: ['editorial-progress'] });
      queryClient.invalidateQueries({ queryKey: ['book-lifecycle'] });
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      queryClient.invalidateQueries({ queryKey: ['book-synopsis'] });
      queryClient.invalidateQueries({ queryKey: ['book-summary'] });
      queryClient.invalidateQueries({ queryKey: ['semantic-status'] });
      queryClient.invalidateQueries({ queryKey: ['resume-target'] });
      queryClient.invalidateQueries({ queryKey: ['dossiers'] });
      queryClient.invalidateQueries({ queryKey: ['import-queue'] });
    };
    window.addEventListener('omnitome:books-changed', handleBooksChanged);
    return () => {
      window.removeEventListener('omnitome:books-changed', handleBooksChanged);
    };
  }, []);

  if (isTauri && !nodePort) {
    if (hasTimeout) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-paper bg-surface p-8 text-ink">
          <h1 className="text-xl font-bold text-red-600">Omnitome Boot Error</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Backend service port handshake timed out during application launch.
          </p>
          <p className="mt-4 text-xs font-mono bg-subtle p-3 rounded">
            Check logs at: %LOCALAPPDATA%\Omnitome\logs\node.log
          </p>
        </div>
      );
    }
    return null;
  }

  if (error && !status) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-paper bg-surface p-8 text-ink selection:bg-accent/20">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
            <svg
              className="w-8 h-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-tight text-ink">
              Initialization Failed
            </h2>
            <p className="text-xs text-ink-muted leading-relaxed">
              {error}
            </p>
          </div>
          <button
            onClick={() => fetchStatus()}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-accent text-accent-contrast hover:opacity-90 transition-opacity"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !status) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-paper bg-surface p-8 text-ink selection:bg-accent/20">
        <div className="relative flex items-center justify-center transition-opacity duration-700 ease-in-out">
          <div className="absolute inset-0 rounded-full bg-accent/20 blur-md animate-pulse" />
          <svg
            className="w-12 h-12 relative select-none animate-pulse transition-opacity duration-700"
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="24" cy="24" r="22" stroke="#d8b4fe" strokeWidth="1.5" strokeDasharray="3 2" />
            <circle cx="24" cy="24" r="16" stroke="#c084fc" strokeWidth="1" />
            <rect x="10.5" y="10.5" width="27" height="27" stroke="#a855f7" strokeWidth="1.2" />
            <rect x="10.5" y="10.5" width="27" height="27" stroke="#a855f7" strokeWidth="1.2" transform="rotate(45 24 24)" />
            <circle cx="24" cy="24" r="7.5" stroke="#f472b6" strokeWidth="1.2" />
            <polygon points="24,19 28,24 24,29 20,24" fill="#ffffff" />
            <circle cx="24" cy="2" r="1.8" fill="#f472b6" />
            <circle cx="24" cy="46" r="1.8" fill="#f472b6" />
            <circle cx="2" cy="24" r="1.8" fill="#f472b6" />
            <circle cx="46" cy="24" r="1.8" fill="#f472b6" />
            <circle cx="8.4" cy="8.4" r="1.2" fill="#c084fc" />
            <circle cx="39.6" cy="8.4" r="1.2" fill="#c084fc" />
            <circle cx="8.4" cy="39.6" r="1.2" fill="#c084fc" />
            <circle cx="39.6" cy="39.6" r="1.2" fill="#c084fc" />
          </svg>
        </div>
        <div className="space-y-1 text-center mt-6">
          <h2 className="text-base font-semibold tracking-tight text-ink">
            Initializing Omnitome...
          </h2>
          <p className="text-xs text-ink-muted">
            Checking local neural models and system readiness
          </p>
        </div>
      </div>
    );
  }

  if (!status.allInstalled) {
    return <FirstRunScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <OnboardingRedirect />
        <ThemeDecor />
        <Layout>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<LibraryRoute />} />
              <Route path="/library" element={<Navigate to="/" replace />} />
              <Route path="/research" element={<ResearchRoute />} />
              <Route path="/research/:bookId" element={<ResearchViewerRoute />} />
              <Route path="/book/:bookId" element={<BookDetailsRoute />} />
              <Route path="/import" element={<ImportRoute />} />
              <Route path="/read/:bookId/:chapterId" element={<ReaderRoute />} />
              <Route path="/settings" element={<SettingsRoute />} />
              <Route path="/help" element={<HelpRoute />} />
            </Routes>
          </ErrorBoundary>
          <ModalHost />
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}