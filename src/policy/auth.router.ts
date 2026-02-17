import { Router } from "express";
import { asyncHandler } from "../shared/http/async-handler";
import { AppError, UnauthorizedError } from "../shared/http/errors";
import { AuthService } from "./auth.service";

export function createAuthRouter(authService: AuthService) {
  const router = Router();

  router.post(
    "/login",
    asyncHandler(async (req, res) => {
      const email = typeof req.body.email === "string" ? req.body.email.trim() : "";
      const password = typeof req.body.password === "string" ? req.body.password : "";
      if (!email || !password) {
        throw new AppError("email y password son requeridos", 400);
      }

      const result = authService.login(email, password);
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
        role: req.role
      });
    })
  );

  return router;
}
