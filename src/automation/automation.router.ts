import { Router } from "express";
import { assertConfirmed, hasSensitiveActions } from "../policy/approval";
import { requirePermission } from "../policy/middleware";
import { asyncHandler } from "../shared/http/async-handler";
import { AppError } from "../shared/http/errors";
import { AutomationService } from "./automation.service";

export function createAutomationRouter(automationService: AutomationService) {
  const router = Router();

  router.post(
    "/rules",
    requirePermission("create", "automatizacion"),
    asyncHandler(async (req, res) => {
      const actions = req.body.actions;
      if (!Array.isArray(actions) || actions.length === 0) {
        throw new AppError("actions es obligatorio y debe ser arreglo", 400);
      }

      if (hasSensitiveActions(actions)) {
        assertConfirmed(req);
      }

      const rule = automationService.createRule(
        {
          name: req.body.name,
          trigger: req.body.trigger,
          actions,
          enabled: req.body.enabled
        },
        req.header("x-confirmed") === "true"
      );

      res.status(201).json(rule);
    })
  );

  router.post(
    "/rules/:id/test",
    requirePermission("execute", "automatizacion"),
    asyncHandler(async (req, res) => {
      const ruleId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!ruleId) {
        throw new AppError("rule id requerido", 400);
      }

      const rule = automationService.getRuleById(ruleId);
      if (hasSensitiveActions(rule.actions)) {
        assertConfirmed(req);
      }

      const runLog = await automationService.testRule(ruleId, {
        eventType: req.body.eventType,
        eventPayload: req.body.eventPayload,
        confirmed: req.header("x-confirmed") === "true"
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
