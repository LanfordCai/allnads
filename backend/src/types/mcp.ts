import { z } from 'zod';

/**
 * MCP tool parameter structure
 */
export const toolInputSchema = z.record(z.any());

/**
 * Role type
 */
export type Role = 'user' | 'assistant' | 'system' | 'tool';

/**
 * MCP base result interface
 */
export interface Result {
  /**
   * This result attribute is reserved by the protocol, allowing clients and servers to attach additional metadata to their responses.
   */
  _meta?: { [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * Annotated content base class
 */
export interface Annotated {
  annotations?: {
    /**
     * Describes who the expected receiver of this object or data is.
     */
    audience?: Role[];
    /**
     * :Describes the importance of this data to the operation server.
     */
    priority?: number;
  }
}

/**
 * Text content type
 */
export interface TextContent extends Annotated {
  type: 'text';
  text: string;
}

/**
 * Image content type
 */
export interface ImageContent extends Annotated {
  type: 'image';
  /**
   * base64 encoded image data
   */
  data: string;
  /**
   * Image MIME type
   */
  mimeType: string;
}

/**
 * Embedded resource type
 */
export interface EmbeddedResource extends Annotated {
  type: 'embedded_resource';
  resource: any;
}

/**
 * MCP tool call result - according to MCP specification
 */
export interface ToolCallResult extends Result {
  content: (TextContent | ImageContent | EmbeddedResource)[];
  
  /**
   * Whether the tool call is wrong
   * If not set, it is assumed to be false (call successful)
   */
  isError?: boolean;
}

/**
 * MCP server configuration
 */
export interface MCPServerConfig {
  url: string; // SSE server URL
  name: string; // server name
  description?: string; // server description
}

/**
 * MCP tool description
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

/**
 * Tool call request
 */
export interface ToolCallRequest {
  toolName: string;
  args: Record<string, any>;
} 