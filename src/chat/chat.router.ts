import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/http/async-handler";
import { requirePermission } from "../policy/middleware";
import { ChatService } from "./chat.service";
import { AppError, ForbiddenError } from "../shared/http/errors";
import { validateBody, validateParams, validateQuery } from "../shared/http/validation";
import { Role } from "../types/domain";

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

const timelineQuerySchema = z.object({
  projectId: z.string().optional(),
  conversationId: z.string().optional(),
  role: z.enum(["user", "assistant", "system"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional()
});

export function createChatRouter(chatService: ChatService) {
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

  return router;
}
