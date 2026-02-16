import express from "express";
import { AppError } from "./shared/http/errors";

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

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
