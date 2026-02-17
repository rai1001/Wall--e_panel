import { Database } from "better-sqlite3";
import { RequestHandler } from "express";
import { AppError } from "./errors";

interface Bucket {
  count: number;
  resetAt: number;
  windowMs: number;
  maxLimit: number;
  blockedCount: number;
  updatedAt: number;
}

export interface RateLimiterOptions {
  backend?: "memory" | "db";
  connection?: Database;
  cleanupEvery?: number;
  windowsToKeep?: number;
}

export interface RateLimitHealth {
  backend: "memory" | "db";
  activeBuckets: number;
  topBlockedKeys: Array<{ key: string; blockedCount: number }>;
  averageWindowMs: number;
  evictions: number;
  totalBlocks: number;
  sampledAt: string;
}

export class RateLimiter {
  private readonly backend: "memory" | "db";
  private readonly buckets = new Map<string, Bucket>();
  private readonly blockedTotals = new Map<string, number>();
  private readonly cleanupEvery: number;
  private readonly windowsToKeep: number;
  private operations = 0;
  private evictionsTotal = 0;
  private readonly consumeDbTransaction?: (key: string, windowStart: number, windowMs: number, max: number, now: number) => number;
  private readonly markBlockedDbStatement?: any;
  private readonly cleanupDbStatement?: any;
  private readonly dbHealthActiveStatement?: any;
  private readonly dbHealthTopBlockedStatement?: any;
  private readonly dbHealthTotalBlockedStatement?: any;

