/**
 * frontend/src/audio/soundPlayer.ts
 * Runtime pre-rendered WAV buffer loader, manifest validator, and Web Audio playback manager.
 *
 * Architecture guarantees (v2.0 Spec):
 * - Zero runtime synthesis: no OscillatorNode, BiquadFilterNode, or noise generators at runtime.
 * - Loads `frontend/public/sounds/manifest.json` and decodes pre-rendered 48kHz PCM16 WAV files
 *   into cached `AudioBuffer` instances keyed by `<theme>.<assetKey>`.
 * - Single shared `AudioContext` and master `GainNode` bus.
 * - Respects user gesture autoplay unlock, global mute/volume (0-100 perceptual curve),
 *   theme-switch sound toggle, 4-voice polyphony cap, interaction priority coalescing,
 *   operation ID deduplication, and Kokoro TTS narration suppression.
 */

import {
  type ThemeId,
  type UiSoundEvent,
  type CanonicalAssetKey,
  type SoundPriority,
  VALID_THEMES,
  CANONICAL_ASSET_KEYS,
  getEventPriorityRank,
  resolveManifestAssetKey,
} from './soundEvents';

export {
  type ThemeId,
  type UiSoundEvent,
  type CanonicalAssetKey,
  type SoundPriority,
  VALID_THEMES,
  CANONICAL_ASSET_KEYS,
  resolveManifestAssetKey,
};

export interface SoundAssetEntry {
  path: string;
  durationMs: number;
  peakDbfs: number;
  rmsDbfs: number;
  sha256: string;
  [extraKey: string]: unknown;
}

export interface SoundManifest {
  schemaVersion: number;
  generatorVersion: string;
  format: {
    container: string;
    codec: string;
    sampleRateHz: number;
    channels: number;
    bitsPerSample: number;
  };
  themes: ThemeId[];
  assets: Record<string, SoundAssetEntry>;
}

export interface UiSoundSettings {
  enabled: boolean;
  volume: number; // 0..100 (default 24 per spec Section 6.9)
  themeSwitchEnabled: boolean;
}

export interface PlayUiSoundOptions {
  theme?: ThemeId;
  dedupeKey?: string;
  priority?: SoundPriority;
  /**
   * Optional explicit toggle state when calling a generic toggle handler.
   */
  toggleState?: boolean;
}

export interface PreloadOptions {
  themes?: ThemeId[];
  baseUrl?: string;
  preloadRemainingOnIdle?: boolean;
}

const STORAGE_KEYS = {
  enabled: 'omnitome.sound.enabled',
  volume: 'omnitome.sound.volume',
  themeSwitch: 'omnitome.sound.themeSwitch',
} as const;

const DEFAULT_SETTINGS: UiSoundSettings = {
  enabled: true,
  volume: 24,
  themeSwitchEnabled: true,
};

const MAX_CONCURRENT_VOICES = 4;
const SAME_EVENT_DEBOUNCE_MS = 40;
const PRIORITY_COALESCE_WINDOW_MS = 35;
const THEME_SWITCH_COALESCE_MS = 140;
const MAX_DEDUPE_HISTORY = 256;

interface ActiveVoice {
  id: number;
  event: UiSoundEvent;
  assetKey: CanonicalAssetKey;
  priorityRank: number;
  startedAtMs: number;
  source: AudioBufferSourceNode;
  gainNode: GainNode;
}

// Module-scoped singleton state (at most one shared AudioContext in the app)
let audioCtx: AudioContext | null = null;
let masterGainNode: GainNode | null = null;
let gestureListenersAttached = false;

let manifestCache: SoundManifest | null = null;
let manifestLoadPromise: Promise<SoundManifest | null> | null = null;
let resolvedSoundsBaseUrl: string | null = null;

const bufferCache = new Map<string, AudioBuffer>();
const inflightBufferLoads = new Map<string, Promise<AudioBuffer | null>>();
const activeVoices = new Set<ActiveVoice>();
const lastEventTimestampMs = new Map<string, number>();
const completedDedupeKeys = new Set<string>();

let lastTriggeredRank = 0;
let lastTriggeredAtMs = 0;
let voiceCounter = 0;
let themeSwitchTimer: ReturnType<typeof setTimeout> | null = null;

let currentSettings: UiSoundSettings = loadPersistedSettings();
let activeThemeResolver: () => ThemeId = detectThemeFromDom;
let isKokoroNarrationActive = false;
const settingsListeners = new Set<(settings: UiSoundSettings) => void>();

