import { NextFunction, Request, RequestHandler, Response } from "express";
import { can, isRole } from "./rbac";
import { DomainAction, Resource, Role } from "../types/domain";
import { ForbiddenError } from "../shared/http/errors";

function resolveRoleFromRequest(req: Request): Role {
  const roleHeader = req.header("x-role");
  if (isRole(roleHeader)) {
    return roleHeader;
  }

  return "viewer";
}

export const attachActor: RequestHandler = (req, _res, next) => {
  req.role = resolveRoleFromRequest(req);
  req.actorId = req.header("x-actor-id") ?? "anonymous";
  next();
};

export function requirePermission(action: DomainAction, resource: Resource): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
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
