import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";

async function login(app: ReturnType<typeof createApp>, email: string, password: string) {
  const response = await request(app).post("/v1/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

describe("Day 5 panel usability", () => {
  it("expone dashboard modular y endpoints para proyectos/automations/chat timeline", async () => {
    const app = createApp();
    const adminToken = await login(app, "admin@local", "admin123");
    const auth = { authorization: `Bearer ${adminToken}` };

    const dashboard = await request(app).get("/v1/dashboard").set(auth);
    expect(dashboard.status).toBe(200);
    expect(dashboard.text).toContain("Projects");
    expect(dashboard.text).toContain("Automations");
    expect(dashboard.text).toContain("Chat Timeline");

    const project = await request(app)
      .post("/v1/projects")
      .set(auth)
      .send({ name: "Panel Day 5 Project", status: "active" });
    expect(project.status).toBe(201);

    const conversation = await request(app)
      .post("/v1/chat/conversations")
      .set(auth)
      .send({
        title: "Timeline panel",
        projectId: project.body.id
      });
    expect(conversation.status).toBe(201);

    const message = await request(app)
      .post(`/v1/chat/conversations/${conversation.body.id}/messages`)
      .set(auth)
      .send({
        role: "user",
        content: "Mensaje para timeline day 5",
        actorType: "user",
        actorId: "user_admin"
      });
    expect(message.status).toBe(201);

    const timeline = await request(app)
      .get("/v1/chat/timeline")
      .query({ projectId: project.body.id, limit: 20 })
      .set(auth);
    expect(timeline.status).toBe(200);
    expect(Array.isArray(timeline.body)).toBe(true);
    expect(timeline.body.length).toBeGreaterThan(0);
    expect(timeline.body[0].eventType).toBe("chat_message_created");

    const rule = await request(app)
      .post("/v1/automation/rules")
      .set(auth)
      .send({
        name: "Rule toggle day5",
        trigger: { type: "task_created" },
        actions: [
          { type: "post_chat_message", payload: { content: "Rule from panel" } },
          { type: "save_memory", payload: { scope: "proyecto", source: "test:day5" } }
        ]
      });
    expect(rule.status).toBe(201);

    const disable = await request(app)
      .patch(`/v1/automation/rules/${rule.body.id}/status`)
      .set(auth)
      .send({ enabled: false });
    expect(disable.status).toBe(200);
    expect(disable.body.enabled).toBe(false);

    const enable = await request(app)
      .patch(`/v1/automation/rules/${rule.body.id}/status`)
      .set(auth)
      .send({ enabled: true });
    expect(enable.status).toBe(200);
    expect(enable.body.enabled).toBe(true);
  });
});
