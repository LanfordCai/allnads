// import { SSEClientTransport, JSONRPCClient, Client } from '@modelcontextprotocol/sdk/types';
// import type { Tool } from '@modelcontextprotocol/sdk/types';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { MCPServerConfig, MCPTool, ToolCallRequest, ToolCallResult, TextContent, ImageContent } from '../types/mcp';
import { MCPError, MCPErrorType } from './mcpManager';

/**
 * MCP Client Configuration
 */
interface MCPClientConfig {
  /**
   * Connection timeout (milliseconds)
   */
  connectionTimeout?: number;
  
  /**
   * Call timeout (milliseconds)
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
      connectionTimeout: 30000,  // Default 30 seconds
      callTimeout: 30000,        // Default 30 seconds
      ...clientConfig
    };
  }

  /**
   * Promise with timeout
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
   * Initialize connection and get available tools
   */
  async initialize(): Promise<MCPTool[]> {
    try {
      if (!this.isConnected) {
        // Add connection timeout
        await this.withTimeout(
          this.client.connect(this.transport),
          this.clientConfig.connectionTimeout || 30000,
          `MCP server '${this.serverConfig.name}' connection timeout`
        );
        this.isConnected = true;
      }
      
      // Get available tools, add timeout
      const toolsResult = await this.withTimeout(
        this.client.listTools(),
        this.clientConfig.callTimeout || 30000,
        `Timeout getting tool list from server '${this.serverConfig.name}'`
      );
      
      const tools = toolsResult.tools || [];
      
      // Convert to our tool format
      this.availableTools = tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema || {}
      }));
      
      return this.availableTools;
    } catch (error: unknown) {
      // Categorize error type
      let mcpError: MCPError;
      
      if (error instanceof MCPError) {
        mcpError = error;
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        let errorType = MCPErrorType.UNKNOWN;
        
        // Determine error type based on message
        if (errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('timed out')) {
          errorType = MCPErrorType.TIMEOUT;
        } else if (errorMessage.toLowerCase().includes('connect') || errorMessage.toLowerCase().includes('connection')) {
          errorType = MCPErrorType.CONNECTION;
        } else if (errorMessage.toLowerCase().includes('server')) {
          errorType = MCPErrorType.SERVER_ERROR;
        }
        
        mcpError = new MCPError(
          `MCP client initialization error: ${errorMessage}`,
          errorType,
          this.serverConfig.name
        );
      }
      
      console.error(`Error initializing MCP client: ${mcpError.message} (${mcpError.type})`);
      throw mcpError;
    }
  }

  /**
   * Get all available tools
   */
  getAvailableTools(): MCPTool[] {
    return this.availableTools;
  }

  /**
   * Call tool and get results
   */
  async callTool(request: ToolCallRequest): Promise<ToolCallResult> {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }
      
      // Check if tool is available
      const tool = this.availableTools.find(t => t.name === request.toolName);
      if (!tool) {
        throw new MCPError(
          `Tool not found: ${request.toolName}`,
          MCPErrorType.TOOL_NOT_FOUND,
          this.serverConfig.name,
          request.toolName
        );
      }

      // Call MCP tool, add timeout
      const result = await this.withTimeout(
        this.client.callTool({
          name: request.toolName,
          arguments: request.args
        }),
        this.clientConfig.callTimeout || 30000,
        `Tool call '${request.toolName}' timed out`
      );
      
      // Format return result according to MCP specification
      const resultContent = result.result !== undefined ? result.result : result;
      
      // Create response object compliant with MCP specification
      let content: (TextContent | ImageContent)[] = [];
      
      // Convert result to compliant content object
      if (typeof resultContent === 'string') {
        // Text content
        content = [{
          type: 'text',
          text: resultContent
        }];
      } else if (resultContent !== null && typeof resultContent === 'object') {
        // If object, check if it has image data
        // Use type guard to check if it might be image content
        const maybeImage = resultContent as Record<string, unknown>;
        if (
          maybeImage.type === 'image' && 
          typeof maybeImage.data === 'string' && 
          typeof maybeImage.mimeType === 'string'
        ) {
          // Already compliant image content, use type assertion
          content = [{
            type: 'image',
            data: maybeImage.data,
            mimeType: maybeImage.mimeType
          }];
        } else {
          // Regular object, convert to JSON string as text content
          content = [{
            type: 'text',
            text: JSON.stringify(resultContent)
          }];
        }
      } else {
        // Convert other types to string
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
      // Categorize error type
      let mcpError: MCPError;
      
      if (error instanceof MCPError) {
        mcpError = error;
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        let errorType = MCPErrorType.UNKNOWN;
        
        // Determine error type based on message
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
          `Tool call error: ${errorMessage}`,
          errorType,
          this.serverConfig.name,
          request.toolName
        );
      }
      
      console.error(`Error calling tool ${request.toolName}: ${mcpError.message} (${mcpError.type})`);
      
      // Return error result
      return {
        content: [{
          type: 'text',
          text: `Error calling tool ${request.toolName}: ${mcpError.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * Close connection
   */
  close(): void {
    if (this.isConnected) {
      try {
        // Use Client's close method to close the connection
        this.client.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`Failed to close client connection: ${errorMessage}`);
      }
      this.isConnected = false;
    }
  }
} 