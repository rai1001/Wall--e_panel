import fs from "node:fs";
import path from "node:path";

type HttpMethod = "get" | "post" | "patch" | "delete";

interface ContractEntry {
  path: string;
  methods: HttpMethod[];
}

const REQUIRED_CONTRACT: ContractEntry[] = [
  { path: "/health", methods: ["get"] },
  { path: "/v1/auth/login", methods: ["post"] },
  { path: "/v1/auth/logout", methods: ["post"] },
  { path: "/v1/auth/me", methods: ["get"] },
  { path: "/v1/auth/keys", methods: ["get"] },
  { path: "/v1/projects", methods: ["get", "post"] },
  { path: "/v1/projects/{id}", methods: ["get", "patch", "delete"] },
  { path: "/v1/projects/{id}/tasks", methods: ["get", "post"] },
  { path: "/v1/projects/{id}/tasks/{taskId}/status", methods: ["patch"] },
  { path: "/v1/chat/conversations", methods: ["post"] },
  { path: "/v1/chat/conversations/{id}/messages", methods: ["get", "post"] },
  { path: "/v1/chat/timeline", methods: ["get"] },
  { path: "/v1/memory/save", methods: ["post"] },
  { path: "/v1/memory/search", methods: ["get"] },
  { path: "/v1/memory/panel", methods: ["get"] },
  { path: "/v1/memory/reindex", methods: ["post"] },
  { path: "/v1/memory/deduplicate", methods: ["post"] },
  { path: "/v1/memory/hygiene/run", methods: ["post"] },
  { path: "/v1/memory/{id}/promote-global", methods: ["post"] },
  { path: "/v1/memory/{id}/forget", methods: ["post"] },
  { path: "/v1/memory/{id}/block", methods: ["post"] },
  { path: "/v1/automation/rules", methods: ["get", "post"] },
  { path: "/v1/automation/rules/{id}/status", methods: ["patch"] },
  { path: "/v1/automation/rules/{id}/test", methods: ["post"] },
  { path: "/v1/automation/runs", methods: ["get"] },
  { path: "/v1/automation/dead-letters", methods: ["get"] },
  { path: "/v1/policy/approvals", methods: ["get"] },
  { path: "/v1/policy/approvals/{id}/approve", methods: ["post"] },
  { path: "/v1/policy/approvals/{id}/reject", methods: ["post"] },
  { path: "/v1/policy/audit", methods: ["get"] },
  { path: "/v1/onboarding/rule-templates", methods: ["get"] },
  { path: "/v1/onboarding/bootstrap-flow", methods: ["post"] },
  { path: "/v1/onboarding/bootstrap-from-template", methods: ["post"] },
  { path: "/v1/ops/metrics", methods: ["get"] },
  { path: "/v1/ops/memory/metrics", methods: ["get"] },
  { path: "/v1/ops/embedding/runtime", methods: ["get"] },
  { path: "/v1/ops/automation/health", methods: ["get"] },
  { path: "/v1/ops/audit/aggregated", methods: ["get"] },
  { path: "/v1/ops/rate-limit/health", methods: ["get"] },
  { path: "/v1/dashboard", methods: ["get"] }
];

function main() {
  const openapiPath = path.join(process.cwd(), "docs", "openapi.yaml");
  const content = fs.readFileSync(openapiPath, "utf8");
  const missing: string[] = [];

  for (const entry of REQUIRED_CONTRACT) {
    const block = extractPathBlock(content, entry.path);
    if (!block) {
      missing.push(`${entry.path} (path missing)`);
      continue;
    }

    for (const method of entry.methods) {
      const methodRegex = new RegExp(`^\\s{4}${method}:\\s*$`, "m");
      if (!methodRegex.test(block)) {
        missing.push(`${entry.path} -> ${method.toUpperCase()} missing`);
      }
    }
  }

  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error("OpenAPI contract check FAILED:");
    for (const item of missing) {
      // eslint-disable-next-line no-console
      console.error(`- ${item}`);
    }
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(`OpenAPI contract check OK. ${REQUIRED_CONTRACT.length} paths validated.`);
}

function extractPathBlock(content: string, apiPath: string) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trimEnd() === `  ${apiPath}:`);
  if (start < 0) {
    return null;
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i]?.startsWith("  /")) {
      end = i;
      break;
    }
  }

  return lines.slice(start + 1, end).join("\n");
}

main();
