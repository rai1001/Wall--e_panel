import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";

describe("Day 1 integrated flow", () => {
  it("Proyecto -> Automatizacion -> Chat -> Memoria", async () => {
    const app = createApp();
    const adminHeaders = { "x-role": "admin", "x-actor-id": "rai" };
    const viewerHeaders = { "x-role": "viewer", "x-actor-id": "rai-view" };

    const projectResponse = await request(app)
      .post("/projects")
      .set(adminHeaders)
      .send({ name: "Proyecto Integrado" });
    expect(projectResponse.status).toBe(201);
    const projectId = projectResponse.body.id as string;

    const conversationResponse = await request(app)
      .post("/chat/conversations")
      .set(adminHeaders)
      .send({ title: "Chat Proyecto Integrado", projectId });
    expect(conversationResponse.status).toBe(201);
    const conversationId = conversationResponse.body.id as string;

    const ruleResponse = await request(app)
      .post("/automation/rules")
      .set(adminHeaders)
      .send({
        name: "TaskCreated -> Chat+Memory",
        trigger: { type: "task_created" },
        actions: [
          {
            type: "post_chat_message",
            payload: {
              content: "Automatizacion: tarea creada"
            }
          },
          {
            type: "save_memory",
            payload: {
              scope: "project",
              content: "Memoria generada por regla task_created",
              tags: ["automation", "task_created"]
            }
          }
        ]
      });
    expect(ruleResponse.status).toBe(201);

    const taskResponse = await request(app)
      .post(`/projects/${projectId}/tasks`)
      .set(adminHeaders)
      .send({ title: "Completar entrega Day 1" });
    expect(taskResponse.status).toBe(201);

    const messagesResponse = await request(app)
      .get(`/chat/conversations/${conversationId}/messages`)
      .set(viewerHeaders);
    expect(messagesResponse.status).toBe(200);
    expect(messagesResponse.body.some((message: { content: string }) => message.content.includes("Automatizacion: tarea creada"))).toBe(true);

    const memoryResponse = await request(app)
      .get("/memory/search?scope=project&tags=automation,task_created")
      .set(viewerHeaders);
    expect(memoryResponse.status).toBe(200);
    expect(memoryResponse.body.length).toBeGreaterThanOrEqual(1);

    const runsResponse = await request(app).get("/automation/runs").set(viewerHeaders);
    expect(runsResponse.status).toBe(200);
    expect(runsResponse.body.length).toBeGreaterThanOrEqual(1);
    expect(runsResponse.body.at(-1)?.status).toBe("success");
  });
});
