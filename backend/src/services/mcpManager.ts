import { MCPClient } from './mcpClient';
import { MCPServerConfig, MCPTool, ToolCallRequest, ToolCallResult } from '../types/mcp';

/**
 * Tool Call Configuration
 */
interface ToolCallConfig {
  /**
   * Maximum retry attempts
   */
  maxRetries?: number;
  
  /**
   * Retry interval (milliseconds)
   */
  retryInterval?: number;
  
  /**
   * Timeout (milliseconds)
   */
  timeout?: number;
}

/**
 * MCP Error Types
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
 * MCP Error
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
 * MCP Manager - Manages multiple MCP server connections
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
   * Add MCP server
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
      // Create client and initialize
      const client = new MCPClient(config);
      const tools = await this.withTimeout(
        client.initialize(),
        this.defaultConfig.timeout || 30000,
        `Server initialization '${config.name}' timed out`
      );
      
      // Save client
      this.clients.set(config.name, client);
      
      // Register tools
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
   * Remove MCP server
   */
  removeServer(serverId: string): boolean {
    const client = this.clients.get(serverId);
    if (!client) {
      return false;
    }
    
    // Close connection
    client.close();
    
    // Remove client
    this.clients.delete(serverId);
    
    // Remove related tools
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
   * Get all MCP servers
   */
  getServers(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Get tools for a specific server
   */
  getServerTools(serverId: string): MCPTool[] {
    const client = this.clients.get(serverId);
    if (!client) {
      return [];
    }
    
    return client.getAvailableTools();
  }

  /**
   * Get all available tools
   */
  getAllTools(): MCPTool[] {
    return Array.from(this.toolsRegistry.values()).map(item => item.tool);
  }

  /**
   * Call tool - Format: serverId__toolName
   * Added more robust error handling, timeout control, and retry mechanism
   */
  async callTool(
    fullToolName: string, 
    args: Record<string, any>,
    config?: Partial<ToolCallConfig>
  ): Promise<ToolCallResult> {
    // Merge configuration
    const callConfig: ToolCallConfig = {
      ...this.defaultConfig,
      ...config
    };
    
    // Parse tool name
    let serverId: string;
    let toolName: string;
    
    try {
      [serverId, toolName] = this.parseToolName(fullToolName);
    } catch (error) {
      // Tool name parsing error
      return {
        content: [{
          type: 'text',
          text: `Error: Invalid tool name format ${fullToolName}. Expected format: serverId__toolName`
        }],
        isError: true
      };
    }
    
    // Check if server exists
    const client = this.clients.get(serverId);
    if (!client) {
      return {
        content: [{
          type: 'text',
          text: `Error: MCP server '${serverId}' does not exist`
        }],
        isError: true
      };
    }
    
    // Retry logic
    let lastError: Error | null = null;
    const maxRetries = callConfig.maxRetries || 0;
    let attempts = 0;
    
    while (attempts <= maxRetries) {
      try {
        // If not the first attempt, log retry information
        if (attempts > 0) {
          console.log(`Retrying tool call ${fullToolName} (${attempts}/${maxRetries})...`);
        }
        
        // Tool call with timeout
        return await this.withTimeout(
          client.callTool({
            toolName,
            args
          }),
          callConfig.timeout || 30000,
          `Tool call ${fullToolName} timed out`
        );
      } catch (error) {
        // Capture error for retry
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Tool call ${fullToolName} failed (attempt ${attempts + 1}/${maxRetries + 1}): ${lastError.message}`);
        
        // Increase attempt count
        attempts++;
        
        // If more retries available, wait before next attempt
        if (attempts <= maxRetries) {
          await this.delay(callConfig.retryInterval || 1000);
        }
      }
    }
    
    // If we get here, all retries failed
    const errorMessage = lastError ? lastError.message : 'Unknown error';
    
    return {
      content: [{
        type: 'text',
        text: `Error: Tool call failed after ${maxRetries + 1} attempts: ${errorMessage}`
      }],
      isError: true
    };
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    this.clients.forEach(client => {
      try {
        client.close();
      } catch (error) {
        console.error('Error closing client:', error);
      }
    });
    this.clients.clear();
    this.toolsRegistry.clear();
  }

  /**
   * Parse tool name into [serverId, toolName]
   * @private
   */
  private parseToolName(fullToolName: string): [string, string] {
    const parts = fullToolName.split('__');
    if (parts.length !== 2) {
      throw new Error(`Invalid tool name format: ${fullToolName}. Expected format: serverId__toolName`);
    }
    
    const [serverId, toolName] = parts;
    if (!serverId || !toolName) {
      throw new Error(`Invalid tool name components in ${fullToolName}`);
    }
    
    return [serverId, toolName];
  }

  /**
   * Add timeout to a promise
   * @private
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new MCPError(
          message,
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
   * Delay execution
   * @private
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 