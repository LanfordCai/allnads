import { MCPClient } from './mcpClient';
import { MCPServerConfig, MCPTool, ToolCallRequest, ToolCallResult } from '../types/mcp';

/**
 * MCP 管理器 - 管理多个 MCP 服务器连接
 */
export class MCPManager {
  private clients: Map<string, MCPClient> = new Map();
  private toolsRegistry: Map<string, { tool: MCPTool; serverId: string }> = new Map();
  
  constructor() {}

  /**
   * 添加 MCP 服务器
   */
  async addServer(config: MCPServerConfig): Promise<MCPTool[]> {
    if (this.clients.has(config.name)) {
      throw new Error(`MCP server with name '${config.name}' already exists`);
    }
    
    try {
      // 创建客户端并初始化
      const client = new MCPClient(config);
      const tools = await client.initialize();
      
      // 保存客户端
      this.clients.set(config.name, client);
      
      // 注册工具
      for (const tool of tools) {
        const toolKey = `${config.name}__${tool.name}`;
        this.toolsRegistry.set(toolKey, { 
          tool,
          serverId: config.name
        });
      }
      
      return tools;
    } catch (error) {
      console.error(`Failed to add MCP server '${config.name}':`, error);
      throw error;
    }
  }

  /**
   * 移除 MCP 服务器
   */
  removeServer(serverId: string): boolean {
    const client = this.clients.get(serverId);
    if (!client) {
      return false;
    }
    
    // 关闭连接
    client.close();
    
    // 移除客户端
    this.clients.delete(serverId);
    
    // 移除相关工具
    const toolKeysToRemove: string[] = [];
    this.toolsRegistry.forEach((value, key) => {
      if (value.serverId === serverId) {
        toolKeysToRemove.push(key);
      }
    });
    
    toolKeysToRemove.forEach(key => {
      this.toolsRegistry.delete(key);
    });
    
    return true;
  }

  /**
   * 获取所有 MCP 服务器
   */
  getServers(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * 获取特定服务器的工具
   */
  getServerTools(serverId: string): MCPTool[] {
    const client = this.clients.get(serverId);
    if (!client) {
      return [];
    }
    
    return client.getAvailableTools();
  }

  /**
   * 获取所有可用工具
   */
  getAllTools(): MCPTool[] {
    return Array.from(this.toolsRegistry.values()).map(item => item.tool);
  }

  /**
   * 调用工具 - 格式: serverId__toolName
   */
  async callTool(fullToolName: string, args: Record<string, any>): Promise<ToolCallResult> {
    const [serverId, toolName] = this.parseToolName(fullToolName);
    
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`MCP server '${serverId}' not found`);
    }
    
    return await client.callTool({
      toolName,
      args
    });
  }

  /**
   * 流式调用工具 - 格式: serverId__toolName
   */
  async streamToolCall(
    fullToolName: string, 
    args: Record<string, any>,
    onEvent: (event: ToolCallResult) => void,
    onError?: (error: Error) => void,
    onDone?: () => void
  ): Promise<void> {
    const [serverId, toolName] = this.parseToolName(fullToolName);
    
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`MCP server '${serverId}' not found`);
    }
    
    await client.streamToolCall(
      { toolName, args },
      onEvent,
      onError,
      onDone
    );
  }

  /**
   * 取消正在进行的所有调用
   */
  abortAll(): void {
    this.clients.forEach(client => {
      client.abort();
    });
  }

  /**
   * 关闭所有连接
   */
  closeAll(): void {
    this.clients.forEach(client => {
      client.close();
    });
    this.clients.clear();
    this.toolsRegistry.clear();
  }

  /**
   * 解析完整工具名
   * @private
   */
  private parseToolName(fullToolName: string): [string, string] {
    const parts = fullToolName.split('__');
    if (parts.length !== 2) {
      throw new Error(`Invalid tool name format: ${fullToolName}. Expected format: serverId__toolName`);
    }
    
    return [parts[0], parts[1]];
  }
} 