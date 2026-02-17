import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDatabaseClient } from "../../src/shared/db/database";
import { RateLimiter } from "../../src/shared/http/rate-limit";

describe("RateLimiter distributed backend", () => {
  it("shares counters across independent instances when backend is db", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wall-e-rate-limit-"));
    const dbPath = path.join(tempDir, "assistant.db");
    const clientA = createDatabaseClient(dbPath);
    const clientB = createDatabaseClient(dbPath);

    try {
      const limiterA = new RateLimiter({ backend: "db", connection: clientA.connection });
      const limiterB = new RateLimiter({ backend: "db", connection: clientB.connection });

      const first = limiterA.consume("login:user_admin", 2, 60_000);
      const second = limiterB.consume("login:user_admin", 2, 60_000);
      const third = limiterA.consume("login:user_admin", 2, 60_000);

      expect(first.allowed).toBe(true);
      expect(second.allowed).toBe(true);
      expect(third.allowed).toBe(false);
    } finally {
      clientA.close();
      clientB.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("reports health with blocked keys and active buckets", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wall-e-rate-limit-health-"));
    const dbPath = path.join(tempDir, "assistant.db");
    const client = createDatabaseClient(dbPath);

    try {
      const limiter = new RateLimiter({ backend: "db", connection: client.connection, cleanupEvery: 10_000 });

      limiter.consume("auth:user_manager", 1, 60_000);
      limiter.consume("auth:user_manager", 1, 60_000);

      const health = limiter.health(5);
      expect(health.backend).toBe("db");
      expect(health.activeBuckets).toBeGreaterThanOrEqual(1);
      expect(health.totalBlocks).toBeGreaterThanOrEqual(1);
      expect(health.topBlockedKeys.length).toBeGreaterThanOrEqual(1);
      expect(health.averageWindowMs).toBeGreaterThanOrEqual(1);
    } finally {
      client.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
