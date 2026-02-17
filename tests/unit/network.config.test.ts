import { describe, expect, it } from "vitest";
import { resolveTrustProxySetting } from "../../src/config/network";

describe("Network config", () => {
  it("interpreta booleanos conocidos", () => {
    expect(resolveTrustProxySetting("true")).toBe(true);
    expect(resolveTrustProxySetting("1")).toBe(true);
    expect(resolveTrustProxySetting("false")).toBe(false);
    expect(resolveTrustProxySetting("0")).toBe(false);
  });

  it("interpreta numero de hops", () => {
    expect(resolveTrustProxySetting("2")).toBe(2);
  });

  it("interpreta lista CSV", () => {
    expect(resolveTrustProxySetting("loopback, linklocal")).toEqual(["loopback", "linklocal"]);
  });
});
