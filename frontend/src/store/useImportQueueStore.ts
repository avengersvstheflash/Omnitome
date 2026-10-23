import { create } from 'zustand';
import { apiClient, apiUrl } from '../api/client';
import { queryClient } from '../api/queryClient';
import { ImportTask, RawImportTask, normalizeImportTask } from '../types/domain';
import { playSuccessSound } from '../hooks/useSoundEffects';

interface QueueApiResponse {
  success: boolean;
  active: RawImportTask | null;
  queued: RawImportTask[];
  history: RawImportTask[];
  totalCount: number;
  pendingCount: number;
}

interface ImportQueueState {
  activeTask: ImportTask | null;
  queuedTasks: ImportTask[];
  historyTasks: ImportTask[];
  allTasks: ImportTask[];
  totalCount: number;
  pendingCount: number;
  isLoading: boolean;
  isPolling: boolean;
  isMinimized: boolean;
  isDismissed: boolean;
  isDockExpanded: boolean;
  hasActiveWork: boolean;
  etaSeconds: number | null;
  elapsedSeconds: number;

  // Actions
  fetchQueue: () => Promise<void>;
  toggleDock: () => void;
  setDockExpanded: (val: boolean) => void;
  enqueueFiles: (files: File[], dossierId?: string, replace?: boolean) => Promise<ImportTask[]>;
  enqueuePaste: (data: {
    title: string;
    author?: string;
    text: string;
    dossierId?: string;
    dossierTitle?: string;
    isNewDossier?: boolean;
    replace?: boolean;
  }) => Promise<ImportTask>;
  enqueueWeb: (data: {
    url: string;
    title?: string;
    author?: string;
    dossierId?: string;
    description?: string;
    contentType?: string;
  }) => Promise<ImportTask>;
  enqueueWebMulti: (data: {
    sources: { url: string; title: string }[];
    title?: string;
    dossierId?: string;
    description?: string;
    contentType?: string;
  }) => Promise<ImportTask>;
  cancelTask: (id: string) => Promise<boolean>;
  retryTask: (id: string) => Promise<ImportTask | null>;
  reorderTasks: (taskIds: string[]) => Promise<void>;
  removeTask: (id: string) => Promise<boolean>;
  clearCompleted: () => Promise<void>;
  toggleMinimized: () => void;
  setMinimized: (val: boolean) => void;
  dismiss: () => void;
  show: () => void;
}

interface ProgressTick {
  timestamp: number;
  progress: number;
}

// Predictive, monotonic ETA state tracker (F77)
const etaTracker = {
  taskId: null as string | null,
  stage: null as string | null,
  ticks: [] as ProgressTick[],
  lastMonotonicEta: null as number | null,
};

const DOCK_EXPANDED_KEY = 'omnitome.importDock.expanded';
const getStoredDockExpanded = (): boolean => {
  try {
    const val = localStorage.getItem(DOCK_EXPANDED_KEY);
    return val !== null ? JSON.parse(val) === true : true;
  } catch {
    return true;
  }
};

let pollTimer: ReturnType<typeof setTimeout> | null = null;

