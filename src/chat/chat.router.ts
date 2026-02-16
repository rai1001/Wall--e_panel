import { Router } from "express";
import { asyncHandler } from "../shared/http/async-handler";
import { requirePermission } from "../policy/middleware";
import { ChatService } from "./chat.service";
import { AppError } from "../shared/http/errors";

export function createChatRouter(chatService: ChatService) {
  const router = Router();

  router.post(
    "/conversations",
    requirePermission("create", "chat"),
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
    asyncHandler(async (req, res) => {
      const conversationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!conversationId) {
        throw new AppError("conversation id requerido", 400);
      }

      const message = await chatService.sendMessage(conversationId, {
        role: req.body.role,
        content: req.body.content,
        actorType: req.body.actorType,
        actorId: req.body.actorId
      });

      res.status(201).json(message);
    })
  );

  router.get(
    "/conversations/:id/messages",
    requirePermission("read", "chat"),
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
