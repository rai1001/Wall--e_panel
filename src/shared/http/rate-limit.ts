import { RequestHandler } from "express";
import { AppError } from "./errors";

interface Bucket {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  consume(key: string, max: number, windowMs: number) {
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
