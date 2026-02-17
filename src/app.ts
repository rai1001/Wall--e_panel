import express from "express";
import path from "node:path";
import fs from "node:fs";
import { createAutomationRouter } from "./automation/automation.router";
import { createAppContext, AppContext } from "./context";
import { createChatRouter } from "./chat/chat.router";
import { createMemoryRouter } from "./memory/memory.router";
import { createOnboardingRouter } from "./onboarding/onboarding.router";
import { createPolicyRouter } from "./policy/policy.router";
import { createProjectRouter } from "./project/project.router";
import { createAttachActor, requireAuthenticated } from "./policy/middleware";
import { AppError } from "./shared/http/errors";
import { createAuthRouter } from "./policy/auth.router";

function readOpenApiSpec() {
  const filePath = path.join(process.cwd(), "docs", "openapi.yaml");
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf8");
  }
  return "openapi: 3.0.0\ninfo:\n  title: Asistente API\n  version: 0.1.0\npaths: {}\n";
}

export function createApp(context: AppContext = createAppContext()) {
  const app = express();
  app.use(express.json());
  app.use(createAttachActor(context.authService));

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/openapi.yaml", (_req, res) => {
    res.type("application/yaml").send(readOpenApiSpec());
  });

  app.use("/auth", createAuthRouter(context.authService));

  app.use("/chat", requireAuthenticated, createChatRouter(context.chatService));
  app.use("/projects", requireAuthenticated, createProjectRouter(context.projectService));
  app.use("/memory", requireAuthenticated, createMemoryRouter(context.memoryService));
  app.use(
    "/automation",
    requireAuthenticated,
    createAutomationRouter(context.automationService, context.auditService, context.approvalService)
  );
  app.use(
    "/policy",
    requireAuthenticated,
    createPolicyRouter(context.approvalService, context.auditService)
  );
  app.use(
    "/onboarding",
    requireAuthenticated,
    createOnboardingRouter(context.projectService, context.chatService, context.automationService)
  );

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
