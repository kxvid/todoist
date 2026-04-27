export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
}

export interface CaptureRequest {
  text: string;
}

export type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool_use"; name: string; input: unknown }
  | { type: "tool_result"; name: string; output: string; isError: boolean }
  | { type: "done"; usage?: { input_tokens: number; output_tokens: number } }
  | { type: "error"; message: string };
