import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createDatabaseClient } from "../../src/shared/db/database";

describe("Database legacy migration hardening", () => {
  it("agrega project_id en esquemas legacy de conversations y memory_items", () => {
    const dbPath = path.join(process.cwd(), "data", `legacy-migration-${Date.now()}.db`);
    const legacy = new Database(dbPath);

    legacy.exec(`
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE memory_items (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        tags_json TEXT NOT NULL
      );
    `);
    legacy.close();

    const client = createDatabaseClient(dbPath);
    const conversationColumns = client.connection
      .prepare("PRAGMA table_info(conversations)")
      .all() as Array<{ name: string }>;
    const memoryColumns = client.connection
      .prepare("PRAGMA table_info(memory_items)")
      .all() as Array<{ name: string }>;

    expect(conversationColumns.some((column) => column.name === "project_id")).toBe(true);
    expect(memoryColumns.some((column) => column.name === "project_id")).toBe(true);

    client.close();
    fs.rmSync(dbPath, { force: true });
  });
});
