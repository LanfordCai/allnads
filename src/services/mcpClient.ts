// import { SSEClientTransport, JSONRPCClient, Client } from '@modelcontextprotocol/sdk/types';
// import type { Tool } from '@modelcontextprotocol/sdk/types';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { MCPServerConfig, MCPTool, ToolCallRequest, ToolCallResult, TextContent, ImageContent } from '../types/mcp';

export class MCPClient {
  private serverConfig: MCPServerConfig;
  private transport: SSEClientTransport;
  private client: Client;
  private availableTools: MCPTool[] = [];
  private isConnected: boolean = false;

  constructor(serverConfig: MCPServerConfig) {
    this.serverConfig = serverConfig;
    const serverUrl = new URL(serverConfig.url);
    this.transport = new SSEClientTransport(serverUrl);
    this.client = new Client({
      name: serverConfig.name || 'MCP Client',
      version: '1.0.0'
    });
  }

  /**
   * 初始化连接并获取可用工具
   */
  async initialize(): Promise<MCPTool[]> {
    try {
      if (!this.isConnected) {
        await this.client.connect(this.transport);
        this.isConnected = true;
      }
      
      // 获取可用工具
      const toolsResult = await this.client.listTools();
      const tools = toolsResult.tools || [];
      console.log('tools',tools);
      
      // 转换为我们的工具格式
      this.availableTools = tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema || {}
      }));
      
      return this.availableTools;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error initializing MCP client: ${errorMessage}`);
      throw error;
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
        throw new Error(`Tool not found: ${request.toolName}`);
      }

      console.log(`name`, request.toolName);
      console.log(`args`, request.args);
      // 调用 MCP 工具
      const result = await this.client.callTool({
        name: request.toolName,
        arguments: request.args
      });

      console.log('result', result);
      
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error calling tool: ${errorMessage}`);
      
      // 返回错误结果
      return {
        content: [{
          type: 'text',
          text: `错误: ${errorMessage}`
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
      } catch (e) {
        console.warn('Failed to close client connection:', e);
      }
      this.isConnected = false;
    }
  }
} 