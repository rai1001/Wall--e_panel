import { NextFunction, Request, RequestHandler, Response } from "express";
import { can, isRole } from "./rbac";
import { AuthService } from "./auth.service";
import { DomainAction, Resource, Role } from "../types/domain";
import { ForbiddenError, UnauthorizedError } from "../shared/http/errors";

function resolveRoleFromLegacyHeader(req: Request): Role {
  const roleHeader = req.header("x-role");
  if (isRole(roleHeader)) {
    return roleHeader;
  }
  return "viewer";
}

export function createAttachActor(authService: AuthService): RequestHandler {
  return (req, _res, next) => {
    const authHeader = req.header("authorization");
    if (authHeader?.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice("bearer ".length).trim();
      const payload = authService.verifyToken(token);
      req.userId = payload.sub;
      req.actorId = payload.sub;
      req.role = payload.role;
      return next();
    }

    if (process.env.ALLOW_LEGACY_HEADERS === "true") {
      req.role = resolveRoleFromLegacyHeader(req);
      req.actorId = req.header("x-actor-id") ?? "anonymous";
      req.userId = req.actorId;
      return next();
    }

    req.role = "viewer";
    req.actorId = "anonymous";
    delete req.userId;
    return next();
  };
}

export const requireAuthenticated: RequestHandler = (req, _res, next) => {
  if (!req.userId) {
    return next(new UnauthorizedError("Se requiere autenticacion"));
  }
  return next();
};

export function requirePermission(action: DomainAction, resource: Resource): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.userId) {
      return next(new UnauthorizedError("Se requiere autenticacion"));
    }

    if (!can(action, resource, req.role)) {
      return next(
        new ForbiddenError(
          `Role ${req.role} no autorizado para ${action} en recurso ${resource}`
        )
      );
    }

    return next();
  };
}
