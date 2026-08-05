'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api-client';
import type { DraftOperation, DraftView } from '@/types/journey';

export const draftKeys = {
  all: ['journey-drafts'] as const,
  detail: (id: string) => ['journey-draft', id] as const,
};

export function useDraft(draftId: string | null) {
  return useQuery({
    queryKey: draftKeys.detail(draftId ?? 'none'),
    queryFn: () => api.get<DraftView>(`/journey-drafts/${draftId}`),
    enabled: Boolean(draftId),
    // The editor is the source of truth while open; refetching would fight it.
    staleTime: Infinity,
  });
}

export function useCreateDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { packageSlug?: string; guests?: number; startDate?: string }) =>
      api.post<DraftView>('/journey-drafts', input),
    onSuccess: (draft) => {
      queryClient.setQueryData(draftKeys.detail(draft.id), draft);
    },
  });
}

/**
 * Applies a batch of operations to a draft. The server is authoritative: it
 * revalidates every reference, reprices, and returns the new snapshot, which
 * replaces the cache entry wholesale. That means a rejected edit leaves the UI
 * showing exactly what the server still believes.
 */
export function usePatchDraft(draftId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (operations: DraftOperation[]) =>
      api.patch<DraftView>(`/journey-drafts/${draftId}`, { operations }),
    onSuccess: (draft) => {
      queryClient.setQueryData(draftKeys.detail(draft.id), draft);
    },
  });
}

const AUTOSAVE_DELAY_MS = 600;

const SESSION_STORAGE_PREFIX = 'derlg:draft:';

/**
 * Resolves which draft the customize page should edit, creating one on first
 * visit. This lives in a query function rather than an effect so there is no
 * setState-during-effect cascade and no server/client hydration mismatch from
 * reading localStorage during render.
 *
 * The resolved draft is written straight into the `draftKeys.detail` cache, so
 * `useDraft` and `usePatchDraft` share one canonical entry.
 */
export function useJourneySessionId(input: {
  packageSlug: string;
  draftIdFromQuery: string | null;
  enabled: boolean;
}) {
  const queryClient = useQueryClient();
  const storageKey = `${SESSION_STORAGE_PREFIX}${input.packageSlug}`;

  return useQuery({
    queryKey: ['journey-session', input.packageSlug, input.draftIdFromQuery],
    enabled: input.enabled,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const remembered =
        input.draftIdFromQuery ??
        (typeof window === 'undefined' ? null : window.localStorage.getItem(storageKey));

      if (remembered) {
        try {
          const existing = await api.get<DraftView>(`/journey-drafts/${remembered}`);
          queryClient.setQueryData(draftKeys.detail(existing.id), existing);
          return existing.id;
        } catch {
          // Deleted, or belongs to another account: forget it and start fresh
          // rather than wedging the page on a dead id.
          window.localStorage.removeItem(storageKey);
        }
      }

      const created = await api.post<DraftView>('/journey-drafts', {
        packageSlug: input.packageSlug,
      });
      queryClient.setQueryData(draftKeys.detail(created.id), created);
      window.localStorage.setItem(storageKey, created.id);
      return created.id;
    },
  });
}

/**
 * Queues operations and flushes them as one PATCH after a quiet period, so
 * dragging three days in a row costs one request instead of three.
 */
export function useDraftAutosave(draftId: string) {
  const patch = usePatchDraft(draftId);
  const queue = useRef<DraftOperation[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const operations = queue.current;
    queue.current = [];
    setPendingCount(0);
    if (operations.length > 0) {
      patch.mutate(operations);
    }
  }, [patch]);

  const enqueue = useCallback(
    (operation: DraftOperation, options: { immediate?: boolean } = {}) => {
      queue.current = [...queue.current, operation];
      setPendingCount(queue.current.length);

      if (options.immediate) {
        flush();
        return;
      }

      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(flush, AUTOSAVE_DELAY_MS);
    },
    [flush],
  );

  // Never lose a queued edit because the component unmounted.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  return {
    enqueue,
    flush,
    pendingCount,
    isSaving: patch.isPending,
    error: patch.error,
    lastSavedAt: patch.data?.updatedAt ?? null,
  };
}
