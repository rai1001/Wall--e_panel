import { describe, expect, it } from "vitest";
import { EventBus } from "../../src/shared/events/event-bus";
import { MemoryService } from "../../src/memory/memory.service";
import { createDatabaseClient } from "../../src/shared/db/database";

describe("MemoryService", () => {
  it("guarda y busca por texto/tags/scope", async () => {
    const dbClient = createDatabaseClient(":memory:");
    const service = new MemoryService(new EventBus(), dbClient.connection);

    await service.save({
      scope: "project",
      content: "Tarea de onboarding creada",
      source: "test",
      tags: ["project", "task"]
    });

    await service.save({
      scope: "chat",
      content: "Mensaje de seguimiento",
      source: "test",
      tags: ["chat"]
    });

    const byText = await service.search({ q: "onboarding" });
    const byTags = await service.search({ tags: ["project", "task"] });
    const byScope = await service.search({ scope: "chat" });

    expect(byText).toHaveLength(1);
    expect(byTags).toHaveLength(1);
    expect(byScope).toHaveLength(1);
    dbClient.close();
  });

  it("captura memoria automaticamente desde eventos", async () => {
    const eventBus = new EventBus();
    const dbClient = createDatabaseClient(":memory:");
    const service = new MemoryService(eventBus, dbClient.connection);
    service.enableEventCapture();

    await eventBus.publish({
      type: "task_created",
      payload: {
        projectId: "project_1",
        taskId: "task_1",
        taskTitle: "Preparar PRD"
      },
      occurredAt: new Date().toISOString()
    });

    const memories = await service.search({ tags: ["task_created"] });
    expect(memories.length).toBeGreaterThanOrEqual(1);
    dbClient.close();
  });
});
