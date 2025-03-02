import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { mcpManager, getAllAvailableTools, getConnectedServers, getServerTools } from '../services/mcpService';
import { mcpConfig } from '../config/mcpConfig';
import { Logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response';

// MCP服务器添加请求验证模式
const addServerRequestSchema = z.object({
  name: z.string().min(1, "服务器名称不能为空"),
  url: z.string().url("必须是有效的URL"),
  description: z.string().optional()
});

/**
 * MCP控制器
 * 提供MCP服务器管理和监控功能
 */
export class MCPController {
  /**
   * 获取所有MCP服务器
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
   * 获取所有可用工具
   */
  static async getTools(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { server } = req.query;
      Logger.debug('MCPController', `Getting tools${server ? ` for server: ${server}` : ' for all servers'}`);
      
      let tools;
      
      // 如果指定了服务器，则只返回该服务器的工具
      if (server && typeof server === 'string') {
        tools = getServerTools(server);
      } else {
        // 否则返回所有工具
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
   * 添加MCP服务器（运行时）
   */
  static async addServer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 验证请求数据
      const result = addServerRequestSchema.safeParse(req.body);
      
      if (!result.success) {
        Logger.warn('MCPController', 'Invalid server configuration provided', result.error.format());
        return ResponseUtil.error(
          res,
          '无效的服务器配置',
          400,
          'VALIDATION_ERROR',
          result.error.format()
        );
      }
      
      const { name, url, description } = result.data;
      Logger.debug('MCPController', `Adding new MCP server: ${name} at ${url}`);
      
      try {
        // 添加服务器
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
        // 处理服务器添加错误
        Logger.error('MCPController', `Failed to add MCP server '${name}'`, error);
        return ResponseUtil.error(
          res,
          `添加服务器失败: ${error instanceof Error ? error.message : String(error)}`,
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
   * 删除MCP服务器
   */
  static async removeServer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      Logger.debug('MCPController', `Removing MCP server: ${id}`);
      
      if (!id) {
        Logger.warn('MCPController', 'Server ID is required but was not provided');
        return ResponseUtil.error(
          res,
          '缺少服务器ID',
          400,
          'MISSING_PARAM'
        );
      }
      
      // 删除服务器
      const success = mcpManager.removeServer(id);
      
      if (!success) {
        Logger.warn('MCPController', `Server not found: ${id}`);
        return ResponseUtil.error(
          res,
          `服务器不存在: ${id}`,
          404,
          'SERVER_NOT_FOUND'
        );
      }
      
      Logger.info('MCPController', `Successfully removed MCP server: ${id}`);
      return ResponseUtil.success(
        res,
        null,
        `服务器已删除: ${id}`
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