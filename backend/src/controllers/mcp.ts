import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { mcpManager, getAllAvailableTools, getConnectedServers, getServerTools } from '../services/mcpService';
import { mcpConfig } from '../config/mcpConfig';

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
      const servers = getConnectedServers();
      
      // 返回成功响应
      res.status(200).json({
        status: 'success',
        data: {
          servers: servers.map(serverId => ({
            id: serverId,
            description: mcpConfig.servers.find(s => s.name === serverId)?.description || '',
            toolCount: getServerTools(serverId).length
          }))
        },
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * 获取所有可用工具
   */
  static async getTools(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { server } = req.query;
      let tools;
      
      // 如果指定了服务器，则只返回该服务器的工具
      if (server && typeof server === 'string') {
        tools = getServerTools(server);
      } else {
        // 否则返回所有工具
        tools = getAllAvailableTools();
      }
      
      // 返回成功响应
      res.status(200).json({
        status: 'success',
        data: {
          tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            fullName: `${mcpConfig.servers.find(s => s.name === server)?.name || ''}__${tool.name}`,
            schema: tool.inputSchema
          }))
        },
      });
    } catch (error) {
      next(error);
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
        res.status(400).json({
          status: 'error',
          error: {
            message: '无效的服务器配置',
            details: result.error.format(),
          },
        });
        return;
      }
      
      const { name, url, description } = result.data;
      
      try {
        // 添加服务器
        const tools = await mcpManager.addServer({
          name,
          url,
          description
        });
        
        // 返回成功响应
        res.status(200).json({
          status: 'success',
          data: {
            server: name,
            url,
            description,
            tools: tools.map(t => ({
              name: t.name,
              description: t.description
            }))
          },
        });
      } catch (error) {
        // 处理服务器添加错误
        res.status(500).json({
          status: 'error',
          error: {
            message: `添加服务器失败: ${error instanceof Error ? error.message : String(error)}`,
          },
        });
      }
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * 删除MCP服务器
   */
  static async removeServer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({
          status: 'error',
          error: {
            message: '缺少服务器ID',
          },
        });
        return;
      }
      
      // 删除服务器
      const success = mcpManager.removeServer(id);
      
      if (!success) {
        res.status(404).json({
          status: 'error',
          error: {
            message: `服务器不存在: ${id}`,
          },
        });
        return;
      }
      
      // 返回成功响应
      res.status(200).json({
        status: 'success',
        data: {
          message: `服务器已删除: ${id}`,
        },
      });
    } catch (error) {
      next(error);
    }
  }
} 