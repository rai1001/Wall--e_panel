import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";

async function login(app: ReturnType<typeof createApp>, email: string, password: string) {
  const response = await request(app).post("/v1/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

describe("Day 3 semantic memory", () => {
  it("realiza busqueda hibrida con filtros de proyecto/agente/scope", async () => {
    const app = createApp();
    const token = await login(app, "admin@local", "admin123");
    const auth = { authorization: `Bearer ${token}` };

    await request(app).post("/v1/memory/save").set(auth).send({
      projectId: "proj_alpha",
      agentId: "agent_main",
      scope: "proyecto",
      memoryType: "decision",
      source: "manual:test",
      content: "Decidimos usar PostgreSQL para transacciones criticas y consistencia ACID.",
      tags: ["database", "postgres"]
    });

    await request(app).post("/v1/memory/save").set(auth).send({
      projectId: "proj_beta",
      agentId: "agent_sub",
      scope: "proyecto",
      memoryType: "nota",
      source: "manual:test",
      content: "Comprar cafe y leche para la oficina.",
      tags: ["shopping"]
    });

    await request(app).post("/v1/memory/save").set(auth).send({
      agentId: "agent_main",
      scope: "global",
      memoryType: "preference",
      source: "manual:test",
      content: "Preferencia global: priorizar trazabilidad y auditoria en cambios sensibles.",
      tags: ["security", "audit"]
    });

    const search = await request(app)
      .get(
        "/v1/memory/search?q=base de datos postgres transaccional&activeProjectId=proj_alpha&currentAgentId=agent_main&limit=5"
      )
      .set(auth);
    expect(search.status).toBe(200);
    expect(search.body.length).toBeGreaterThanOrEqual(1);
    expect(search.body[0].projectId).toBe("proj_alpha");

    const filtered = await request(app)
      .get("/v1/memory/search?scope=global&agentId=agent_main")
      .set(auth);
    expect(filtered.status).toBe(200);
    expect(filtered.body.every((item: { scope: string }) => item.scope === "global")).toBe(true);

    const reindex = await request(app)
      .post("/v1/memory/reindex")
      .set(auth)
      .send({ limit: 200 });
    expect(reindex.status).toBe(200);
    expect(reindex.body.processed + reindex.body.skipped).toBeGreaterThanOrEqual(1);
  });
});
