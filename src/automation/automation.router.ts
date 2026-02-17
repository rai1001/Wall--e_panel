import { Router } from "express";
import { z } from "zod";
import { hasSensitiveActions } from "../policy/approval";
import { ApprovalService } from "../policy/approval.service";
import { AuditService, auditSensitiveAction } from "../policy/audit.service";
import { requirePermission } from "../policy/middleware";
import { asyncHandler } from "../shared/http/async-handler";
import { AppError, ApprovalRequiredError } from "../shared/http/errors";
import { RateLimiter, createRateLimitMiddleware } from "../shared/http/rate-limit";
import { validateBody, validateParams } from "../shared/http/validation";
import { Action } from "../types/domain";
import { AutomationService } from "./automation.service";

const triggerSchema = z
  .object({
    type: z.enum(["task_created", "task_status_changed", "scheduled_tick"]),
    filter: z.record(z.string(), z.string()).optional(),
    mode: z.enum(["AND", "OR"]).optional(),
    conditions: z
      .array(
        z.object({
          field: z.string().min(1),
          operator: z.enum([
            "eq",
            "neq",
            "contains",
            "starts_with",
            "ends_with",
            "gt",
            "gte",
            "lt",
            "lte"
          ]),
          value: z.union([z.string(), z.number(), z.boolean()])
        })
      )
      .optional(),
    cron: z.string().optional()
  })
  .superRefine((value, ctx) => {
    if (value.type === "scheduled_tick" && !value.cron) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "scheduled_tick requiere trigger.cron",
        path: ["cron"]
      });
    }
  });

const actionSchema = z.object({
  type: z.enum([
    "post_chat_message",
    "save_memory",
    "external_action",
    "shell_execution",
    "mass_messaging",
    "remote_action"
  ]),
  payload: z.record(z.string(), z.any()).optional()
});

const createRuleSchema = z.object({
  name: z.string().min(3).max(120),
  trigger: triggerSchema,
  actions: z.array(actionSchema).min(1),
  enabled: z.boolean().optional()
});

const testRuleSchema = z.object({
  eventType: z
    .enum(["task_created", "task_status_changed", "scheduled_tick"])
    .optional(),
  eventPayload: z.record(z.string(), z.any()).optional()
});

const ruleParamSchema = z.object({
  id: z.string().min(1)
});

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
        "Aprobar en POST /v1/policy/approvals/:id/approve y reintentar con x-confirmed:true + x-approval-id"
    });
  }

  approvalService.ensureApproved(approvalIdHeader);
}

export function createAutomationRouter(
  automationService: AutomationService,
  auditService: AuditService,
  approvalService: ApprovalService,
  rateLimiter: RateLimiter
) {
  const router = Router();

  router.post(
    "/rules",
    createRateLimitMiddleware(rateLimiter, {
      keyPrefix: "automation-create-rule",
      max: 40,
      windowMs: 60_000
    }),
    requirePermission("create", "automatizacion"),
    validateBody(createRuleSchema),
    auditSensitiveAction(auditService, "create_rule", "automatizacion"),
    asyncHandler(async (req, res) => {
      const actions = req.body.actions as Action[];
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
    createRateLimitMiddleware(rateLimiter, {
      keyPrefix: "automation-test-rule",
      max: 90,
      windowMs: 60_000
    }),
    requirePermission("execute", "automatizacion"),
    validateParams(ruleParamSchema),
    validateBody(testRuleSchema),
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
        eventPayload: req.body.eventPayload,
        correlationId: req.correlationId
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

  router.get(
    "/dead-letters",
    requirePermission("read", "automatizacion"),
    asyncHandler(async (_req, res) => {
      res.status(200).json(automationService.listDeadLetters());
    })
  );

  return router;
}
