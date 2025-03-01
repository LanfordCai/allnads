import { Request, Response, NextFunction } from 'express';
import { ChatService } from '../services/chat';
import { SessionService } from '../services/session';
import { chatRequestSchema } from '../types/chat';
import { z } from 'zod';
import { mcpManager } from '../services/mcpService';
import { authenticate } from '../middleware/auth';

// 工具调用请求验证模式
const toolCallRequestSchema = z.object({
  toolName: z.string().min(1, "工具名不能为空"),
  args: z.record(z.unknown()).optional().default({})
});

/**
 * 聊天控制器
 */
export class ChatController {
  /**
   * 处理聊天请求
   */
  static async chat(req: Request & { user?: any }, res: Response, next: NextFunction): Promise<void> {
    try {
      // 验证请求数据
      const result = chatRequestSchema.safeParse(req.body);
      
      if (!result.success) {
        res.status(400).json({
          status: 'error',
          error: {
            message: '无效的请求数据',
            details: result.error.format(),
          },
        });
        return;
      }
      
      const chatData = result.data;
      
      // 处理用户关联
      if (req.user && !chatData.sessionId) {
        // 创建新会话并关联用户
        const session = await SessionService.createSession(
          chatData.systemPrompt,
          req.user.id
        );
        chatData.sessionId = session.id;
      } else if (req.user && chatData.sessionId) {
        // 验证会话所有权
        const isOwner = await SessionService.validateSessionOwnership(
          chatData.sessionId,
          req.user.id
        );
        
        if (!isOwner) {
          res.status(403).json({
            status: 'error',
            error: {
              message: '您无权访问此会话',
              code: 'SESSION_FORBIDDEN',
            }
          });
          return;
        }
      }
      
      // 处理聊天请求
      const response = await ChatService.processChat(chatData);
      
      // 返回成功响应
      res.status(200).json({
        status: 'success',
        data: response,
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * 直接调用工具
   */
  static async callTool(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 验证请求数据
      const result = toolCallRequestSchema.safeParse(req.body);
      
      if (!result.success) {
        res.status(400).json({
          status: 'error',
          error: {
            message: '无效的工具调用请求',
            details: result.error.format(),
          },
        });
        return;
      }
      
      const { toolName, args } = result.data;
      
      // 检查工具名格式
      if (!toolName.includes('__')) {
        res.status(400).json({
          status: 'error',
          error: {
            message: '无效的工具名格式，应为: serverId__toolName',
          },
        });
        return;
      }
      
      try {
        // 调用工具
        const toolResult = await mcpManager.callTool(toolName, args);
        
        // 返回成功响应
        res.status(200).json({
          status: 'success',
          data: {
            result: toolResult,
          },
        });
      } catch (error) {
        // 处理工具调用错误
        res.status(500).json({
          status: 'error',
          error: {
            message: `工具调用失败: ${error instanceof Error ? error.message : String(error)}`,
          },
        });
      }
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * 获取会话历史
   */
  static async getSessionHistory(req: Request & { user?: any }, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        res.status(400).json({
          status: 'error',
          error: {
            message: '缺少会话 ID',
          },
        });
        return;
      }
      
      // 验证用户所有权
      if (req.user) {
        const isOwner = await SessionService.validateSessionOwnership(sessionId, req.user.id);
        if (!isOwner) {
          res.status(403).json({
            status: 'error',
            error: {
              message: '您无权访问此会话',
              code: 'SESSION_FORBIDDEN',
            }
          });
          return;
        }
      }
      
      // 获取会话历史
      const history = await SessionService.getHistory(sessionId);
      
      // 返回成功响应
      res.status(200).json({
        status: 'success',
        data: {
          sessionId,
          history,
        },
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * 删除会话
   */
  static async deleteSession(req: Request & { user?: any }, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        res.status(400).json({
          status: 'error',
          error: {
            message: '缺少会话 ID',
          },
        });
        return;
      }
      
      // 验证用户所有权
      if (req.user) {
        const isOwner = await SessionService.validateSessionOwnership(sessionId, req.user.id);
        if (!isOwner) {
          res.status(403).json({
            status: 'error',
            error: {
              message: '您无权删除此会话',
              code: 'SESSION_FORBIDDEN',
            }
          });
          return;
        }
      }
      
      // 删除会话
      const success = await SessionService.deleteSession(sessionId);
      
      if (!success) {
        res.status(404).json({
          status: 'error',
          error: {
            message: `会话不存在: ${sessionId}`,
          },
        });
        return;
      }
      
      // 返回成功响应
      res.status(200).json({
        status: 'success',
        data: {
          message: `会话已删除: ${sessionId}`,
        },
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * 获取所有会话 ID
   */
  static async getAllSessions(req: Request & { user?: any }, res: Response, next: NextFunction): Promise<void> {
    try {
      let sessionIds: string[] = [];
      
      // 如果用户已认证，只返回属于该用户的会话
      if (req.user) {
        sessionIds = await SessionService.getUserSessionIds(req.user.id);
      } else {
        // 获取所有会话 ID
        sessionIds = await SessionService.getAllSessionIds();
      }
      
      // 返回成功响应
      res.status(200).json({
        status: 'success',
        data: {
          sessions: sessionIds,
        },
      });
    } catch (error) {
      next(error);
    }
  }
} 