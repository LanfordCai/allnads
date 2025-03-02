import { z } from 'zod';

// 消息角色
export enum ChatRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

// 消息内容类型
export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: Date;
}

// 聊天会话
export interface ChatSession {
  id: string;
  privyUserId?: string;
  createdAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
}

// 聊天请求验证模式
export const chatRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1, "消息不能为空"),
  enableTools: z.boolean().optional()
});

// 聊天请求类型
export type ChatRequest = z.infer<typeof chatRequestSchema>;

// 聊天响应（应用内部使用）
export interface AppChatResponse {
  sessionId: string;
  message: ChatMessage;
}

/**
 * 支持的角色类型
 */
export type Role = 'user' | 'assistant' | 'system' | 'tool';

/**
 * 函数调用参数定义
 */
export interface FunctionParameters {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
}

/**
 * 函数定义
 */
export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters: Record<string, any>;
}

/**
 * 工具类型
 */
export type ToolType = 'function';

/**
 * 聊天工具定义
 */
export interface ChatCompletionTool {
  type: ToolType;
  function: FunctionDefinition;
}

/**
 * 工具调用结果
 */
export interface ToolCallResult {
  tool_call_id: string;
  role: 'tool';
  content: string;
}

/**
 * 函数调用定义
 */
export interface FunctionCall {
  name: string;
  arguments: string | Record<string, any>;
}

/**
 * 工具调用
 */
export interface ToolCall {
  id: string;
  type: ToolType;
  function: FunctionCall;
}

/**
 * 聊天消息
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
 * 聊天选项
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
 * 聊天响应选择
 */
export interface ChatResponseChoice {
  index: number;
  message: Message;
  finish_reason: string;
}

/**
 * 聊天使用统计
 */
export interface ChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * 聊天响应
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
 * 聊天流式响应块
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