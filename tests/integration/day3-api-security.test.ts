import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";

describe("Day 3 API hardening", () => {
  it("mantiene rutas legacy con headers de deprecacion", async () => {
    const app = createApp();

    const legacyLogin = await request(app)
      .post("/auth/login")
      .send({ email: "admin@local", password: "admin123" });

    expect(legacyLogin.status).toBe(200);
    expect(legacyLogin.headers.deprecation).toBe("true");
    expect(legacyLogin.headers.sunset).toBeTruthy();
  });

  it("valida payloads y bloquea login por intentos fallidos", async () => {
    const app = createApp();

    const adminLogin = await request(app)
      .post("/v1/auth/login")
      .send({ email: "admin@local", password: "admin123" });
    expect(adminLogin.status).toBe(200);
    const token = adminLogin.body.token as string;

    const invalidProjectPayload = await request(app)
      .post("/v1/projects")
      .set({ authorization: `Bearer ${token}` })
      .send({ name: "x" });
    expect(invalidProjectPayload.status).toBe(422);

    for (let i = 0; i < 3; i += 1) {
      const fail = await request(app)
        .post("/v1/auth/login")
        .send({ email: "member@local", password: "incorrecta" });
      expect([401, 423]).toContain(fail.status);
    }

    const locked = await request(app)
      .post("/v1/auth/login")
      .send({ email: "member@local", password: "member123" });
    expect(locked.status).toBe(423);
  });

  it("aplica rate limit en endpoint de login", async () => {
    const app = createApp();
    const statuses: number[] = [];

    for (let i = 0; i < 12; i += 1) {
      const response = await request(app)
        .post("/v1/auth/login")
        .send({ email: `no-user-${i}@local`, password: "x" });
      statuses.push(response.status);
    }

    expect(statuses).toContain(429);
  });
});
