import { describe, expect, it } from "vitest";
import { redactSensitiveData } from "../../src/shared/security/redaction";

describe("Sensitive data redaction", () => {
  it("redacta campos sensibles anidados", () => {
    const raw = {
      email: "rai@local",
      password: "alborelle",
      nested: {
        apiKey: "secret-key",
        authorization: "Bearer abc.def.ghi"
      }
    };

    const redacted = redactSensitiveData(raw) as Record<string, unknown>;
    expect(redacted.password).toBe("***REDACTED***");
    expect((redacted.nested as Record<string, unknown>).apiKey).toBe("***REDACTED***");
    expect((redacted.nested as Record<string, unknown>).authorization).toBe("***REDACTED***");
  });
});

