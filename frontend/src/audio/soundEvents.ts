/**
 * frontend/src/audio/soundEvents.ts
 * Typed semantic UI sound events, canonical asset keys, priority tiers,
 * and event-to-asset routing map for Omnitome.
 */

export type ThemeId = 'omni' | 'sakura' | 'spring' | 'coffee' | 'cyberpunk';

export const VALID_THEMES: readonly ThemeId[] = [
  'omni',
  'sakura',
  'spring',
  'coffee',
  'cyberpunk',
] as const;

/**
 * The 18 canonical pre-rendered WAV stems per theme in `frontend/public/sounds/manifest.json`.
 */
export type CanonicalAssetKey =
  | 'button-primary'
  | 'button-secondary'
  | 'toggle-on'
  | 'toggle-off'
  | 'nav-primary'
  | 'tab-switch'
  | 'nav-back'
  | 'panel-open'
  | 'panel-close'
  | 'book-open'
  | 'mode-original'
  | 'mode-omni'
  | 'citation-jump'
  | 'import-start'
  | 'operation-success'
  | 'operation-error'
  | 'operation-cancel'
  | 'theme-switch';

export const CANONICAL_ASSET_KEYS: readonly CanonicalAssetKey[] = [
  'button-primary',
  'button-secondary',
  'toggle-on',
  'toggle-off',
  'nav-primary',
  'tab-switch',
  'nav-back',
  'panel-open',
  'panel-close',
  'book-open',
  'mode-original',
  'mode-omni',
  'citation-jump',
  'import-start',
  'operation-success',
  'operation-error',
  'operation-cancel',
  'theme-switch',
] as const;

/**
 * Semantic UI events emitted by application handlers (Section 4 & Section 6.3).
 */
export type UiSoundEvent =
  | 'ui.button.primary'
  | 'ui.button.secondary'
  | 'ui.toggle.on'
  | 'ui.toggle.off'
  | 'nav.primary.library'
  | 'nav.primary.research'
  | 'nav.primary.import'
  | 'nav.tab.switch'
  | 'nav.back'
  | 'nav.menu.open'
  | 'nav.menu.close'
  | 'nav.dialog.open'
  | 'nav.dialog.close'
  | 'panel.open'
  | 'panel.close'
  | 'library.book.select'
  | 'library.book.deselect'
  | 'library.book.open'
  | 'library.book.read'
  | 'library.book.omni_read'
  | 'library.selection.enter'
  | 'library.selection.clear'
  | 'library.sample.load_start'
  | 'reader.chapter.next'
  | 'reader.chapter.previous'
  | 'reader.representation.original'
  | 'reader.representation.smart'
  | 'reader.mode.original'
  | 'reader.mode.omni'
  | 'reader.citation.jump'
  | 'reader.citation.copy'
  | 'reader.contents.open'
  | 'reader.fullscreen.toggle'
  | 'import.start'
  | 'import.user_start'
  | 'import.processing_started'
  | 'import.completed'
  | 'import.failed'
  | 'import.cancelled'
  | 'job.queue.open'
  | 'job.completed'
  | 'job.failed'
  | 'job.retry'
  | 'operation.success'
  | 'operation.error'
  | 'operation-cancel'
  | 'operation.cancel'
  | 'operation.destructive_confirmed'
  | 'settings.open'
  | 'settings.theme.preview'
  | 'settings.theme.switch'
  | 'settings.saved'
  | 'form.validation_error'
  | 'toast.success'
  | 'toast.warning'
  | 'toast.error'
  | 'clipboard.success';

export type SoundPriority = 'low' | 'normal' | 'high';

/**
 * Maps every semantic `UiSoundEvent` to one of the 18 canonical WAV asset keys.
 */
