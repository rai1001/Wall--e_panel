import { Router } from "express";
import { z } from "zod";
import { AutomationService } from "../automation/automation.service";
import { MemoryService } from "../memory/memory.service";
import { AuditService } from "../policy/audit.service";
import { MetricsService } from "./metrics.service";
import { requirePermission } from "../policy/middleware";
import { asyncHandler } from "../shared/http/async-handler";
import { validateQuery } from "../shared/http/validation";

const rangeQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).optional()
});

export function createOpsRouter(
  metricsService: MetricsService,
  memoryService: MemoryService,
  automationService: AutomationService,
  auditService: AuditService
) {
  const router = Router();

  router.get(
    "/metrics",
    requirePermission("read", "automatizacion"),
    asyncHandler(async (_req, res) => {
      res.status(200).json(metricsService.snapshot());
    })
  );

  router.get(
    "/memory/metrics",
    requirePermission("read", "memoria"),
    asyncHandler(async (_req, res) => {
      res.status(200).json(memoryService.getMetrics());
    })
  );

  router.get(
    "/automation/health",
    requirePermission("read", "automatizacion"),
    validateQuery(rangeQuerySchema),
    asyncHandler(async (req, res) => {
      const options: { from?: string; to?: string } = {};
      if (req.query.from) options.from = String(req.query.from);
      if (req.query.to) options.to = String(req.query.to);
      res.status(200).json(
        automationService.healthSummary(options)
      );
    })
  );

  router.get(
    "/audit/aggregated",
    requirePermission("read", "automatizacion"),
    validateQuery(rangeQuerySchema),
    asyncHandler(async (req, res) => {
      const options: { from?: string; to?: string; limit?: number } = {
        limit: req.query.limit ? Number(req.query.limit) : 100
      };
      if (req.query.from) options.from = String(req.query.from);
      if (req.query.to) options.to = String(req.query.to);
      res.status(200).json(
        auditService.aggregateByActorAndAction(options)
      );
    })
  );

  return router;
}
