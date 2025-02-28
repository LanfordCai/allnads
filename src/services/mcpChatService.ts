import { MCPManager } from './mcpManager';
import { MCPServerConfig, MCPTool, ToolCallResult as MCPToolCallResult } from '../types/mcp';
import { Message, ChatCompletionTool, ToolCall } from '../types/chat';

/**
 * MCP 聊天服务 - 整合 MCP 与聊天功能
 */
export class MCPChatService {
  private mcpManager: MCPManager;
  
  constructor() {
    this.mcpManager = new MCPManager();
  }

  /**
   * 注册 MCP 服务器
   */
  async registerServer(config: MCPServerConfig): Promise<MCPTool[]> {
    return await this.mcpManager.addServer(config);
  }

  /**
   * 移除 MCP 服务器
   */
  removeServer(serverId: string): boolean {
    return this.mcpManager.removeServer(serverId);
  }

  /**
   * 获取所有可用的 MCP 工具，格式化为 LLM 工具格式
   */
  getAvailableToolsForLLM(): ChatCompletionTool[] {
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
      return {
        type: 'function',
        function: {
          name: `mcp__${serverId}__${tool.name}`,
          description: tool.description,
          parameters: tool.inputSchema
        }
      };
    });
  }

  /**
   * 执行工具调用
   * @param toolName 工具名，格式: mcp__serverId__toolName
   * @param args 工具参数
   */
  async executeToolCall(toolName: string, args: Record<string, any>): Promise<MCPToolCallResult> {
    // 解析工具名
    const segments = toolName.split('__');
    if (segments.length !== 3 || segments[0] !== 'mcp') {
      throw new Error(`Invalid MCP tool name format: ${toolName}. Expected format: mcp__serverId__toolName`);
    }
    
    const [_, serverId, actualToolName] = segments;
    const fullToolName = `${serverId}__${actualToolName}`;
    
    // 执行工具调用
    return await this.mcpManager.callTool(fullToolName, args);
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
        console.error(`Error parsing tool arguments: ${error}`);
      }
      
      return { name, args };
    }).filter(Boolean) as { name: string; args: Record<string, any> }[];
  }

  /**
   * 关闭所有 MCP 连接
   */
  close(): void {
    this.mcpManager.closeAll();
  }
} 