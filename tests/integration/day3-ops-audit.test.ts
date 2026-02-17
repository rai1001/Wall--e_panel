import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";

async function login(app: ReturnType<typeof createApp>, email: string, password: string) {
  const response = await request(app).post("/v1/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

describe("Day 3 ops endpoints", () => {
  it("expone metricas de memoria, salud de automatizacion y auditoria agregada", async () => {
    const app = createApp();
    const adminToken = await login(app, "admin@local", "admin123");
    const managerToken = await login(app, "manager@local", "manager123");
    const adminAuth = { authorization: `Bearer ${adminToken}` };
    const managerAuth = { authorization: `Bearer ${managerToken}` };

    await request(app).post("/v1/projects").set(adminAuth).send({ name: "Ops Project" });
    await request(app).post("/v1/memory/save").set(adminAuth).send({
      scope: "global",
      memoryType: "operational",
      source: "manual:test",
      content: "Runbook operativo creado para backups diarios."
    });

    const pending = await request(app).post("/v1/automation/rules").set(adminAuth).send({
      name: "Sensitive Rule",
      trigger: { type: "task_created" },
      actions: [{ type: "shell_execution" }]
    });
    expect(pending.status).toBe(412);
    const approvalId = pending.body?.details?.approvalId as string;
    expect(approvalId).toBeTruthy();

    const approved = await request(app)
      .post(`/v1/policy/approvals/${approvalId}/approve`)
      .set(managerAuth);
    expect(approved.status).toBe(200);

    const memoryMetrics = await request(app).get("/v1/ops/memory/metrics").set(managerAuth);
    expect(memoryMetrics.status).toBe(200);
    expect(memoryMetrics.body.total).toBeGreaterThanOrEqual(1);

    const automationHealth = await request(app)
      .get("/v1/ops/automation/health")
      .set(managerAuth);
    expect(automationHealth.status).toBe(200);
    expect(automationHealth.body.totalRuns).toBeGreaterThanOrEqual(0);

    const auditAggregated = await request(app)
      .get("/v1/ops/audit/aggregated")
      .set(managerAuth);
    expect(auditAggregated.status).toBe(200);
    expect(Array.isArray(auditAggregated.body)).toBe(true);
    expect(auditAggregated.body.length).toBeGreaterThanOrEqual(1);
  });
});
