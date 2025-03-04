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
      this.logStatus();
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
    const currentRequestId = ++this.requestId;
    
    // First try to consume immediately
    if (this.tryConsume()) {
      return;
    }
    
    // If we can't consume immediately, we're queued
    this.queuedRequests++;
    this.logStatus(`Request #${currentRequestId} queued`);
    
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
        console.warn(`[RateLimiter] Force consuming token after ${attempts} attempts`);
        this.activeRequests++;
        this.tokens = Math.max(0, this.tokens - 1);
      }
      
      this.queuedRequests--;
      this.logStatus(`Request #${currentRequestId} started after waiting ~${waitTime}ms`);
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
      this.logStatus("Request completed");
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

  /**
   * Log the current status of the rate limiter
   */
  private logStatus(message?: string): void {
    const status = this.getStatus();
    console.log(
      `[RateLimiter] ${message || 'Status update'}: ` +
      `Active: ${status.active}, ` +
      `Queued: ${status.queued}, ` +
      `Available tokens: ${status.availableTokens.toFixed(2)}`
    );
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
    } catch (error: any) {
      // Check if we've reached max retries
      if (retries >= maxRetries) {
        console.log(`[Retry] Max retries (${maxRetries}) reached, giving up.`);
        throw error;
      }
      
      // Determine if this is an HTTP/network error that should be retried
      const isHttpError = 
        error?.message?.includes('HTTP') || 
        error?.message?.includes('network') ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('connection') ||
        (error?.status >= 400 && error?.status < 500) ||
        error?.code === 'NETWORK_ERROR' ||
        error?.code === 'TIMEOUT';
      
      // Determine if this is a contract execution error that should NOT be retried
      const isContractError = 
        error?.message?.includes('contract') || 
        error?.message?.includes('execution reverted') ||
        error?.message?.includes('ContractFunctionExecutionError') ||
        error?.message?.includes('invalid opcode') ||
        error?.message?.includes('out of gas') ||
        error?.code === 'CALL_EXCEPTION';
      
      // Only retry HTTP errors, not contract execution errors
      if (!isHttpError || isContractError) {
        console.log(`[Retry] Error not eligible for retry: ${error.message}`);
        throw error;
      }

      // Log retry attempt
      console.log(`[Retry] Attempt ${retries + 1}/${maxRetries} failed, retrying in ${delay}ms: ${error.message}`);
      
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
export function withRateLimitAndRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  rateLimiter: RateLimiter,
  maxRetries: number = 3
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    // Get a timestamp for performance tracking
    const startTime = Date.now();
    
    try {
      // Wait for rate limiter
      await rateLimiter.consume();
      
      // Track how long we waited for the rate limiter
      const waitTime = Date.now() - startTime;
      if (waitTime > 100) { // Only log if wait was significant
        console.log(`[RateLimit] Waited ${waitTime}ms for token`);
      }
      
      try {
        // Execute with retry
        const result = await retryWithBackoff(
          () => fn(...args),
          maxRetries
        );
        
        // Mark request as completed
        rateLimiter.completeRequest();
        
        // Log execution time
        const executionTime = Date.now() - startTime;
        if (executionTime > 1000) { // Only log if execution was slow
          console.log(`[Performance] Request took ${executionTime}ms to complete`);
        }
        
        return result;
      } catch (error) {
        // Mark request as completed even if it failed
        rateLimiter.completeRequest();
        throw error;
      }
    } catch (error) {
      // This would be an error in the rate limiter itself
      console.error('[RateLimit] Error in rate limiter:', error);
      
      // Try to execute the function directly as a fallback
      // This bypasses rate limiting but prevents complete failure
      console.warn('[RateLimit] Bypassing rate limiter due to error');
      return await fn(...args);
    }
  }) as T;
} 