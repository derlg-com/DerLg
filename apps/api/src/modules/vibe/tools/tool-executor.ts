import { HttpException, Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ValidationError, validateSync } from 'class-validator';

import { AppException } from '../../../common/errors/app.exception';
import { ToolCall } from '../../llm/interfaces/llm.interface';
import { ToolContext, ToolRegistry } from './tool-registry';

/** Per-tool ceiling. A slow catalogue query must not stall the whole turn. */
export const TOOL_TIMEOUT_MS = 15_000;

export interface ToolOutcome {
  callId: string;
  name: string;
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string };
  durationMs: number;
}

type ToolErrorCode =
  | 'UNKNOWN_TOOL'
  | 'INVALID_ARGUMENTS'
  | 'MALFORMED_JSON'
  | 'TIMEOUT'
  | 'EXECUTION_FAILED'
  /** A domain error code passed straight through, e.g. CATALOG_UNKNOWN_REFERENCE. */
  | string;

/** Nest status -> a code the model can reason about. */
const CODE_BY_STATUS: Record<number, string> = {
  400: 'INVALID_ARGUMENTS',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'INVALID_ARGUMENTS',
};

function failure(
  call: ToolCall,
  code: ToolErrorCode,
  message: string,
  durationMs: number,
): ToolOutcome {
  return { callId: call.id, name: call.name, success: false, error: { code, message }, durationMs };
}

/**
 * Runs the tool calls a model asked for.
 *
 * Contract, relied on by the agent loop (Task 15):
 *   - It NEVER throws. Every failure comes back as `{success:false, error}` so
 *     the model can read the problem and try something else, and one broken tool
 *     cannot kill a conversation.
 *   - Independent calls run concurrently, each with its own timeout.
 *   - Arguments are validated and coerced against the tool's DTO before the
 *     handler sees them, so a hallucinated field or a stringified number cannot
 *     reach a service.
 */
@Injectable()
export class ToolExecutor {
  private readonly logger = new Logger(ToolExecutor.name);

  constructor(private readonly registry: ToolRegistry) {}

  async execute(calls: ToolCall[], context: ToolContext): Promise<ToolOutcome[]> {
    return Promise.all(calls.map((call) => this.executeOne(call, context)));
  }

  private async executeOne(call: ToolCall, context: ToolContext): Promise<ToolOutcome> {
    const started = Date.now();

    const tool = this.registry.get(call.name);
    if (!tool) {
      this.logger.warn(`Model asked for an unregistered tool: ${call.name}`, {
        available: this.registry.names(),
      });
      return failure(
        call,
        'UNKNOWN_TOOL',
        `There is no tool called "${call.name}". Available tools: ${this.registry.names().join(', ')}.`,
        Date.now() - started,
      );
    }

    let raw: unknown;
    try {
      raw = call.arguments.trim() ? JSON.parse(call.arguments) : {};
    } catch {
      return failure(
        call,
        'MALFORMED_JSON',
        'The arguments were not valid JSON. Send a single JSON object.',
        Date.now() - started,
      );
    }

    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return failure(
        call,
        'INVALID_ARGUMENTS',
        'Arguments must be a JSON object.',
        Date.now() - started,
      );
    }

    // Coerce (the model stringifies numbers) then validate, stripping anything
    // the DTO does not declare.
    const instance = plainToInstance(tool.argsType, normaliseModelJson(raw), {
      enableImplicitConversion: true,
      excludeExtraneousValues: false,
    });

    const errors = validateSync(instance as object, {
      whitelist: true,
      forbidNonWhitelisted: false,
      skipMissingProperties: false,
    });

    if (errors.length > 0) {
      const details = flattenValidationErrors(errors).join('; ');
      this.logger.warn(`Rejected ${call.name} arguments`, {
        details,
        // Capped: enough to see the shape the model produced, not a full dump.
        received: call.arguments.slice(0, 300),
      });
      return failure(
        call,
        'INVALID_ARGUMENTS',
        `Those arguments are not valid — ${details}. Fix them and call the tool again.`,
        Date.now() - started,
      );
    }