/**
 * Clamp a numeric volume into an integer in [0, 100].
 */
function clampVolume(vol: unknown): number {
  const num = typeof vol === 'number' ? vol : Number(vol);
  if (!Number.isFinite(num)) return DEFAULT_SETTINGS.volume;
  return Math.max(0, Math.min(100, Math.round(num)));
}

/**
 * Map a 0..100 UI volume slider to a perceptual linear gain in [0.0, 1.0].
 * `0` is guaranteed to return `0.0` (exact silence).
 */
export function masterVolumeCurve(volume0to100: number): number {
  const clamped = clampVolume(volume0to100);
  if (clamped <= 0) return 0.0;
  const normalized = clamped / 100.0;
  // Power curve (exponent 2.2) gives natural loudness scaling across 1..100
  return Math.pow(normalized, 2.2);
}

/**
 * Load persisted sound settings from `localStorage` with malformed-data recovery.
 */
function loadPersistedSettings(): UiSoundSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const rawEnabled = window.localStorage.getItem(STORAGE_KEYS.enabled);
    const rawVolume = window.localStorage.getItem(STORAGE_KEYS.volume);
    const rawThemeSwitch = window.localStorage.getItem(STORAGE_KEYS.themeSwitch);

    return {
      enabled: rawEnabled === null ? DEFAULT_SETTINGS.enabled : rawEnabled !== 'false',
      volume: rawVolume === null ? DEFAULT_SETTINGS.volume : clampVolume(Number(rawVolume)),
      themeSwitchEnabled:
        rawThemeSwitch === null ? DEFAULT_SETTINGS.themeSwitchEnabled : rawThemeSwitch !== 'false',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save current settings to `localStorage` safely.
 */
function persistSettings(settings: UiSoundSettings): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.enabled, String(settings.enabled));
    window.localStorage.setItem(STORAGE_KEYS.volume, String(settings.volume));
    window.localStorage.setItem(STORAGE_KEYS.themeSwitch, String(settings.themeSwitchEnabled));
  } catch {
    // Ignore storage quota or private-browsing exceptions
  }
}

/**
 * Detect active theme from `<html data-theme="...">` or `<body data-theme="...">`,
 * defaulting to `'omni'`.
 */
function detectThemeFromDom(): ThemeId {
  if (typeof document !== 'undefined') {
    const attr =
      document.documentElement.getAttribute('data-theme') ??
      document.body?.getAttribute('data-theme');
    if (attr && (VALID_THEMES as readonly string[]).includes(attr)) {
      return attr as ThemeId;
    }
  }
  return 'omni';
}

/**
 * Resolve Vite / Tauri public asset base URL for `/sounds`.
 */
export function resolveSoundsBaseUrl(explicitBaseUrl?: string): string {
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/+$/, '');
  }
  if (resolvedSoundsBaseUrl) {
    return resolvedSoundsBaseUrl;
  }

  let viteBase = '/';
  try {
    const metaEnv = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
    if (metaEnv && typeof metaEnv.BASE_URL === 'string' && metaEnv.BASE_URL.length > 0) {
      viteBase = metaEnv.BASE_URL;
    }
  } catch {
    viteBase = '/';
  }

  const normalizedBase = viteBase.endsWith('/') ? viteBase : `${viteBase}/`;
  resolvedSoundsBaseUrl = `${normalizedBase}sounds`;
  return resolvedSoundsBaseUrl;
}

/**
 * Validate a parsed `manifest.json` object against the Section 6.6 schema contract.
 * Tolerates unknown future keys while strictly verifying required fields and path safety.
 */
export function validateSoundManifest(raw: unknown): SoundManifest | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (obj.schemaVersion !== 1) return null;
  if (!obj.format || typeof obj.format !== 'object') return null;
  if (!obj.assets || typeof obj.assets !== 'object') return null;

  const assets = obj.assets as Record<string, unknown>;
  for (const [key, entry] of Object.entries(assets)) {
    if (!entry || typeof entry !== 'object') return null;
    const item = entry as Record<string, unknown>;
    if (typeof item.path !== 'string' || item.path.length === 0) return null;
    // Prevent path traversal or external URL injection
    if (
      item.path.includes('..') ||
      item.path.startsWith('/') ||
      item.path.startsWith('http:') ||
      item.path.startsWith('https:')
    ) {
      return null;
    }
    if (typeof item.durationMs !== 'number' || !Number.isFinite(item.durationMs)) return null;
    if (typeof item.peakDbfs !== 'number' || !Number.isFinite(item.peakDbfs)) return null;
    if (typeof item.rmsDbfs !== 'number' || !Number.isFinite(item.rmsDbfs)) return null;
    if (typeof item.sha256 !== 'string' || item.sha256.length < 32) return null;
    if (!key.includes('.')) return null;
  }

  return obj as unknown as SoundManifest;
}

