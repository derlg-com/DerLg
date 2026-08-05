import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VibeSession } from '@/components/vibe/VibeSession';
import type { UseVibeStream } from '@/hooks/use-vibe-stream';
import type { VibeMessage, VibePanel, ToolProgress } from '@/types/vibe';

const startMutate = vi.fn();
let aiAvailable = true;
let startFails = false;

vi.mock('@/hooks/use-vibe', () => ({
  useStartConversation: () => ({ mutateAsync: startMutate }),
}));

/** A controllable stand-in for the SSE hook. */
const streamState: {
  messages: VibeMessage[];
  panels: VibePanel[];
  tools: ToolProgress[];
  isStreaming: boolean;
  error: string | null;
  reconnecting: boolean;
} = {
  messages: [],
  panels: [],
  tools: [],
  isStreaming: false,
  error: null,
  reconnecting: false,
};

const send = vi.fn();
const stop = vi.fn();
const dismissError = vi.fn();

vi.mock('@/hooks/use-vibe-stream', () => ({
  useVibeStream: (): UseVibeStream => ({
    ...streamState,
    send,
    stop,
    hydrate: vi.fn(),
    dismissError,
  }),
  parseFrames: vi.fn(),
}));

function renderSession(initialMessage?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <VibeSession initialMessage={initialMessage} />
    </QueryClientProvider>,
  );
}

describe('VibeSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiAvailable = true;
    startFails = false;
    Object.assign(streamState, {
      messages: [],
      panels: [],
      tools: [],
      isStreaming: false,
      error: null,
      reconnecting: false,
    });
    startMutate.mockImplementation(() =>
      startFails
        ? Promise.reject(new Error('no'))
        : Promise.resolve({ id: 'conv-1', title: null, aiAvailable }),
    );
  });

  it('opens a conversation and invites the traveller to start', async () => {
    renderSession();

    await waitFor(() => {
      expect(startMutate).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText(/where would you like to go/i)).toBeInTheDocument();
    expect(screen.getByText(/three days of temples/i)).toBeInTheDocument();
  });

  it('sends a typed message', async () => {
    const user = userEvent.setup();
    renderSession();
    const box = screen.getByLabelText(/message the concierge/i);
    // The box stays disabled until the conversation exists.
    await waitFor(() => expect(box).toBeEnabled());

    await user.type(box, 'hotels in Siem Reap');
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    expect(send).toHaveBeenCalledWith('hotels in Siem Reap');
    expect(box).toHaveValue('');
  });

  it('sends on Enter but not on Shift+Enter', async () => {
    const user = userEvent.setup();
    renderSession();
    const box = screen.getByLabelText(/message the concierge/i);
    await waitFor(() => expect(box).toBeEnabled());

    await user.type(box, 'first line{Shift>}{Enter}{/Shift}second line');
    expect(send).not.toHaveBeenCalled();

    await user.type(box, '{Enter}');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('will not send an empty message', async () => {
    renderSession();
    await waitFor(() => expect(startMutate).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: /^send$/i })).toBeDisabled();
  });

  it('sends an opening line carried in from another page, exactly once', async () => {
    renderSession('Tell me about the angkor essentials 3 day trip');

    await waitFor(() => {
      expect(send).toHaveBeenCalledWith('Tell me about the angkor essentials 3 day trip');
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('shows both sides of the conversation', async () => {
    streamState.messages = [
      { id: 'm1', role: 'user', content: 'cheap hotels?' },
      { id: 'm2', role: 'assistant', content: 'The Lotus Lodge is $28 a night.' },
    ];
    renderSession();
    await waitFor(() => expect(startMutate).toHaveBeenCalled());

    expect(screen.getByText('cheap hotels?')).toBeInTheDocument();
    expect(screen.getByText('The Lotus Lodge is $28 a night.')).toBeInTheDocument();
  });

  it('explains the wait while tools are running, and offers to stop', async () => {
    streamState.isStreaming = true;
    streamState.tools = [
      { name: 'search_hotels', status: 'running', label: 'Checking hotels in Siem Reap…' },
    ];
    renderSession();
    await waitFor(() => expect(startMutate).toHaveBeenCalled());

    expect(screen.getByText('Checking hotels in Siem Reap…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/message the concierge/i)).toBeDisabled();
  });

  it('renders panels newest first so the current topic is on top', async () => {
    streamState.panels = [
      { id: 'p1', stage: 'places', payload: { items: [{ refId: 'a', name: 'Angkor Wat' }] } },
      { id: 'p2', stage: 'hotels', payload: { items: [{ refId: 'b', name: 'Lotus Lodge' }] } },
    ];
    renderSession();
    await waitFor(() => expect(startMutate).toHaveBeenCalled());

    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings[0]).toHaveTextContent('Where to stay');
    expect(headings[1]).toHaveTextContent('Places to visit');
  });

  it('shows a hint before anything has been found', async () => {
    renderSession();
    await waitFor(() => expect(startMutate).toHaveBeenCalled());

    expect(screen.getByText(/options will appear here/i)).toBeInTheDocument();
  });

  it('surfaces a stream error with a way to dismiss it', async () => {
    const user = userEvent.setup();
    streamState.error = 'The connection dropped.';
    renderSession();
    await waitFor(() => expect(startMutate).toHaveBeenCalled());

    expect(screen.getByRole('alert')).toHaveTextContent('The connection dropped.');
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(dismissError).toHaveBeenCalled();
  });

  it('says it is reconnecting rather than looking frozen', async () => {
    streamState.reconnecting = true;
    renderSession();
    await waitFor(() => expect(startMutate).toHaveBeenCalled());

    expect(screen.getByRole('status')).toHaveTextContent(/reconnecting/i);
  });

  it('degrades to the manual flow when the concierge is switched off', async () => {
    aiAvailable = false;
    renderSession();

    await waitFor(() => {
      expect(screen.getByText(/not available right now/i)).toBeInTheDocument();
    });
    // No input is offered when it cannot be used.
    expect(screen.queryByLabelText(/message the concierge/i)).not.toBeInTheDocument();
  });

  it('explains itself when a conversation cannot be started at all', async () => {
    startFails = true;
    renderSession();

    await waitFor(() => {
      expect(screen.getByText(/could not be reached/i)).toBeInTheDocument();
    });
  });
});
