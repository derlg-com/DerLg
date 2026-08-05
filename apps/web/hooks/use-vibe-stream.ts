'use client';

import { useCallback, useRef, useState } from 'react';

import { API_BASE_URL, refreshSession } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import type {
  ToolProgress,
  VibeEvent,
  VibeMessage,
  VibePanel,
  VibeTranscript,
} from '@/types/vibe';

/**
 * Reads the concierge's answer as it is written.
 *
 * `EventSource` cannot be used here: the endpoint is a POST (the message is in
 * the body) and it needs an Authorization header, neither of which EventSource
 * supports. So the SSE frames are parsed off a fetch ReadableStream by hand.
 */

let messageCounter = 0;
function nextId(prefix: string): string {
  messageCounter += 1;
  return `${prefix}_${messageCounter}`;
}

export interface VibeStreamState {
  messages: VibeMessage[];
  panels: VibePanel[];
  tools: ToolProgress[];
  isStreaming: boolean;
  error: string | null;
  /** True while a retryable transport failure is being recovered. */
  reconnecting: boolean;
}

export interface UseVibeStream extends VibeStreamState {
  send: (message: string) => Promise<void>;
  stop: () => void;
  hydrate: (transcript: VibeTranscript) => void;
  dismissError: () => void;
}

/** Splits a stream into complete SSE frames, keeping any partial tail. */
export function parseFrames(buffer: string): { events: VibeEvent[]; rest: string } {
  const events: VibeEvent[] = [];
  const parts = buffer.split('\n\n');
  // The last part may be incomplete, so it stays in the buffer.
  const rest = parts.pop() ?? '';

  for (const frame of parts) {
    const dataLine = frame
      .split('\n')
      .find((line) => line.startsWith('data: '));
    if (!dataLine) {
      // Heartbeat comments (": keep-alive") land here and are ignored.
      continue;
    }
    try {
      events.push(JSON.parse(dataLine.slice('data: '.length)) as VibeEvent);
    } catch {
      // A malformed frame is skipped rather than killing the conversation.
    }
  }

  return { events, rest };
}

export function useVibeStream(conversationId: string | null): UseVibeStream {
  const [messages, setMessages] = useState<VibeMessage[]>([]);
  const [panels, setPanels] = useState<VibePanel[]>([]);
  const [tools, setTools] = useState<ToolProgress[]>([]);
  const [isStreaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  const hydrate = useCallback((transcript: VibeTranscript) => {
    const restored: VibeMessage[] = transcript.messages.map((message) => ({
      id: nextId('past'),
      role: message.role === 'USER' ? 'user' : 'assistant',
      content: message.content,
      ...(message.contentPayload
        ? {
            panel: {
              id: nextId('panel'),
              stage: message.contentPayload.stage,
              payload: message.contentPayload.payload,
            },
          }
        : {}),
    }));

    setMessages(restored);
    setPanels(
      restored.flatMap((message) => (message.panel ? [message.panel] : [])),
    );
  }, []);

  const send = useCallback(
    async (text: string) => {
      const body = text.trim();
      if (!conversationId || !body || isStreaming) {
        return;
      }

      setError(null);
      setTools([]);
      setStreaming(true);

      const assistantId = nextId('assistant');
      setMessages((current) => [
        ...current,
        { id: nextId('user'), role: 'user', content: body },
        { id: assistantId, role: 'assistant', content: '', streaming: true },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      const appendDelta = (delta: string): void => {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? { ...message, content: message.content + delta }
              : message,
          ),
        );
      };

      const attachPanel = (panel: VibePanel): void => {
        setPanels((current) => [...current, panel]);
        setMessages((current) =>
          current.map((message) => (message.id === assistantId ? { ...message, panel } : message)),
        );
      };

      const openStream = async (token: string | null): Promise<Response> =>
        fetch(`${API_BASE_URL}/vibe/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({ message: body }),
          signal: controller.signal,
        });

      try {
        let response = await openStream(useAuthStore.getState().accessToken);

        // A 15-minute access token can lapse between turns; refresh once and retry.
        if (response.status === 401) {
          setReconnecting(true);
          const refreshed = await refreshSession();
          response = await openStream(refreshed);
          setReconnecting(false);
        }

        if (!response.ok || !response.body) {
          throw new Error(`stream failed with ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let sawAnything = false;

        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const { events, rest } = parseFrames(buffer);
          buffer = rest;

          for (const event of events) {
            sawAnything = true;
            switch (event.type) {
              case 'token':
                appendDelta(event.delta);
                break;
              case 'tool_status':
                setTools((current) => {
                  const next = [...current];
                  const at = next.findIndex((tool) => tool.name === event.name && tool.status === 'running');
                  const entry: ToolProgress = {
                    name: event.name,
                    status: event.status,
                    label: event.label,
                    ...(event.durationMs === undefined ? {} : { durationMs: event.durationMs }),
                  };
                  if (event.status === 'running' || at === -1) {
                    next.push(entry);
                  } else {
                    next[at] = entry;
                  }
                  return next;
                });
                break;
              case 'content':
                attachPanel({ id: nextId('panel'), stage: event.stage, payload: event.payload });
                break;
              case 'error':
                setError(event.message);
                break;
              case 'done':
                break;
            }
          }
        }

        if (!sawAnything) {
          setError('The concierge did not answer. Please try again.');
        }
      } catch (streamError) {
        // An aborted stream is the traveller leaving, not a failure.
        if ((streamError as Error).name !== 'AbortError') {
          setError('The connection dropped. Your message may not have been answered.');
        }
      } finally {
        setStreaming(false);
        setReconnecting(false);
        abortRef.current = null;
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? { ...message, streaming: false } : message,
          ),
        );
      }
    },
    [conversationId, isStreaming],
  );

  return {
    messages,
    panels,
    tools,
    isStreaming,
    error,
    reconnecting,
    send,
    stop,
    hydrate,
    dismissError,
  };
}
