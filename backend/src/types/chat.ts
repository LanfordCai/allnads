import { z } from 'zod';

// Message role
export enum ChatRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  TOOL = 'tool',
  SYSTEM = 'system',
}

// Message content type
export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: Date;
  sessionId?: string;
  toolCallId?: string;  // Tool call ID
  toolName?: string;    // Tool name
}

// Chat session
export interface ChatSession {
  id: string;
  privyUserId?: string;
  createdAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
}

// Chat request validation schema
export const chatRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1, "Message cannot be empty"),
  enableTools: z.boolean().optional()
});

// Chat request type
export type ChatRequest = z.infer<typeof chatRequestSchema>;

// Chat response (internal use)
export interface AppChatResponse {
  sessionId: string;
  message: ChatMessage;
}

/**
 * Supported role types
 */
export type Role = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Function call parameter definition
 */
export interface FunctionParameters {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
}

/**
 * Function definition
 */
export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters: Record<string, any>;
}

/**
 * Tool type
 */
export type ToolType = 'function';

/**
 * Chat tool definition
 */
export interface ChatCompletionTool {
  type: ToolType;
  function: FunctionDefinition;
}

/**
 * Tool call result
 */
export interface ToolCallResult {
  tool_call_id: string;
  role: 'tool';
  content: string;
}

/**
 * Function call definition
 */
export interface FunctionCall {
  name: string;
  arguments: string | Record<string, any>;
}

/**
 * Tool call
 */
export interface ToolCall {
  id: string;
  type: ToolType;
  function: FunctionCall;
}

/**
 * Chat message
 */
export interface Message {
  id?: string;
  role: Role;
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

/**
 * Chat options
 */
export interface ChatOptions {
  model: string;
  messages: Message[];
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: ChatCompletionTool[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

/**
 * Chat response choice
 */
export interface ChatResponseChoice {
  index: number;
  message: Message;
  finish_reason: string;
}

/**
 * Chat usage statistics
 */
export interface ChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Chat response
 */
export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatResponseChoice[];
  usage: ChatUsage;
}

/**
 * Chat stream response chunk
 */
export interface ChatResponseChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: Partial<Message>;
    finish_reason: string | null;
  }[];
} 