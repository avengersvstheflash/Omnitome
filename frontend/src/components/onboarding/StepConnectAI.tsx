import React, { useState } from 'react';
import {
  Cloud,
  Server,
  Eye,
  EyeOff,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { useSoundStore } from '../../store/useSoundStore';

interface StepConnectAIProps {
  aiProvider: 'openrouter' | 'local';
  setAiProvider: (provider: 'openrouter' | 'local') => void;
  openrouterApiKey: string;
  setOpenrouterApiKey: (key: string) => void;
  openrouterModel: string;
  setOpenrouterModel: (model: string) => void;
  localPreset: 'ollama' | 'lmstudio' | 'custom';
  setLocalPreset: (preset: 'ollama' | 'lmstudio' | 'custom') => void;
  localBaseUrl: string;
  setLocalBaseUrl: (url: string) => void;
  localModel: string;
  setLocalModel: (model: string) => void;
}

const OPENROUTER_PRESETS = [
  { label: 'DeepSeek V4 Flash', id: 'deepseek/deepseek-v4-flash' },
  { label: 'Claude 3.5 Sonnet', id: 'anthropic/claude-3.5-sonnet' },
  { label: 'Llama 3.3 70B', id: 'meta-llama/llama-3.3-70b-instruct' },
];

export const StepConnectAI: React.FC<StepConnectAIProps> = ({
  aiProvider,
  setAiProvider,
  openrouterApiKey,
  setOpenrouterApiKey,
  openrouterModel,
  setOpenrouterModel,
  localPreset,
  setLocalPreset,
  localBaseUrl,
  setLocalBaseUrl,
  localModel,
  setLocalModel,
}) => {
  const { testConnection } = useSettings();
  const playSound = useSoundStore((s) => s.playSound);

  const [showApiKey, setShowApiKey] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    state: 'idle' | 'testing' | 'success' | 'error';
    message?: string;
  }>({ state: 'idle' });

  const handleProviderToggle = (provider: 'openrouter' | 'local') => {
    if (provider !== aiProvider) {
      playSound(provider === 'openrouter' ? 'ui.toggle.on' : 'ui.toggle.off');
      setAiProvider(provider);
      setTestStatus({ state: 'idle' });
    }
  };

  const handleToggleGuide = () => {
    const nextState = !guideOpen;
    playSound(nextState ? 'panel.open' : 'panel.close');
    setGuideOpen(nextState);
  };

  const handleSelectLocalPreset = (preset: 'ollama' | 'lmstudio' | 'custom') => {
    playSound('ui.button.primary');
    setLocalPreset(preset);
    if (preset === 'ollama') {
      setLocalBaseUrl('http://127.0.0.1:11434/v1');
      if (!localModel || localModel === 'local-model') {
        setLocalModel('llama3');
      }
    } else if (preset === 'lmstudio') {
      setLocalBaseUrl('http://127.0.0.1:1234/v1');
      if (!localModel || localModel === 'llama3') {
        setLocalModel('local-model');
      }
    }
    setTestStatus({ state: 'idle' });
  };

  const handleTestConnection = async () => {
    if (aiProvider === 'openrouter' && !openrouterApiKey.trim()) {
      playSound('operation.error');
      setTestStatus({
        state: 'error',
        message: 'OpenRouter API key is required to test connection',
      });
      return;
    }

    playSound('ui.button.primary');
    setTestStatus({ state: 'testing' });

    try {
      const payload =
        aiProvider === 'openrouter'
          ? {
              provider: 'openrouter',
              apiKey: openrouterApiKey,
              model: openrouterModel || 'deepseek/deepseek-v4-flash',
            }
          : {
              provider: 'local',
              baseUrl: localBaseUrl || 'http://127.0.0.1:11434/v1',
              model: localModel || 'llama3',
            };

      const result = await testConnection.mutateAsync(payload);
      if (result.success) {
        playSound('operation.success');
        setTestStatus({
          state: 'success',
          message: result.message || `Connected successfully (${result.latencyMs ?? 0}ms)`,
        });
      } else {
        playSound('operation.error');
        setTestStatus({
          state: 'error',
          message: result.message || 'Connection test failed. Check settings.',
        });
      }
    } catch (err: unknown) {
      playSound('operation.error');
      const errMessage = err instanceof Error ? err.message : 'Connection failed';
      setTestStatus({
        state: 'error',
        message: errMessage,
      });
    }
  };

  return (
    <div className="flex flex-col h-full py-1">
      {/* Step Header */}
      <div className="space-y-1.5 text-center mb-4">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink font-display">
          Connect Intelligence Engine
        </h2>
        <p className="text-xs sm:text-sm text-ink-muted max-w-md mx-auto">
          Omnitome synthesizes chapter summaries, semantic indices, and knowledge graphs
          via local or cloud LLMs.
        </p>
      </div>

      {/* Segmented Control Toggle */}
      <div className="flex p-1 bg-[rgb(var(--surface)/0.80)] border border-line/60 rounded-xl max-w-sm mx-auto mb-4 w-full">
        <button
          type="button"
          onClick={() => handleProviderToggle('openrouter')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
            aiProvider === 'openrouter'
              ? 'bg-accent text-accent-ink shadow-sm'
              : 'text-ink-muted hover:text-ink hover:bg-[rgb(var(--subtle)/0.50)]'
          }`}
        >
          <Cloud className="w-4 h-4" />
          <span>Cloud (OpenRouter)</span>
        </button>
        <button
          type="button"
          onClick={() => handleProviderToggle('local')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
            aiProvider === 'local'
              ? 'bg-accent text-accent-ink shadow-sm'
              : 'text-ink-muted hover:text-ink hover:bg-[rgb(var(--subtle)/0.50)]'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Local (Ollama / LMS)</span>
        </button>
      </div>

      {/* Configuration View Area */}
      <div className="space-y-4 max-w-lg mx-auto w-full flex-1">
        {aiProvider === 'openrouter' ? (
          <div className="space-y-3.5">
            {/* API Key Input */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-medium text-ink flex items-center justify-between">
                <span>OpenRouter API Key</span>
                <span className="text-[10px] text-ink-muted">Encrypted locally</span>
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={openrouterApiKey}
                  onChange={(e) => {
                    setOpenrouterApiKey(e.target.value);
                    setTestStatus({ state: 'idle' });
                  }}
                  placeholder="sk-or-v1-..."
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-line/60 bg-[rgb(var(--surface)/0.60)] text-ink placeholder:text-ink-muted/50 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink rounded"
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Model Selection */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-medium text-ink flex items-center justify-between">
                <span>Model Preset</span>
                <span className="text-[10px] font-mono text-ink-muted truncate max-w-[200px]">{openrouterModel}</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {OPENROUTER_PRESETS.map((p) => {
                  const isCurrent =
                    openrouterModel === p.id ||
                    (p.id === 'deepseek/deepseek-v4-flash' && openrouterModel === 'deepseek/deepseek-chat');
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        playSound('ui.button.primary');
                        setOpenrouterModel(p.id);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        isCurrent
                          ? 'border-accent bg-accent/15 text-accent shadow-xs'
                          : 'border-line/60 bg-[rgb(var(--surface)/0.50)] text-ink-muted hover:text-ink hover:border-line'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Collapsible OpenRouter Guide Accordion */}
            <div className="rounded-xl border border-line/60 bg-[rgb(var(--surface)/0.50)] overflow-hidden text-left">
              <button
                type="button"
                onClick={handleToggleGuide}
                className="w-full flex items-center justify-between p-3 text-xs font-medium text-ink hover:bg-[rgb(var(--subtle)/0.30)] transition-colors"
              >
                <span className="flex items-center gap-1.5 text-accent">
                  <Sparkles className="w-3.5 h-3.5" />
                  How to get an OpenRouter key
                </span>
                {guideOpen ? (
                  <ChevronUp className="w-4 h-4 text-ink-muted" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-ink-muted" />
                )}
              </button>

              {guideOpen && (
                <div className="p-3.5 pt-0 space-y-2 text-[11px] text-ink-muted border-t border-line/40">
                  <ol className="list-decimal list-inside space-y-1.5 pl-1">
                    <li>
                      Visit the{' '}
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-accent underline hover:opacity-80"
                      >
                        OpenRouter API Keys page <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                    <li>Create an account and generate a new key with spending limits.</li>
                    <li>
                      Paste your key above. Your key is stored securely in local storage and
                      never leaves your device.
                    </li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Preset Selector */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-medium text-ink">Local Provider</label>
              <div className="grid grid-cols-3 gap-2">
                {(['ollama', 'lmstudio', 'custom'] as const).map((preset) => {
                  const isCurrent = localPreset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSelectLocalPreset(preset)}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-all ${
                        isCurrent
                          ? 'border-accent bg-accent/15 text-accent shadow-xs'
                          : 'border-line/60 bg-[rgb(var(--surface)/0.50)] text-ink-muted hover:text-ink hover:border-line'
                      }`}
                    >
                      {preset === 'ollama' ? 'Ollama' : preset === 'lmstudio' ? 'LM Studio' : 'Custom'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Base URL Input */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-medium text-ink">Local API Base URL</label>
              <input
                type="text"
                value={localBaseUrl}
                onChange={(e) => {
                  setLocalBaseUrl(e.target.value);
                  setTestStatus({ state: 'idle' });
                }}
                placeholder="http://127.0.0.1:11434/v1"
                className="w-full px-3.5 py-2 rounded-xl border border-line/60 bg-[rgb(var(--surface)/0.60)] text-ink placeholder:text-ink-muted/50 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
            </div>

            {/* Model Name Input */}
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-medium text-ink">Model Name</label>
              <input
                type="text"
                value={localModel}
                onChange={(e) => {
                  setLocalModel(e.target.value);
                  setTestStatus({ state: 'idle' });
                }}
                placeholder="llama3"
                className="w-full px-3.5 py-2 rounded-xl border border-line/60 bg-[rgb(var(--surface)/0.60)] text-ink placeholder:text-ink-muted/50 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
              />
            </div>

            {/* Privacy Guarantee Note */}
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[rgb(var(--surface)/0.40)] border border-line/40 text-[11px] text-ink-muted">
              <ShieldCheck className="w-4 h-4 text-accent flex-shrink-0" />
              <span>Zero cloud egress. All text synthesis runs strictly on local machine hardware.</span>
            </div>
          </div>
        )}

        {/* Test Connection Button & Status */}
        <div className="pt-1 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testStatus.state === 'testing'}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-line/60 bg-[rgb(var(--surface)/0.60)] hover:bg-surface text-ink text-xs font-medium transition-colors disabled:opacity-50"
          >
            {testStatus.state === 'testing' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                <span>Verifying endpoint...</span>
              </>
            ) : (
              <span>Test Connection</span>
            )}
          </button>

          {testStatus.state === 'success' && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{testStatus.message}</span>
            </div>
          )}

          {testStatus.state === 'error' && (
            <div className="flex items-center gap-1.5 text-[11px] text-warn">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{testStatus.message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
