import type { RunStep } from "@/contract";
import type { Reasoning, TfRole } from "./roles";

export type TfMode = "live" | "replay";

export interface TfEnv {
  NEBIUS_API_KEY?: string;
  TF_MODE?: string;
  TF_BASE_URL?: string;
}

export type ChatPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: "system" | "user"; content: string | ChatPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ToolDef {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

// What every call is labelled with so the run panel can show it.
export interface CallMeta {
  title: string;
  tool?: string | null;
  summary?: string;
}

export interface ChatOptions {
  role: Exclude<TfRole, "embed">;
  messages: ChatMessage[];
  meta: CallMeta;
  reasoning?: Reasoning;
  maxTokens?: number;
  temperature?: number;
  tools?: ToolDef[];
  toolChoice?: "auto" | "none" | "required";
  jsonSchema?: { name: string; schema: Record<string, unknown> };
}

export interface ChatResult {
  content: string;
  toolCalls: ToolCall[];
  finishReason: string | null;
  step: RunStep;
}

export interface RecordedResponse {
  status: number;
  body: unknown;
  requestId: string | null;
  ms: number;
}

// Recorded responses for TF_MODE=replay. Live mode writes through put when one is given.
export interface ReplayStore {
  get(key: string): Promise<RecordedResponse | null>;
  put?(key: string, value: RecordedResponse): Promise<void>;
}

export class TfError extends Error {
  constructor(message: string, readonly code: string, readonly status?: number) {
    super(message);
    this.name = "TfError";
  }
}