export const SEMANTIC_EVENT_TO_ASSET: Record<UiSoundEvent, CanonicalAssetKey> = {
  'ui.button.primary': 'button-primary',
  'ui.button.secondary': 'button-secondary',
  'ui.toggle.on': 'toggle-on',
  'ui.toggle.off': 'toggle-off',

  'nav.primary.library': 'nav-primary',
  'nav.primary.research': 'nav-primary',
  'nav.primary.import': 'nav-primary',
  'nav.tab.switch': 'tab-switch',
  'nav.back': 'nav-back',

  'nav.menu.open': 'panel-open',
  'nav.menu.close': 'panel-close',
  'nav.dialog.open': 'panel-open',
  'nav.dialog.close': 'panel-close',
  'panel.open': 'panel-open',
  'panel.close': 'panel-close',

  'library.book.select': 'button-secondary',
  'library.book.deselect': 'button-secondary',
  'library.book.open': 'book-open',
  'library.book.read': 'mode-original',
  'library.book.omni_read': 'mode-omni',
  'library.selection.enter': 'button-secondary',
  'library.selection.clear': 'button-secondary',
  'library.sample.load_start': 'import-start',

  'reader.chapter.next': 'nav-primary',
  'reader.chapter.previous': 'nav-back',
  'reader.representation.original': 'mode-original',
  'reader.representation.smart': 'mode-omni',
  'reader.mode.original': 'mode-original',
  'reader.mode.omni': 'mode-omni',
  'reader.citation.jump': 'citation-jump',
  'reader.citation.copy': 'button-secondary',
  'reader.contents.open': 'panel-open',
  'reader.fullscreen.toggle': 'toggle-on',

  'import.start': 'import-start',
  'import.user_start': 'import-start',
  'import.processing_started': 'import-start',
  'import.completed': 'operation-success',
  'import.failed': 'operation-error',
  'import.cancelled': 'operation-cancel',

  'job.queue.open': 'panel-open',
  'job.completed': 'operation-success',
  'job.failed': 'operation-error',
  'job.retry': 'button-secondary',

  'operation.success': 'operation-success',
  'operation.error': 'operation-error',
  'operation-cancel': 'operation-cancel',
  'operation.cancel': 'operation-cancel',
  'operation.destructive_confirmed': 'operation-cancel',

  'settings.open': 'panel-open',
  'settings.theme.preview': 'theme-switch',
  'settings.theme.switch': 'theme-switch',
  'settings.saved': 'operation-success',

  'form.validation_error': 'operation-error',
  'toast.success': 'operation-success',
  'toast.warning': 'button-secondary',
  'toast.error': 'operation-error',
  'clipboard.success': 'button-secondary',
};

/**
 * Numeric rank matching Section 4.6 priority hierarchy:
 *   5 = Explicit theme switch
 *   4 = Important operation completion / failure
 *   3 = Reader navigation or provenance citation action
 *   2 = User navigation / tab / panel action
 *   1 = Generic button / selection / clipboard interaction
 */
export function getEventPriorityRank(event: UiSoundEvent, explicit?: SoundPriority): number {
  if (explicit === 'high') return 5;
  if (explicit === 'low') return 1;

  const asset = SEMANTIC_EVENT_TO_ASSET[event];
  switch (asset) {
    case 'theme-switch':
      return 5;
    case 'operation-success':
    case 'operation-error':
    case 'operation-cancel':
    case 'import-start':
      return 4;
    case 'citation-jump':
    case 'mode-original':
    case 'mode-omni':
    case 'book-open':
      return 3;
    case 'nav-primary':
    case 'tab-switch':
    case 'nav-back':
    case 'panel-open':
    case 'panel-close':
      return 2;
    default:
      return 1;
  }
}

/**
 * Resolve a semantic UI event + theme ID into the manifest lookup key (`<theme>.<assetKey>`).
 */
export function resolveManifestAssetKey(
  event: UiSoundEvent,
  theme: ThemeId
): { manifestKey: string; assetKey: CanonicalAssetKey } {
  const assetKey = SEMANTIC_EVENT_TO_ASSET[event] ?? 'button-primary';
  return {
    manifestKey: `${theme}.${assetKey}`,
    assetKey,
  };
}
