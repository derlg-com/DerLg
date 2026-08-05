'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/Button';
import { ContentStagePanel } from '@/components/vibe/ContentStagePanel';
import { useStartConversation } from '@/hooks/use-vibe';
import { useVibeStream } from '@/hooks/use-vibe-stream';
import { useTranslations } from '@/lib/i18n';
import type { ToolProgress, VibeMessage } from '@/types/vibe';

/**
 * Vibe Booking: conversation on the left, real inventory on the right.
 *
 * The two halves are driven by the same stream — prose arrives as tokens, and
 * structured panels arrive as `content` events carrying the data the tools
 * actually returned. Nothing on the right is parsed out of the model's text.
 */
export function VibeSession({
  initialMessage,
}: {
  initialMessage?: string;
}): React.ReactElement {
  const t = useTranslations('vibe');
  const startConversation = useStartConversation();

  // Resolved inside a query rather than an effect: setState in an effect is
  // forbidden by lint, and this also survives a remount without re-creating.
  const session = useQuery({
    queryKey: ['vibe', 'session'],
    queryFn: async () => {
      const created = await startConversation.mutateAsync(undefined);
      return created;
    },
    staleTime: Infinity,
    retry: false,
  });

  const conversationId = session.data?.id ?? null;
  const stream = useVibeStream(conversationId);

  const [draft, setDraft] = useState('');
  const sentOpener = useRef(false);
  const listEnd = useRef<HTMLDivElement>(null);

  // Send the opening line carried over from a package page or the home hero.
  useEffect(() => {
    if (!conversationId || sentOpener.current || !initialMessage) {
      return;
    }
    sentOpener.current = true;
    void stream.send(initialMessage);
  }, [conversationId, initialMessage, stream]);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [stream.messages, stream.tools]);

  const aiUnavailable = session.data?.aiAvailable === false;

  function submit(event: React.FormEvent): void {
    event.preventDefault();
    const message = draft.trim();
    if (!message) {
      return;
    }
    setDraft('');
    void stream.send(message);
  }

  if (session.isError) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {t('startFailed')}
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
      {/* Conversation */}
      <section
        className="flex min-h-[60vh] flex-col rounded-2xl border border-stone-200 bg-white lg:min-h-[calc(100vh-11rem)]"
        aria-label={t('conversationLabel')}
      >
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {stream.messages.length === 0 ? <Opener /> : null}

          {stream.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {stream.tools.length > 0 && stream.isStreaming ? (
            <ToolProgressList tools={stream.tools} />
          ) : null}

          <div ref={listEnd} />
        </div>

        {stream.reconnecting ? (
          <p
            className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900"
            role="status"
          >
            {t('reconnecting')}
          </p>
        ) : null}

        {stream.error ? (
          <div className="border-t border-red-200 bg-red-50 px-4 py-3" role="alert">
            <p className="text-sm text-red-800">{stream.error}</p>
            <button
              type="button"
              onClick={stream.dismissError}
              className="mt-1 text-xs font-medium text-red-700 underline"
            >
              {t('dismiss')}
            </button>
          </div>
        ) : null}

        {aiUnavailable ? (
          <p className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t('unavailable')}
          </p>
        ) : (
          <form onSubmit={submit} className="border-t border-stone-200 p-3">
            <label htmlFor="vibe-message" className="sr-only">
              {t('inputLabel')}
            </label>
            <div className="flex items-end gap-2">
              <textarea
                id="vibe-message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    submit(event);
                  }
                }}
                rows={2}
                maxLength={2000}
                placeholder={t('placeholder')}
                disabled={!conversationId || stream.isStreaming}
                className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200 disabled:bg-stone-50"
              />
              {stream.isStreaming ? (
                <Button type="button" variant="secondary" onClick={stream.stop}>
                  {t('stop')}
                </Button>
              ) : (
                <Button type="submit" disabled={!conversationId || draft.trim().length === 0}>
                  {t('send')}
                </Button>
              )}
            </div>
            <p className="mt-2 text-xs text-stone-500">{t('inputHint')}</p>
          </form>
        )}
      </section>

      {/* Inventory */}
      <section
        className="space-y-3 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto"
        aria-label={t('panelsLabel')}
      >
        {stream.panels.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-300 p-6 text-sm text-stone-500">
            {t('panelsEmpty')}
          </p>
        ) : (
          // Newest first: the last thing the concierge found is the thing being
          // discussed.
          [...stream.panels].reverse().map((panel) => (
            <ContentStagePanel key={panel.id} panel={panel} />
          ))
        )}
      </section>
    </div>
  );
}

function Opener(): React.ReactElement {
  const t = useTranslations('vibe');

  return (
    <div className="rounded-2xl bg-stone-50 p-4">
      <p className="text-sm font-medium text-stone-900">{t('greetingTitle')}</p>
      <p className="mt-1 text-sm text-stone-600">{t('greetingBody')}</p>
      <ul className="mt-3 space-y-1 text-sm text-stone-600">
        <li>· {t('example1')}</li>
        <li>· {t('example2')}</li>
        <li>· {t('example3')}</li>
      </ul>
    </div>
  );
}

function MessageBubble({ message }: { message: VibeMessage }): React.ReactElement {
  const isUser = message.role === 'user';

  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={
          isUser
            ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-stone-900 px-4 py-2 text-sm text-white'
            : 'max-w-[90%] rounded-2xl rounded-bl-sm bg-stone-100 px-4 py-2 text-sm text-stone-900'
        }
      >
        {/* Plain text on purpose: the model's output is never treated as markup,
            so there is nothing to sanitise and nothing can be injected. */}
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.streaming && message.content.length === 0 ? (
          <span className="text-stone-500" aria-label="Thinking">
            …
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ToolProgressList({ tools }: { tools: ToolProgress[] }): React.ReactElement {
  return (
    <ul className="space-y-1" aria-live="polite">
      {tools.map((tool, index) => (
        <li
          key={`${tool.name}-${index}`}
          className="flex items-center gap-2 text-xs text-stone-500"
        >
          <span aria-hidden="true">
            {tool.status === 'running' ? '◌' : tool.status === 'done' ? '✓' : '×'}
          </span>
          <span className={tool.status === 'failed' ? 'text-amber-700' : undefined}>
            {tool.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
