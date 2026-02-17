import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../shared/http/async-handler";
import { requirePermission } from "../policy/middleware";
import { ChatService } from "./chat.service";
import { AppError } from "../shared/http/errors";
import { validateBody, validateParams } from "../shared/http/validation";

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

export function createChatRouter(chatService: ChatService) {
  const router = Router();

  router.post(
    "/conversations",
    requirePermission("create", "chat"),
    validateBody(conversationBodySchema),
    asyncHandler(async (req, res) => {
      const conversation = chatService.createConversation({
        title: req.body.title,
        projectId: req.body.projectId,
        participants: req.body.participants
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

      const messages = chatService.listMessages(conversationId);
      res.status(200).json(messages);
    })
  );

  return router;
}
