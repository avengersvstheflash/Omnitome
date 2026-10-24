import React, { useState, useEffect, useCallback } from 'react';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import { OnboardingStep, OnboardingWizardProps } from './types';
import { StepWelcome } from './StepWelcome';
import { StepTheme } from './StepTheme';
import { StepConnectAI } from './StepConnectAI';
import { StepStarterPack } from './StepStarterPack';
import { StepFinish } from './StepFinish';
import { useThemeStore } from '../../store/useThemeStore';
import { useSoundStore } from '../../store/useSoundStore';
import { useSettings } from '../../hooks/useSettings';
import { Theme } from '../../types/domain';

export const WelcomeWizard: React.FC<OnboardingWizardProps> = ({ onClose }) => {
  const currentTheme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const { playSound, playThemeSwitch } = useSoundStore();
  const { settings, updateSettings } = useSettings();

  const [step, setStep] = useState<OnboardingStep>(1);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  // Step 2: Theme
  const [selectedTheme, setSelectedTheme] = useState<Theme>(currentTheme);

  // Step 3: AI Configuration
  const [aiProvider, setAiProvider] = useState<'openrouter' | 'local'>('openrouter');
  const [openrouterApiKey, setOpenrouterApiKey] = useState<string>('');
  const [openrouterModel, setOpenrouterModel] = useState<string>('deepseek/deepseek-v4-flash');
  const [localPreset, setLocalPreset] = useState<'ollama' | 'lmstudio' | 'custom'>('ollama');
  const [localBaseUrl, setLocalBaseUrl] = useState<string>('http://127.0.0.1:11434/v1');
  const [localModel, setLocalModel] = useState<string>('llama3');

  // Step 4: Starter Pack
  const [starterPackStatus, setStarterPackStatus] = useState<
    'idle' | 'installing' | 'installed' | 'skipped'
  >('idle');
  const [starterPackProgress, setStarterPackProgress] = useState<number>(0);

  const hasHydratedSettings = React.useRef(false);

  // Play sound when wizard opens
  useEffect(() => {
    playSound('nav.dialog.open');
  }, [playSound]);

  // Hydrate settings if available (only on initial load)
  useEffect(() => {
    if (settings && !hasHydratedSettings.current) {
      hasHydratedSettings.current = true;
      if (settings.aiProvider === 'local' || settings.aiProvider === 'ollama') {
        setAiProvider('local');
      } else if (settings.aiProvider === 'openrouter') {
        setAiProvider('openrouter');
      }

      if (settings.openrouter?.apiKey || settings.openrouterApiKey) {
        setOpenrouterApiKey(settings.openrouter?.apiKey || settings.openrouterApiKey || '');
      }
      if (settings.openrouter?.model) {
        setOpenrouterModel(settings.openrouter.model);
      }

      if (settings.local?.baseUrl || settings.localBaseUrl) {
        setLocalBaseUrl(settings.local?.baseUrl || settings.localBaseUrl || 'http://127.0.0.1:11434/v1');
      }
      if (settings.local?.model) {
        setLocalModel(settings.local.model);
      }
      if (settings.local?.preset && (settings.local.preset === 'ollama' || settings.local.preset === 'lmstudio' || settings.local.preset === 'custom')) {
        setLocalPreset(settings.local.preset);
      }
    }
  }, [settings]);

  const markCompletedAndClose = useCallback(() => {
    try {
      localStorage.setItem('omnitome.onboarding.completed', 'true');
      localStorage.setItem('omnitome.onboarding.dismissed', 'true');
      localStorage.setItem('omnitome_onboarding_skipped', 'true');
    } catch {
      // Ignore localStorage issues
    }
    onClose();
  }, [onClose]);

  const handleSkip = useCallback(() => {
    playSound('ui.button.secondary');
    markCompletedAndClose();
  }, [playSound, markCompletedAndClose]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSkip]);

  const handleThemeSelect = (theme: Theme) => {
    setSelectedTheme(theme);
    setTheme(theme);
    playThemeSwitch(theme);
  };

  const persistAiSettings = async () => {
    try {
      await updateSettings.mutateAsync({
        aiProvider: aiProvider,
        openrouter: {
          apiKey: openrouterApiKey,
          model: openrouterModel,
        },
        local: {
          preset: localPreset,
          baseUrl: localBaseUrl,
          model: localModel,
        },
      });
    } catch (err) {
      console.warn('[WelcomeWizard] Failed to persist AI settings during step:', err);
    }
  };

  const handleNext = async () => {
    playSound('ui.button.primary');
    setDirection('forward');

    if (step === 3) {
      void persistAiSettings();
    }

    if (step === 4 && starterPackStatus === 'idle') {
      setStarterPackStatus('skipped');
    }

    if (step < 5) {
      setStep((s) => (s + 1) as OnboardingStep);
    }
  };

  const handleBack = () => {
    playSound('ui.button.secondary');
    setDirection('backward');
    if (step === 4 && starterPackStatus === 'installing') {
      setStarterPackStatus('idle');
      setStarterPackProgress(0);
    }
    if (step > 1) {
      setStep((s) => (s - 1) as OnboardingStep);
    }
  };

  const handleEnterLibrary = () => {
    playSound('operation.success');
    void persistAiSettings();
    markCompletedAndClose();
  };

  return (
    <>
      {/* Pure CSS slide animation keyframes scoped to WelcomeWizard */}
      <style>{`
        @keyframes wizardFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes wizardSlideForward {
          from {
            opacity: 0;
            transform: translateX(18px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes wizardSlideBackward {
          from {
            opacity: 0;
            transform: translateX(-18px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-wizard-fade-in {
          animation: wizardFadeIn 240ms ease-out forwards;
        }
        .animate-wizard-forward {
          animation: wizardSlideForward 280ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-wizard-backward {
          animation: wizardSlideBackward 280ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-wizard-fade-in,
          .animate-wizard-forward,
          .animate-wizard-backward {
            animation: none !important;
            transform: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-md animate-wizard-fade-in"
        role="dialog"
        aria-modal="true"
        aria-label="Omnitome Welcome Wizard"
      >
        {/* Wizard Shell */}
        <div className="relative w-full max-w-2xl bg-[rgb(var(--surface)/0.92)] backdrop-blur-2xl border border-line/60 rounded-3xl shadow-[0_25px_60px_-15px_rgb(var(--accent)/0.25)] flex flex-col overflow-hidden text-ink transition-colors duration-300 my-auto">
          {/* Top Dynamic Accent Gradient Line */}
          <div className="h-1 w-full bg-gradient-to-r from-accent via-accent/80 to-brand/40" />

          {/* Modal Header */}
          <div className="flex items-center justify-between px-5 sm:px-7 pt-5 pb-3 border-b border-line/40">
            {/* Left: Brand Sigil & Name */}
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
                <svg
                  className="w-3.5 h-3.5 select-none"
                  viewBox="0 0 48 48"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" />
                  <rect x="12" y="12" width="24" height="24" stroke="currentColor" strokeWidth="2" />
                  <polygon points="24,19 28,24 24,29 20,24" fill="currentColor" />
                </svg>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-semibold text-sm tracking-tight text-ink">
                  Omnitome
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30 font-medium">
                  v1.1.0
                </span>
              </div>
            </div>

            {/* Center: Step Dots (1 to 5) */}
            <div className="flex items-center gap-2">
              {([1, 2, 3, 4, 5] as const).map((stepNumber) => {
                const isCompleted = stepNumber < step;
                const isCurrent = stepNumber === step;

                return (
                  <div
                    key={stepNumber}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      isCurrent
                        ? 'w-6 bg-accent shadow-sm shadow-accent/50'
                        : isCompleted
                        ? 'w-2 bg-accent/60'
                        : 'w-2 bg-line'
                    }`}
                    title={`Step ${stepNumber}`}
                  />
                );
              })}
            </div>

            {/* Right: Skip Button */}
            <button
              type="button"
              onClick={handleSkip}
              className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink px-2.5 py-1 rounded-lg hover:bg-[rgb(var(--subtle)/0.50)] transition-colors"
              aria-label="Skip onboarding"
            >
              <span>Skip for now</span>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Modal Body: Dynamic Step Content Container */}
          <div className="px-5 sm:px-7 py-4 min-h-[440px] flex flex-col justify-between overflow-x-hidden">
            <div
              key={step}
              className={`flex-1 flex flex-col ${
                direction === 'forward' ? 'animate-wizard-forward' : 'animate-wizard-backward'
              }`}
            >
              {step === 1 && <StepWelcome onNext={handleNext} />}
              {step === 2 && (
                <StepTheme
                  selectedTheme={selectedTheme}
                  onSelectTheme={handleThemeSelect}
                />
              )}
              {step === 3 && (
                <StepConnectAI
                  aiProvider={aiProvider}
                  setAiProvider={setAiProvider}
                  openrouterApiKey={openrouterApiKey}
                  setOpenrouterApiKey={setOpenrouterApiKey}
                  openrouterModel={openrouterModel}
                  setOpenrouterModel={setOpenrouterModel}
                  localPreset={localPreset}
                  setLocalPreset={setLocalPreset}
                  localBaseUrl={localBaseUrl}
                  setLocalBaseUrl={setLocalBaseUrl}
                  localModel={localModel}
                  setLocalModel={setLocalModel}
                />
              )}
              {step === 4 && (
                <StepStarterPack
                  status={starterPackStatus}
                  progress={starterPackProgress}
                  setStatus={setStarterPackStatus}
                  setProgress={setStarterPackProgress}
                />
              )}
              {step === 5 && (
                <StepFinish
                  selectedTheme={selectedTheme}
                  aiProvider={aiProvider}
                  openrouterModel={openrouterModel}
                  localPreset={localPreset}
                  localModel={localModel}
                  starterPackStatus={starterPackStatus}
                  onEnterLibrary={handleEnterLibrary}
                />
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between px-5 sm:px-7 py-3.5 border-t border-line/40 bg-[rgb(var(--surface)/0.60)]">
            {/* Back Button */}
            <div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink px-3 py-1.5 rounded-xl hover:bg-[rgb(var(--subtle)/0.50)] transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              )}
            </div>

            {/* Step Counter Indicator */}
            <div className="text-[11px] font-mono text-ink-muted">
              Step {step} of 5
            </div>

            {/* Next / Primary Action Button */}
            <div>
              {step === 2 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-accent-ink font-medium text-xs shadow-md shadow-accent/20 hover:opacity-95 active:scale-[0.98] transition-all"
                >
                  <span>Next: Connect AI</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : step === 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-accent-ink font-medium text-xs shadow-md shadow-accent/20 hover:opacity-95 active:scale-[0.98] transition-all"
                >
                  <span>Next: Starter Pack</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : step === 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={starterPackStatus === 'installing'}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-accent-ink font-medium text-xs shadow-md shadow-accent/20 hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>
                    {starterPackStatus === 'installing'
                      ? 'Installing...'
                      : starterPackStatus === 'installed'
                      ? 'Next: Finalize'
                      : 'Continue'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
