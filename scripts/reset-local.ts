import fs from "node:fs";
import path from "node:path";

function resolveDbPath() {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "assistant.db");
}

function run() {
  if (process.env.FORCE_RESET !== "true") {
    throw new Error(
      "Reset bloqueado por seguridad. Ejecuta con FORCE_RESET=true npm run reset:local"
    );
  }

  const dbPath = resolveDbPath();
  if (fs.existsSync(dbPath)) {
    fs.rmSync(dbPath, { force: true });
  }

  // eslint-disable-next-line no-console
  console.log(`Reset local OK. Eliminado: ${dbPath}`);
}

run();