  constructor(options: RateLimiterOptions = {}) {
    this.backend = options.backend === "db" && options.connection ? "db" : "memory";
    this.cleanupEvery = options.cleanupEvery && options.cleanupEvery > 0 ? options.cleanupEvery : 250;
    this.windowsToKeep = options.windowsToKeep && options.windowsToKeep > 0 ? options.windowsToKeep : 8;

    if (this.backend === "db" && options.connection) {
      const upsert = options.connection.prepare(
        `INSERT INTO rate_limit_buckets (
          bucket_key, window_start, window_ms, max_limit, count, blocked_count, first_seen, updated_at, last_blocked_at
        )
         VALUES (?, ?, ?, ?, 1, 0, ?, ?, NULL)
         ON CONFLICT(bucket_key, window_start) DO UPDATE SET
           count = count + 1,
           window_ms = excluded.window_ms,
           max_limit = excluded.max_limit,
           updated_at = excluded.updated_at`
      );
      const read = options.connection.prepare(
        `SELECT count
         FROM rate_limit_buckets
         WHERE bucket_key = ?
           AND window_start = ?`
      );
      this.markBlockedDbStatement = options.connection.prepare(
        `UPDATE rate_limit_buckets
         SET blocked_count = blocked_count + 1,
             last_blocked_at = ?
         WHERE bucket_key = ?
           AND window_start = ?`
      );
      this.cleanupDbStatement = options.connection.prepare(
        `DELETE FROM rate_limit_buckets
         WHERE updated_at < ?`
      );
      this.dbHealthActiveStatement = options.connection.prepare(
        `SELECT
           COUNT(1) as active_buckets,
           AVG(window_ms) as avg_window_ms
         FROM rate_limit_buckets
         WHERE (window_start + window_ms) > ?`
      );
      this.dbHealthTopBlockedStatement = options.connection.prepare(
        `SELECT bucket_key, SUM(blocked_count) as blocked_count
         FROM rate_limit_buckets
         GROUP BY bucket_key
         HAVING SUM(blocked_count) > 0
         ORDER BY blocked_count DESC
         LIMIT ?`
      );
      this.dbHealthTotalBlockedStatement = options.connection.prepare(
        `SELECT COALESCE(SUM(blocked_count), 0) as total
         FROM rate_limit_buckets`
      );

      this.consumeDbTransaction = options.connection.transaction(
        (key: string, windowStart: number, windowMs: number, max: number, now: number) => {
          upsert.run(key, windowStart, windowMs, max, now, now);
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

  health(limit = 10): RateLimitHealth {
    if (this.backend === "db") {
      return this.healthFromDb(limit);
    }
    return this.healthFromMemory(limit);
  }

  private consumeFromMemory(key: string, max: number, windowMs: number) {
    const now = Date.now();
    this.operations += 1;

    if (this.operations % this.cleanupEvery === 0) {
      this.sweepMemory(now);
    }

    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + windowMs,
        windowMs,
        maxLimit: max,
        blockedCount: 0,
        updatedAt: now
      });
      return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
    }

    current.windowMs = windowMs;
    current.maxLimit = max;
    current.updatedAt = now;

    if (current.count >= max) {
      current.blockedCount += 1;
      this.buckets.set(key, current);
      this.incrementBlockedTotal(key);
      return { allowed: false, remaining: 0, resetAt: current.resetAt };
    }

    current.count += 1;
    this.buckets.set(key, current);
    return { allowed: true, remaining: Math.max(0, max - current.count), resetAt: current.resetAt };
  }

  private consumeFromDb(key: string, max: number, windowMs: number) {
    const now = Date.now();
    const windowStart = now - (now % windowMs);
    const resetAt = windowStart + windowMs;

    const count = this.consumeDbTransaction?.(key, windowStart, windowMs, max, now) ?? 1;
    this.operations += 1;

    if (count > max) {
      this.markBlockedDbStatement?.run(now, key, windowStart);
      if (this.operations % this.cleanupEvery === 0 && this.cleanupDbStatement) {
        const threshold = now - windowMs * this.windowsToKeep;
        const result = this.cleanupDbStatement.run(threshold);
        this.evictionsTotal += result.changes;
      }
      return { allowed: false, remaining: 0, resetAt };
    }

    if (this.operations % this.cleanupEvery === 0 && this.cleanupDbStatement) {
      const threshold = now - windowMs * this.windowsToKeep;
      const result = this.cleanupDbStatement.run(threshold);
      this.evictionsTotal += result.changes;
    }

    return { allowed: true, remaining: Math.max(0, max - count), resetAt };
  }

  private sweepMemory(now: number) {
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
        this.evictionsTotal += 1;
      }
    }
  }

  private incrementBlockedTotal(key: string) {
    const current = this.blockedTotals.get(key) ?? 0;
    this.blockedTotals.set(key, current + 1);
  }

  private healthFromMemory(limit: number): RateLimitHealth {
    const now = Date.now();
    const active = [...this.buckets.entries()].filter(([, bucket]) => bucket.resetAt > now);

    const topBlocked = [...this.blockedTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, blockedCount]) => ({ key, blockedCount }));

    const averageWindowMs =
      active.length > 0
        ? Number((active.reduce((acc, [, bucket]) => acc + bucket.windowMs, 0) / active.length).toFixed(2))
        : 0;

    const totalBlocks = [...this.blockedTotals.values()].reduce((acc, value) => acc + value, 0);

    return {
      backend: "memory",
      activeBuckets: active.length,
      topBlockedKeys: topBlocked,
      averageWindowMs,
      evictions: this.evictionsTotal,
      totalBlocks,
      sampledAt: new Date(now).toISOString()
    };
  }

  private healthFromDb(limit: number): RateLimitHealth {
    const now = Date.now();

    const activeRow = this.dbHealthActiveStatement?.get(now) as
      | { active_buckets: number; avg_window_ms: number | null }
      | undefined;

    const topRows = (this.dbHealthTopBlockedStatement?.all(limit) ?? []) as Array<{
      bucket_key: string;
      blocked_count: number;
    }>;

    const totalBlocksRow = this.dbHealthTotalBlockedStatement?.get() as { total: number } | undefined;

    return {
      backend: "db",
      activeBuckets: activeRow?.active_buckets ?? 0,
      topBlockedKeys: topRows.map((row) => ({
        key: row.bucket_key,
        blockedCount: row.blocked_count
      })),
      averageWindowMs: Number((activeRow?.avg_window_ms ?? 0).toFixed(2)),
      evictions: this.evictionsTotal,
      totalBlocks: totalBlocksRow?.total ?? 0,
      sampledAt: new Date(now).toISOString()
    };
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
