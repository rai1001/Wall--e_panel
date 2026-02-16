import { describe, expect, it } from "vitest";
import { EventBus } from "../../src/shared/events/event-bus";
import { ProjectService } from "../../src/project/project.service";

describe("ProjectService", () => {
  it("crea proyecto, crea tarea y actualiza su estado", async () => {
    const eventBus = new EventBus();
    const service = new ProjectService(eventBus);
    const seenEvents: string[] = [];

    eventBus.subscribe("task_created", (event) => {
      seenEvents.push(event.type);
    });
    eventBus.subscribe("task_status_changed", (event) => {
      seenEvents.push(event.type);
    });

    const project = service.createProject({ name: "Proyecto A" });
    const task = await service.createTask(project.id, { title: "Configurar flujo" });
    const initialStatus = task.status;
    const updated = await service.updateTaskStatus(project.id, task.id, "in_progress");

    expect(project.name).toBe("Proyecto A");
    expect(initialStatus).toBe("todo");
    expect(updated.status).toBe("in_progress");
    expect(seenEvents).toContain("task_created");
    expect(seenEvents).toContain("task_status_changed");
  });
});
