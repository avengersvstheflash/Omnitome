import { useState, useEffect, useCallback } from 'react';

let activeInstances = 0;
let keydownListener: ((e: KeyboardEvent) => void) | null = null;

/**
 * Safely toggle full-screen using HTML5 Fullscreen API with vendor fallback.
 */
export async function toggleFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;

  try {
    const isFs = Boolean(
      document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement
    );

    if (!isFs) {
      const docEl = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      }
    } else {
      const doc = document as Document & {
        webkitExitFullscreen?: () => Promise<void>;
      };
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      }
    }
  } catch (err) {
    console.warn('[useFullscreen] Failed to toggle fullscreen mode:', err);
  }
}

/**
 * Hook providing reactive full-screen state and toggle control,
 * with automatic F11 keyboard shortcut management and Esc sync.
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return Boolean(
      document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement
    );
  });

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
          (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement
      );
      setIsFullscreen(isFs);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    // Register a single global F11 keydown listener reference-counted across hook instances
    if (activeInstances === 0) {
      keydownListener = (e: KeyboardEvent) => {
        if (e.key === 'F11') {
          e.preventDefault();
          toggleFullscreen();
        }
      };
      window.addEventListener('keydown', keydownListener);
    }
    activeInstances++;

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);

      activeInstances--;
      if (activeInstances === 0 && keydownListener) {
        window.removeEventListener('keydown', keydownListener);
        keydownListener = null;
      }
    };
  }, []);

  const handleToggle = useCallback(() => {
    toggleFullscreen();
  }, []);

  return {
    isFullscreen,
    toggleFullscreen: handleToggle,
  };
}

