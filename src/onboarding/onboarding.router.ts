import { Router } from "express";
import { z } from "zod";
import { AutomationService } from "../automation/automation.service";
import { ChatService } from "../chat/chat.service";
import { requirePermission } from "../policy/middleware";
import { ProjectService } from "../project/project.service";
import { asyncHandler } from "../shared/http/async-handler";
import { ForbiddenError } from "../shared/http/errors";
import { validateBody } from "../shared/http/validation";

const bootstrapBodySchema = z.object({
  projectName: z.string().min(3).max(180).optional(),
  conversationTitle: z.string().min(3).max(180).optional(),
  ruleName: z.string().min(3).max(180).optional()
});

const templateBodySchema = z.object({
  templateId: z.enum(["task_chat_memory", "scheduled_daily_digest"])
});

const RULE_TEMPLATES = [
  {
    id: "task_chat_memory",
    name: "Task Created -> Chat + Memory",
    trigger: { type: "task_created" as const },
    actions: [{ type: "post_chat_message" as const }, { type: "save_memory" as const }]
  },
  {
    id: "scheduled_daily_digest",
    name: "Daily Digest (09:00)",
    trigger: {
      type: "scheduled_tick" as const,
      cron: "0 9 * * *"
    },
    actions: [
      {
        type: "save_memory" as const,
        payload: {
          scope: "daily",
          content: "Digest diario ejecutado"
        }
      }
    ]
  }
];

function ensureAdmin(role: string) {
  if (role !== "admin") {
    throw new ForbiddenError("Solo admin puede ejecutar onboarding");
  }
}

export function createOnboardingRouter(
  projectService: ProjectService,
  chatService: ChatService,
  automationService: AutomationService
) {
  const router = Router();

  router.get(
    "/rule-templates",
    requirePermission("read", "automatizacion"),
    asyncHandler(async (_req, res) => {
      res.status(200).json(RULE_TEMPLATES);
    })
  );

  router.post(
    "/bootstrap-flow",
    requirePermission("create", "proyecto"),
    validateBody(bootstrapBodySchema),
    asyncHandler(async (req, res) => {
      ensureAdmin(req.role);

      const projectName = req.body.projectName ?? "Proyecto Rai";
      const conversationTitle = req.body.conversationTitle ?? "Conversacion principal";
      const ruleName = req.body.ruleName ?? "task_created -> chat + memory";

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

  router.post(
    "/bootstrap-from-template",
    requirePermission("create", "automatizacion"),
    validateBody(templateBodySchema),
    asyncHandler(async (req, res) => {
      ensureAdmin(req.role);

      const template = RULE_TEMPLATES.find((item) => item.id === req.body.templateId);
      if (!template) {
        throw new ForbiddenError("Template no encontrado");
      }

      const rule = automationService.createRule({
        name: template.name,
        trigger: template.trigger,
        actions: template.actions
      });

      res.status(201).json(rule);
    })
  );

  return router;
}