/**
 * Lazily initialize the single shared `AudioContext` and master `GainNode`.
 */
function ensureAudioContext(): AudioContext | null {
  if (audioCtx && audioCtx.state !== 'closed') return audioCtx;
  if (typeof window === 'undefined') return null;

  const AudioCtxCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtxCtor) return null;

  try {
    audioCtx = new AudioCtxCtor();
    masterGainNode = audioCtx.createGain();
    masterGainNode.gain.value = currentSettings.enabled
      ? masterVolumeCurve(currentSettings.volume)
      : 0.0;
    masterGainNode.connect(audioCtx.destination);
    gestureListenersAttached = false;
    attachUserGestureUnlock();
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Return the shared unlocked AudioContext instance, lazily initialized if needed.
 */
export function getSharedAudioContext(): AudioContext | null {
  return ensureAudioContext();
}

/**
 * Synchronously or asynchronously resume the shared AudioContext if it is suspended.
 */
export function resumeAudioContext(): Promise<void> {
  const ctx = ensureAudioContext();
  if (ctx && ctx.state === 'suspended') {
    return ctx.resume();
  }
  return Promise.resolve();
}

/**
 * Attach one-time user gesture listeners to resume a suspended `AudioContext`
 * on the first genuine pointer or keyboard interaction without emitting any startup sound.
 */
function attachUserGestureUnlock(): void {
  if (gestureListenersAttached || typeof window === 'undefined') return;
  gestureListenersAttached = true;

  const removeListeners = () => {
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
    gestureListenersAttached = false;
  };

  const unlock = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx
        .resume()
        .then(() => {
          if (audioCtx && audioCtx.state === 'running') {
            removeListeners();
          }
        })
        .catch(() => {});
    } else if (audioCtx && audioCtx.state === 'running') {
      removeListeners();
    }
  };

  window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  window.addEventListener('keydown', unlock, { capture: true, passive: true });
}

/**
 * Load and validate `manifest.json` from the public sounds directory.
 */
export async function loadSoundManifest(baseUrl?: string): Promise<SoundManifest | null> {
  if (manifestCache) return manifestCache;
  if (manifestLoadPromise) return manifestLoadPromise;

  const rootUrl = resolveSoundsBaseUrl(baseUrl);
  const manifestUrl = `${rootUrl}/manifest.json`;

  manifestLoadPromise = (async () => {
    try {
      const response = await fetch(manifestUrl, { cache: 'force-cache' });
      if (!response.ok) return null;
      const json: unknown = await response.json();
      const validated = validateSoundManifest(json);
      if (validated) {
        manifestCache = validated;
      }
      return validated;
    } catch {
      return null;
    } finally {
      manifestLoadPromise = null;
    }
  })();

  return manifestLoadPromise;
}

/**
 * Fetch and decode a single WAV asset into the shared `AudioBuffer` cache.
 */
async function loadAndDecodeAsset(
  manifestKey: string,
  baseUrl?: string
): Promise<AudioBuffer | null> {
  const existing = bufferCache.get(manifestKey);
  if (existing) return existing;

  const inflight = inflightBufferLoads.get(manifestKey);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const manifest = manifestCache ?? (await loadSoundManifest(baseUrl));
      if (!manifest) return null;

      const entry = manifest.assets[manifestKey];
      if (!entry) return null;

      const ctx = ensureAudioContext();
      if (!ctx) return null;

      const rootUrl = resolveSoundsBaseUrl(baseUrl);
      const assetUrl = `${rootUrl}/${entry.path}`;
      const res = await fetch(assetUrl, { cache: 'force-cache' });
      if (!res.ok) return null;

      const arrayBuf = await res.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuf);
      bufferCache.set(manifestKey, decoded);
      return decoded;
    } catch {
      return null;
    } finally {
      inflightBufferLoads.delete(manifestKey);
    }
  })();

  inflightBufferLoads.set(manifestKey, promise);
  return promise;
}

