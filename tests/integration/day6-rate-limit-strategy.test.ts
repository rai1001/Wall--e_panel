import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";

async function withEnv<T>(
  overrides: Record<string, string>,
  run: () => Promise<T>
): Promise<T> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

describe("Day 6 rate-limit strategy", () => {
  it("limita por email sin bloquear otro email en la misma IP", async () => {
    await withEnv(
      {
        TRUST_PROXY: "true",
        RATE_LIMIT_AUTH_LOGIN_IP_MAX: "20",
        RATE_LIMIT_AUTH_LOGIN_EMAIL_MAX: "2",
        RATE_LIMIT_AUTH_LOGIN_WINDOW_MS: "60000"
      },
      async () => {
        const app = createApp();
        const statuses: number[] = [];

        for (let i = 0; i < 3; i += 1) {
          const response = await request(app)
            .post("/v1/auth/login")
            .set("x-forwarded-for", "203.0.113.10")
            .send({ email: "one-user@local", password: "x" });
          statuses.push(response.status);
        }

        expect(statuses).toContain(429);

        const otherEmail = await request(app)
          .post("/v1/auth/login")
          .set("x-forwarded-for", "203.0.113.10")
          .send({ email: "other-user@local", password: "x" });

        expect(otherEmail.status).not.toBe(429);
      }
    );
  });

  it("limita por IP usando x-forwarded-for cuando TRUST_PROXY=true", async () => {
    await withEnv(
      {
        TRUST_PROXY: "true",
        RATE_LIMIT_AUTH_LOGIN_IP_MAX: "3",
        RATE_LIMIT_AUTH_LOGIN_EMAIL_MAX: "50",
        RATE_LIMIT_AUTH_LOGIN_WINDOW_MS: "60000"
      },
      async () => {
        const app = createApp();
        const statuses: number[] = [];

        for (let i = 0; i < 4; i += 1) {
          const response = await request(app)
            .post("/v1/auth/login")
            .set("x-forwarded-for", "198.51.100.8")
            .send({ email: `ip-user-${i}@local`, password: "x" });
          statuses.push(response.status);
        }

        expect(statuses).toContain(429);

        const otherIp = await request(app)
          .post("/v1/auth/login")
          .set("x-forwarded-for", "198.51.100.9")
          .send({ email: "new-ip-user@local", password: "x" });

        expect(otherIp.status).not.toBe(429);
      }
    );
  });
});
