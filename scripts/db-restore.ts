import fs from "node:fs";
import path from "node:path";

function parseArg(name: string) {
  const prefixed = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (!prefixed) {
    return undefined;
  }
  return prefixed.slice(name.length + 1);
}

function resolveDbPath() {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "assistant.db");
}

function run() {
  const file = parseArg("--file");
  if (!file) {
    throw new Error("Uso: npm run restore -- --file=<ruta-backup.db>");
  }

  const source = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  if (!fs.existsSync(source)) {
    throw new Error(`Backup no encontrado: ${source}`);
  }

  const destination = resolveDbPath();
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);

  // eslint-disable-next-line no-console
  console.log(`Restore OK: ${destination}`);
}

run();
