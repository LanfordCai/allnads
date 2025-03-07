import { Request, Response, NextFunction } from 'express';
import { SessionService } from '../services/session';
import { z } from 'zod';
import { mcpManager } from '../services/mcpService';
import { Logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response';

// Tool call request validation schema
const toolCallRequestSchema = z.object({
  toolName: z.string().min(1, "Tool name cannot be empty"),
  args: z.record(z.unknown()).optional().default({})
});

/**
 * Chat Controller
 */
export class ChatController {
  /**
   * Get session history
   */
  static async getSessionHistory(req: Request & { user?: any }, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      Logger.debug('ChatController', `Getting session history for: ${sessionId}`);
      
      if (!sessionId) {
        Logger.warn('ChatController', 'Session ID is required but was not provided');
        return ResponseUtil.error(
          res,
          'Missing session ID',
          400,
          'MISSING_PARAM'
        );
      }
      
      // Validate user ownership
      if (req.user) {
        const isOwner = await SessionService.validateSessionOwnership(sessionId, req.user.id);
        if (!isOwner) {
          Logger.warn('ChatController', `User ${req.user.id} attempted to access unauthorized session: ${sessionId}`);
          return ResponseUtil.error(
            res,
            'You do not have permission to access this session',
            403,
            'SESSION_FORBIDDEN'
          );
        }
      }
      
      // Get session history - directly use SessionService
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
   * Delete session
   */
  static async deleteSession(req: Request & { user?: any }, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      Logger.debug('ChatController', `Deleting session: ${sessionId}`);
      
      if (!sessionId) {
        Logger.warn('ChatController', 'Session ID is required but was not provided');
        return ResponseUtil.error(
          res,
          'Missing session ID',
          400,
          'MISSING_PARAM'
        );
      }
      
      // Validate user ownership
      if (req.user) {
        const isOwner = await SessionService.validateSessionOwnership(sessionId, req.user.id);
        if (!isOwner) {
          Logger.warn('ChatController', `User ${req.user.id} attempted to delete unauthorized session: ${sessionId}`);
          return ResponseUtil.error(
            res,
            'You do not have permission to delete this session',
            403,
            'SESSION_FORBIDDEN'
          );
        }
      }
      
      // Delete session - directly use SessionService
      const success = await SessionService.deleteSession(sessionId);
      
      if (!success) {
        Logger.warn('ChatController', `Session not found: ${sessionId}`);
        return ResponseUtil.error(
          res,
          `Session does not exist: ${sessionId}`,
          404,
          'SESSION_NOT_FOUND'
        );
      }
      
      Logger.info('ChatController', `Successfully deleted session: ${sessionId}`);
      return ResponseUtil.success(
        res,
        null,
        `Session deleted: ${sessionId}`
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
   * Get all session IDs
   */
  static async getAllSessions(req: Request & { user?: any }, res: Response, next: NextFunction): Promise<void> {
    try {
      Logger.debug('ChatController', 'Getting all session IDs');
      let sessionIds: string[] = [];
      
      // If user is authenticated, only return sessions belonging to that user
      if (req.user) {
        Logger.debug('ChatController', `Getting sessions for user: ${req.user.id}`);
        sessionIds = await SessionService.getUserSessionIds(req.user.id);
      } else {
        // Get all session IDs
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