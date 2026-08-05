import { Injectable, Logger } from '@nestjs/common';

import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ChatMessage, ToolCall } from '../../llm/interfaces/llm.interface';
import { LlmService } from '../../llm/llm.service';
import { ConversationStore } from '../conversation.store';
import {
  ConversationSession,
  ShownItem,
  MAX_AGENT_ITERATIONS,
  SessionMessage,
  VibeContentStage,
  VibeEvent,
} from '../interfaces/vibe.interface';
import { ToolExecutor } from '../tools/tool-executor';
import { ToolRegistry } from '../tools/tool-registry';
import { contentForOutcomes, digestForShownContent, labelForCall } from './content-stage';
import { ProseGate } from './prose-gate';
import { buildSystemPrompt } from './system-prompt';

/**
 * The agent loop.
 *
 * One traveller message can take several model round-trips: the model asks for
 * tools, we run them, feed the results back, and it either asks for more or
 * writes the answer. The loop is capped at MAX_AGENT_ITERATIONS so a confused
 * model cannot spin.
 *
 * `run` is an async generator so the controller can pipe events straight to SSE
 * without buffering — the traveller sees prose appear while tools are still
 * running.
 */
/** Two identical failures is enough to know the model is stuck. */
const REPEATED_FAILURE_LIMIT = 2;

/** How many previously-shown rows stay in recall. */
const MAX_SHOWN_ITEMS = 30;

