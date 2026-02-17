import { describe, expect, it } from "vitest";
import { assertRuntimeSecurityConfig } from "../../src/config/runtime-security";

describe("Runtime security config", () => {
  it("falla en produccion con JWT debil por defecto", () => {
    expect(() =>
      assertRuntimeSecurityConfig({
        NODE_ENV: "production",
        JWT_SECRET: "dev-secret-change-me"
      })
    ).toThrow(/JWT secret debil/i);
  });

  it("falla en produccion con legacy headers habilitados", () => {
    expect(() =>
      assertRuntimeSecurityConfig({
        NODE_ENV: "production",
        JWT_SECRET: "this-is-a-very-strong-secret-with-length",
        ALLOW_LEGACY_HEADERS: "true"
      })
    ).toThrow(/ALLOW_LEGACY_HEADERS/i);
  });

  it("acepta configuracion valida en produccion", () => {
    expect(() =>
      assertRuntimeSecurityConfig({
        NODE_ENV: "production",
        JWT_SECRETS:
          "4f7c2b5a8d3e6f9a1c4b7d0e2f5a8c3d,8a6d4c2b0f9e7d5c3b1a8f6e4d2c0b9a"
      })
    ).not.toThrow();
  });
});
