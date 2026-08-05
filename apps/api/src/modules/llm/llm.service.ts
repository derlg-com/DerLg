import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';

import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import {
  ChatMessage,
  ChatRequest,
  LlmStreamEvent,
  ToolCall,
  TokenUsage,
  ToolDefinition,
} from './interfaces/llm.interface';

/** Never let a prompt or a completion reach the logs in full. */
function redact(text: string, keep = 80): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length <= keep ? collapsed : `${collapsed.slice(0, keep)}…(+${collapsed.length - keep})`;
}

/**
 * The single seam between DerLg and whichever LLM is answering.
 *
 * Deliberately provider-neutral: it speaks the OpenAI chat-completions protocol
 * against `OPENAI_BASE_URL`, so NVIDIA NIM, OpenAI, Groq or a local vLLM are all
 * a config change rather than a code change.
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly apiKey?: string;
  private readonly baseURL: string;
  private readonly timeoutMs: number;
  readonly model: string;
  private client?: OpenAI;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('OPENAI_API_KEY') || undefined;
    this.baseURL = config.getOrThrow<string>('OPENAI_BASE_URL');
    this.model = config.getOrThrow<string>('OPENAI_MODEL');
    this.timeoutMs = config.getOrThrow<number>('OPENAI_TIMEOUT_MS');

    if (!this.apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY is not set — Vibe Booking endpoints will return 503 until it is configured.',
      );
    } else {
      this.logger.log(`LLM configured: ${this.model} via ${this.baseURL}`);
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private requireClient(): OpenAI {
    if (!this.apiKey) {
      throw new AppException(
        ErrorCode.AI_UNAVAILABLE,
        'The travel concierge is not configured on this environment yet.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    this.client ??= new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      timeout: this.timeoutMs,
      // Retries are handled here, not by the SDK, so a partially-streamed
      // response is never silently replayed from the start.
      maxRetries: 0,
    });

    return this.client;
  }

  /** Translates DerLg's message shape into the provider's. */
  /**
   * Translates domain messages into provider messages.
   *
   * Also works around a hard constraint of NVIDIA's llama prompt template:
   * "This model only supports single tool-calls at once!". The model happily
   * *emits* several tool calls in one turn, but replaying that turn back to it
   * returns HTTP 500, which broke every follow-up after a parallel search. A
   * multi-call turn is therefore split into consecutive single-call turns, each
   * paired with its own result — same conversation, template-legal shape.
   */
  private toProviderMessages(messages: ChatMessage[]): ChatCompletionMessageParam[] {
    return this.splitParallelToolTurns(messages).map(
      (message): ChatCompletionMessageParam => {
        if (message.role === 'tool') {
          return {
            role: 'tool',
            content: message.content,
            tool_call_id: message.toolCallId ?? '',
          };
        }

        if (message.role === 'assistant') {
          return {
            role: 'assistant',
            content: message.content || null,
            ...(message.toolCalls?.length
              ? {
                  tool_calls: message.toolCalls.map((call) => ({
                    id: call.id,
                    type: 'function' as const,
                    function: { name: call.name, arguments: call.arguments },
                  })),
                }
              : {}),
          };
        }

        return { role: message.role, content: message.content };
      },
    );
  }

  /** One assistant turn per tool call, each immediately followed by its result. */
  private splitParallelToolTurns(messages: ChatMessage[]): ChatMessage[] {
    if (!messages.some((message) => (message.toolCalls?.length ?? 0) > 1)) {
      return messages;
    }

    const resultsById = new Map<string, ChatMessage>();
    for (const message of messages) {
      if (message.role === 'tool' && message.toolCallId) {
        resultsById.set(message.toolCallId, message);
      }
    }

    const rewritten: ChatMessage[] = [];
    const consumed = new Set<string>();

    for (const message of messages) {
      if (message.role === 'tool' && message.toolCallId && consumed.has(message.toolCallId)) {
        continue;
      }

      if (message.role !== 'assistant' || (message.toolCalls?.length ?? 0) <= 1) {
        rewritten.push(message);
        continue;
      }

      const calls = message.toolCalls ?? [];
      calls.forEach((call, index) => {
        rewritten.push({
          role: 'assistant',
          // The prose, if any, belongs with the first fragment only.
          content: index === 0 ? message.content : '',
          toolCalls: [call],
        });

        const result = resultsById.get(call.id);
        if (result) {
          rewritten.push(result);
          consumed.add(call.id);
        }
      });
    }

    return rewritten;
  }

  private toProviderTools(tools?: ToolDefinition[]): ChatCompletionTool[] | undefined {
    if (!tools?.length) {
      return undefined;
    }
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Streams a completion as a sequence of events.
   *
   * A failure *before* the first event is retried once, because that is almost
   * always a transient connection or cold-start problem. A failure mid-stream is
   * surfaced immediately — replaying would duplicate text the caller has already
   * shown to the traveller.
   */
  async *stream(request: ChatRequest): AsyncGenerator<LlmStreamEvent> {
    let emitted = false;
    let attempt = 0;

    while (attempt < 2) {
      attempt += 1;
      try {
        for await (const event of this.streamOnce(request)) {
          emitted = true;
          yield event;
        }
        return;
      } catch (error) {
        if (emitted || attempt >= 2) {
          throw this.toDomainError(error);
        }
        this.logger.warn(`LLM stream failed before any output; retrying once`, {
          error: (error as Error).message,
          model: request.model ?? this.model,
        });
      }
    }
  }

  private async *streamOnce(request: ChatRequest): AsyncGenerator<LlmStreamEvent> {
    const client = this.requireClient();
    const model = request.model ?? this.model;
    const started = Date.now();

    this.logger.debug('LLM request', {
      model,
      messages: request.messages.length,
      tools: request.tools?.length ?? 0,
      lastUser: redact(
        [...request.messages].reverse().find((message) => message.role === 'user')?.content ?? '',
      ),
    });

    const stream = await client.chat.completions.create(
      {
        model,
        messages: this.toProviderMessages(request.messages),
        tools: this.toProviderTools(request.tools),
        ...(request.tools?.length ? { tool_choice: 'auto' as const } : {}),
        temperature: request.temperature ?? 0.4,
        max_tokens: request.maxTokens ?? 900,
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal: request.signal },
    );

    // Tool calls arrive as deltas keyed by index, so they are assembled here and
    // emitted once complete rather than dribbled out half-formed.
    const partialCalls = new Map<number, { id: string; name: string; arguments: string }>();
    let finishReason: string | null = null;
    let usage: TokenUsage | undefined;
    let textLength = 0;

    for await (const chunk of stream) {
      if (chunk.usage) {
        usage = {
          promptTokens: chunk.usage.prompt_tokens,
          completionTokens: chunk.usage.completion_tokens,
          totalTokens: chunk.usage.total_tokens,
        };
      }

      const choice = chunk.choices?.[0];
      if (!choice) {
        continue;
      }

      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }

      const delta = choice.delta;
      if (delta?.content) {
        textLength += delta.content.length;
        yield { type: 'text', delta: delta.content };
      }

      for (const call of delta?.tool_calls ?? []) {
        const index = call.index ?? 0;
        const existing = partialCalls.get(index) ?? { id: '', name: '', arguments: '' };
        partialCalls.set(index, {
          id: call.id ?? existing.id,
          name: call.function?.name ?? existing.name,
          arguments: `${existing.arguments}${call.function?.arguments ?? ''}`,
        });
      }
    }

    const calls: ToolCall[] = [...partialCalls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, call]) => ({
        // Some providers omit the id on the first delta; synthesise a stable one.
        id: call.id || `call_${index}`,
        name: call.name,
        arguments: call.arguments || '{}',
      }))
      .filter((call) => call.name.length > 0);

    if (calls.length > 0) {
      yield { type: 'tool_calls', calls };
    }

    this.logger.log('LLM completion', {
      model,
      ms: Date.now() - started,
      textChars: textLength,
      toolCalls: calls.map((call) => call.name),
      finishReason,
      totalTokens: usage?.totalTokens,
    });

    yield { type: 'done', finishReason, usage };
  }

  /** Collects a stream into a single result; used by tests and non-streaming callers. */
  async complete(request: ChatRequest): Promise<{ text: string; toolCalls: ToolCall[] }> {
    let text = '';
    let toolCalls: ToolCall[] = [];

    for await (const event of this.stream(request)) {
      if (event.type === 'text') {
        text += event.delta;
      } else if (event.type === 'tool_calls') {
        toolCalls = event.calls;
      }
    }

    return { text, toolCalls };
  }

  /** Never leaks provider URLs, keys or raw SDK errors to the client. */
  private toDomainError(error: unknown): AppException {
    if (error instanceof AppException) {
      return error;
    }

    const message = (error as Error)?.message ?? '';
    const isTimeout = /timeout|timed out|aborted/i.test(message);

    this.logger.error('LLM request failed', {
      error: message,
      model: this.model,
      timeout: isTimeout,
    });

    return new AppException(
      ErrorCode.AI_UNAVAILABLE,
      isTimeout
        ? 'The concierge took too long to answer. Please try again.'
        : 'The concierge is temporarily unavailable. Please try again.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
