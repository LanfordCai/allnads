import { Request, Response, NextFunction } from 'express';
import { ChatService } from '../services/chat';
import { SessionService } from '../services/session';
import { chatRequestSchema } from '../types/chat';

/**
 * 聊天控制器
 */
export class ChatController {
  /**
   * 处理聊天请求
   */
  static async chat(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      
      // 处理聊天请求
      const response = await ChatService.processChat(result.data);
      
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
   * 获取会话历史
   */
  static async getSessionHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      
      // 获取会话历史
      const history = SessionService.getHistory(sessionId);
      
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
  static async deleteSession(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      
      // 删除会话
      const success = SessionService.deleteSession(sessionId);
      
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
  static async getAllSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 获取所有会话 ID
      const sessionIds = SessionService.getAllSessionIds();
      
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