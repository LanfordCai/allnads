// import { SSEClientTransport, JSONRPCClient, Client } from '@modelcontextprotocol/sdk/types';
// import type { Tool } from '@modelcontextprotocol/sdk/types';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { MCPServerConfig, MCPTool, ToolCallRequest, ToolCallResult, TextContent, ImageContent } from '../types/mcp';
import { MCPError, MCPErrorType } from './mcpManager';

/**
 * MCP客户端配置
 */
interface MCPClientConfig {
  /**
   * 连接超时时间 (毫秒)
   */
  connectionTimeout?: number;
  
  /**
   * 调用超时时间 (毫秒)
   */
  callTimeout?: number;
}

export class MCPClient {
  private serverConfig: MCPServerConfig;
  private transport: SSEClientTransport;
  private client: Client;
  private availableTools: MCPTool[] = [];
  private isConnected: boolean = false;
  private clientConfig: MCPClientConfig;

  constructor(serverConfig: MCPServerConfig, clientConfig?: MCPClientConfig) {
    this.serverConfig = serverConfig;
    const serverUrl = new URL(serverConfig.url);
    this.transport = new SSEClientTransport(serverUrl);
    this.client = new Client({
      name: serverConfig.name || 'MCP Client',
      version: '1.0.0'
    });
    this.clientConfig = {
      connectionTimeout: 30000,  // 默认30秒
      callTimeout: 30000,        // 默认30秒
      ...clientConfig
    };
  }

  /**
   * 带超时的Promise
   * @private
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new MCPError(
          `${message} (timeout after ${timeoutMs}ms)`,
          MCPErrorType.TIMEOUT,
          this.serverConfig.name
        ));
      }, timeoutMs);
      
      promise
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * 初始化连接并获取可用工具
   */
  async initialize(): Promise<MCPTool[]> {
    try {
      if (!this.isConnected) {
        // 添加连接超时
        await this.withTimeout(
          this.client.connect(this.transport),
          this.clientConfig.connectionTimeout || 30000,
          `MCP 服务器 '${this.serverConfig.name}' 连接超时`
        );
        this.isConnected = true;
      }
      
      // 获取可用工具，添加超时
      const toolsResult = await this.withTimeout(
        this.client.listTools(),
        this.clientConfig.callTimeout || 30000,
        `从服务器 '${this.serverConfig.name}' 获取工具列表超时`
      );
      
      const tools = toolsResult.tools || [];
      
      // 转换为我们的工具格式
      this.availableTools = tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema || {}
      }));
      
      return this.availableTools;
    } catch (error: unknown) {
      // 分类错误类型
      let mcpError: MCPError;
      
      if (error instanceof MCPError) {
        mcpError = error;
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        let errorType = MCPErrorType.UNKNOWN;
        
        // 根据错误消息判断类型
        if (errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('timed out')) {
          errorType = MCPErrorType.TIMEOUT;
        } else if (errorMessage.toLowerCase().includes('connect') || errorMessage.toLowerCase().includes('connection')) {
          errorType = MCPErrorType.CONNECTION;
        } else if (errorMessage.toLowerCase().includes('server')) {
          errorType = MCPErrorType.SERVER_ERROR;
        }
        
        mcpError = new MCPError(
          `MCP客户端初始化错误: ${errorMessage}`,
          errorType,
          this.serverConfig.name
        );
      }
      
      console.error(`Error initializing MCP client: ${mcpError.message} (${mcpError.type})`);
      throw mcpError;
    }
  }

  /**
   * 获取所有可用工具
   */
  getAvailableTools(): MCPTool[] {
    return this.availableTools;
  }

  /**
   * 调用工具并获取结果
   */
  async callTool(request: ToolCallRequest): Promise<ToolCallResult> {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }
      
      // 检查工具是否可用
      const tool = this.availableTools.find(t => t.name === request.toolName);
      if (!tool) {
        throw new MCPError(
          `工具未找到: ${request.toolName}`,
          MCPErrorType.TOOL_NOT_FOUND,
          this.serverConfig.name,
          request.toolName
        );
      }

      // 调用 MCP 工具，添加超时
      const result = await this.withTimeout(
        this.client.callTool({
          name: request.toolName,
          arguments: request.args
        }),
        this.clientConfig.callTimeout || 30000,
        `调用工具 '${request.toolName}' 超时`
      );
      
      // 根据MCP规范格式化返回结果
      const resultContent = result.result !== undefined ? result.result : result;
      
      // 创建符合MCP规范的响应对象
      let content: (TextContent | ImageContent)[] = [];
      
      // 将结果转换为符合规范的内容对象
      if (typeof resultContent === 'string') {
        // 文本内容
        content = [{
          type: 'text',
          text: resultContent
        }];
      } else if (resultContent !== null && typeof resultContent === 'object') {
        // 如果是对象，检查是否有图像数据
        // 使用类型守卫检查是否为可能的图像内容
        const maybeImage = resultContent as Record<string, unknown>;
        if (
          maybeImage.type === 'image' && 
          typeof maybeImage.data === 'string' && 
          typeof maybeImage.mimeType === 'string'
        ) {
          // 已经是符合规范的图像内容，使用类型断言
          content = [{
            type: 'image',
            data: maybeImage.data,
            mimeType: maybeImage.mimeType
          }];
        } else {
          // 普通对象，转换为JSON字符串作为文本内容
          content = [{
            type: 'text',
            text: JSON.stringify(resultContent)
          }];
        }
      } else {
        // 其他类型转换为字符串
        content = [{
          type: 'text',
          text: String(resultContent)
        }];
      }
      
      return {
        content,
        isError: false
      };
    } catch (error: unknown) {
      // 分类错误类型
      let mcpError: MCPError;
      
      if (error instanceof MCPError) {
        mcpError = error;
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        let errorType = MCPErrorType.UNKNOWN;
        
        // 根据错误消息判断类型
        if (errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('timed out')) {
          errorType = MCPErrorType.TIMEOUT;
        } else if (errorMessage.toLowerCase().includes('not found') || errorMessage.toLowerCase().includes('unknown tool')) {
          errorType = MCPErrorType.TOOL_NOT_FOUND;
        } else if (errorMessage.toLowerCase().includes('argument') || errorMessage.toLowerCase().includes('parameter')) {
          errorType = MCPErrorType.INVALID_ARGS;
        } else if (errorMessage.toLowerCase().includes('server') || errorMessage.toLowerCase().includes('internal')) {
          errorType = MCPErrorType.SERVER_ERROR;
        }
        
        mcpError = new MCPError(
          `调用工具错误: ${errorMessage}`,
          errorType,
          this.serverConfig.name,
          request.toolName
        );
      }
      
      console.error(`Error calling tool ${request.toolName}: ${mcpError.message} (${mcpError.type})`);
      
      // 返回错误结果
      return {
        content: [{
          type: 'text',
          text: `错误 (${mcpError.type}): ${mcpError.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * 关闭连接
   */
  close(): void {
    if (this.isConnected) {
      try {
        // 使用 Client 的 close 方法关闭连接
        this.client.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`关闭客户端连接失败: ${errorMessage}`);
      }
      this.isConnected = false;
    }
  }
} 