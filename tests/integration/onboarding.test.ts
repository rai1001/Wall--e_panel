import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";

async function login(app: ReturnType<typeof createApp>, email: string, password: string) {
  const response = await request(app).post("/v1/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

describe("Onboarding bootstrap", () => {
  it("crea proyecto, conversacion y regla en una llamada", async () => {
    const app = createApp();
    const adminToken = await login(app, "admin@local", "admin123");
    const viewerToken = await login(app, "viewer@local", "viewer123");

    const bootstrap = await request(app)
      .post("/v1/onboarding/bootstrap-flow")
      .set({ authorization: `Bearer ${adminToken}` })
      .send({
        projectName: "Proyecto Bootstrap",
        conversationTitle: "Chat Bootstrap",
        ruleName: "Bootstrap Rule"
      });

    expect(bootstrap.status).toBe(201);
    const projectId = bootstrap.body.project.id as string;
    const conversationId = bootstrap.body.conversation.id as string;

    const task = await request(app)
      .post(`/v1/projects/${projectId}/tasks`)
      .set({ authorization: `Bearer ${adminToken}` })
      .send({ title: "Task bootstrap" });
    expect(task.status).toBe(201);

    const messages = await request(app)
      .get(`/v1/chat/conversations/${conversationId}/messages`)
      .set({ authorization: `Bearer ${viewerToken}` });
    expect(messages.status).toBe(200);
    expect(messages.body.length).toBeGreaterThanOrEqual(1);
  });
});
