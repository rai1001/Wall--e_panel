const WEAK_SECRET_MARKERS = [
  "dev-secret-change-me",
  "change-me",
  "changeme",
  "secret",
  "default",
  "password",
  "admin123",
  "test",
  "123456"
];

function isProduction(env: NodeJS.ProcessEnv) {
  return (env.NODE_ENV ?? "").toLowerCase() === "production";
}

function readJwtSecrets(env: NodeJS.ProcessEnv) {
  const fromRotation = env.JWT_SECRETS
    ? env.JWT_SECRETS.split(",").map((item) => item.trim()).filter(Boolean)
    : [];
  if (fromRotation.length > 0) {
    return fromRotation;
  }

  const single = env.JWT_SECRET?.trim();
  return single ? [single] : [];
}

function isWeakSecret(secret: string) {
  const normalized = secret.trim().toLowerCase();
  if (normalized.length < 24) {
    return true;
  }

  return WEAK_SECRET_MARKERS.some((marker) => normalized.includes(marker));
}

export function assertRuntimeSecurityConfig(env: NodeJS.ProcessEnv = process.env) {
  if (!isProduction(env)) {
    return;
  }

  if ((env.ALLOW_LEGACY_HEADERS ?? "").toLowerCase() === "true") {
    throw new Error(
      "Configuracion insegura: ALLOW_LEGACY_HEADERS=true no permitido en produccion"
    );
  }

  const secrets = readJwtSecrets(env);
  if (secrets.length === 0) {
    throw new Error("Configuracion insegura: JWT_SECRET/JWT_SECRETS es obligatorio en produccion");
  }

  if (secrets.some((secret) => isWeakSecret(secret))) {
    throw new Error(
      "Configuracion insegura: JWT secret debil detectado. Use secretos robustos de al menos 24 caracteres"
    );
  }
}

