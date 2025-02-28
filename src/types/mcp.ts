import { z } from 'zod';

/**
 * MCP 工具参数结构
 */
export const toolInputSchema = z.record(z.any());

/**
 * 角色类型
 */
export type Role = 'user' | 'assistant' | 'system' | 'tool';

/**
 * MCP 基础结果接口
 */
export interface Result {
  /**
   * 此结果属性被协议保留，允许客户端和服务器将额外的元数据附加到其响应。
   */
  _meta?: { [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * 带注释的内容基类
 */
export interface Annotated {
  annotations?: {
    /**
     * 描述此对象或数据的预期接收者是谁。
     */
    audience?: Role[];
    /**
     * :描述此数据对操作服务器的重要性。
     */
    priority?: number;
  }
}

/**
 * 文本内容类型
 */
export interface TextContent extends Annotated {
  type: 'text';
  text: string;
}

/**
 * 图像内容类型
 */
export interface ImageContent extends Annotated {
  type: 'image';
  /**
   * base64编码的图像数据
   */
  data: string;
  /**
   * 图像的MIME类型
   */
  mimeType: string;
}

/**
 * 嵌入资源类型
 */
export interface EmbeddedResource extends Annotated {
  type: 'embedded_resource';
  resource: any;
}

/**
 * MCP 工具调用结果 - 根据MCP规范定义
 */
export interface ToolCallResult extends Result {
  content: (TextContent | ImageContent | EmbeddedResource)[];
  
  /**
   * 工具调用是否出错
   * 如果未设置，则假定为false（调用成功）
   */
  isError?: boolean;
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