    try {
      const data = await this.withTimeout(
        tool.handler(instance, context),
        TOOL_TIMEOUT_MS,
        call.name,
      );
      const durationMs = Date.now() - started;

      this.logger.log(`Tool ${call.name} ok`, {
        ms: durationMs,
        conversationId: context.conversationId,
      });

      return { callId: call.id, name: call.name, success: true, data, durationMs };
    } catch (error) {
      const durationMs = Date.now() - started;
      const message = (error as Error)?.message ?? 'unknown error';
      const timedOut = message.startsWith('TOOL_TIMEOUT');

      // Domain errors are already written for a human to read, and they carry
      // the detail the model needs to recover — which id was unknown, what was
      // sold out. Pass them through instead of flattening them.
      if (error instanceof AppException) {
        this.logger.warn(`Tool ${call.name} refused: ${error.code}`, {
          ms: durationMs,
          conversationId: context.conversationId,
        });
        return failure(call, error.code as ToolErrorCode, error.message, durationMs);
      }

      // Ownership and state guards raise plain Nest exceptions. A 4xx is a
      // refusal the model should hear about; a 5xx is our problem, not its.
      if (error instanceof HttpException && error.getStatus() < 500) {
        const code = CODE_BY_STATUS[error.getStatus()] ?? 'EXECUTION_FAILED';
        this.logger.warn(`Tool ${call.name} refused: ${code}`, {
          ms: durationMs,
          conversationId: context.conversationId,
        });
        return failure(call, code, error.message, durationMs);
      }

      this.logger.error(`Tool ${call.name} failed`, {
        ms: durationMs,
        timedOut,
        error: message,
        conversationId: context.conversationId,
      });

      return failure(
        call,
        timedOut ? 'TIMEOUT' : 'EXECUTION_FAILED',
        timedOut
          ? `The ${call.name} lookup took too long. Try a narrower search.`
          : `The ${call.name} lookup failed. Try different arguments or another approach.`,
        durationMs,
      );
    }
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number, name: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        promise,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error(`TOOL_TIMEOUT ${name}`)), ms);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  /** Serialises an outcome for the model's `tool` message. */
  static toToolMessageContent(outcome: ToolOutcome): string {
    return JSON.stringify(
      outcome.success
        ? { success: true, data: outcome.data }
        : { success: false, error: outcome.error },
    );
  }
}

/**
 * Un-stringifies the nested structures llama sends as text.
 *
 * The same quirk that makes it send 60 as "60" makes it send an array of days as
 * "[{...}]". Observed live: compose_itinerary was rejected five times running
 * with "days must be an array". Class-transformer's implicit conversion handles
 * scalars but not this, so the values are normalised here, at the same boundary,
 * before validation sees them. A string that is not JSON is left untouched — a
 * description that merely starts with a brace must survive intact.
 */
function normaliseModelJson(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
      return value;
    }

    const parsed = tryParseStructure(trimmed);
    // Only structures are worth rescuing; anything else is really a string.
    return typeof parsed === 'object' && parsed !== null ? normaliseModelJson(parsed) : value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normaliseModelJson(entry));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normaliseModelJson(entry)]),
    );
  }

  return value;
}

/**
 * Parses a structure the model wrote, tolerating Python-style syntax.
 *
 * llama does not just stringify the value, it often writes it with single quotes
 * and Python literals: `"[{'dayNumber': 1, 'title': 'Day 1'}]"`. Strict
 * JSON.parse rejects that, so a correctly-structured plan was being thrown away
 * over quoting. The repair is attempted only after real JSON has failed, and
 * only on text that already looks like a structure; if it still will not parse,
 * `undefined` is returned and the caller keeps the original string so the model
 * gets a validation message rather than silent corruption.
 */
function tryParseStructure(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Fall through to the tolerant path.
  }

  const repaired = text
    // Single-quoted keys and values -> double-quoted.
    .replace(/'((?:[^'\\]|\\.)*)'/g, (_match, inner: string) => `"${inner.replace(/"/g, '\\"')}"`)
    // Python literals.
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, 'null')
    // Trailing commas, which small models add freely.
    .replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(repaired);
  } catch {
    return undefined;
  }
}

/**
 * Flattens nested validation errors into messages the model can act on.
 *
 * class-validator puts the real reason on the deepest child, so reading only the
 * top level produced "days: ." — literally no information. A model given that
 * cannot correct itself and will repeat the same call, which is exactly what was
 * observed. Paths are included so it knows *which* day or item was wrong.
 */
function flattenValidationErrors(errors: ValidationError[], path = ''): string[] {
  return errors.flatMap((error) => {
    const here = path ? `${path}.${error.property}` : error.property;
    const constraints = Object.values(error.constraints ?? {});
    const own = constraints.length > 0 ? [`${here}: ${constraints.join(', ')}`] : [];
    const nested = error.children?.length ? flattenValidationErrors(error.children, here) : [];
    return [...own, ...nested];
  });
}
