import { Router } from "express";
import { z } from "zod";
import { requirePermission } from "../policy/middleware";
import { AuditService } from "../policy/audit.service";
import { asyncHandler } from "../shared/http/async-handler";
import { AppError } from "../shared/http/errors";
import { validateBody, validateParams, validateQuery } from "../shared/http/validation";
import { MemoryService, SearchMemoryInput } from "./memory.service";

const saveMemoryBodySchema = z.object({
  projectId: z.string().optional(),
  agentId: z.string().optional(),
  scope: z.enum(["global", "proyecto", "privado", "project", "private"]),
  memoryType: z.string().min(2).max(80).optional(),
  content: z.string().min(1).max(6000),
  source: z.string().min(1).max(180),
  createdBy: z.string().optional(),
  timestamp: z.string().optional(),
  tags: z.array(z.string().min(1).max(60)).optional(),
  ttlSeconds: z.coerce.number().int().positive().max(60 * 60 * 24 * 365).optional(),
  temporary: z.boolean().optional()
});

const searchQuerySchema = z.object({
  q: z.string().optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  scope: z.enum(["global", "proyecto", "privado", "project", "private"]).optional(),
  projectId: z.string().optional(),
  agentId: z.string().optional(),
  memoryType: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  activeProjectId: z.string().optional(),
  currentAgentId: z.string().optional(),
  includeArchived: z.coerce.boolean().optional(),
  includeBlocked: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(200).optional()
});

const reindexBodySchema = z.object({
  limit: z.coerce.number().int().positive().max(10000).optional(),
  since: z.string().optional()
});

const cleanupBodySchema = z.object({
  processedEventsMaxAgeDays: z.coerce.number().int().positive().max(365).optional()
});

const memoryParamSchema = z.object({
  id: z.string().min(1)
});

