/**
 * Rate Limiter Abstraction — Upstash Redis Sliding-Window Production Driver
 *
 * ADR-012: Abstract RateLimiter interface backed by @upstash/ratelimit and @upstash/redis.
 *
 * Production Invariants:
 * - When RATE_LIMIT_PROVIDER=upstash (or redis), UPSTASH_REDIS_REST_URL and
 *   UPSTASH_REDIS_REST_TOKEN are strictly required. Missing configuration FAILS CLOSED.
 * - Silent fallback to in-memory rate limiting is FORBIDDEN.
 * - RATE_LIMIT_PROVIDER=memory is permitted ONLY in non-production environments (dev/test).
 * - Attempting to perform rate limiting via InMemoryRateLimiter in production strictly throws a ServiceConfigurationError.
 * - Sliding window reset is verified against the installed library using resetUsedTokens(key).
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logger } from "@/lib/logger";

// =============================================================================
// ERRORS
// =============================================================================

export class ServiceConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceConfigurationError";
  }
}

// =============================================================================
// INTERFACES
// =============================================================================

export interface RateLimitOptions {
  key: string;         // Unique identifier for this limit (e.g. "login:ip:127.0.0.1")
  limit: number;       // Max requests allowed in the window
  windowMs: number;    // Time window in milliseconds
}

export interface RateLimitResult {
  success: boolean;    // true = request allowed, false = rate limited
  remaining: number;   // Remaining requests in current window
  resetAt: Date;       // When the window resets
}

export interface RateLimiter {
  check(options: RateLimitOptions): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

// =============================================================================
// UPSTASH REDIS SLIDING WINDOW IMPLEMENTATION
// =============================================================================

export class UpstashRateLimiter implements RateLimiter {
  private redis: Redis | null = null;
  private limiters = new Map<string, Ratelimit>();
  private configError: string | null = null;

  constructor() {
    const provider = process.env.RATE_LIMIT_PROVIDER;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    const missing: string[] = [];
    if (process.env.NODE_ENV === "production" && (!provider || !provider.trim())) {
      missing.push("RATE_LIMIT_PROVIDER");
    }
    if (!url || !url.trim()) missing.push("UPSTASH_REDIS_REST_URL");
    if (!token || !token.trim()) missing.push("UPSTASH_REDIS_REST_TOKEN");

    if (missing.length > 0) {
      this.configError = `Missing required Upstash Redis configuration: ${missing.join(", ")} must be set when RATE_LIMIT_PROVIDER=upstash.`;
    } else {
      this.redis = new Redis({
        url: url!,
        token: token!,
      });
    }
  }

  private ensureConfigured(): void {
    if (this.configError || !this.redis) {
      const msg = `[RateLimiter Configuration Error] ${this.configError ?? "Upstash Redis uninitialized."}`;
      console.error(msg);
      throw new ServiceConfigurationError(this.configError ?? "Rate limiter misconfigured.");
    }
  }

  private getLimiter(limit: number, windowMs: number): Ratelimit {
    const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
    const cacheKey = `${limit}:${windowSec}s`;
    let limiter = this.limiters.get(cacheKey);

    if (!limiter) {
      limiter = new Ratelimit({
        redis: this.redis!,
        limiter: Ratelimit.slidingWindow(limit, `${windowSec} s` as any),
        prefix: "crm_ratelimit",
        analytics: false,
      });
      this.limiters.set(cacheKey, limiter);
    }

    return limiter;
  }

  async check(options: RateLimitOptions): Promise<RateLimitResult> {
    this.ensureConfigured();

    const limiter = this.getLimiter(options.limit, options.windowMs);
    const result = await limiter.limit(options.key);

    return {
      success: result.success,
      remaining: result.remaining,
      resetAt: new Date(result.reset),
    };
  }

  /**
   * Resets rate limit tokens for a specific key.
   * Uses @upstash/ratelimit's internal resetUsedTokens which invokes the Lua script
   * targeting all sliding-window timestamp buckets: ['crm_ratelimit', key, '*'].
   */
  async reset(key: string): Promise<void> {
    this.ensureConfigured();

    try {
      const limiter = this.limiters.values().next().value ?? this.getLimiter(10, 60000);
      await limiter.resetUsedTokens(key);
    } catch (err: any) {
      logger.error("Rate limiter reset failed", {
        service: "RateLimiter",
        provider: "upstash",
        operation: "reset",
        errorMessage: err?.message,
      });
      throw err;
    }
  }
}

// =============================================================================
// IN-MEMORY IMPLEMENTATION (Dev/Test Fallback — Forbidden in Production)
// =============================================================================

interface WindowEntry {
  count: number;
  resetAt: number; // Unix timestamp ms
}

export class InMemoryRateLimiter implements RateLimiter {
  private store = new Map<string, WindowEntry>();

  private assertNotProduction(): void {
    if (process.env.NODE_ENV === "production") {
      throw new ServiceConfigurationError(
        "CRITICAL: RATE_LIMIT_PROVIDER='memory' cannot be executed in production. Production must use RATE_LIMIT_PROVIDER='upstash'."
      );
    }
  }

  async check(options: RateLimitOptions): Promise<RateLimitResult> {
    this.assertNotProduction();

    const now = Date.now();
    const entry = this.store.get(options.key);

    // Window expired or no entry — start fresh
    if (!entry || now > entry.resetAt) {
      const resetAt = now + options.windowMs;
      this.store.set(options.key, { count: 1, resetAt });
      return {
        success: true,
        remaining: options.limit - 1,
        resetAt: new Date(resetAt),
      };
    }

    // Within window
    if (entry.count >= options.limit) {
      return {
        success: false,
        remaining: 0,
        resetAt: new Date(entry.resetAt),
      };
    }

    entry.count += 1;
    return {
      success: true,
      remaining: options.limit - entry.count,
      resetAt: new Date(entry.resetAt),
    };
  }

  async reset(key: string): Promise<void> {
    this.assertNotProduction();
    this.store.delete(key);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

// =============================================================================
// PRE-DEFINED RATE LIMIT CONFIGURATIONS
// =============================================================================

export const RateLimits = {
  login: { limit: 5, windowMs: 60 * 1000 },           // 5 per minute per IP or identifier
  passwordReset: { limit: 3, windowMs: 60 * 1000 },    // 3 per minute per email
  invitation: { limit: 10, windowMs: 60 * 1000 },      // 10 per minute per company
  inviteAccept: { limit: 5, windowMs: 60 * 1000 },     // 5 per minute per IP
  api: { limit: 100, windowMs: 60 * 1000 },            // 100 per minute general API
} as const;

// =============================================================================
// FACTORY
// =============================================================================

export function createRateLimiter(): RateLimiter {
  const provider = (process.env.RATE_LIMIT_PROVIDER ?? "upstash").toLowerCase().trim();

  if (provider === "memory") {
    return new InMemoryRateLimiter();
  }

  if (provider === "upstash" || provider === "redis") {
    return new UpstashRateLimiter();
  }

  throw new ServiceConfigurationError(
    `Unsupported RATE_LIMIT_PROVIDER='${provider}'. Valid options: 'upstash' (production) or 'memory' (dev/test only).`
  );
}

export const rateLimiter = createRateLimiter();
