/**
 * Rate limiting and retry utilities for blockchain calls
 */

// Token bucket implementation for rate limiting
export class RateLimiter {
  private tokens: number;
  private lastRefillTime: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond
  private activeRequests: number = 0;
  private queuedRequests: number = 0;
  private requestId: number = 0;
  private processingQueue: boolean = false;

  /**
   * Create a new rate limiter
   * @param maxRequestsPerSecond Maximum number of requests allowed per second
   * @param initialTokens Initial number of tokens in the bucket (defaults to max)
   */
  constructor(maxRequestsPerSecond: number, initialTokens?: number) {
    this.maxTokens = maxRequestsPerSecond;
    this.tokens = initialTokens ?? maxRequestsPerSecond;
    this.lastRefillTime = Date.now();
    this.refillRate = maxRequestsPerSecond / 1000; // Convert to tokens per ms
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsedTime = now - this.lastRefillTime;
    
    if (elapsedTime > 0) {
      // Calculate tokens to add based on time elapsed
      const tokensToAdd = elapsedTime * this.refillRate;
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefillTime = now;
    }
  }

  /**
   * Try to consume a token
   * @returns true if a token was consumed, false otherwise
   */
  public tryConsume(): boolean {
    this.refill();
    
    if (this.tokens >= 1) {
      this.tokens -= 1;
      this.activeRequests++;
      return true;
    }
    
    return false;
  }

  /**
   * Calculate time until next token is available
   * @returns Time in milliseconds until next token
   */
  private getTimeUntilNextToken(): number {
    this.refill();
    if (this.tokens >= 1) return 0;
    
    // Calculate how much time we need to wait to get 1 token
    return Math.ceil((1 - this.tokens) / this.refillRate);
  }

  /**
   * Wait until a token is available and consume it
   * @returns Promise that resolves when a token is consumed
   */
  public async consume(): Promise<void> {
    // First try to consume immediately
    if (this.tryConsume()) {
      return;
    }
    
    // If we can't consume immediately, we're queued
    this.queuedRequests++;
    
    try {
      // Get time until next token is available
      const waitTime = this.getTimeUntilNextToken();
      
      if (waitTime > 0) {
        // Wait for the calculated time
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      // After waiting, try to consume again
      // If we still can't consume, we'll wait a minimal amount and try again
      // This ensures we don't block the queue for too long
      let attempts = 0;
      const maxAttempts = 5;
      
      while (!this.tryConsume() && attempts < maxAttempts) {
        attempts++;
        // Wait a small fraction of the time between tokens
        const minWaitTime = Math.ceil(1000 / (this.refillRate * 1000) / 10);
        await new Promise(resolve => setTimeout(resolve, minWaitTime));
      }
      
      // If we still couldn't consume after multiple attempts, force consumption
      // This is a last resort to prevent deadlocks
      if (attempts >= maxAttempts) {
        this.activeRequests++;
        this.tokens = Math.max(0, this.tokens - 1);
      }
      
      this.queuedRequests--;
    } catch (error) {
      // If there's an error, make sure to decrement the queued count
      this.queuedRequests--;
      throw error;
    }
  }

  /**
   * Mark a request as completed
   */
  public completeRequest(): void {
    if (this.activeRequests > 0) {
      this.activeRequests--;
    }
  }

  /**
   * Get current status of the rate limiter
   */
  public getStatus(): { active: number; queued: number; availableTokens: number } {
    this.refill(); // Update token count
    return {
      active: this.activeRequests,
      queued: this.queuedRequests,
      availableTokens: this.tokens
    };
  }
}

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retries
 * @param initialDelayMs Initial delay in milliseconds
 * @param maxDelayMs Maximum delay in milliseconds
 * @returns Promise that resolves with the function result or rejects with the last error
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 500,
  maxDelayMs: number = 10000
): Promise<T> {
  let retries = 0;
  let delay = initialDelayMs;

  while (true) {
    try {
      return await fn();
    } catch (error: unknown) {
      // Check if we've reached max retries
      if (retries >= maxRetries) {
        throw error;
      }
      
      // Type guard for error object
      const errorObj = error as { 
        message?: string; 
        status?: number; 
        code?: string;
      };
      
      // Determine if this is an HTTP/network error that should be retried
      const isHttpError = 
        errorObj?.message?.includes('HTTP') || 
        errorObj?.message?.includes('network') ||
        errorObj?.message?.includes('timeout') ||
        errorObj?.message?.includes('connection') ||
        (errorObj?.status && errorObj?.status >= 400 && errorObj?.status < 500) ||
        errorObj?.code === 'NETWORK_ERROR' ||
        errorObj?.code === 'TIMEOUT';
      
      // Determine if this is a contract execution error that should NOT be retried
      const isContractError = 
        errorObj?.message?.includes('contract') || 
        errorObj?.message?.includes('execution reverted') ||
        errorObj?.message?.includes('ContractFunctionExecutionError') ||
        errorObj?.message?.includes('invalid opcode') ||
        errorObj?.message?.includes('out of gas') ||
        errorObj?.code === 'CALL_EXCEPTION';
      
      // Only retry HTTP errors, not contract execution errors
      if (!isHttpError || isContractError) {
        throw error;
      }

      // Exponential backoff
      retries++;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, maxDelayMs);
    }
  }
}

/**
 * Wrap a function with rate limiting and retry logic
 * @param fn Function to wrap
 * @param rateLimiter Rate limiter instance
 * @param maxRetries Maximum number of retries
 * @returns Rate-limited and retry-enabled function
 */
export function withRateLimitAndRetry<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  rateLimiter: RateLimiter,
  maxRetries: number = 3
): T {
  return (async (...args: unknown[]): Promise<unknown> => {
    try {
      // Wait for rate limiter
      await rateLimiter.consume();
      
      try {
        // Execute with retry
        const result = await retryWithBackoff(
          () => fn(...args),
          maxRetries
        );
        
        // Mark request as completed
        rateLimiter.completeRequest();
        
        return result;
      } catch (error) {
        // Mark request as completed even if it failed
        rateLimiter.completeRequest();
        throw error;
      }
    } catch (_error) {
      // This would be an error in the rate limiter itself
      
      // Try to execute the function directly as a fallback
      // This bypasses rate limiting but prevents complete failure
      return await fn(...args);
    }
  }) as T;
}