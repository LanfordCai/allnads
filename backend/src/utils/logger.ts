import { env } from '../config/env';

/**
 * Log level definition
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

/**
 * Logger service class
 * Provides globally consistent logging functionality and controls log levels based on environment variables
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
   * Get log level from environment variable
   */
  private static getLogLevelFromEnv(): LogLevel {
    const level = env.LOG_LEVEL?.toLowerCase();

    switch (level) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      default: return LogLevel.INFO; // Default INFO level
    }
  }

  /**
   * Get current timestamp
   */
  private static getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Format log message
   */
  private static format(level: string, context: string, message: string): string {
    return `[${this.getTimestamp()}] [${level}] [${context}] ${message}`;
  }

  /**
   * Log DEBUG level message
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
   * Log INFO level message
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
   * Log WARN level message
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
   * Log ERROR level message
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
   * Log API request
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
   * Log API response
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