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

export function createAuthRouter(authService: AuthService, rateLimiter: RateLimiter) {
  const router = Router();

  router.post(
    "/login",
    createRateLimitMiddleware(rateLimiter, {
      keyPrefix: "auth-login",
      max: 10,
      windowMs: 60_000
    }),
    validateBody(loginBodySchema),
    asyncHandler(async (req, res) => {
      const result = authService.login(req.body.email, req.body.password);
      res.status(200).json(result);
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
