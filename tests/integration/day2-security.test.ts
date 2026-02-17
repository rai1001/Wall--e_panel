import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";

async function login(app: ReturnType<typeof createApp>, email: string, password: string) {
  const response = await request(app).post("/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

describe("Day 2 security and approvals", () => {
  it("exige auth y aprobacion para acciones sensibles", async () => {
    const app = createApp();

    const unauthenticated = await request(app).post("/projects").send({ name: "No Auth" });
    expect(unauthenticated.status).toBe(401);

    const adminToken = await login(app, "admin@local", "admin123");
    const managerToken = await login(app, "manager@local", "manager123");

    const pending = await request(app)
      .post("/automation/rules")
      .set({ authorization: `Bearer ${adminToken}` })
      .send({
        name: "Sensitive Rule",
        trigger: { type: "task_created" },
        actions: [{ type: "shell_execution" }]
      });

    expect(pending.status).toBe(412);
    const approvalId = pending.body?.details?.approvalId as string;
    expect(approvalId).toBeTruthy();

    const approved = await request(app)
      .post(`/policy/approvals/${approvalId}/approve`)
      .set({ authorization: `Bearer ${managerToken}` });
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("approved");

    const created = await request(app)
      .post("/automation/rules")
      .set({
        authorization: `Bearer ${adminToken}`,
        "x-confirmed": "true",
        "x-approval-id": approvalId
      })
      .send({
        name: "Sensitive Rule",
        trigger: { type: "task_created" },
        actions: [{ type: "shell_execution" }]
      });

    expect(created.status).toBe(201);

    const audits = await request(app)
      .get("/policy/audit?limit=10")
      .set({ authorization: `Bearer ${managerToken}` });
    expect(audits.status).toBe(200);
    expect(audits.body.length).toBeGreaterThanOrEqual(1);
  });
});
