import { describe, expect, it } from "vitest";
import { AutomationService } from "../../src/automation/automation.service";
import { ChatService } from "../../src/chat/chat.service";
import { MemoryService } from "../../src/memory/memory.service";
import { EventBus } from "../../src/shared/events/event-bus";

describe("AutomationService", () => {
  it("ejecuta regla task_created -> post_chat_message + save_memory", async () => {
    const eventBus = new EventBus();
    const chatService = new ChatService(eventBus);
    const memoryService = new MemoryService(eventBus);
    const automationService = new AutomationService(eventBus, chatService, memoryService);

    automationService.start();

    const conversation = chatService.createConversation({
      title: "Proyecto A chat",
      projectId: "project_1"
    });

    automationService.createRule({
      name: "Task to Chat+Memory",
      trigger: {
        type: "task_created"
      },
      actions: [
        { type: "post_chat_message" },
        {
          type: "save_memory",
          payload: {
            scope: "project",
            tags: ["automation", "task_created"]
          }
        }
      ]
    });

    await eventBus.publish({
      type: "task_created",
      payload: {
        projectId: "project_1",
        taskId: "task_10",
        taskTitle: "Preparar entrega"
      },
      occurredAt: new Date().toISOString()
    });

    const messages = chatService.listMessages(conversation.id);
    const memories = memoryService.search({ tags: ["automation"] });
    const runs = automationService.listRunLogs();

    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(memories.length).toBeGreaterThanOrEqual(1);
    expect(runs[0]?.status).toBe("success");
  });

  it("requiere confirmacion para acciones sensibles", () => {
    const eventBus = new EventBus();
    const automationService = new AutomationService(
      eventBus,
      new ChatService(eventBus),
      new MemoryService(eventBus)
    );

    expect(() =>
      automationService.createRule({
        name: "Regla sensible",
        trigger: { type: "task_created" },
        actions: [{ type: "shell_execution" }]
      })
    ).toThrowError();
  });
});
