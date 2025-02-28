import { z } from 'zod';

/**
 * MCP 工具参数结构
 */
export const toolInputSchema = z.record(z.any());

/**
 * MCP 工具调用结果
 */
export interface ToolCallResult {
  content: string;
  metadata?: Record<string, any>;
}

/**
 * MCP 服务器配置
 */
export interface MCPServerConfig {
  url: string; // SSE 服务器 URL
  name: string; // 服务器名称
  description?: string; // 服务器描述
}

/**
 * MCP 工具描述
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

/**
 * 工具调用请求
 */
export interface ToolCallRequest {
  toolName: string;
  args: Record<string, any>;
} 