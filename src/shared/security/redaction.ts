const REDACTED = "***REDACTED***";
const MAX_DEPTH = 8;

const SENSITIVE_KEY_PATTERN =
  /(pass(word)?|token|secret|authorization|cookie|api[_-]?key|bearer|jwt)/i;

function redactPrimitive(value: unknown): unknown {
  if (typeof value === "string") {
    if (/^bearer\s+/i.test(value.trim())) {
      return "Bearer ***REDACTED***";
    }
    return value;
  }
  return value;
}

export function redactSensitiveData(value: unknown): unknown {
  return redactInternal(value, 0, new WeakSet<object>());
}

function redactInternal(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (depth > MAX_DEPTH) {
    return "[MAX_DEPTH]";
  }

  if (typeof value !== "object") {
    return redactPrimitive(value);
  }

  if (seen.has(value)) {
    return "[CIRCULAR]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactInternal(item, depth + 1, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = REDACTED;
      continue;
    }
    output[key] = redactInternal(item, depth + 1, seen);
  }

  return output;
}

