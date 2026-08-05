/**
 * Provider-neutral chat vocabulary.
 *
 * Everything here mirrors the OpenAI chat-completions shape, which NVIDIA NIM,
 * OpenAI, Together, Groq and vLLM all speak. Swapping provider is therefore a
 * matter of changing `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `OPENAI_MODEL` — no
 * code in this repository needs to know which vendor is answering.
 */

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  /** Raw JSON string as produced by the model; parsed and validated downstream. */
  arguments: string;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Present on an assistant turn that asked for tools. */
  toolCalls?: ToolCall[];
  /** Present on a tool result turn, matching the call it answers. */
  toolCallId?: string;
  /** Tool name, for readability in provider logs. */
  name?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the arguments object. */
  parameters: Record<string, unknown>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type LlmStreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_calls'; calls: ToolCall[] }
  | { type: 'done'; finishReason: string | null; usage?: TokenUsage };

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  /** Defaults to the configured model; set to override per request. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

/**
 * Some models return numbers as JSON strings ("60" rather than 60) — observed on
 * NVIDIA NIM with llama-3.1. Downstream argument validation must coerce rather
 * than reject, which is why the tool DTOs use `@Type(() => Number)`.
 */
export const MODEL_MAY_STRINGIFY_NUMBERS = true;
