import { Router } from "express";
import { requirePermission } from "../policy/middleware";
import { asyncHandler } from "../shared/http/async-handler";
import { MemoryService } from "./memory.service";

export function createMemoryRouter(memoryService: MemoryService) {
  const router = Router();

  router.post(
    "/save",
    requirePermission("create", "memoria"),
    asyncHandler(async (req, res) => {
      const saved = await memoryService.save({
        scope: req.body.scope,
        content: req.body.content,
        source: req.body.source,
        timestamp: req.body.timestamp,
        tags: req.body.tags
      });

      res.status(201).json(saved);
    })
  );

  router.get(
    "/search",
    requirePermission("read", "memoria"),
    asyncHandler(async (req, res) => {
      const tagsQuery = req.query.tags;
      const tags = Array.isArray(tagsQuery)
        ? tagsQuery.flatMap((value) => String(value).split(","))
        : tagsQuery
          ? String(tagsQuery).split(",")
          : [];

      const searchInput: {
        q?: string;
        scope?: string;
        tags?: string[];
      } = {};

      if (req.query.q) {
        searchInput.q = String(req.query.q);
      }
      if (req.query.scope) {
        searchInput.scope = String(req.query.scope);
      }
      if (tags.length > 0) {
        searchInput.tags = tags.filter((tag) => tag.length > 0);
      }

      const result = memoryService.search(searchInput);

      res.status(200).json(result);
    })
  );

  return router;
}
