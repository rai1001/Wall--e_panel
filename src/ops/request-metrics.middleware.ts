import { RequestHandler } from "express";
import { MetricsService } from "./metrics.service";

export function createRequestMetricsMiddleware(metricsService: MetricsService): RequestHandler {
  return (req, res, next) => {
    const startedAt = Date.now();

    res.on("finish", () => {
      const latencyMs = Date.now() - startedAt;
      const routePath =
        req.route && typeof req.route.path === "string" ? req.route.path : req.path;
      const key = `${req.method} ${req.baseUrl || ""}${routePath}`;
      metricsService.recordRequest(key, latencyMs, res.statusCode);
    });

    next();
  };
}
