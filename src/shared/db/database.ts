import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";

export interface DatabaseClient {
  connection: Database.Database;
  close: () => void;
}

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "assistant.db");

export function createDatabaseClient(dbPath?: string): DatabaseClient {
  const resolvedPath =
    dbPath ?? process.env.DB_PATH ?? (process.env.NODE_ENV === "test" ? ":memory:" : DEFAULT_DB_PATH);

  if (resolvedPath !== ":memory:") {
    const directory = path.dirname(resolvedPath);
    fs.mkdirSync(directory, { recursive: true });
  }

  const connection = new Database(resolvedPath);
  connection.pragma("journal_mode = WAL");
  connection.pragma("foreign_keys = ON");
  migrate(connection);
  seed(connection);

  return {
    connection,
    close: () => {
      connection.close();
    }
  };
}

function migrate(connection: Database.Database) {
  connection.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      actor_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      assignee TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      due_date TEXT,
      status TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS memory_items (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      tags_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS automation_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      trigger_filter_json TEXT,
      actions_json TEXT NOT NULL,
      enabled INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS run_logs (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      event_key TEXT NOT NULL,
      status TEXT NOT NULL,
      output TEXT NOT NULL,
      attempts INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS processed_events (
      event_key TEXT PRIMARY KEY,
      processed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      action_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      requested_by TEXT NOT NULL,
      approved_by TEXT,
      requested_at TEXT NOT NULL,
      approved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audits (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      role TEXT NOT NULL,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      details_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_memory_scope ON memory_items(scope);
    CREATE INDEX IF NOT EXISTS idx_runs_rule ON run_logs(rule_id);
    CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
  `);
}

function seed(connection: Database.Database) {
  const total = connection.prepare("SELECT COUNT(1) as count FROM users").get() as { count: number };
  if (total.count > 0) {
    return;
  }

  const now = new Date().toISOString();
  const insert = connection.prepare(`
    INSERT INTO users (id, email, name, role, password_hash, created_at)
    VALUES (@id, @email, @name, @role, @password_hash, @created_at)
  `);

  const users = [
    { id: "user_admin", email: "admin@local", name: "Admin", role: "admin", password: "admin123" },
    { id: "user_manager", email: "manager@local", name: "Manager", role: "manager", password: "manager123" },
    { id: "user_member", email: "member@local", name: "Member", role: "member", password: "member123" },
    { id: "user_viewer", email: "viewer@local", name: "Viewer", role: "viewer", password: "viewer123" }
  ];

  for (const user of users) {
    insert.run({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      password_hash: bcrypt.hashSync(user.password, 10),
      created_at: now
    });
  }
}

export function parseJson<T>(raw: string | null): T | undefined {
  if (!raw) {
    return undefined;
  }
  return JSON.parse(raw) as T;
}