/**
 * Preload and decode pre-rendered UI sound assets into memory.
 * Defaults to loading all 18 events for the active theme plus all 5 `theme-switch` signatures,
 * then warming the remaining themes during browser idle time.
 */
export async function preloadUiSounds(options?: PreloadOptions): Promise<void> {
  const baseUrl = options?.baseUrl;
  const manifest = await loadSoundManifest(baseUrl);
  if (!manifest) return;

  const activeTheme = activeThemeResolver();
  const priorityThemes = options?.themes ?? [activeTheme];
  const primaryKeys = new Set<string>();

  // 1. All 18 events for the requested/active theme(s)
  for (const theme of priorityThemes) {
    for (const assetKey of CANONICAL_ASSET_KEYS) {
      primaryKeys.add(`${theme}.${assetKey}`);
    }
  }

  // 2. All 5 theme-switch signatures so switching into any theme is immediate
  for (const theme of VALID_THEMES) {
    primaryKeys.add(`${theme}.theme-switch`);
  }

  await Promise.all(
    Array.from(primaryKeys).map((manifestKey) => loadAndDecodeAsset(manifestKey, baseUrl))
  );

  // 3. Optionally preload the remaining themes during idle time
  if (options?.preloadRemainingOnIdle !== false && typeof window !== 'undefined') {
    const remainingKeys: string[] = [];
    for (const theme of VALID_THEMES) {
      for (const assetKey of CANONICAL_ASSET_KEYS) {
        const key = `${theme}.${assetKey}`;
        if (!primaryKeys.has(key) && !bufferCache.has(key)) {
          remainingKeys.push(key);
        }
      }
    }

    if (remainingKeys.length > 0) {
      const scheduleIdle =
        typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
          ? (cb: () => void) => window.requestIdleCallback(cb)
          : (cb: () => void) => setTimeout(cb, 250);

      scheduleIdle(() => {
        void Promise.all(remainingKeys.map((k) => loadAndDecodeAsset(k, baseUrl)));
      });
    }
  }
}

/**
 * Smoothly fade out and stop an active voice over 8ms to prevent clicks when evicting or coalescing.
 */
function fadeOutAndStopVoice(voice: ActiveVoice): void {
  activeVoices.delete(voice);
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    voice.gainNode.gain.cancelScheduledValues(now);
    voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);
    voice.gainNode.gain.linearRampToValueAtTime(0.0, now + 0.008);
    voice.source.stop(now + 0.009);
  } catch {
    try {
      voice.source.disconnect();
      voice.gainNode.disconnect();
    } catch {
      // Ignore already-disconnected node errors
    }
  }
}

/**
 * Internal buffer playback dispatcher once coalescing/priority checks pass.
 */
function triggerDecodedBuffer(
  event: UiSoundEvent,
  theme: ThemeId,
  priorityRank: number
): void {
  if (!currentSettings.enabled || currentSettings.volume <= 0) return;

  const safeTheme = (VALID_THEMES as readonly string[]).includes(theme) ? theme : 'omni';
  const { manifestKey, assetKey } = resolveManifestAssetKey(event, safeTheme);

  // Suppress ambient operation completion/error cues if Kokoro narration is actively speaking
  if (
    isKokoroNarrationActive &&
    (assetKey === 'operation-success' || assetKey === 'operation-error')
  ) {
    return;
  }

  const ctx = ensureAudioContext();
  if (!ctx || !masterGainNode) return;

  // Attempt non-blocking resume if gesture just occurred
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const buffer = bufferCache.get(manifestKey);
  if (!buffer) {
    // Trigger background load for next time; never play late
    void loadAndDecodeAsset(manifestKey);
    return;
  }

  // If this is a theme switch, fade out any in-progress theme-switch signature
  if (assetKey === 'theme-switch') {
    for (const v of Array.from(activeVoices)) {
      if (v.assetKey === 'theme-switch') {
        fadeOutAndStopVoice(v);
      }
    }
  }

  // Enforce polyphony cap (max 4 concurrent voices)
  if (activeVoices.size >= MAX_CONCURRENT_VOICES) {
    let candidateToEvict: ActiveVoice | null = null;
    for (const v of activeVoices) {
      if (
        !candidateToEvict ||
        v.priorityRank < candidateToEvict.priorityRank ||
        (v.priorityRank === candidateToEvict.priorityRank &&
          v.startedAtMs < candidateToEvict.startedAtMs)
      ) {
        candidateToEvict = v;
      }
    }
    if (candidateToEvict && candidateToEvict.priorityRank <= priorityRank) {
      fadeOutAndStopVoice(candidateToEvict);
    } else {
      return;
    }
  }

  try {
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 1.0;

    source.connect(voiceGain);
    voiceGain.connect(masterGainNode);

    const voiceRecord: ActiveVoice = {
      id: ++voiceCounter,
      event,
      assetKey,
      priorityRank,
      startedAtMs: performance.now(),
      source,
      gainNode: voiceGain,
    };

    activeVoices.add(voiceRecord);
    source.onended = () => {
      activeVoices.delete(voiceRecord);
      try {
        source.disconnect();
        voiceGain.disconnect();
      } catch {
        // Ignore cleanup errors
      }
    };

    source.start(0);
  } catch {
    // Fail silent on any Web Audio playback exception
  }
}

