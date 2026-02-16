import express from "express";
import { createAppContext, AppContext } from "./context";
import { createChatRouter } from "./chat/chat.router";
import { createMemoryRouter } from "./memory/memory.router";
import { createProjectRouter } from "./project/project.router";
import { attachActor } from "./policy/middleware";
import { AppError } from "./shared/http/errors";

export function createApp(context: AppContext = createAppContext()) {
  const app = express();
  app.use(express.json());
  app.use(attachActor);

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/chat", createChatRouter(context.chatService));
  app.use("/projects", createProjectRouter(context.projectService));
  app.use("/memory", createMemoryRouter(context.memoryService));

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
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
  });

  return app;
}