/** How many of those are listed back to the model. */
const RECALL_LIMIT = 14;

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly llm: LlmService,
    private readonly registry: ToolRegistry,
    private readonly executor: ToolExecutor,
    private readonly store: ConversationStore,
  ) {}

  get isConfigured(): boolean {
    return this.llm.isConfigured;
  }

  async *run(
    session: ConversationSession,
    userMessage: string,
    signal?: AbortSignal,
  ): AsyncGenerator<VibeEvent> {
    if (!this.llm.isConfigured) {
      throw new AppException(
        ErrorCode.AI_UNAVAILABLE,
        'The travel concierge is not available right now.',
        503,
      );
    }

    // The prompt is assembled from history plus this turn explicitly, rather
    // than relying on the store having mutated the session first.
    const messages = this.buildMessages(session);
    messages.push({ role: 'user', content: userMessage });

    await this.store.ensureTitle(session, userMessage);
    await this.store.append(session, {
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    });

    const tools = this.registry.definitions();

    let iterations = 0;
    let assistantText = '';
    let stagePayload: { stage: VibeContentStage; payload: unknown } | null = null;

    // Ids the tools have actually returned this turn. The composer refuses
    // anything not in here, so a guessed id cannot become a booking.
    const knownRefIds = new Set<string>(session.knownRefIds ?? []);
    const shownItems: ShownItem[] = [...(session.shownItems ?? [])];
    // How often each tool has failed with the same code, so a model stuck in a
    // loop is redirected instead of burning every iteration on it.
    const failureCounts = new Map<string, number>();

    while (iterations < MAX_AGENT_ITERATIONS) {
      iterations += 1;

      let turnText = '';
      let toolCalls: ToolCall[] = [];
      const prose = new ProseGate();

      for await (const event of this.llm.stream({ messages, tools, signal })) {
        if (event.type === 'text') {
          turnText += event.delta;
          const safe = prose.push(event.delta);
          if (safe) {
            assistantText += safe;
            yield { type: 'token', delta: safe };
          }
        } else if (event.type === 'tool_calls') {
          toolCalls = event.calls;
        }
      }

      const tail = prose.flush();
      if (tail) {
        assistantText += tail;
        yield { type: 'token', delta: tail };
      }

      // No tools requested: this turn is the answer.
      if (toolCalls.length === 0) {
        break;
      }

      // Record the assistant's tool request so the results have something to attach to.
      messages.push({
        role: 'assistant',
        content: turnText,
        toolCalls,
      });

      for (const call of toolCalls) {
        yield {
          type: 'tool_status',
          name: call.name,
          status: 'running',
          label: labelForCall(call.name, call.arguments),
        };
      }

      const outcomes = await this.executor.execute(toolCalls, {
        userId: session.userId,
        conversationId: session.conversationId,
        knownRefIds,
        shownItems,
        draftId: session.draftId,
      });

      for (const outcome of outcomes) {
        collectRefIds(outcome.data, knownRefIds);
        collectShownItems(outcome.data, shownItems);

        yield {
          type: 'tool_status',
          name: outcome.name,
          status: outcome.success ? 'done' : 'failed',
          label: outcome.success
            ? labelForCall(outcome.name, '{}')
            : (outcome.error?.message ?? 'That lookup did not work.'),
          durationMs: outcome.durationMs,
        };

        messages.push({
          role: 'tool',
          content: ToolExecutor.toToolMessageContent(outcome),
          toolCallId: outcome.callId,
          name: outcome.name,
        });

        if (!outcome.success) {
          const signature = `${outcome.name}:${outcome.error?.code ?? 'unknown'}`;
          const count = (failureCounts.get(signature) ?? 0) + 1;
          failureCounts.set(signature, count);

          // Repeating the same mistake is not going to fix itself. Say so
          // plainly rather than letting it consume the whole budget.
          if (count === REPEATED_FAILURE_LIMIT) {
            messages.push({
              role: 'system',
              content: `${outcome.name} has now failed ${count} times the same way. Stop calling it. Either use a different tool to get what you are missing, or tell the traveller plainly what you could not do. Do not describe any place, hotel, guide or price that a tool has not returned to you.`,
            });
          }
        }
      }

      const content = contentForOutcomes(outcomes);
      if (content) {
        stagePayload = content;
        yield { type: 'content', stage: content.stage, payload: content.payload };
      }

      // Remember which plan this conversation is shaping, so the handoff to the
      // manual editor knows what to open.
      const composed = outcomes.find(
        (outcome) => outcome.name === 'compose_itinerary' && outcome.success,
      );
      const draftId = (composed?.data as { draftId?: string } | undefined)?.draftId;
      if (draftId) {
        await this.store.setDraftId(session, draftId);
      }

      // Carry provenance across turns so "book the one you found earlier" works.
      session.knownRefIds = [...knownRefIds];
      session.shownItems = shownItems.slice(-MAX_SHOWN_ITEMS);

      if (iterations === MAX_AGENT_ITERATIONS) {
        // Out of budget: ask for prose with no tools so the traveller still gets
        // an answer built on what we did find.
        this.logger.warn(
          `Conversation ${session.conversationId} hit the iteration cap; forcing a final answer`,
        );
        const closing = await this.llm.complete({ messages, signal });
        if (closing.text) {
          assistantText += closing.text;
          yield { type: 'token', delta: closing.text };
        }
        break;
      }
    }

    // A turn that only ran tools and said nothing would look broken. Stray
    // punctuation left over from a suppressed tool-call leak does not count as
    // an answer either.
    if (!hasMeaningfulText(assistantText)) {
      const fallback = stagePayload
        ? 'Here is what I found.'
        : 'Sorry — I could not get that done just now. Could you tell me again what you are looking for?';
      const cleared = assistantText;
      assistantText = fallback;
      yield { type: 'token', delta: fallback };
      if (cleared) {
        this.logger.warn(
          `Replaced an unusable answer in ${session.conversationId}: ${JSON.stringify(cleared.slice(0, 40))}`,
        );
      }
    }

    const stored: SessionMessage = {
      role: 'assistant',
      content: assistantText,
      createdAt: new Date().toISOString(),
      ...(stagePayload ? { content_stage: stagePayload } : {}),
    };

    await this.store.append(session, stored, {
      stage: stagePayload?.stage,
      payload: stagePayload?.payload,
    });

    yield {
      type: 'done',
      conversationId: session.conversationId,
      messageId: null,
      iterations,
    };
  }

  /** Session history plus the system prompt, in provider order. */
  private buildMessages(session: ConversationSession): ChatMessage[] {
    const system: ChatMessage = {
      role: 'system',
      content: buildSystemPrompt({
        today: new Date().toISOString().slice(0, 10),
        toolNames: this.registry.names(),
      }),
    };

    const recall = buildRecall(session.shownItems ?? []);
    if (recall) {
      system.content += `\n\n${recall}`;
    }

    const history: ChatMessage[] = session.messages
      // Tool turns are transient scaffolding for one answer, not history.
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => {
        // Replay the data the traveller was shown, so a follow-up like "book the
        // cheaper one" can be answered from what is already on screen.
        const digest = message.content_stage
          ? digestForShownContent(message.content_stage.stage, message.content_stage.payload)
          : null;

        return {
          role: message.role as 'user' | 'assistant',
          content: digest ? `${message.content}\n${digest}` : message.content,
        };
      });

    return [system, ...history];
  }
}

