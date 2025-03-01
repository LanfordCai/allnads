import { MCPClient } from './mcpClient';
import { MCPServerConfig, MCPTool, ToolCallRequest, ToolCallResult } from '../types/mcp';

/**
 * 工具调用配置
 */
interface ToolCallConfig {
  /**
   * 最大重试次数
   */
  maxRetries?: number;
  
  /**
   * 重试间隔 (毫秒)
   */
  retryInterval?: number;
  
  /**
   * 超时时间 (毫秒)
   */
  timeout?: number;
}

/**
 * MCP错误类型
 */
export enum MCPErrorType {
  CONNECTION = 'CONNECTION_ERROR',
  TIMEOUT = 'TIMEOUT_ERROR',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  INVALID_ARGS = 'INVALID_ARGUMENTS',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN_ERROR'
}

/**
 * MCP错误
 */
export class MCPError extends Error {
  type: MCPErrorType;
  serverId: string;
  toolName?: string;
  
  constructor(
    message: string, 
    type: MCPErrorType = MCPErrorType.UNKNOWN,
    serverId: string = 'unknown',
    toolName?: string
  ) {
    super(message);
    this.name = 'MCPError';
    this.type = type;
    this.serverId = serverId;
    this.toolName = toolName;
  }
}

/**
 * MCP 管理器 - 管理多个 MCP 服务器连接
 */
export class MCPManager {
  private clients: Map<string, MCPClient> = new Map();
  private toolsRegistry: Map<string, { tool: MCPTool; serverId: string }> = new Map();
  private defaultConfig: ToolCallConfig = {
    maxRetries: 2,
    retryInterval: 1000,
    timeout: 30000,
  };
  
  constructor(config?: Partial<ToolCallConfig>) {
    if (config) {
      this.defaultConfig = { ...this.defaultConfig, ...config };
    }
  }

  /**
   * 添加 MCP 服务器
   */
  async addServer(config: MCPServerConfig): Promise<MCPTool[]> {
    if (this.clients.has(config.name)) {
      throw new MCPError(
        `MCP server with name '${config.name}' already exists`,
        MCPErrorType.SERVER_ERROR,
        config.name
      );
    }
    
    try {
      // 创建客户端并初始化
      const client = new MCPClient(config);
      const tools = await this.withTimeout(
        client.initialize(),
        this.defaultConfig.timeout || 30000,
        `初始化服务器 '${config.name}' 超时`
      );
      
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error instanceof MCPError ? error.type : MCPErrorType.CONNECTION;
      
      console.error(`Failed to add MCP server '${config.name}':`, errorMessage);
      throw new MCPError(
        `Failed to add MCP server '${config.name}': ${errorMessage}`,
        errorType,
        config.name
      );
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
   * 增加了更健壮的错误处理、超时控制和重试机制
   */
  async callTool(
    fullToolName: string, 
    args: Record<string, any>,
    config?: Partial<ToolCallConfig>
  ): Promise<ToolCallResult> {
    // 合并配置
    const callConfig: ToolCallConfig = {
      ...this.defaultConfig,
      ...config
    };
    
    // 解析工具名
    let serverId: string;
    let toolName: string;
    
    try {
      [serverId, toolName] = this.parseToolName(fullToolName);
    } catch (error) {
      // 工具名解析错误
      return {
        content: [{
          type: 'text',
          text: `错误: 无效的工具名格式 ${fullToolName}. 预期格式: serverId__toolName`
        }],
        isError: true
      };
    }
    
    // 检查服务器是否存在
    const client = this.clients.get(serverId);
    if (!client) {
      return {
        content: [{
          type: 'text',
          text: `错误: MCP 服务器 '${serverId}' 不存在`
        }],
        isError: true
      };
    }
    
    // 重试逻辑
    let lastError: Error | null = null;
    const maxRetries = callConfig.maxRetries || 0;
    let attempts = 0;
    
    while (attempts <= maxRetries) {
      try {
        // 如果不是第一次尝试，则记录重试信息
        if (attempts > 0) {
          console.log(`重试工具调用 ${fullToolName} (${attempts}/${maxRetries})...`);
        }
        
        // 带超时的工具调用
        return await this.withTimeout(
          client.callTool({
            toolName,
            args
          }),
          callConfig.timeout || 30000,
          `工具调用 ${fullToolName} 超时`
        );
      } catch (error) {
        // 捕获错误以便进行重试
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`工具调用 ${fullToolName} 失败 (尝试 ${attempts + 1}/${maxRetries + 1}): ${lastError.message}`);
        
        // 增加尝试次数
        attempts++;
        
        // 如果还能重试，则等待指定时间
        if (attempts <= maxRetries) {
          await this.delay(callConfig.retryInterval || 1000);
        }
      }
    }
    
    // 达到最大重试次数，返回最后一个错误
    const errorMessage = lastError ? lastError.message : '未知错误';
    
    return {
      content: [{
        type: 'text',
        text: `工具调用错误: ${errorMessage}`
      }],
      isError: true
    };
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
      throw new MCPError(
        `Invalid tool name format: ${fullToolName}. Expected format: serverId__toolName`,
        MCPErrorType.TOOL_NOT_FOUND,
        'unknown',
        fullToolName
      );
    }
    
    return [parts[0], parts[1]];
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
          'unknown'
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
   * 延迟函数
   * @private
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 