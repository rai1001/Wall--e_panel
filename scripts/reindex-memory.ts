import { createAppContext } from "../src/context";

function parseArg(name: string) {
  const prefixed = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (!prefixed) {
    return undefined;
  }
  return prefixed.slice(name.length + 1);
}

async function run() {
  const context = createAppContext();
  try {
    const limitArg = parseArg("--limit");
    const since = parseArg("--since");
    const limit = limitArg ? Number(limitArg) : undefined;

    const result = await context.memoryService.reindexIncremental({
      limit: Number.isFinite(limit ?? NaN) ? limit : undefined,
      since
    });

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: true, result }, null, 2));
  } finally {
    context.dispose();
  }
}

void run();
