import express from "express";
import helmet from "helmet";
import path from "node:path";
import fs from "node:fs";
import { createAutomationRouter } from "./automation/automation.router";
import { createAppContext, AppContext } from "./context";
import { createChatRouter } from "./chat/chat.router";
import { createMemoryRouter } from "./memory/memory.router";
import { createOnboardingRouter } from "./onboarding/onboarding.router";
import { createOpsRouter } from "./ops/ops.router";
import { createPolicyRouter } from "./policy/policy.router";
import { createProjectRouter } from "./project/project.router";
import { createAttachActor, requireAuthenticated } from "./policy/middleware";
import { AppError } from "./shared/http/errors";
import { createAuthRouter } from "./policy/auth.router";
import { attachCorrelationId } from "./shared/http/correlation";
import { deprecationHeaders } from "./shared/http/deprecation";
import { createRateLimitMiddleware } from "./shared/http/rate-limit";
import { createRequestMetricsMiddleware } from "./ops/request-metrics.middleware";
import { createDashboardRouter } from "./ui/dashboard.router";
import { renderLoginPageHtml } from "./ui/login.page";
import { resolveTrustProxySetting } from "./config/network";

function readOpenApiSpec() {
  const filePath = path.join(process.cwd(), "docs", "openapi.yaml");
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf8");
  }
  return "openapi: 3.0.0\ninfo:\n  title: Asistente API\n  version: 0.1.0\npaths: {}\n";
}

function readPositiveIntEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function mountDomainRouters(router: express.Router, context: AppContext) {
  router.use("/auth", createAuthRouter(context.authService, context.rateLimiter));
  router.use("/chat", requireAuthenticated, createChatRouter(context.chatService));
  router.use("/projects", requireAuthenticated, createProjectRouter(context.projectService));
  router.use(
    "/memory",
    requireAuthenticated,
    createMemoryRouter(context.memoryService, context.auditService)
  );
  router.use(
    "/automation",
    requireAuthenticated,
    createAutomationRouter(
      context.automationService,
      context.auditService,
      context.approvalService,
      context.rateLimiter
    )
  );
  router.use(
    "/policy",
    requireAuthenticated,
    createPolicyRouter(context.approvalService, context.auditService)
  );
  router.use(
    "/onboarding",
    requireAuthenticated,
    createOnboardingRouter(context.projectService, context.chatService, context.automationService)
  );
  router.use(
    "/ops",
    requireAuthenticated,
    createOpsRouter(
      context.metricsService,
      context.memoryService,
      context.automationService,
      context.auditService,
      context.rateLimiter
    )
  );
  router.use(
    "/dashboard",
    requireAuthenticated,
    createDashboardRouter(
      context.metricsService,
      context.auditService,
      context.approvalService,
      context.memoryService
    )
  );
}

export function createApp(context: AppContext = createAppContext()) {
  const app = express();
  app.set("trust proxy", resolveTrustProxySetting());
  app.disable("x-powered-by");

  const globalRateLimitMax = readPositiveIntEnv("RATE_LIMIT_GLOBAL_MAX", 600);
  const globalRateLimitWindowMs = readPositiveIntEnv("RATE_LIMIT_GLOBAL_WINDOW_MS", 60_000);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: false
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(attachCorrelationId);
  app.use(createAttachActor(context.authService));
  app.use(createRequestMetricsMiddleware(context.metricsService));
  app.use(
    createRateLimitMiddleware(context.rateLimiter, {
      keyPrefix: "global",
      max: globalRateLimitMax,
      windowMs: globalRateLimitWindowMs
    })
  );

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/", (_req, res) => {
    res.status(200).json({
      name: "OpenClaw Assistant Panel API",
      health: "/health",
      openapi: "/openapi.yaml",
      login: "/login",
      dashboard: "/v1/dashboard (auth required)"
    });
  });

  app.get("/login", (_req, res) => {
    res.type("text/html").send(renderLoginPageHtml());
  });

  app.get("/openapi.yaml", (_req, res) => {
    res.type("application/yaml").send(readOpenApiSpec());
  });

  // Chrome DevTools probes this endpoint automatically in some sessions.
  // Return a small JSON payload to avoid noisy 404/CSP console warnings.
  app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  const v1 = express.Router();
  mountDomainRouters(v1, context);
  app.use("/v1", v1);

  const legacy = express.Router();
  legacy.use(
    deprecationHeaders({
      sunset: "Wed, 30 Sep 2026 00:00:00 GMT",
      link: "/v1"
    })
  );
  mountDomainRouters(legacy, context);
  app.use("/", legacy);

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          error: error.name,
          message: error.message,
          details: error.details ?? null
        });
      }

      return res.status(500).json({
        error: "InternalServerError",
        message: "Unexpected error"
      });
    }
  );

  return app;
}
