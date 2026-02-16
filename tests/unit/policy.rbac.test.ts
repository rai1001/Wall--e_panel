import { describe, expect, it } from "vitest";
import { can } from "../../src/policy/rbac";

describe("RBAC can()", () => {
  it("admin puede todo", () => {
    expect(can("execute", "automatizacion", "admin")).toBe(true);
    expect(can("delete", "chat", "admin")).toBe(true);
  });

  it("manager no puede crear reglas de automatizacion", () => {
    expect(can("create", "automatizacion", "manager")).toBe(false);
    expect(can("execute", "automatizacion", "manager")).toBe(true);
  });

  it("member no puede delete en proyecto", () => {
    expect(can("delete", "proyecto", "member")).toBe(false);
    expect(can("update", "proyecto", "member")).toBe(true);
  });

  it("viewer solo tiene read", () => {
    expect(can("read", "memoria", "viewer")).toBe(true);
    expect(can("create", "chat", "viewer")).toBe(false);
  });
});
