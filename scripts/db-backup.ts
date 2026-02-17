import fs from "node:fs";
import path from "node:path";

function resolveDbPath() {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "assistant.db");
}

function run() {
  const source = resolveDbPath();
  if (!fs.existsSync(source)) {
    throw new Error(`DB no encontrada en ${source}`);
  }

  const backupDir = path.join(process.cwd(), "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destination = path.join(backupDir, `assistant-${stamp}.db`);
  fs.copyFileSync(source, destination);

  // eslint-disable-next-line no-console
  console.log(`Backup OK: ${destination}`);
}

run();