export function createMemoryRouter(memoryService: MemoryService, auditService: AuditService) {
  const router = Router();

  router.post(
    "/save",
    requirePermission("create", "memoria"),
    validateBody(saveMemoryBodySchema),
    asyncHandler(async (req, res) => {
      const saved = await memoryService.save(
        {
          projectId: req.body.projectId,
          agentId: req.body.agentId,
          scope: req.body.scope,
          memoryType: req.body.memoryType,
          content: req.body.content,
          source: req.body.source,
          createdBy: req.body.createdBy ?? req.actorId,
          timestamp: req.body.timestamp,
          tags: req.body.tags,
          ttlSeconds: req.body.ttlSeconds,
          temporary: req.body.temporary
        },
        { correlationId: req.correlationId }
      );

      res.status(201).json(saved);
    })
  );

  router.get(
    "/search",
    requirePermission("read", "memoria"),
    validateQuery(searchQuerySchema),
    asyncHandler(async (req, res) => {
      const tagsQuery = req.query.tags;
      const tags = Array.isArray(tagsQuery)
        ? tagsQuery.flatMap((value) => String(value).split(","))
        : tagsQuery
          ? String(tagsQuery).split(",")
          : [];

      const searchInput: SearchMemoryInput = {};
      if (req.query.q) searchInput.q = String(req.query.q);
      if (tags.length > 0) searchInput.tags = tags.filter((tag) => tag.length > 0);
      if (req.query.scope) searchInput.scope = String(req.query.scope);
      if (req.query.projectId) searchInput.projectId = String(req.query.projectId);
      if (req.query.agentId) searchInput.agentId = String(req.query.agentId);
      if (req.query.memoryType) searchInput.memoryType = String(req.query.memoryType);
      if (req.query.from) searchInput.from = String(req.query.from);
      if (req.query.to) searchInput.to = String(req.query.to);
      if (req.query.activeProjectId) searchInput.activeProjectId = String(req.query.activeProjectId);
      if (req.query.currentAgentId) searchInput.currentAgentId = String(req.query.currentAgentId);
      const includeArchived = parseBooleanQuery(req.query.includeArchived);
      const includeBlocked = parseBooleanQuery(req.query.includeBlocked);
      if (includeArchived) searchInput.includeArchived = true;
      if (includeBlocked) searchInput.includeBlocked = true;
      if (req.query.limit) searchInput.limit = Number(req.query.limit);

      const result = memoryService.search(searchInput);

      res.status(200).json(result);
    })
  );

  router.get(
    "/panel",
    requirePermission("read", "memoria"),
    validateQuery(searchQuerySchema),
    asyncHandler(async (req, res) => {
      const tagsQuery = req.query.tags;
      const tags = Array.isArray(tagsQuery)
        ? tagsQuery.flatMap((value) => String(value).split(","))
        : tagsQuery
          ? String(tagsQuery).split(",")
          : [];

      const searchInput: SearchMemoryInput = {
        includeArchived: true,
        includeBlocked: true,
        limit: req.query.limit ? Number(req.query.limit) : 100
      };
      if (req.query.q) searchInput.q = String(req.query.q);
      if (tags.length > 0) searchInput.tags = tags.filter((tag) => tag.length > 0);
      if (req.query.scope) searchInput.scope = String(req.query.scope);
      if (req.query.projectId) searchInput.projectId = String(req.query.projectId);
      if (req.query.agentId) searchInput.agentId = String(req.query.agentId);
      if (req.query.memoryType) searchInput.memoryType = String(req.query.memoryType);
      if (req.query.from) searchInput.from = String(req.query.from);
      if (req.query.to) searchInput.to = String(req.query.to);
      if (req.query.activeProjectId) searchInput.activeProjectId = String(req.query.activeProjectId);
      if (req.query.currentAgentId) searchInput.currentAgentId = String(req.query.currentAgentId);

      const result = memoryService.search(searchInput);

      res.status(200).json(result);
    })
  );

  router.post(
    "/reindex",
    requirePermission("update", "memoria"),
    validateBody(reindexBodySchema),
    asyncHandler(async (req, res) => {
      const result = memoryService.reindexIncremental({
        limit: req.body.limit,
        since: req.body.since
      });
      res.status(200).json(result);
    })
  );

  router.post(
    "/deduplicate",
    requirePermission("update", "memoria"),
    asyncHandler(async (_req, res) => {
      const result = memoryService.deduplicateMemories();
      res.status(200).json(result);
    })
  );

  router.post(
    "/hygiene/run",
    requirePermission("update", "memoria"),
    validateBody(cleanupBodySchema),
    asyncHandler(async (req, res) => {
      const ttl = memoryService.applyTtlAndArchive();
      const dedup = memoryService.deduplicateMemories();
      const cleanup = memoryService.cleanupProcessedEvents(
        req.body.processedEventsMaxAgeDays ?? 30
      );

      res.status(200).json({
        ttl,
        dedup,
        cleanup
      });
    })
  );

  router.post(
    "/:id/promote-global",
    requirePermission("update", "memoria"),
    validateParams(memoryParamSchema),
    asyncHandler(async (req, res) => {
      const memoryId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!memoryId) {
        throw new AppError("memory id requerido", 400);
      }

      const updated = memoryService.promoteToGlobal(memoryId);
      auditService.record({
        actorId: req.actorId,
        role: req.role,
        action: "memory_promote_global",
        resource: "memoria",
        details: { memoryId, correlationId: req.correlationId }
      });
      res.status(200).json(updated);
    })
  );

  router.post(
    "/:id/forget",
    requirePermission("delete", "memoria"),
    validateParams(memoryParamSchema),
    asyncHandler(async (req, res) => {
      const memoryId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!memoryId) {
        throw new AppError("memory id requerido", 400);
      }

      const updated = memoryService.forget(memoryId);
      auditService.record({
        actorId: req.actorId,
        role: req.role,
        action: "memory_forget",
        resource: "memoria",
        details: { memoryId, correlationId: req.correlationId }
      });
      res.status(200).json(updated);
    })
  );

  router.post(
    "/:id/block",
    requirePermission("update", "memoria"),
    validateParams(memoryParamSchema),
    asyncHandler(async (req, res) => {
      const memoryId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!memoryId) {
        throw new AppError("memory id requerido", 400);
      }

      const updated = memoryService.block(memoryId);
      auditService.record({
        actorId: req.actorId,
        role: req.role,
        action: "memory_block",
        resource: "memoria",
        details: { memoryId, correlationId: req.correlationId }
      });
      res.status(200).json(updated);
    })
  );

  return router;
}

function parseBooleanQuery(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return false;
}
