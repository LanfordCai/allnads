import { env } from '../config/env';

/**
 * 日志级别定义
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

/**
 * 日志服务类
 * 提供全局一致的日志记录功能，并根据环境变量控制日志级别
 */
export class Logger {
  private static currentLevel: LogLevel = Logger.getLogLevelFromEnv();
  private static readonly RESET = '\x1b[0m';
  private static readonly RED = '\x1b[31m';
  private static readonly YELLOW = '\x1b[33m';
  private static readonly GREEN = '\x1b[32m';
  private static readonly CYAN = '\x1b[36m';
  private static readonly GRAY = '\x1b[90m';

  /**
   * 从环境变量获取日志级别
   */
  private static getLogLevelFromEnv(): LogLevel {
    const level = env.LOG_LEVEL?.toLowerCase();

    switch (level) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      default: return LogLevel.INFO; // 默认INFO级别
    }
  }

  /**
   * 获取当前时间戳
   */
  private static getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * 格式化日志信息
   */
  private static format(level: string, context: string, message: string): string {
    return `[${this.getTimestamp()}] [${level}] [${context}] ${message}`;
  }

  /**
   * 记录DEBUG级别日志
   */
  static debug(context: string, message: string, meta?: any): void {
    if (this.currentLevel >= LogLevel.DEBUG) {
      console.debug(
        `${this.GRAY}${this.format('DEBUG', context, message)}${this.RESET}`,
        meta ? meta : ''
      );
    }
  }

  /**
   * 记录INFO级别日志
   */
  static info(context: string, message: string, meta?: any): void {
    if (this.currentLevel >= LogLevel.INFO) {
      console.info(
        `${this.GREEN}${this.format('INFO', context, message)}${this.RESET}`,
        meta ? meta : ''
      );
    }
  }

  /**
   * 记录WARN级别日志
   */
  static warn(context: string, message: string, meta?: any): void {
    if (this.currentLevel >= LogLevel.WARN) {
      console.warn(
        `${this.YELLOW}${this.format('WARN', context, message)}${this.RESET}`,
        meta ? meta : ''
      );
    }
  }

  /**
   * 记录ERROR级别日志
   */
  static error(context: string, message: string, error?: any): void {
    if (this.currentLevel >= LogLevel.ERROR) {
      console.error(
        `${this.RED}${this.format('ERROR', context, message)}${this.RESET}`,
        error ? error : ''
      );
    }
  }

  /**
   * 记录API请求
   */
  static logRequest(req: any, context: string): void {
    if (this.currentLevel >= LogLevel.INFO) {
      const { method, originalUrl, ip, headers } = req;
      const userAgent = headers['user-agent'] || 'Unknown';
      
      console.info(
        `${this.CYAN}${this.format('REQUEST', context, `${method} ${originalUrl}`)}${this.RESET}`,
        { ip, userAgent }
      );
    }
  }

  /**
   * 记录API响应
   */
  static logResponse(res: any, context: string, startTime?: number): void {
    if (this.currentLevel >= LogLevel.INFO) {
      const duration = startTime ? `${Date.now() - startTime}ms` : 'unknown';
      
      console.info(
        `${this.CYAN}${this.format('RESPONSE', context, `Status: ${res.statusCode} - Duration: ${duration}`)}${this.RESET}`
      );
    }
  }
} 