export const useImportQueueStore = create<ImportQueueState>((set, get) => {
  // Internal helper to calculate dynamic ETA (F77)
  const calculateEta = (activeTask: ImportTask | null): { etaSeconds: number | null; elapsedSeconds: number } => {
    if (!activeTask || !activeTask.startedAt || activeTask.status !== 'processing') {
      etaTracker.taskId = null;
      etaTracker.stage = null;
      etaTracker.ticks = [];
      etaTracker.lastMonotonicEta = null;
      return { etaSeconds: null, elapsedSeconds: 0 };
    }

    const now = Date.now();
    const startedMs = new Date(activeTask.startedAt).getTime();
    const elapsedSeconds = Math.max(1, Math.round((now - startedMs) / 1000));
    const progress = activeTask.progress;

    // Reset tracking if task changed
    if (etaTracker.taskId !== activeTask.id) {
      etaTracker.taskId = activeTask.id;
      etaTracker.stage = activeTask.stage;
      etaTracker.ticks = [];
      etaTracker.lastMonotonicEta = null;
    } else if (etaTracker.stage !== activeTask.stage) {
      // Rule 3: Reset rolling window when a new stage begins (preserving monotonic clamp across the task)
      etaTracker.stage = activeTask.stage;
      etaTracker.ticks = [];
    }

    // Record progress tick (rate-limited to at most one tick per 300ms)
    const lastTick = etaTracker.ticks[etaTracker.ticks.length - 1];
    if (!lastTick || now - lastTick.timestamp >= 300) {
      etaTracker.ticks.push({ timestamp: now, progress });
      if (etaTracker.ticks.length > 10) {
        etaTracker.ticks.shift();
      }
    }

    if (progress >= 100) {
      etaTracker.lastMonotonicEta = 0;
      return { etaSeconds: 0, elapsedSeconds };
    }

    // Require at least 5 ticks to compute reliable rolling rate
    if (etaTracker.ticks.length < 5) {
      return { etaSeconds: etaTracker.lastMonotonicEta, elapsedSeconds };
    }

    // Rule 1: Calculate rolling average progress rate over the last 5+ ticks
    const firstTick = etaTracker.ticks[0];
    const latestTick = etaTracker.ticks[etaTracker.ticks.length - 1];
    const windowSeconds = (latestTick.timestamp - firstTick.timestamp) / 1000;
    const windowProgressDelta = latestTick.progress - firstTick.progress;

    const remainingProgress = Math.max(0, 100 - progress);

    let observedRate: number | null = null;
    if (windowSeconds > 0 && windowProgressDelta > 0) {
      observedRate = windowProgressDelta / windowSeconds;
    } else if (elapsedSeconds > 0 && progress > 0) {
      // Fallback to cumulative average rate if progress hasn't moved within the rolling window
      observedRate = progress / elapsedSeconds;
    }

    let finalEta: number | null = etaTracker.lastMonotonicEta;
    if (observedRate && observedRate > 0) {
      const rawEta = Math.max(1, Math.min(3600, Math.round(remainingProgress / observedRate)));
      // Rule 2: Clamp to be monotonically non-increasing while a task is running (allow small jitter down, never up)
      if (etaTracker.lastMonotonicEta !== null) {
        finalEta = Math.min(etaTracker.lastMonotonicEta, rawEta);
      } else {
        finalEta = rawEta;
      }
    }

    etaTracker.lastMonotonicEta = finalEta;
    return { etaSeconds: finalEta, elapsedSeconds };
  };

  const scheduleNextPoll = (hasPendingWork: boolean) => {
    if (pollTimer) clearTimeout(pollTimer);
    const interval = hasPendingWork ? 1000 : 5000;
    pollTimer = setTimeout(() => {
      void get().fetchQueue();
    }, interval);
  };

  return {
    activeTask: null,
    queuedTasks: [],
    historyTasks: [],
    allTasks: [],
    totalCount: 0,
    pendingCount: 0,
    isLoading: false,
    isPolling: false,
    isMinimized: true,
    isDismissed: false,
    isDockExpanded: getStoredDockExpanded(),
    hasActiveWork: false,
    etaSeconds: null,
    elapsedSeconds: 0,

    fetchQueue: async () => {
      try {
        const res = await apiClient<QueueApiResponse>('/api/import/queue');
        const active = res.active ? normalizeImportTask(res.active) : null;
        const queued = (res.queued || []).map(normalizeImportTask);
        const rawHistory = (res.history || []).map(normalizeImportTask);
        const booksQueryState = queryClient.getQueryState(['books']);
        const isBooksRefetching =
          queryClient.isFetching({ queryKey: ['books'] }) > 0 ||
          Boolean(booksQueryState?.isInvalidated);

        const booksCache = queryClient.getQueryData<any>(['books']);
        const cachedBookList = Array.isArray(booksCache)
          ? booksCache
          : Array.isArray(booksCache?.books)
          ? booksCache.books
          : null;
        const knownBookIds = cachedBookList ? new Set(cachedBookList.map((b: any) => b.id)) : null;

        const prevActiveTaskId = get().activeTask?.id;
        const now = Date.now();

        const history = rawHistory.filter((t) => {
          if (['completed', 'failed', 'cancelled', 'interrupted'].includes(t.status)) {
            const bId = t.bookId || (t as any).book_id;
            // Protect newly finished tasks during the React Query cache refetch window
            if (isBooksRefetching) return true;
            if (t.id === prevActiveTaskId) return true;
            if (t.completedAt && now - new Date(t.completedAt).getTime() < 60000) return true;

            // When books cache is settled, prune tasks for deleted books
            if (bId && knownBookIds && !knownBookIds.has(bId)) {
              return false;
            }
          }
          return true;
        });

        const allTasks = [...(active ? [active] : []), ...queued, ...history];
        const pendingCount = queued.length + (active ? 1 : 0);
        const { etaSeconds, elapsedSeconds } = calculateEta(active);

        // Compute hasActiveWork: active OR queued OR recentFailed (within 30s)
        const recentFailed = history.some((t) => {
          const time = t.completedAt || t.startedAt || t.createdAt;
          return t.status === 'failed' && time && now - new Date(time).getTime() < 30000;
        });
        const hasActiveWork = Boolean(active || queued.length > 0 || recentFailed);

        // Auto undis-miss if new items appear in queue
        const shouldUnDismiss = pendingCount > 0 && get().isDismissed;

        const prevActive = get().activeTask;
        const prevPending = get().pendingCount;
        const prevCompletedIds = new Set(
          (get().historyTasks || []).filter((t) => t.status === 'completed').map((t) => t.id)
        );
        const hasNewlyCompletedTask = history.some(
          (t) => t.status === 'completed' && !prevCompletedIds.has(t.id)
        );
        const prevCompletedCount = (get().historyTasks || []).filter((t) => t.status === 'completed').length;
        const curCompletedCount = history.filter((t) => t.status === 'completed').length;
        const taskJustFinished =
          hasNewlyCompletedTask ||
          Boolean(prevActive && !active) ||
          curCompletedCount > prevCompletedCount ||
          (prevPending > 0 && pendingCount === 0);

        if (taskJustFinished) {
          if (curCompletedCount > prevCompletedCount || hasNewlyCompletedTask) {
            playSuccessSound();
          }
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
          queryClient.invalidateQueries({ queryKey: ['resume-target'] });
          try {
            window.dispatchEvent(new CustomEvent('omnitome:books-changed'));
          } catch {}
        }

        set({
          activeTask: active,
          queuedTasks: queued,
          historyTasks: history,
          allTasks,
          totalCount: res.totalCount || allTasks.length,
          pendingCount,
          etaSeconds,
          elapsedSeconds,
          hasActiveWork,
          isDismissed: shouldUnDismiss ? false : get().isDismissed,
        });

        scheduleNextPoll(pendingCount > 0);
      } catch (err) {
        console.warn('[useImportQueueStore] fetchQueue error:', err);
        scheduleNextPoll(false);
      }
    },

    enqueueFiles: async (files: File[], dossierId?: string, replace?: boolean) => {
      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file);
      }
      if (dossierId) formData.append('dossierId', dossierId);
      if (replace) formData.append('replace', 'true');

      set({ isDismissed: false });

      const res = await fetch(apiUrl('/api/import/queue/files'), {
        method: 'POST',
        body: formData,
      });

      if (res.status === 409) {
        const errJson = await res.json().catch(() => ({}));
        const promptMsg = errJson.error || 'This book already exists. Replace the old version or cancel?';
        const shouldReplace = window.confirm(promptMsg);
        if (shouldReplace) {
          return get().enqueueFiles(files, dossierId, true);
        }
        throw new Error('Import cancelled by user');
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Upload failed with status ${res.status}`);
      }

      const json = (await res.json()) as { success: boolean; tasks: RawImportTask[] };
      const tasks = (json.tasks || []).map(normalizeImportTask);
      void get().fetchQueue();
      return tasks;
    },

    enqueuePaste: async (data) => {
      set({ isDismissed: false });
      try {
        const res = await apiClient<{ success: boolean; task: RawImportTask }>('/api/import/queue/paste', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        const task = normalizeImportTask(res.task);
        void get().fetchQueue();
        return task;
      } catch (err: any) {
        if (err?.status === 409 || err?.message?.includes('already exists')) {
          const promptMsg =
            (err?.data && err.data.error) || err?.message || 'This book already exists. Replace the old version or cancel?';
          const shouldReplace = window.confirm(promptMsg);
          if (shouldReplace) {
            return get().enqueuePaste({ ...data, replace: true });
          }
          throw new Error('Import cancelled by user');
        }
        throw err;
      }
    },

    enqueueWeb: async (data) => {
      set({ isDismissed: false });
      const res = await apiClient<{ success: boolean; task: RawImportTask }>('/api/import/queue/web', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const task = normalizeImportTask(res.task);
      void get().fetchQueue();
      return task;
    },

    enqueueWebMulti: async (data) => {
      set({ isDismissed: false });
      const res = await apiClient<{ success: boolean; task: RawImportTask }>('/api/import/queue/web-multi', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const task = normalizeImportTask(res.task);
      void get().fetchQueue();
      return task;
    },

    cancelTask: async (id: string) => {
      try {
        const res = await apiClient<{ success: boolean }>(`/api/import/queue/${id}/cancel`, {
          method: 'POST',
        });
        void get().fetchQueue();
        return res.success;
      } catch (err) {
        console.warn('cancelTask error:', err);
        return false;
      }
    },

    retryTask: async (id: string) => {
      try {
        set({ isDismissed: false });
        const res = await apiClient<{ success: boolean; task: RawImportTask }>(`/api/import/queue/${id}/retry`, {
          method: 'POST',
        });
        const task = normalizeImportTask(res.task);
        void get().fetchQueue();
        return task;
      } catch (err) {
        console.warn('retryTask error:', err);
        return null;
      }
    },

    reorderTasks: async (taskIds: string[]) => {
      try {
        await apiClient('/api/import/queue/reorder', {
          method: 'POST',
          body: JSON.stringify({ taskIds }),
        });
        void get().fetchQueue();
      } catch (err) {
        console.warn('reorderTasks error:', err);
      }
    },

    removeTask: async (id: string) => {
      try {
        const res = await apiClient<{ success: boolean }>(`/api/import/queue/${id}`, {
          method: 'DELETE',
        });
        void get().fetchQueue();
        return res.success;
      } catch (err) {
        console.warn('removeTask error:', err);
        return false;
      }
    },

    clearCompleted: async () => {
      try {
        await apiClient('/api/import/queue/clear-completed', {
          method: 'POST',
        });
        void get().fetchQueue();
      } catch (err) {
        console.warn('clearCompleted error:', err);
      }
    },

    toggleMinimized: () => set((state) => ({ isMinimized: !state.isMinimized })),
    setMinimized: (val: boolean) => set({ isMinimized: val }),
    toggleDock: () =>
      set((state) => {
        const next = !state.isDockExpanded;
        try {
          localStorage.setItem(DOCK_EXPANDED_KEY, JSON.stringify(next));
        } catch {}
        return { isDockExpanded: next };
      }),
    setDockExpanded: (val: boolean) => {
      try {
        localStorage.setItem(DOCK_EXPANDED_KEY, JSON.stringify(val));
      } catch {}
      set({ isDockExpanded: val });
    },
    dismiss: () => set({ isDismissed: true }),
    show: () => set({ isDismissed: false, isMinimized: false, isDockExpanded: true }),
  };
});
