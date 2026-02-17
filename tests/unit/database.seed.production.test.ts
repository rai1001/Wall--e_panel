import { describe, expect, it } from "vitest";
import { createDatabaseClient } from "../../src/shared/db/database";

describe("Database seed policy", () => {
  it("no inserta usuarios default en produccion sin ALLOW_PROD_SEED", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousAllowProdSeed = process.env.ALLOW_PROD_SEED;

    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_PROD_SEED;

    try {
      const dbClient = createDatabaseClient(":memory:");
      const total = dbClient.connection
        .prepare("SELECT COUNT(1) as count FROM users")
        .get() as { count: number };

      expect(total.count).toBe(0);
      dbClient.close();
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      if (previousAllowProdSeed === undefined) {
        delete process.env.ALLOW_PROD_SEED;
      } else {
        process.env.ALLOW_PROD_SEED = previousAllowProdSeed;
      }
    }
  });
});