/**
 * Play a semantic UI sound event. Non-blocking and fail-silent.
 */
export function playUiSound(event: UiSoundEvent, options?: PlayUiSoundOptions): void {
  if (!currentSettings.enabled || currentSettings.volume <= 0) return;

  // Allow caller to pass explicit boolean toggleState for fullscreen/generic toggles
  let effectiveEvent = event;
  if (options?.toggleState !== undefined && event === 'reader.fullscreen.toggle') {
    effectiveEvent = options.toggleState ? 'ui.toggle.on' : 'ui.toggle.off';
  }

  // Suppress background operation and import chimes when Kokoro narration is actively speaking
  if (isKokoroNarrationActive && (effectiveEvent.startsWith('operation.') || effectiveEvent.startsWith('import.'))) {
    return;
  }

  const rawTheme = options?.theme ?? activeThemeResolver();
  const theme = (VALID_THEMES as readonly string[]).includes(rawTheme)
    ? (rawTheme as ThemeId)
    : 'omni';
  const { assetKey } = resolveManifestAssetKey(effectiveEvent, theme);

  // Respect dedicated theme-switch sound setting (except explicit preview button in Settings)
  if (
    assetKey === 'theme-switch' &&
    effectiveEvent !== 'settings.theme.preview' &&
    !currentSettings.themeSwitchEnabled
  ) {
    return;
  }

  // Deduplicate terminal job/import events by operation ID (`dedupeKey`)
  if (options?.dedupeKey) {
    const compositeDedupe = `${effectiveEvent}:${options.dedupeKey}`;
    if (completedDedupeKeys.has(compositeDedupe)) {
      return;
    }
    if (completedDedupeKeys.size >= MAX_DEDUPE_HISTORY) {
      const oldest = completedDedupeKeys.values().next().value;
      if (oldest) completedDedupeKeys.delete(oldest);
    }
    completedDedupeKeys.add(compositeDedupe);
  }

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const priorityRank = getEventPriorityRank(effectiveEvent, options?.priority);

  // Coalesce rapid theme-switch cycling (Section 5 Rule 4: 140ms coalescing)
  if (effectiveEvent === 'settings.theme.switch') {
    const targetTheme = options?.theme ?? activeThemeResolver();
    if (themeSwitchTimer) {
      clearTimeout(themeSwitchTimer);
    }
    for (const v of Array.from(activeVoices)) {
      if (v.assetKey === 'theme-switch') {
        fadeOutAndStopVoice(v);
      }
    }
    lastTriggeredRank = priorityRank;
    lastTriggeredAtMs = now;
    themeSwitchTimer = setTimeout(() => {
      themeSwitchTimer = null;
      triggerDecodedBuffer(effectiveEvent, targetTheme, priorityRank);
    }, THEME_SWITCH_COALESCE_MS);
    return;
  }

  // Priority suppression within the same interaction window (Section 4.6)
  if (
    now - lastTriggeredAtMs < PRIORITY_COALESCE_WINDOW_MS &&
    priorityRank < lastTriggeredRank
  ) {
    return;
  }

  // Same-event burst debounce (40ms)
  const prevEventTime = lastEventTimestampMs.get(effectiveEvent) ?? -Infinity;
  if (now - prevEventTime < SAME_EVENT_DEBOUNCE_MS) {
    return;
  }

  // If a higher-priority event arrives within the same interaction tick (<35ms) as a generic click,
  // fade out the lower-priority generic click immediately
  if (now - lastTriggeredAtMs < PRIORITY_COALESCE_WINDOW_MS && priorityRank > lastTriggeredRank) {
    for (const v of Array.from(activeVoices)) {
      if (v.priorityRank < priorityRank && now - v.startedAtMs < PRIORITY_COALESCE_WINDOW_MS) {
        fadeOutAndStopVoice(v);
      }
    }
  }

  lastEventTimestampMs.set(effectiveEvent, now);
  lastTriggeredRank = priorityRank;
  lastTriggeredAtMs = now;

  triggerDecodedBuffer(effectiveEvent, theme, priorityRank);
}

