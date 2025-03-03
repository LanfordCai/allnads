import { Request, Response, NextFunction } from 'express';
import { ChatService } from '../services/chat';
import { SessionService } from '../services/session';
import { z } from 'zod';
import { mcpManager } from '../services/mcpService';
import { Logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response';

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
   * 直接调用工具
   */
  static async callTool(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      Logger.debug('ChatController', 'Processing tool call request');
      
      // 验证请求数据
      const result = toolCallRequestSchema.safeParse(req.body);
      
      if (!result.success) {
        Logger.warn('ChatController', 'Invalid tool call request', result.error.format());
        return ResponseUtil.error(
          res,
          '无效的工具调用请求',
          400,
          'VALIDATION_ERROR',
          result.error.format()
        );
      }
      
      const { toolName, args } = result.data;
      
      // 检查工具名格式
      if (!toolName.includes('__')) {
        Logger.warn('ChatController', `Invalid tool name format: ${toolName}`);
        return ResponseUtil.error(
          res,
          '无效的工具名格式，应为: serverId__toolName',
          400,
          'INVALID_TOOL_NAME'
        );
      }
      
      try {
        Logger.info('ChatController', `Calling tool: ${toolName} with args`, args);
        // 调用工具
        const toolResult = await mcpManager.callTool(toolName, args);
        
        Logger.info('ChatController', `Tool call successful: ${toolName}`);
        return ResponseUtil.success(res, toolResult);
      } catch (error) {
        // 处理工具调用错误
        Logger.error('ChatController', `Tool call failed: ${toolName}`, error);
        return ResponseUtil.error(
          res,
          `工具调用失败: ${error instanceof Error ? error.message : String(error)}`,
          500,
          'TOOL_CALL_ERROR'
        );
      }
    } catch (error) {
      Logger.error('ChatController', 'Unexpected error in callTool', error);
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
   * 获取会话历史
   */
  static async getSessionHistory(req: Request & { user?: any }, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      Logger.debug('ChatController', `Getting session history for: ${sessionId}`);
      
      if (!sessionId) {
        Logger.warn('ChatController', 'Session ID is required but was not provided');
        return ResponseUtil.error(
          res,
          '缺少会话 ID',
          400,
          'MISSING_PARAM'
        );
      }
      
      // 验证用户所有权
      if (req.user) {
        const isOwner = await SessionService.validateSessionOwnership(sessionId, req.user.id);
        if (!isOwner) {
          Logger.warn('ChatController', `User ${req.user.id} attempted to access unauthorized session: ${sessionId}`);
          return ResponseUtil.error(
            res,
            '您无权访问此会话',
            403,
            'SESSION_FORBIDDEN'
          );
        }
      }
      
      // 获取会话历史 - 直接使用SessionService
      const history = await SessionService.getHistory(sessionId);
      Logger.info('ChatController', `Retrieved history for session ${sessionId}: ${history.length} messages`);
      
      return ResponseUtil.success(
        res,
        {
          sessionId,
          history
        }
      );
    } catch (error) {
      Logger.error('ChatController', `Error getting session history: ${req.params.sessionId}`, error);
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
   * 删除会话
   */
  static async deleteSession(req: Request & { user?: any }, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      Logger.debug('ChatController', `Deleting session: ${sessionId}`);
      
      if (!sessionId) {
        Logger.warn('ChatController', 'Session ID is required but was not provided');
        return ResponseUtil.error(
          res,
          '缺少会话 ID',
          400,
          'MISSING_PARAM'
        );
      }
      
      // 验证用户所有权
      if (req.user) {
        const isOwner = await SessionService.validateSessionOwnership(sessionId, req.user.id);
        if (!isOwner) {
          Logger.warn('ChatController', `User ${req.user.id} attempted to delete unauthorized session: ${sessionId}`);
          return ResponseUtil.error(
            res,
            '您无权删除此会话',
            403,
            'SESSION_FORBIDDEN'
          );
        }
      }
      
      // 删除会话 - 直接使用SessionService
      const success = await SessionService.deleteSession(sessionId);
      
      if (!success) {
        Logger.warn('ChatController', `Session not found: ${sessionId}`);
        return ResponseUtil.error(
          res,
          `会话不存在: ${sessionId}`,
          404,
          'SESSION_NOT_FOUND'
        );
      }
      
      Logger.info('ChatController', `Successfully deleted session: ${sessionId}`);
      return ResponseUtil.success(
        res,
        null,
        `会话已删除: ${sessionId}`
      );
    } catch (error) {
      Logger.error('ChatController', `Error deleting session: ${req.params.sessionId}`, error);
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
   * 获取所有会话 ID
   */
  static async getAllSessions(req: Request & { user?: any }, res: Response, next: NextFunction): Promise<void> {
    try {
      Logger.debug('ChatController', 'Getting all session IDs');
      let sessionIds: string[] = [];
      
      // 如果用户已认证，只返回属于该用户的会话
      if (req.user) {
        Logger.debug('ChatController', `Getting sessions for user: ${req.user.id}`);
        sessionIds = await SessionService.getUserSessionIds(req.user.id);
      } else {
        // 获取所有会话 ID
        sessionIds = await SessionService.getAllSessionIds();
      }
      
      Logger.info('ChatController', `Retrieved ${sessionIds.length} sessions`);
      return ResponseUtil.success(res, { sessions: sessionIds });
    } catch (error) {
      Logger.error('ChatController', 'Error getting all sessions', error);
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