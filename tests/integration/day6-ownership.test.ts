import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";

async function login(app: ReturnType<typeof createApp>, email: string, password: string) {
  const response = await request(app).post("/v1/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

describe("Day 6 ownership baseline", () => {
  it("bloquea operaciones cross-owner en project/chat/memory para member", async () => {
    const app = createApp();

    const root = await request(app).get("/");
    expect(root.status).toBe(200);
    expect(root.headers["x-powered-by"]).toBeUndefined();

    const adminToken = await login(app, "admin@local", "admin123");
    const memberToken = await login(app, "member@local", "member123");
    const adminAuth = { authorization: `Bearer ${adminToken}` };
    const memberAuth = { authorization: `Bearer ${memberToken}` };

    const adminProject = await request(app)
      .post("/v1/projects")
      .set(adminAuth)
      .send({ name: "Admin Project" });
    expect(adminProject.status).toBe(201);

    const forbiddenProjectUpdate = await request(app)
      .patch(`/v1/projects/${adminProject.body.id}`)
      .set(memberAuth)
      .send({ status: "paused" });
    expect(forbiddenProjectUpdate.status).toBe(403);

    const memberProject = await request(app)
      .post("/v1/projects")
      .set(memberAuth)
      .send({ name: "Member Project" });
    expect(memberProject.status).toBe(201);

    const ownProjectUpdate = await request(app)
      .patch(`/v1/projects/${memberProject.body.id}`)
      .set(memberAuth)
      .send({ status: "paused" });
    expect(ownProjectUpdate.status).toBe(200);

    const conversation = await request(app)
      .post("/v1/chat/conversations")
      .set(adminAuth)
      .send({
        title: "Admin Conversation",
        projectId: adminProject.body.id
      });
    expect(conversation.status).toBe(201);

    const forbiddenMessage = await request(app)
      .post(`/v1/chat/conversations/${conversation.body.id}/messages`)
      .set(memberAuth)
      .send({
        role: "user",
        content: "No deberia pasar",
        actorType: "user",
        actorId: "user_member"
      });
    expect(forbiddenMessage.status).toBe(403);

    const adminMemory = await request(app)
      .post("/v1/memory/save")
      .set(adminAuth)
      .send({
        scope: "global",
        content: "Memoria admin",
        source: "test:ownership",
        tags: ["ownership"]
      });
    expect(adminMemory.status).toBe(201);

    const forbiddenMemoryBlock = await request(app)
      .post(`/v1/memory/${adminMemory.body.id}/block`)
      .set(memberAuth);
    expect(forbiddenMemoryBlock.status).toBe(403);

    const memberMemory = await request(app)
      .post("/v1/memory/save")
      .set(memberAuth)
      .send({
        scope: "global",
        content: "Memoria member",
        source: "test:ownership",
        tags: ["ownership"]
      });
    expect(memberMemory.status).toBe(201);

    const ownMemoryBlock = await request(app)
      .post(`/v1/memory/${memberMemory.body.id}/block`)
      .set(memberAuth);
    expect(ownMemoryBlock.status).toBe(200);
  });
});