/**
 * Stop all currently playing UI SFX voices (never touches Kokoro TTS narration).
 */
export function stopAllUiSounds(): void {
  if (themeSwitchTimer) {
    clearTimeout(themeSwitchTimer);
    themeSwitchTimer = null;
  }
  for (const voice of Array.from(activeVoices)) {
    fadeOutAndStopVoice(voice);
  }
}

/**
 * Enable or disable UI sound effects globally and persist to `localStorage`.
 */
export function setUiSoundEnabled(enabled: boolean): void {
  currentSettings = { ...currentSettings, enabled: Boolean(enabled) };
  if (masterGainNode && audioCtx) {
    const targetGain = currentSettings.enabled
      ? masterVolumeCurve(currentSettings.volume)
      : 0.0;
    masterGainNode.gain.setValueAtTime(targetGain, audioCtx.currentTime);
  }
  if (!currentSettings.enabled) {
    stopAllUiSounds();
  }
  persistSettings(currentSettings);
  notifySettingsListeners();
}

/**
 * Set UI sound master volume (0..100) and persist to `localStorage`.
 */
export function setUiSoundVolume(volume0to100: number): void {
  const volume = clampVolume(volume0to100);
  currentSettings = { ...currentSettings, volume };
  if (masterGainNode && audioCtx) {
    const targetGain = currentSettings.enabled ? masterVolumeCurve(volume) : 0.0;
    masterGainNode.gain.setValueAtTime(targetGain, audioCtx.currentTime);
  }
  if (volume === 0) {
    stopAllUiSounds();
  }
  persistSettings(currentSettings);
  notifySettingsListeners();
}

/**
 * Enable or disable the theme-switch signature sound specifically.
 */
export function setUiThemeSwitchSoundEnabled(enabled: boolean): void {
  currentSettings = { ...currentSettings, themeSwitchEnabled: Boolean(enabled) };
  persistSettings(currentSettings);
  notifySettingsListeners();
}

/**
 * Read current UI sound settings snapshot.
 */
export function getUiSoundSettings(): UiSoundSettings {
  return { ...currentSettings };
}

/**
 * Subscribe to sound settings updates (for React hooks / Settings UI).
 */
export function subscribeUiSoundSettings(
  listener: (settings: UiSoundSettings) => void
): () => void {
  settingsListeners.add(listener);
  return () => {
    settingsListeners.delete(listener);
  };
}

function notifySettingsListeners(): void {
  const snapshot = getUiSoundSettings();
  for (const listener of settingsListeners) {
    listener(snapshot);
  }
}

/**
 * Register a custom callback to read the active theme from Zustand store if preferred over DOM attribute.
 */
export function registerThemeResolver(resolver: () => ThemeId): void {
  activeThemeResolver = resolver;
}

/**
 * Inform the UI SFX manager whether Kokoro-82M TTS narration is actively speaking.
 * When active, background operation completion/failure chimes are suppressed so speech is never interrupted.
 */
export function setKokoroNarrationActive(active: boolean): void {
  isKokoroNarrationActive = Boolean(active);
}

/**
 * Read-only diagnostic inspection for the internal developer Sound Lab (Section 6.10).
 */
export function getSoundLabDiagnostics(): {
  manifestLoaded: boolean;
  manifest: SoundManifest | null;
  decodedAssetKeys: string[];
  activeVoiceCount: number;
  contextState: AudioContextState | 'uninitialized';
} {
  return {
    manifestLoaded: manifestCache !== null,
    manifest: manifestCache,
    decodedAssetKeys: Array.from(bufferCache.keys()),
    activeVoiceCount: activeVoices.size,
    contextState: audioCtx ? audioCtx.state : 'uninitialized',
  };
}
