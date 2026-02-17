import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";

describe("Auth login page + cookie session", () => {
  it("sirve pagina de login publica", async () => {
    const app = createApp();
    const response = await request(app).get("/login");

    expect(response.status).toBe(200);
    expect(response.type).toContain("text/html");
    expect(response.text).toContain("Entrar al Dashboard");
  });

  it("permite /auth/me y /dashboard usando cookie de sesion", async () => {
    const app = createApp();
    const login = await request(app)
      .post("/v1/auth/login")
      .send({ email: "admin@local", password: "admin123" });

    expect(login.status).toBe(200);
    const cookies = login.headers["set-cookie"] as string[] | undefined;
    const authCookie = cookies?.find((cookie) => cookie.startsWith("oc_token="));
    expect(authCookie).toBeTruthy();

    const me = await request(app).get("/v1/auth/me").set("Cookie", authCookie!);
    expect(me.status).toBe(200);
    expect(me.body.role).toBe("admin");

    const dashboard = await request(app).get("/v1/dashboard").set("Cookie", authCookie!);
    expect(dashboard.status).toBe(200);
    expect(dashboard.type).toContain("text/html");
    expect(dashboard.text).toContain("OpenClaw Control Deck");
  });
});
