let sequence = 0;

export function createId(prefix: string) {
  sequence += 1;
  return `${prefix}_${Date.now()}_${sequence}`;
}
