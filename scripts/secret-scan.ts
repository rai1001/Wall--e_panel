import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

interface Finding {
  file: string;
  line: number;
  rule: string;
  snippet: string;
}

const RULES: Array<{ name: string; regex: RegExp }> = [
  {
    name: "google_api_key",
    regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g
  },
  {
    name: "openai_api_key",
    regex: /\bsk-[A-Za-z0-9]{20,}\b/g
  },
  {
    name: "github_token",
    regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g
  },
  {
    name: "private_key_block",
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g
  },
  {
    name: "jwt_token",
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b/g
  }
];

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".tar",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp4",
  ".mov",
  ".avi"
]);

const IGNORED_PREFIXES = ["node_modules/", "dist/", ".git/", "data/", "backups/"];

function main() {
  const files = listTrackedFiles();
  const findings: Finding[] = [];

  for (const file of files) {
    if (shouldSkipFile(file)) {
      continue;
    }

    const content = safeReadUtf8(file);
    if (content === null || content.includes("\u0000")) {
      continue;
    }

    for (const rule of RULES) {
      const matches = [...content.matchAll(rule.regex)];
      for (const match of matches) {
        if (match.index === undefined) {
          continue;
        }
        const line = lineNumberAt(content, match.index);
        findings.push({
          file,
          line,
          rule: rule.name,
          snippet: truncate(match[0], 80)
        });
      }
    }
  }

  if (findings.length > 0) {
    // eslint-disable-next-line no-console
    console.error("Secret scan FAILED. Findings:");
    for (const finding of findings) {
      // eslint-disable-next-line no-console
      console.error(
        `- ${finding.file}:${finding.line} [${finding.rule}] ${finding.snippet}`
      );
    }
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(`Secret scan OK. ${files.length} tracked files analyzed.`);
}

function listTrackedFiles() {
  const raw = execSync("git ls-files -z", { encoding: "utf8" });
  return raw
    .split("\u0000")
    .map((item) => item.trim())
    .filter(Boolean);
}

function shouldSkipFile(file: string) {
  if (IGNORED_PREFIXES.some((prefix) => file.startsWith(prefix))) {
    return true;
  }
  const ext = path.extname(file).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

function safeReadUtf8(file: string) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (_error) {
    return null;
  }
}

function lineNumberAt(content: string, index: number) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

function truncate(value: string, max: number) {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}...`;
}

main();