/**
 * Is this actually an answer?
 *
 * Suppressing a leaked tool call can leave a fragment like ";" behind, which is
 * technically non-empty but says nothing. Anything without a couple of real
 * words is treated as no answer at all.
 */
function hasMeaningfulText(text: string): boolean {
  return /[A-Za-z\u00C0-\uFFFF]{3}/.test(text);
}

/**
 * Harvests catalogue ids out of a tool result.
 *
 * Walks the payload rather than assuming a shape, because every tool returns a
 * different envelope and all of them carry `refId` somewhere. This is what makes
 * the composer's provenance check possible.
 */
function collectRefIds(data: unknown, into: Set<string>): void {
  if (Array.isArray(data)) {
    for (const entry of data) {
      collectRefIds(entry, into);
    }
    return;
  }

  if (typeof data !== 'object' || data === null) {
    return;
  }

  for (const [key, value] of Object.entries(data)) {
    if ((key === 'refId' || key === 'packageId') && typeof value === 'string') {
      into.add(value);
    } else if (typeof value === 'object' && value !== null) {
      collectRefIds(value, into);
    }
  }
}

/**
 * Lists the rows already shown, with their ids, so the model can reuse them.
 *
 * Without this the model had no way back to a uuid it saw one turn ago and
 * started inventing values for refId — it literally sent the tool's own name.
 * Recall is capped so a long conversation cannot crowd out the instructions.
 */
function buildRecall(items: ShownItem[]): string | null {
  if (items.length === 0) {
    return null;
  }

  const lines = items.slice(-RECALL_LIMIT).map((item) => {
    const price = typeof item.priceUsd === 'number' ? ` — $${item.priceUsd}` : '';
    return `- ${item.name} (${item.type}) refId: ${item.refId}${price}`;
  });

  return [
    '## Things you have already found for this traveller',
    'These are real. Copy a refId exactly as written when you build the itinerary.',
    ...lines,
  ].join('\n');
}

/** Pulls named catalogue rows out of a tool result for later recall. */
function collectShownItems(data: unknown, into: ShownItem[]): void {
  if (typeof data !== 'object' || data === null) {
    return;
  }

  const items = (data as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    return;
  }

  for (const entry of items) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const row = entry as Record<string, unknown>;
    const refId = row.refId ?? row.packageId;
    const name = row.name ?? row.operator ?? row.title;
    if (typeof refId !== 'string' || typeof name !== 'string') {
      continue;
    }
    if (into.some((existing) => existing.refId === refId)) {
      continue;
    }
    const price =
      row.pricePerNightUsd ?? row.pricePerDayUsd ?? row.pricePerSeatUsd ?? row.entranceFeeUsd ?? row.priceUsd;
    into.push({
      type: typeof row.type === 'string' ? row.type : 'PACKAGE',
      refId,
      name,
      ...(typeof price === 'number' ? { priceUsd: price } : {}),
    });
  }
}
