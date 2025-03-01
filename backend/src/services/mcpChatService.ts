import { MCPManager, MCPError, MCPErrorType } from './mcpManager';
import { MCPServerConfig, MCPTool, ToolCallResult } from '../types/mcp';
import { Message, ChatCompletionTool, ToolCall } from '../types/chat';

/**
 * MCP聊天服务配置
 */
interface MCPChatServiceConfig {
  /**
   * 工具调用超时时间 (毫秒)
   */
  toolCallTimeout?: number;
  
  /**
   * 服务器连接超时时间 (毫秒)
   */
  serverConnectionTimeout?: number;
  
  /**
   * 最大重试次数
   */
  maxRetries?: number;
  
  /**
   * 重试间隔 (毫秒)
   */
  retryInterval?: number;
}

/**
 * MCP 聊天服务 - 整合 MCP 与聊天功能
 */
export class MCPChatService {
  private mcpManager: MCPManager;
  private config: MCPChatServiceConfig;
  
  constructor(config?: MCPChatServiceConfig) {
    this.config = {
      toolCallTimeout: 30000,       // 默认30秒
      serverConnectionTimeout: 30000, // 默认30秒
      maxRetries: 2,                // 默认最多重试2次
      retryInterval: 1000,          // 默认重试间隔1秒
      ...config
    };
    
    // 使用配置创建 MCPManager
    this.mcpManager = new MCPManager({
      maxRetries: this.config.maxRetries,
      retryInterval: this.config.retryInterval,
      timeout: this.config.toolCallTimeout
    });
  }

  /**
   * 处理MCP错误
   * @private
   */
  private handleMCPError(error: unknown, context: string): MCPError {
    if (error instanceof MCPError) {
      console.error(`[MCPChatService] ${context}: ${error.message} (${error.type})`);
      return error;
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error);
      let errorType = MCPErrorType.UNKNOWN;
      
      // 简单错误分类
      if (errorMessage.toLowerCase().includes('timeout')) {
        errorType = MCPErrorType.TIMEOUT;
      } else if (errorMessage.toLowerCase().includes('not found')) {
        errorType = MCPErrorType.TOOL_NOT_FOUND;
      }
      
      const mcpError = new MCPError(
        `${context}: ${errorMessage}`,
        errorType,
        'unknown'
      );
      
      console.error(`[MCPChatService] ${mcpError.message} (${mcpError.type})`);
      return mcpError;
    }
  }

  /**
   * 注册 MCP 服务器
   */
  async registerServer(config: MCPServerConfig): Promise<MCPTool[]> {
    try {
      return await this.mcpManager.addServer(config);
    } catch (error) {
      throw this.handleMCPError(error, `注册服务器 '${config.name}' 失败`);
    }
  }

  /**
   * 移除 MCP 服务器
   */
  removeServer(serverId: string): boolean {
    try {
      return this.mcpManager.removeServer(serverId);
    } catch (error) {
      this.handleMCPError(error, `移除服务器 '${serverId}' 失败`);
      return false;
    }
  }

  /**
   * 获取所有可用的 MCP 工具，格式化为 LLM 工具格式
   */
  getAvailableToolsForLLM(): ChatCompletionTool[] {
    try {
      const mcpTools = this.mcpManager.getAllTools();
      
      return mcpTools.map(tool => {
        // 查找此工具所属的服务器
        const servers = this.mcpManager.getServers();
        let serverId = '';
        
        for (const server of servers) {
          const serverTools = this.mcpManager.getServerTools(server);
          if (serverTools.some(t => t.name === tool.name)) {
            serverId = server;
            break;
          }
        }
        
        // 构建 LLM 工具格式
        // 确保parameters是一个有效的JSON Schema
        const parameters = tool.inputSchema || {};
        
        // 如果没有type字段，添加一个默认的object类型
        if (!parameters.type) {
          parameters.type = 'object';
        }
        
        // 如果没有properties字段且type为object，添加一个空的properties对象
        if (parameters.type === 'object' && !parameters.properties) {
          parameters.properties = {};
        }
        
        return {
          type: 'function',
          function: {
            name: `mcp__${serverId}__${tool.name}`,
            description: tool.description,
            parameters: parameters
          }
        };
      });
    } catch (error) {
      console.error(`获取可用工具失败: ${error}`);
      // 出错时返回空数组
      return [];
    }
  }

  /**
   * 执行工具调用
   * @param toolName 工具名，格式: mcp__serverId__toolName
   * @param args 工具参数
   */
  async executeToolCall(toolName: string, args: Record<string, any>): Promise<ToolCallResult> {
    try {
      // 解析工具名
      const segments = toolName.split('__');
      if (segments.length !== 3 || segments[0] !== 'mcp') {
        throw new MCPError(
          `无效的MCP工具名格式: ${toolName}. 预期格式: mcp__serverId__toolName`,
          MCPErrorType.TOOL_NOT_FOUND,
          'unknown',
          toolName
        );
      }
      
      const [_, serverId, actualToolName] = segments;
      const fullToolName = `${serverId}__${actualToolName}`;
      
      // 执行工具调用，使用当前服务配置
      return await this.mcpManager.callTool(fullToolName, args, {
        timeout: this.config.toolCallTimeout,
        maxRetries: this.config.maxRetries,
        retryInterval: this.config.retryInterval
      });
    } catch (error) {
      const mcpError = this.handleMCPError(error, `执行工具 '${toolName}' 失败`);
      
      // 返回格式化的错误信息
      return {
        content: [{
          type: 'text',
          text: `工具调用错误 (${mcpError.type}): ${mcpError.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * 解析聊天消息中的工具调用
   * @param message 聊天消息
   * @returns 解析出的工具调用数组，格式: [{ name, args }, ...]
   */
  parseToolCallsFromMessage(message: Message): { name: string; args: Record<string, any> }[] {
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return [];
    }
    
    return message.tool_calls.map((toolCall: ToolCall) => {
      // 只处理函数调用
      if (toolCall.type !== 'function') {
        return null;
      }
      
      const name = toolCall.function.name;
      let args: Record<string, any> = {};
      
      try {
        args = typeof toolCall.function.arguments === 'string' 
          ? JSON.parse(toolCall.function.arguments) 
          : toolCall.function.arguments;
      } catch (error) {
        console.error(`解析工具参数错误: ${error}`);
        
        // 在参数解析失败时，返回错误信息作为参数
        args = { 
          error: `参数解析失败: ${error instanceof Error ? error.message : String(error)}`,
          originalArguments: toolCall.function.arguments 
        };
      }
      
      return { name, args };
    }).filter(Boolean) as { name: string; args: Record<string, any> }[];
  }

  /**
   * 关闭所有 MCP 连接
   */
  close(): void {
    try {
      this.mcpManager.closeAll();
    } catch (error) {
      this.handleMCPError(error, '关闭MCP连接失败');
    }
  }
} 