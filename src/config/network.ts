export type TrustProxySetting = boolean | number | string | string[];

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

export function resolveTrustProxySetting(
  raw: string | undefined = process.env.TRUST_PROXY
): TrustProxySetting {
  const value = raw?.trim();
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();
  if (TRUE_VALUES.has(normalized)) {
    return true;
  }
  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  if (/^\d+$/.test(value)) {
    const hops = Number(value);
    if (Number.isFinite(hops) && hops >= 0) {
      return hops;
    }
  }

  if (value.includes(",")) {
    const list = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (list.length > 0) {
      return list;
    }
  }

  return value;
}
