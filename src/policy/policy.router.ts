import { Router } from "express";
import { ApprovalService } from "./approval.service";
import { AuditService } from "./audit.service";
import { requirePermission } from "./middleware";
import { asyncHandler } from "../shared/http/async-handler";
import { AppError, ForbiddenError } from "../shared/http/errors";

function ensureApprovalManager(role: string) {
  if (role !== "admin" && role !== "manager") {
    throw new ForbiddenError("Solo admin o manager pueden gestionar aprobaciones");
  }
}

export function createPolicyRouter(approvalService: ApprovalService, auditService: AuditService) {
  const router = Router();

  router.get(
    "/approvals",
    requirePermission("read", "automatizacion"),
    asyncHandler(async (req, res) => {
      ensureApprovalManager(req.role);
      const status = req.query.status ? String(req.query.status) : undefined;
      const approvals = approvalService.list(
        status === "pending" || status === "approved" || status === "rejected"
          ? status
          : undefined
      );
      res.status(200).json(approvals);
    })
  );

  router.post(
    "/approvals/:id/approve",
    requirePermission("execute", "automatizacion"),
    asyncHandler(async (req, res) => {
      ensureApprovalManager(req.role);
      const approvalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!approvalId) {
        throw new AppError("approval id requerido", 400);
      }

      const approved = approvalService.approve(approvalId, req.actorId);
      auditService.record({
        actorId: req.actorId,
        role: req.role,
        action: "approve_sensitive_action",
        resource: "automatizacion",
        details: { approvalId }
      });

      res.status(200).json(approved);
    })
  );

  router.post(
    "/approvals/:id/reject",
    requirePermission("execute", "automatizacion"),
    asyncHandler(async (req, res) => {
      ensureApprovalManager(req.role);
      const approvalId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!approvalId) {
        throw new AppError("approval id requerido", 400);
      }

      const rejected = approvalService.reject(approvalId, req.actorId);
      auditService.record({
        actorId: req.actorId,
        role: req.role,
        action: "reject_sensitive_action",
        resource: "automatizacion",
        details: { approvalId }
      });

      res.status(200).json(rejected);
    })
  );

  router.get(
    "/audit",
    requirePermission("read", "automatizacion"),
    asyncHandler(async (req, res) => {
      ensureApprovalManager(req.role);
      const limitRaw = req.query.limit ? Number(req.query.limit) : 50;
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50;
      const records = auditService.list(limit);
      res.status(200).json(records);
    })
  );

  return router;
}
