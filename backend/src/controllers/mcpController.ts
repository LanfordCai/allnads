import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { mcpManager, getAllAvailableTools, getConnectedServers, getServerTools } from '../services/mcpService';
import { mcpConfig } from '../config/mcpConfig';
import { Logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response';

// MCP server add request validation schema
const addServerRequestSchema = z.object({
  name: z.string().min(1, "Server name cannot be empty"),
  url: z.string().url("Must be a valid URL"),
  description: z.string().optional()
});

/**
 * MCP Controller
 * Provides MCP server management and monitoring functionality
 */
export class MCPController {
  /**
   * Get all MCP servers
   */
  static async getServers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      Logger.debug('MCPController', 'Getting all MCP servers');
      const servers = getConnectedServers();
      
      Logger.info('MCPController', `Retrieved ${servers.length} MCP servers`);
      
      const serversData = servers.map(serverId => ({
        id: serverId,
        description: mcpConfig.servers.find(s => s.name === serverId)?.description || '',
        toolCount: getServerTools(serverId).length
      }));
      
      return ResponseUtil.success(res, serversData);
    } catch (error) {
      Logger.error('MCPController', 'Error retrieving MCP servers', error);
      return ResponseUtil.error(
        res,
        'Failed to retrieve MCP servers',
        500,
        'INTERNAL_ERROR',
        error instanceof Error ? { message: error.message } : undefined
      );
    }
  }
  
  /**
   * Get all available tools
   */
  static async getTools(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { server } = req.query;
      Logger.debug('MCPController', `Getting tools${server ? ` for server: ${server}` : ' for all servers'}`);
      
      let tools;
      
      // If a server is specified, only return tools for that server
      if (server && typeof server === 'string') {
        tools = getServerTools(server);
      } else {
        // Otherwise return all tools
        tools = getAllAvailableTools();
      }
      
      Logger.info('MCPController', `Retrieved ${tools.length} tools`);
      
      const toolsData = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        fullName: `${mcpConfig.servers.find(s => s.name === server)?.name || ''}__${tool.name}`,
        schema: tool.inputSchema
      }));
      
      return ResponseUtil.success(res, toolsData);
    } catch (error) {
      Logger.error('MCPController', 'Error retrieving MCP tools', error);
      return ResponseUtil.error(
        res,
        'Failed to retrieve MCP tools',
        500,
        'INTERNAL_ERROR',
        error instanceof Error ? { message: error.message } : undefined
      );
    }
  }
  
  /**
   * Add MCP server (runtime)
   */
  static async addServer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request data
      const result = addServerRequestSchema.safeParse(req.body);
      
      if (!result.success) {
        Logger.warn('MCPController', 'Invalid server configuration provided', result.error.format());
        return ResponseUtil.error(
          res,
          'Invalid server configuration',
          400,
          'VALIDATION_ERROR',
          result.error.format()
        );
      }
      
      const { name, url, description } = result.data;
      Logger.debug('MCPController', `Adding new MCP server: ${name} at ${url}`);
      
      try {
        // Add server
        const tools = await mcpManager.addServer({
          name,
          url,
          description
        });
        
        Logger.info('MCPController', `Successfully added MCP server '${name}' with ${tools.length} tools`);
        
        return ResponseUtil.success(
          res,
          {
            server: name,
            url,
            description,
            tools: tools.map(t => ({
              name: t.name,
              description: t.description
            }))
          },
          'MCP server added successfully'
        );
      } catch (error) {
        // Handle server addition error
        Logger.error('MCPController', `Failed to add MCP server '${name}'`, error);
        return ResponseUtil.error(
          res,
          `Failed to add server: ${error instanceof Error ? error.message : String(error)}`,
          500,
          'SERVER_CONNECTION_ERROR'
        );
      }
    } catch (error) {
      Logger.error('MCPController', 'Unexpected error in addServer', error);
      return ResponseUtil.error(
        res,
        'Internal server error',
        500,
        'INTERNAL_ERROR',
        error instanceof Error ? { message: error.message } : undefined
      );
    }
  }
  
  /**
   * Remove MCP server
   */
  static async removeServer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      Logger.debug('MCPController', `Removing MCP server: ${id}`);
      
      if (!id) {
        Logger.warn('MCPController', 'Server ID is required but was not provided');
        return ResponseUtil.error(
          res,
          'Missing server ID',
          400,
          'MISSING_PARAM'
        );
      }
      
      // Remove server
      const success = mcpManager.removeServer(id);
      
      if (!success) {
        Logger.warn('MCPController', `Server not found: ${id}`);
        return ResponseUtil.error(
          res,
          `Server does not exist: ${id}`,
          404,
          'SERVER_NOT_FOUND'
        );
      }
      
      Logger.info('MCPController', `Successfully removed MCP server: ${id}`);
      return ResponseUtil.success(
        res,
        null,
        `Server removed: ${id}`
      );
    } catch (error) {
      Logger.error('MCPController', `Error removing MCP server: ${req.params.id}`, error);
      return ResponseUtil.error(
        res,
        'Internal server error',
        500,
        'INTERNAL_ERROR',
        error instanceof Error ? { message: error.message } : undefined
      );
    }
  }
} 