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
      project_id TEXT,
      agent_id TEXT,
      scope TEXT NOT NULL,
      memory_type TEXT,
      content TEXT NOT NULL,
      source TEXT NOT NULL,
      created_by TEXT,
      timestamp TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      updated_at TEXT,
      content_hash TEXT,
      duplicate_of TEXT,
      blocked INTEGER DEFAULT 0,
      archived INTEGER DEFAULT 0,
      archived_reason TEXT,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS memory_embeddings (
      memory_id TEXT PRIMARY KEY,
      embedding_dim INTEGER NOT NULL,
      embedding_json TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      embedding_provider TEXT,
      embedding_model TEXT,
      embedding_version TEXT,
      FOREIGN KEY(memory_id) REFERENCES memory_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS automation_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      trigger_filter_json TEXT,
      trigger_mode TEXT,
      trigger_conditions_json TEXT,
      trigger_cron TEXT,
      actions_json TEXT NOT NULL,
      enabled INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS run_logs (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      event_key TEXT NOT NULL,
      correlation_id TEXT,
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

    CREATE TABLE IF NOT EXISTS dead_letters (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      event_key TEXT NOT NULL,
      reason TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      correlation_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_login_state (
      email TEXT PRIMARY KEY,
      failed_count INTEGER NOT NULL,
      locked_until TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limit_buckets (
      bucket_key TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      window_ms INTEGER NOT NULL DEFAULT 60000,
      max_limit INTEGER NOT NULL DEFAULT 60,
      count INTEGER NOT NULL,
      blocked_count INTEGER NOT NULL DEFAULT 0,
      first_seen INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      last_blocked_at INTEGER,
      PRIMARY KEY (bucket_key, window_start)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_memory_scope ON memory_items(scope);
    CREATE INDEX IF NOT EXISTS idx_runs_rule ON run_logs(rule_id);
    CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
    CREATE INDEX IF NOT EXISTS idx_dead_letters_rule ON dead_letters(rule_id);
    CREATE INDEX IF NOT EXISTS idx_rate_limit_updated ON rate_limit_buckets(updated_at);
  `);

  ensureColumn(connection, "automation_rules", "trigger_mode", "TEXT");
  ensureColumn(connection, "automation_rules", "trigger_conditions_json", "TEXT");
  ensureColumn(connection, "automation_rules", "trigger_cron", "TEXT");
  ensureColumn(connection, "conversations", "project_id", "TEXT");
  ensureColumn(connection, "tasks", "project_id", "TEXT");
  ensureColumn(connection, "milestones", "project_id", "TEXT");
  ensureColumn(connection, "run_logs", "correlation_id", "TEXT");
  ensureColumn(connection, "memory_items", "project_id", "TEXT");
  ensureColumn(connection, "memory_items", "agent_id", "TEXT");
  ensureColumn(connection, "memory_items", "memory_type", "TEXT");
  ensureColumn(connection, "memory_items", "created_by", "TEXT");
  ensureColumn(connection, "memory_items", "updated_at", "TEXT");
  ensureColumn(connection, "memory_items", "content_hash", "TEXT");
  ensureColumn(connection, "memory_items", "duplicate_of", "TEXT");
  ensureColumn(connection, "memory_items", "blocked", "INTEGER DEFAULT 0");
  ensureColumn(connection, "memory_items", "archived", "INTEGER DEFAULT 0");
  ensureColumn(connection, "memory_items", "archived_reason", "TEXT");
  ensureColumn(connection, "memory_items", "expires_at", "TEXT");
  ensureColumn(connection, "memory_embeddings", "embedding_provider", "TEXT");
  ensureColumn(connection, "memory_embeddings", "embedding_model", "TEXT");
  ensureColumn(connection, "memory_embeddings", "embedding_version", "TEXT");
  ensureColumn(connection, "rate_limit_buckets", "window_ms", "INTEGER NOT NULL DEFAULT 60000");
  ensureColumn(connection, "rate_limit_buckets", "max_limit", "INTEGER NOT NULL DEFAULT 60");
  ensureColumn(connection, "rate_limit_buckets", "blocked_count", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(connection, "rate_limit_buckets", "first_seen", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(connection, "rate_limit_buckets", "last_blocked_at", "INTEGER");

  ensureIndex(connection, "idx_memory_project", "memory_items", "project_id");
  ensureIndex(connection, "idx_memory_agent", "memory_items", "agent_id");
  ensureIndex(connection, "idx_memory_type", "memory_items", "memory_type");
  ensureIndex(connection, "idx_memory_archived", "memory_items", "archived");
  ensureIndex(connection, "idx_memory_expires", "memory_items", "expires_at");
  ensureIndex(connection, "idx_conversations_project", "conversations", "project_id");
  ensureIndex(connection, "idx_rate_limit_updated", "rate_limit_buckets", "updated_at");
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

function ensureColumn(
  connection: Database.Database,
  tableName: string,
  columnName: string,
  sqlType: string
) {
  if (!tableExists(connection, tableName)) {
    return;
  }

  const rows = connection
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string }>;

  if (rows.some((row) => row.name === columnName)) {
    return;
  }

  connection.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqlType}`);
}

function ensureIndex(
  connection: Database.Database,
  indexName: string,
  tableName: string,
  columnName: string
) {
  if (!tableExists(connection, tableName)) {
    return;
  }

  connection.exec(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${columnName})`);
}

function tableExists(connection: Database.Database, tableName: string) {
  const row = connection
    .prepare(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table' AND name = ?
       LIMIT 1`
    )
    .get(tableName) as { name: string } | undefined;

  return Boolean(row);
}
