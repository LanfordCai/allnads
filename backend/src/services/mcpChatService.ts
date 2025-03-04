import { MCPManager, MCPError, MCPErrorType } from './mcpManager';
import { MCPServerConfig, MCPTool, ToolCallResult } from '../types/mcp';
import { Message, ChatCompletionTool, ToolCall } from '../types/chat';

/**
 * MCP Chat Service Configuration
 */
interface MCPChatServiceConfig {
  /**
   * Tool call timeout (milliseconds)
   */
  toolCallTimeout?: number;
  
  /**
   * Server connection timeout (milliseconds)
   */
  serverConnectionTimeout?: number;
  
  /**
   * Maximum retry attempts
   */
  maxRetries?: number;
  
  /**
   * Retry interval (milliseconds)
   */
  retryInterval?: number;
}

/**
 * MCP Chat Service - Integrates MCP with chat functionality
 */
export class MCPChatService {
  private mcpManager: MCPManager;
  private config: MCPChatServiceConfig;
  
  constructor(config?: MCPChatServiceConfig) {
    this.config = {
      toolCallTimeout: 30000,       // Default 30 seconds
      serverConnectionTimeout: 30000, // Default 30 seconds
      maxRetries: 2,                // Default 2 retry attempts
      retryInterval: 1000,          // Default 1 second retry interval
      ...config
    };
    
    // Create MCPManager with configuration
    this.mcpManager = new MCPManager({
      maxRetries: this.config.maxRetries,
      retryInterval: this.config.retryInterval,
      timeout: this.config.toolCallTimeout
    });
  }

  /**
   * Handle MCP errors
   * @private
   */
  private handleMCPError(error: unknown, context: string): MCPError {
    if (error instanceof MCPError) {
      console.error(`[MCPChatService] ${context}: ${error.message} (${error.type})`);
      return error;
    } else {
      const errorMessage = error instanceof Error ? error.message : String(error);
      let errorType = MCPErrorType.UNKNOWN;
      
      // Simple error classification
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
   * Register MCP server
   */
  async registerServer(config: MCPServerConfig): Promise<MCPTool[]> {
    try {
      return await this.mcpManager.addServer(config);
    } catch (error) {
      throw this.handleMCPError(error, `Failed to register server '${config.name}'`);
    }
  }

  /**
   * Remove MCP server
   */
  removeServer(serverId: string): boolean {
    try {
      return this.mcpManager.removeServer(serverId);
    } catch (error) {
      this.handleMCPError(error, `Failed to remove server '${serverId}'`);
      return false;
    }
  }

  /**
   * Get all available MCP tools, formatted for LLM
   */
  getAvailableToolsForLLM(): ChatCompletionTool[] {
    try {
      const mcpTools = this.mcpManager.getAllTools();
      
      return mcpTools.map(tool => {
        // Find which server this tool belongs to
        const servers = this.mcpManager.getServers();
        let serverId = '';
        
        for (const server of servers) {
          const serverTools = this.mcpManager.getServerTools(server);
          if (serverTools.some(t => t.name === tool.name)) {
            serverId = server;
            break;
          }
        }
        
        // Build LLM tool format
        // Ensure parameters is a valid JSON Schema
        const parameters = tool.inputSchema || {};
        
        // Add default type field if missing
        if (!parameters.type) {
          parameters.type = 'object';
        }
        
        // Add empty properties object if missing and type is object
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
      console.error(`Failed to get available tools: ${error}`);
      // Return empty array on error
      return [];
    }
  }

  /**
   * Execute tool call
   * @param toolName Tool name, format: mcp__serverId__toolName
   * @param args Tool arguments
   */
  async executeToolCall(toolName: string, args: Record<string, any>): Promise<ToolCallResult> {
    try {
      // Parse tool name
      const segments = toolName.split('__');
      if (segments.length !== 3 || segments[0] !== 'mcp') {
        throw new MCPError(
          `Invalid MCP tool name format: ${toolName}. Expected format: mcp__serverId__toolName`,
          MCPErrorType.TOOL_NOT_FOUND,
          'unknown',
          toolName
        );
      }
      
      const [_, serverId, actualToolName] = segments;
      const fullToolName = `${serverId}__${actualToolName}`;
      
      // Execute tool call, using current service configuration
      return await this.mcpManager.callTool(fullToolName, args, {
        timeout: this.config.toolCallTimeout,
        maxRetries: this.config.maxRetries,
        retryInterval: this.config.retryInterval
      });
    } catch (error) {
      const mcpError = this.handleMCPError(error, `Failed to execute tool '${toolName}'`);
      
      // Return formatted error message
      return {
        content: [{
          type: 'text',
          text: `Tool call error (${mcpError.type}): ${mcpError.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * Parse tool calls from chat message
   * @param message Chat message
   * @returns Parsed tool calls array, format: [{ name, args }, ...]
   */
  parseToolCallsFromMessage(message: Message): { name: string; args: Record<string, any> }[] {
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return [];
    }
    
    return message.tool_calls.map((toolCall: ToolCall) => {
      // Only process function calls
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
        
        // When argument parsing fails, return error info as arguments
        args = { 
          error: `Argument parsing failed: ${error instanceof Error ? error.message : String(error)}`,
          originalArguments: toolCall.function.arguments 
        };
      }
      
      return { name, args };
    }).filter(Boolean) as { name: string; args: Record<string, any> }[];
  }

  /**
   * Close all MCP connections
   */
  close(): void {
    try {
      this.mcpManager.closeAll();
    } catch (error) {
      this.handleMCPError(error, 'Failed to close MCP connections');
    }
  }
} 