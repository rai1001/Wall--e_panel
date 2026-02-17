import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";

async function login(app: ReturnType<typeof createApp>, email: string, password: string) {
  const response = await request(app).post("/v1/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

describe("chat realtime", () => {
  it("streaming reply guarda mensaje user y assistant en la conversacion", async () => {
    const app = createApp();
    const token = await login(app, "admin@local", "admin123");
    const auth = { authorization: `Bearer ${token}` };

    const project = await request(app)
      .post("/v1/projects")
      .set(auth)
      .send({ name: "Realtime Chat Project", status: "active" });
    expect(project.status).toBe(201);

    const conversation = await request(app)
      .post("/v1/chat/conversations")
      .set(auth)
      .send({ title: "Realtime chat", projectId: project.body.id });
    expect(conversation.status).toBe(201);

    const realtime = await request(app)
      .post(`/v1/chat/conversations/${conversation.body.id}/realtime`)
      .set(auth)
      .send({
        content: "Necesito plan rapido para hoy",
        actorType: "user",
        actorId: "user_admin"
      });

    expect(realtime.status).toBe(200);
    expect(realtime.type).toContain("application/x-ndjson");

    const events = realtime.text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as { type?: string });

    expect(events.some((item) => item.type === "user_message_saved")).toBe(true);
    expect(events.some((item) => item.type === "delta")).toBe(true);
    expect(events.some((item) => item.type === "assistant_message_saved")).toBe(true);
    expect(events.some((item) => item.type === "done")).toBe(true);

    const saved = await request(app)
      .get(`/v1/chat/conversations/${conversation.body.id}/messages`)
      .set(auth);
    expect(saved.status).toBe(200);
    expect(Array.isArray(saved.body)).toBe(true);
    expect(saved.body.some((item: { role?: string; content?: string }) => item.role === "user" && item.content?.includes("Necesito plan rapido"))).toBe(true);
    expect(saved.body.some((item: { role?: string; content?: string }) => item.role === "assistant" && typeof item.content === "string" && item.content.length > 0)).toBe(true);
  });
});

