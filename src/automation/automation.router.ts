import { Router } from "express";
import { hasSensitiveActions } from "../policy/approval";
import { ApprovalService } from "../policy/approval.service";
import { AuditService, auditSensitiveAction } from "../policy/audit.service";
import { requirePermission } from "../policy/middleware";
import { asyncHandler } from "../shared/http/async-handler";
import { AppError, ApprovalRequiredError } from "../shared/http/errors";
import { Action } from "../types/domain";
import { AutomationService } from "./automation.service";

function ensureSensitiveApproval(
  approvalService: ApprovalService,
  actorId: string,
  approvalIdHeader: string | undefined,
  actionType: string,
  payload: Record<string, unknown>,
  confirmed: boolean
) {
  if (!confirmed || !approvalIdHeader) {
    const approval = approvalService.request({
      actionType,
      requestedBy: actorId,
      payload
    });

    throw new ApprovalRequiredError("Accion sensible requiere aprobacion explicita", {
      approvalId: approval.id,
      status: approval.status,
      nextStep:
        "Aprobar en POST /policy/approvals/:id/approve y reintentar con x-confirmed:true + x-approval-id"
    });
  }

  approvalService.ensureApproved(approvalIdHeader);
}

export function createAutomationRouter(
  automationService: AutomationService,
  auditService: AuditService,
  approvalService: ApprovalService
) {
  const router = Router();

  router.post(
    "/rules",
    requirePermission("create", "automatizacion"),
    auditSensitiveAction(auditService, "create_rule", "automatizacion"),
    asyncHandler(async (req, res) => {
      const actions = req.body.actions as Action[];
      if (!Array.isArray(actions) || actions.length === 0) {
        throw new AppError("actions es obligatorio y debe ser arreglo", 400);
      }

      const isSensitive = hasSensitiveActions(actions);
      if (isSensitive) {
        ensureSensitiveApproval(
          approvalService,
          req.actorId,
          req.header("x-approval-id") ?? undefined,
          "automation_create_rule",
          {
            name: req.body.name,
            trigger: req.body.trigger,
            actions
          },
          req.header("x-confirmed") === "true"
        );
      }

      const rule = automationService.createRule({
        name: req.body.name,
        trigger: req.body.trigger,
        actions,
        enabled: req.body.enabled
      });

      res.status(201).json(rule);
    })
  );

  router.post(
    "/rules/:id/test",
    requirePermission("execute", "automatizacion"),
    auditSensitiveAction(auditService, "test_rule", "automatizacion"),
    asyncHandler(async (req, res) => {
      const ruleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!ruleId) {
        throw new AppError("rule id requerido", 400);
      }

      const rule = automationService.getRuleById(ruleId);
      if (hasSensitiveActions(rule.actions)) {
        ensureSensitiveApproval(
          approvalService,
          req.actorId,
          req.header("x-approval-id") ?? undefined,
          "automation_test_rule",
          {
            ruleId,
            eventType: req.body.eventType,
            eventPayload: req.body.eventPayload
          },
          req.header("x-confirmed") === "true"
        );
      }

      const runLog = await automationService.testRule(ruleId, {
        eventType: req.body.eventType,
        eventPayload: req.body.eventPayload
      });

      res.status(200).json(runLog);
    })
  );

  router.get(
    "/rules",
    requirePermission("read", "automatizacion"),
    asyncHandler(async (_req, res) => {
      res.status(200).json(automationService.listRules());
    })
  );

  router.get(
    "/runs",
    requirePermission("read", "automatizacion"),
    asyncHandler(async (_req, res) => {
      res.status(200).json(automationService.listRunLogs());
    })
  );

  return router;
}
