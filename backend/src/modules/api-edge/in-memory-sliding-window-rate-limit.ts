import { ApiError } from "../../shared/api-error.js";

/**
 * Per-process sliding-window rate limiter keyed by client IP string.
 * In Lambda, counters do not share across invocations and reset on cold start;
 * use API Gateway throttling or WAF for deployment-wide limits.
 */
export function createInMemorySlidingWindowIpRateLimiter(options: {
  windowMs: number;
  maxAttempts: number;
  tooManyMessage: string;
}): { enforce(ip: string | undefined): void } {
  const attemptsByKey = new Map<string, number[]>();
  return {
    enforce(ip: string | undefined): void {
      const key = ip || "unknown-ip";
      const now = Date.now();
      const cutoff = now - options.windowMs;
      const recentAttempts = (attemptsByKey.get(key) ?? []).filter((value) => value >= cutoff);
      if (recentAttempts.length >= options.maxAttempts) {
        attemptsByKey.set(key, recentAttempts);
        throw new ApiError(429, "AUTH_RATE_LIMITED", options.tooManyMessage);
      }
      recentAttempts.push(now);
      attemptsByKey.set(key, recentAttempts);
    }
  };
}
