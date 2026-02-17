import { Router } from "express";
import { AutomationService } from "../automation/automation.service";
import { ChatService } from "../chat/chat.service";
import { requirePermission } from "../policy/middleware";
import { ProjectService } from "../project/project.service";
import { asyncHandler } from "../shared/http/async-handler";
import { ForbiddenError } from "../shared/http/errors";

export function createOnboardingRouter(
  projectService: ProjectService,
  chatService: ChatService,
  automationService: AutomationService
) {
  const router = Router();

  router.post(
    "/bootstrap-flow",
    requirePermission("create", "proyecto"),
    asyncHandler(async (req, res) => {
      if (req.role !== "admin") {
        throw new ForbiddenError("Solo admin puede ejecutar onboarding bootstrap");
      }

      const projectName = typeof req.body.projectName === "string" ? req.body.projectName : "Proyecto Rai";
      const conversationTitle =
        typeof req.body.conversationTitle === "string"
          ? req.body.conversationTitle
          : "Conversacion principal";
      const ruleName =
        typeof req.body.ruleName === "string"
          ? req.body.ruleName
          : "task_created -> chat + memory";

      const project = projectService.createProject({ name: projectName });
      const conversation = chatService.createConversation({
        title: conversationTitle,
        projectId: project.id
      });

      const rule = automationService.createRule({
        name: ruleName,
        trigger: { type: "task_created" },
        actions: [{ type: "post_chat_message" }, { type: "save_memory" }]
      });

      res.status(201).json({
        project,
        conversation,
        rule
      });
    })
  );

  return router;
}
