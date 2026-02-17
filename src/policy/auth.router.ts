import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/http/async-handler";
import { ForbiddenError, UnauthorizedError } from "../shared/http/errors";
import { RateLimiter, createRateLimitMiddleware } from "../shared/http/rate-limit";
import { validateBody } from "../shared/http/validation";
import { AuthService } from "./auth.service";

const loginBodySchema = z.object({
  email: z.string().min(3).regex(/.+@.+/),
  password: z.string().min(1).max(256)
});

const AUTH_COOKIE_NAME = "oc_token";
const AUTH_COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function readPositiveIntEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function normalizeEmailForRateLimit(value: unknown) {
  if (typeof value !== "string") {
    return "unknown-email";
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 320) {
    return "unknown-email";
  }

  return normalized;
}

export function createAuthRouter(authService: AuthService, rateLimiter: RateLimiter) {
  const router = Router();
  const loginWindowMs = readPositiveIntEnv("RATE_LIMIT_AUTH_LOGIN_WINDOW_MS", 60_000);
  const loginIpMax = readPositiveIntEnv("RATE_LIMIT_AUTH_LOGIN_IP_MAX", 10);
  const loginEmailMax = readPositiveIntEnv("RATE_LIMIT_AUTH_LOGIN_EMAIL_MAX", 8);

  router.post(
    "/login",
    createRateLimitMiddleware(rateLimiter, {
      keyPrefix: "auth-login-ip",
      keyStrategy: "ip",
      max: loginIpMax,
      windowMs: loginWindowMs
    }),
    createRateLimitMiddleware(rateLimiter, {
      keyPrefix: "auth-login-email",
      keyStrategy: "global",
      keyResolver: (req) => normalizeEmailForRateLimit(req.body?.email),
      max: loginEmailMax,
      windowMs: loginWindowMs
    }),
    validateBody(loginBodySchema),
    asyncHandler(async (req, res) => {
      const result = authService.login(req.body.email, req.body.password);
      res.cookie(AUTH_COOKIE_NAME, result.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: AUTH_COOKIE_MAX_AGE_MS,
        path: "/"
      });
      res.status(200).json(result);
    })
  );

  router.post(
    "/logout",
    asyncHandler(async (_req, res) => {
      res.clearCookie(AUTH_COOKIE_NAME, {
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/"
      });
      res.status(200).json({ ok: true });
    })
  );

  router.get(
    "/me",
    asyncHandler(async (req, res) => {
      if (!req.userId) {
        throw new UnauthorizedError("Se requiere token para consultar /auth/me");
      }
      res.status(200).json({
        userId: req.userId,
        actorId: req.actorId,
        role: req.role,
        correlationId: req.correlationId
      });
    })
  );

  router.get(
    "/keys",
    asyncHandler(async (req, res) => {
      if (!req.userId) {
        throw new UnauthorizedError("Se requiere token para consultar /auth/keys");
      }
      if (req.role !== "admin") {
        throw new ForbiddenError("Solo admin puede consultar metadata de claves JWT");
      }

      res.status(200).json(authService.keyInfo());
    })
  );

  return router;
}
