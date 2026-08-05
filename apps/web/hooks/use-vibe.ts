'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { VibeConversationSummary, VibeTranscript } from '@/types/vibe';

export const vibeKeys = {
  all: ['vibe'] as const,
  conversations: () => [...vibeKeys.all, 'conversations'] as const,
  conversation: (id: string) => [...vibeKeys.all, 'conversation', id] as const,
};

interface CreatedConversation {
  id: string;
  title: string | null;
  aiAvailable: boolean;
}

export function useConversations(enabled: boolean) {
  return useQuery({
    queryKey: vibeKeys.conversations(),
    queryFn: () => api.get<VibeConversationSummary[]>('/vibe/conversations'),
    enabled,
  });
}

export function useTranscript(id: string | null) {
  return useQuery({
    queryKey: vibeKeys.conversation(id ?? 'none'),
    queryFn: () => api.get<VibeTranscript>(`/vibe/conversations/${id!}`),
    enabled: Boolean(id),
    // The live stream is the source of truth once a conversation is open.
    staleTime: Infinity,
  });
}

export function useStartConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title?: string) =>
      api.post<CreatedConversation>('/vibe/conversations', title ? { title } : {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: vibeKeys.conversations() });
    },
  });
}
