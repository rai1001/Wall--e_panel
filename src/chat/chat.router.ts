import { Request, Response, Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/http/async-handler";
import { requirePermission } from "../policy/middleware";
import { ChatService } from "./chat.service";
import { AppError, ForbiddenError } from "../shared/http/errors";
import { validateBody, validateParams, validateQuery } from "../shared/http/validation";
import { Role } from "../types/domain";
import { ChatAssistantService } from "./chat-assistant.service";

const conversationBodySchema = z.object({
  title: z.string().min(3).max(120),
  projectId: z.string().optional(),
  participants: z
    .array(
      z.object({
        actorType: z.string().min(1),
        actorId: z.string().min(1)
      })
    )
    .optional()
});

const conversationParamSchema = z.object({
  id: z.string().min(1)
});

const messageBodySchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(4000),
  actorType: z.string().optional(),
  actorId: z.string().optional()
});

const realtimeBodySchema = z.object({
  content: z.string().min(1).max(4000),
  actorType: z.string().optional(),
  actorId: z.string().optional()
});

const timelineQuerySchema = z.object({
  projectId: z.string().optional(),
  conversationId: z.string().optional(),
  role: z.enum(["user", "assistant", "system"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional()
});

function writeRealtimeEvent(
  response: Response,
  payload: Record<string, unknown>
) {
  response.write(`${JSON.stringify(payload)}\n`);
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Error inesperado en realtime";
}

export function createChatRouter(
  chatService: ChatService,
  chatAssistantService: ChatAssistantService
) {
  const router = Router();

  function enforceConversationOwnership(
    role: Role,
    actorId: string,
    conversationId: string
  ) {
    if (role === "admin" || role === "manager") {
      return;
    }

    const hasAccess = chatService.canActorAccessConversation(conversationId, actorId, role);
    if (!hasAccess) {
      throw new ForbiddenError(
        `Actor ${actorId} no autorizado para operar conversacion ${conversationId}`
      );
    }
  }

  router.post(
    "/conversations",
    requirePermission("create", "chat"),
    validateBody(conversationBodySchema),
    asyncHandler(async (req, res) => {
      const conversation = chatService.createConversation({
        title: req.body.title,
        projectId: req.body.projectId,
        participants: req.body.participants,
        ownerActorId: req.actorId
      });

      res.status(201).json(conversation);
    })
  );

  router.post(
    "/conversations/:id/messages",
    requirePermission("create", "chat"),
    validateParams(conversationParamSchema),
    validateBody(messageBodySchema),
    asyncHandler(async (req, res) => {
      const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!conversationId) {
        throw new AppError("conversation id requerido", 400);
      }

      enforceConversationOwnership(req.role, req.actorId, conversationId);
      const message = await chatService.sendMessage(
        conversationId,
        {
          role: req.body.role,
          content: req.body.content,
          actorType: req.body.actorType,
          actorId: req.body.actorId
        },
        { correlationId: req.correlationId }
      );

      res.status(201).json(message);
    })
  );

  router.get(
    "/conversations/:id/messages",
    requirePermission("read", "chat"),
    validateParams(conversationParamSchema),
    asyncHandler(async (req, res) => {
      const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!conversationId) {
        throw new AppError("conversation id requerido", 400);
      }

      enforceConversationOwnership(req.role, req.actorId, conversationId);
      const messages = chatService.listMessages(conversationId);
      res.status(200).json(messages);
    })
  );

  router.get(
    "/timeline",
    requirePermission("read", "chat"),
    validateQuery(timelineQuerySchema),
    asyncHandler(async (req, res) => {
      const input: Parameters<ChatService["listTimeline"]>[0] = {};
      if (req.query.projectId) input.projectId = String(req.query.projectId);
      if (req.query.conversationId) input.conversationId = String(req.query.conversationId);
      if (req.query.role) input.role = String(req.query.role) as "user" | "assistant" | "system";
      if (req.query.from) input.from = String(req.query.from);
      if (req.query.to) input.to = String(req.query.to);
      if (req.query.limit) input.limit = Number(req.query.limit);

      const timeline = chatService.listTimeline(input);

      res.status(200).json(timeline);
    })
  );

  router.post(
    "/conversations/:id/realtime",
    requirePermission("create", "chat"),
    validateParams(conversationParamSchema),
    validateBody(realtimeBodySchema),
    async (req: Request, res: Response, next) => {
      const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!conversationId) {
        next(new AppError("conversation id requerido", 400));
        return;
      }

      try {
        enforceConversationOwnership(req.role, req.actorId, conversationId);

        const userMessage = await chatService.sendMessage(
          conversationId,
          {
            role: "user",
            content: req.body.content,
            actorType: req.body.actorType ?? "user",
            actorId: req.body.actorId ?? req.actorId
          },
          { correlationId: req.correlationId }
        );

        res.status(200);
        res.setHeader("content-type", "application/x-ndjson; charset=utf-8");
        res.setHeader("cache-control", "no-cache, no-transform");
        res.setHeader("connection", "keep-alive");
        res.setHeader("x-accel-buffering", "no");
        if (typeof res.flushHeaders === "function") {
          res.flushHeaders();
        }

        const abortController = new AbortController();
        let closed = false;
        req.on("close", () => {
          closed = true;
          abortController.abort();
        });

        writeRealtimeEvent(res, {
          type: "user_message_saved",
          message: userMessage
        });

        const messages = chatService.listMessages(conversationId).slice(-25);
        let assistantText = "";
        let runtimeProvider = "local";
        let runtimeModel = "openclaw-local-assistant-v1";

        try {
          const reply = await chatAssistantService.streamReply(
            messages,
            async (delta) => {
              if (closed || !delta) {
                return;
              }
              assistantText += delta;
              writeRealtimeEvent(res, {
                type: "delta",
                delta
              });
            },
            abortController.signal
          );

          runtimeProvider = reply.provider;
          runtimeModel = reply.model;

          if (!assistantText.trim()) {
            assistantText = reply.text;
          }

          if (closed) {
            return;
          }

          const assistantMessage = await chatService.sendMessage(
            conversationId,
            {
              role: "assistant",
              content: assistantText.trim() || "Sin respuesta generada.",
              actorType: "system",
              actorId: "openclaw-assistant"
            },
            { correlationId: req.correlationId }
          );

          writeRealtimeEvent(res, {
            type: "assistant_message_saved",
            provider: runtimeProvider,
            model: runtimeModel,
            message: assistantMessage
          });
          writeRealtimeEvent(res, {
            type: "done",
            provider: runtimeProvider,
            model: runtimeModel
          });
        } catch (error) {
          if (!closed) {
            writeRealtimeEvent(res, {
              type: "error",
              message: errorMessage(error)
            });
          }
        } finally {
          if (!closed) {
            res.end();
          }
        }
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
