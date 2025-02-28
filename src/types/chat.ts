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
  createdAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
}

// 聊天请求验证模式
export const chatRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1, "消息不能为空"),
  systemPrompt: z.string().optional(),
});

// 聊天请求类型
export type ChatRequest = z.infer<typeof chatRequestSchema>;

// 聊天响应
export interface ChatResponse {
  sessionId: string;
  message: ChatMessage;
  history: ChatMessage[];
}

// API 响应格式
export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
} 