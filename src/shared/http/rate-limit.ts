import { Database } from "better-sqlite3";
import { RequestHandler } from "express";
import { AppError } from "./errors";

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  backend?: "memory" | "db";
  connection?: Database;
  cleanupEvery?: number;
  windowsToKeep?: number;
}

export class RateLimiter {
  private readonly backend: "memory" | "db";
  private readonly buckets = new Map<string, Bucket>();
  private readonly cleanupEvery: number;
  private readonly windowsToKeep: number;
  private operations = 0;
  private readonly consumeDbTransaction?: (key: string, windowStart: number, now: number) => number;
  private readonly cleanupDbStatement?: ReturnType<Database["prepare"]>;

  constructor(options: RateLimiterOptions = {}) {
    this.backend = options.backend === "db" && options.connection ? "db" : "memory";
    this.cleanupEvery = options.cleanupEvery && options.cleanupEvery > 0 ? options.cleanupEvery : 250;
    this.windowsToKeep = options.windowsToKeep && options.windowsToKeep > 0 ? options.windowsToKeep : 8;

    if (this.backend === "db" && options.connection) {
      const upsert = options.connection.prepare(
        `INSERT INTO rate_limit_buckets (bucket_key, window_start, count, updated_at)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(bucket_key, window_start) DO UPDATE SET
           count = count + 1,
           updated_at = excluded.updated_at`
      );
      const read = options.connection.prepare(
        `SELECT count
         FROM rate_limit_buckets
         WHERE bucket_key = ?
           AND window_start = ?`
      );
      this.cleanupDbStatement = options.connection.prepare(
        `DELETE FROM rate_limit_buckets
         WHERE updated_at < ?`
      );
      this.consumeDbTransaction = options.connection.transaction(
        (key: string, windowStart: number, now: number) => {
          upsert.run(key, windowStart, now);
          const row = read.get(key, windowStart) as { count: number } | undefined;
          return row?.count ?? 1;
        }
      );
    }
  }

  consume(key: string, max: number, windowMs: number) {
    if (this.backend === "db" && this.consumeDbTransaction) {
      return this.consumeFromDb(key, max, windowMs);
    }

    return this.consumeFromMemory(key, max, windowMs);
  }

  private consumeFromMemory(key: string, max: number, windowMs: number) {
    const now = Date.now();
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
    }

    if (current.count >= max) {
      return { allowed: false, remaining: 0, resetAt: current.resetAt };
    }

    current.count += 1;
    this.buckets.set(key, current);
    return { allowed: true, remaining: max - current.count, resetAt: current.resetAt };
  }

  private consumeFromDb(key: string, max: number, windowMs: number) {
    const now = Date.now();
    const windowStart = now - (now % windowMs);
    const resetAt = windowStart + windowMs;

    const count = this.consumeDbTransaction?.(key, windowStart, now) ?? 1;
    this.operations += 1;

    if (this.operations % this.cleanupEvery === 0 && this.cleanupDbStatement) {
      const threshold = now - windowMs * this.windowsToKeep;
      this.cleanupDbStatement.run(threshold);
    }

    if (count > max) {
      return { allowed: false, remaining: 0, resetAt };
    }

    return { allowed: true, remaining: Math.max(0, max - count), resetAt };
  }
}

export function createRateLimitMiddleware(
  rateLimiter: RateLimiter,
  options: { keyPrefix: string; max: number; windowMs: number }
): RequestHandler {
  return (req, _res, next) => {
    const actor = req.userId ?? req.ip ?? "unknown";
    const key = `${options.keyPrefix}:${actor}:${req.path}`;
    const result = rateLimiter.consume(key, options.max, options.windowMs);
    if (!result.allowed) {
      return next(new AppError("Rate limit excedido, reintenta luego", 429, { resetAt: result.resetAt }));
    }
    return next();
  };
}
