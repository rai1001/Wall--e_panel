import { describe, expect, it } from "vitest";
import { AutomationService } from "../../src/automation/automation.service";
import { ChatService } from "../../src/chat/chat.service";
import { MemoryService } from "../../src/memory/memory.service";
import { MetricsService } from "../../src/ops/metrics.service";
import { EventBus } from "../../src/shared/events/event-bus";
import { createDatabaseClient } from "../../src/shared/db/database";

describe("AutomationService", () => {
  it("ejecuta regla task_created -> post_chat_message + save_memory", async () => {
    const dbClient = createDatabaseClient(":memory:");
    const eventBus = new EventBus();
    const chatService = new ChatService(eventBus, dbClient.connection);
    const memoryService = new MemoryService(eventBus, dbClient.connection);
    const automationService = new AutomationService(
      eventBus,
      chatService,
      memoryService,
      dbClient.connection,
      new MetricsService()
    );

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
    const memories = await memoryService.search({ tags: ["automation"] });
    const runs = automationService.listRunLogs();

    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(memories.length).toBeGreaterThanOrEqual(1);
    expect(runs[0]?.status).toBe("success");
    dbClient.close();
  });

  it("evita reprocesar evento igual (idempotencia)", async () => {
    const dbClient = createDatabaseClient(":memory:");
    const eventBus = new EventBus();
    const chatService = new ChatService(eventBus, dbClient.connection);
    const memoryService = new MemoryService(eventBus, dbClient.connection);
    const automationService = new AutomationService(
      eventBus,
      chatService,
      memoryService,
      dbClient.connection,
      new MetricsService()
    );
    automationService.start();

    chatService.createConversation({ title: "chat", projectId: "project_1" });
    automationService.createRule({
      name: "Idempotent Rule",
      trigger: { type: "task_created" },
      actions: [{ type: "save_memory" }]
    });

    const event = {
      type: "task_created" as const,
      payload: { projectId: "project_1", taskId: "task_1", taskTitle: "Idempotencia" },
      occurredAt: new Date().toISOString()
    };

    await eventBus.publish(event);
    await eventBus.publish(event);

    const runs = automationService.listRunLogs();
    expect(runs.length).toBe(1);
    dbClient.close();
  });

  it("evalua condiciones compuestas en trigger", async () => {
    const dbClient = createDatabaseClient(":memory:");
    const eventBus = new EventBus();
    const chatService = new ChatService(eventBus, dbClient.connection);
    const memoryService = new MemoryService(eventBus, dbClient.connection);
    const automationService = new AutomationService(
      eventBus,
      chatService,
      memoryService,
      dbClient.connection,
      new MetricsService()
    );
    automationService.start();

    automationService.createRule({
      name: "Status done OR priority high",
      trigger: {
        type: "task_status_changed",
        mode: "OR",
        conditions: [
          { field: "status", operator: "eq", value: "done" },
          { field: "priority", operator: "eq", value: "high" }
        ]
      },
      actions: [{ type: "save_memory" }]
    });

    await eventBus.publish({
      type: "task_status_changed",
      payload: {
        projectId: "project_1",
        taskId: "task_5",
        status: "done",
        priority: "low"
      },
      occurredAt: new Date().toISOString()
    });

    expect(automationService.listRunLogs().length).toBe(1);
    dbClient.close();
  });

  it("envia fallos permanentes a dead-letter queue", async () => {
    const dbClient = createDatabaseClient(":memory:");
    const eventBus = new EventBus();
    const chatService = new ChatService(eventBus, dbClient.connection);
    const memoryService = new MemoryService(eventBus, dbClient.connection);
    const automationService = new AutomationService(
      eventBus,
      chatService,
      memoryService,
      dbClient.connection,
      new MetricsService()
    );
    automationService.start();

    automationService.createRule({
      name: "Unsupported action dead letter",
      trigger: { type: "task_created" },
      actions: [{ type: "external_action" }]
    });

    await eventBus.publish({
      type: "task_created",
      payload: {
        projectId: "project_1",
        taskId: "task_9",
        taskTitle: "dead letter"
      },
      occurredAt: new Date().toISOString()
    });

    const runs = automationService.listRunLogs();
    const deadLetters = automationService.listDeadLetters();
    expect(runs[0]?.status).toBe("failed");
    expect(deadLetters.length).toBeGreaterThanOrEqual(1);
    dbClient.close();
  });

  it("acepta reglas programadas por cron", async () => {
    const dbClient = createDatabaseClient(":memory:");
    const eventBus = new EventBus();
    const chatService = new ChatService(eventBus, dbClient.connection);
    const memoryService = new MemoryService(eventBus, dbClient.connection);
    const automationService = new AutomationService(
      eventBus,
      chatService,
      memoryService,
      dbClient.connection,
      new MetricsService()
    );
    automationService.start();

    const rule = automationService.createRule({
      name: "Scheduled digest",
      trigger: { type: "scheduled_tick", cron: "* * * * *" },
      actions: [{ type: "save_memory", payload: { scope: "daily" } }]
    });

    const run = await automationService.testRule(rule.id, {
      eventType: "scheduled_tick",
      eventPayload: { ruleId: rule.id }
    });

    expect(run?.status).toBe("success");
    dbClient.close();
  });
});
