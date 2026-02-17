import { createHash } from "node:crypto";
import { Database } from "better-sqlite3";
import { DomainEvent, EventBus } from "../shared/events/event-bus";
import { createId } from "../shared/id";
import { AppError, NotFoundError } from "../shared/http/errors";
import { MemoryItem } from "../types/domain";
import {
  cosineSimilarity,
  createEmbedding,
  createEmbeddingAsync,
  embeddingDimension,
  embeddingModel,
  embeddingProvider,
  embeddingVersion,
  lexicalScore
} from "./embedding";

export interface SaveMemoryInput {
  projectId?: string;
  agentId?: string;
  scope: string;
  memoryType?: string;
  content: string;
  source: string;
  createdBy?: string;
  timestamp?: string;
  tags?: string[];
  ttlSeconds?: number;
  temporary?: boolean;
}

export interface SearchMemoryInput {
  q?: string;
  tags?: string[];
  scope?: string;
  projectId?: string;
  agentId?: string;
  memoryType?: string;
  from?: string;
  to?: string;
  activeProjectId?: string;
  currentAgentId?: string;
  includeArchived?: boolean;
  includeBlocked?: boolean;
  limit?: number;
}

export interface MemorySearchResult extends MemoryItem {
  semanticScore: number;
  lexicalScore: number;
  priorityScore: number;
  finalScore: number;
}

export interface ReindexResult {
  processed: number;
  skipped: number;
  failed: number;
}

export interface MemoryMetrics {
  total: number;
  byScope: Record<string, number>;
  byProject: Array<{ projectId: string; count: number }>;
  orphans: number;
  duplicates: number;
  blocked: number;
  temporaryActive: number;
  archived: number;
  vectorIndexed: number;
}

interface MemoryRow {
  id: string;
  project_id: string | null;
  agent_id: string | null;
  scope: string;
  memory_type: string | null;
  content: string;
  source: string;
  created_by: string | null;
  timestamp: string;
  tags_json: string;
  updated_at: string | null;
  content_hash: string | null;
  duplicate_of: string | null;
  blocked: number;
  archived: number;
  archived_reason: string | null;
  expires_at: string | null;
}

interface EmbeddingRow {
  memory_id: string;
  embedding_dim: number;
  embedding_json: string;
  content_hash: string;
  embedding_provider: string | null;
  embedding_model: string | null;
  embedding_version: string | null;
}

export class MemoryService {
  constructor(
    private readonly eventBus: EventBus,
    private readonly connection: Database
  ) {}

  enableEventCapture() {
    this.eventBus.subscribe("task_created", async (event) => {
      await this.save(
        {
          ...(typeof event.payload.projectId === "string"
            ? { projectId: event.payload.projectId }
            : {}),
          agentId: "automation-engine",
          scope: "proyecto",
          memoryType: "evento",
          content: `Task creada: ${String(event.payload.taskTitle ?? event.payload.taskId)}`,
          source: "event:task_created",
          createdBy: "automation-engine",
          tags: ["event", "project", "task_created"]
        },
        event.correlationId ? { correlationId: event.correlationId } : {}
      );
    });

    this.eventBus.subscribe("chat_message_created", async (event) => {
      await this.save(
        {
          scope: "global",
          memoryType: "evento",
          agentId: "automation-engine",
          content: `Mensaje registrado en conversacion ${String(event.payload.conversationId)}`,
          source: "event:chat_message_created",
          createdBy: "automation-engine",
          tags: ["event", "chat", "chat_message_created"]
        },
        event.correlationId ? { correlationId: event.correlationId } : {}
      );
    });
  }

  async save(input: SaveMemoryInput, meta: { correlationId?: string } = {}) {
    const content = input.content?.trim();
    if (!content) {
      throw new AppError("content es requerido para save memory", 400);
    }

    const timestamp = input.timestamp ?? new Date().toISOString();
    const updatedAt = timestamp;
    const tags = input.tags ?? [];
    const contentHash = createContentHash(content, tags);

    const ttlSeconds =
      typeof input.ttlSeconds === "number" && input.ttlSeconds > 0
        ? input.ttlSeconds
        : input.temporary
          ? 24 * 60 * 60
          : undefined;
    const expiresAt =
      ttlSeconds && ttlSeconds > 0 ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null;
    const isNoise = shouldArchiveAsNoise(content, input.source, input.memoryType);

    const item: MemoryItem = {
      id: createId("memory"),
      ...(input.projectId ? { projectId: input.projectId } : {}),
      ...(input.agentId ? { agentId: input.agentId } : {}),
      scope: normalizeScope(input.scope),
      memoryType: input.memoryType ?? "contexto",
      content,
      source: input.source,
      ...(input.createdBy ? { createdBy: input.createdBy } : {}),
      timestamp,
      tags,
      updatedAt,
      contentHash,
      blocked: false,
      archived: isNoise,
      ...(isNoise ? { archivedReason: "noise" } : {}),
      ...(expiresAt ? { expiresAt } : {})
    };

    this.connection
      .prepare(
        `INSERT INTO memory_items (
          id, project_id, agent_id, scope, memory_type, content, source, created_by, timestamp, tags_json,
          updated_at, content_hash, duplicate_of, blocked, archived, archived_reason, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        item.id,
        item.projectId ?? null,
        item.agentId ?? null,
        item.scope,
        item.memoryType ?? null,
        item.content,
        item.source,
        item.createdBy ?? null,
        item.timestamp,
        JSON.stringify(item.tags),
        item.updatedAt ?? null,
        item.contentHash ?? null,
        null,
        0,
        isNoise ? 1 : 0,
        isNoise ? "noise" : null,
        item.expiresAt ?? null
      );

    await this.upsertEmbedding(item.id, item.content, item.contentHash ?? "", item.updatedAt ?? timestamp);

    const event: DomainEvent = {
      type: "memory_saved",
      payload: {
        memoryId: item.id,
        scope: item.scope,
        projectId: item.projectId ?? null,
        agentId: item.agentId ?? null
      },
      occurredAt: new Date().toISOString(),
      ...(meta.correlationId ? { correlationId: meta.correlationId } : {})
    };

    await this.eventBus.publish(event);
    return item;
  }

  async search(input: SearchMemoryInput): Promise<MemorySearchResult[]> {
    const rows = this.queryRows(input);
    const limit = input.limit && input.limit > 0 ? Math.min(input.limit, 200) : 25;
    const tags = input.tags?.filter(Boolean) ?? [];

    const filteredRows = rows.filter((row) => {
      if (tags.length > 0) {
        const rowTags = parseTags(row.tags_json);
        if (!tags.every((tag) => rowTags.includes(tag))) {
          return false;
        }
      }

      if (input.currentAgentId && row.scope === "privado" && row.agent_id !== input.currentAgentId) {
        return false;
      }

      return true;
    });

    const result = (await this.rankRows(filteredRows, input)).slice(0, limit);
    return result;
  }

  listAll() {
    return this.queryRows({ includeArchived: true }).map((row) => this.mapMemory(row));
  }

  async reindexIncremental(options: { limit?: number; since?: string } = {}): Promise<ReindexResult> {
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 10_000) : 1000;
    const rows = this.connection
      .prepare(
        `SELECT id, content, content_hash, updated_at
         FROM memory_items
         WHERE archived = 0
           AND (? IS NULL OR updated_at >= ?)
         ORDER BY updated_at DESC
         LIMIT ?`
      )
      .all(options.since ?? null, options.since ?? null, limit) as Array<{
      id: string;
      content: string;
      content_hash: string | null;
      updated_at: string | null;
    }>;

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const hash = row.content_hash ?? createContentHash(row.content, []);
        const existing = this.connection
          .prepare(
            `SELECT memory_id, embedding_dim, content_hash, embedding_provider, embedding_model, embedding_version
             FROM memory_embeddings
             WHERE memory_id = ?`
          )
          .get(row.id) as EmbeddingRow | undefined;

        if (
          existing &&
          existing.content_hash === hash &&
          existing.embedding_dim === embeddingDimension() &&
          (existing.embedding_version ?? null) === embeddingVersion() &&
          (existing.embedding_provider ?? null) === embeddingProvider() &&
          (existing.embedding_model ?? null) === embeddingModel()
        ) {
          skipped += 1;
          continue;
        }

        await this.upsertEmbedding(row.id, row.content, hash, row.updated_at ?? new Date().toISOString());
        processed += 1;
      } catch (_error) {
        failed += 1;
      }
    }

    return { processed, skipped, failed };
  }

  deduplicateMemories() {
    const rows = this.connection
      .prepare(
        `SELECT id, project_id, agent_id, scope, memory_type, content_hash, timestamp
         FROM memory_items
         WHERE archived = 0
         ORDER BY timestamp ASC`
      )
      .all() as Array<{
      id: string;
      project_id: string | null;
      agent_id: string | null;
      scope: string;
      memory_type: string | null;
      content_hash: string | null;
      timestamp: string;
    }>;

    const keepByKey = new Map<string, string>();
    let deduplicated = 0;
    const now = new Date().toISOString();

    for (const row of rows) {
      const hash = row.content_hash ?? "";
      if (!hash) {
        continue;
      }

      const key = `${row.project_id ?? "_"}|${row.agent_id ?? "_"}|${row.scope}|${row.memory_type ?? "_"}|${hash}`;
      const canonicalId = keepByKey.get(key);
      if (!canonicalId) {
        keepByKey.set(key, row.id);
        continue;
      }

      this.connection
        .prepare(
          `UPDATE memory_items
           SET duplicate_of = ?, archived = 1, archived_reason = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(canonicalId, "duplicate", now, row.id);
      deduplicated += 1;
    }

    return { deduplicated };
  }

  applyTtlAndArchive(nowIso = new Date().toISOString()) {
    const result = this.connection
      .prepare(
        `UPDATE memory_items
         SET archived = 1, archived_reason = ?, updated_at = ?
         WHERE archived = 0
           AND expires_at IS NOT NULL
           AND expires_at <= ?`
      )
      .run("ttl_expired", nowIso, nowIso);

    return { archived: result.changes };
  }

  cleanupProcessedEvents(maxAgeDays = 30) {
    const threshold = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
    const result = this.connection
      .prepare(
        `DELETE FROM processed_events
         WHERE processed_at < ?`
      )
      .run(threshold);

    return { deleted: result.changes, threshold };
  }

  promoteToGlobal(memoryId: string) {
    this.ensureMemoryExists(memoryId);
    this.connection
      .prepare(
        `UPDATE memory_items
         SET scope = ?, updated_at = ?
         WHERE id = ?`
      )
      .run("global", new Date().toISOString(), memoryId);
    return this.getById(memoryId);
  }

  forget(memoryId: string) {
    this.ensureMemoryExists(memoryId);
    this.connection
      .prepare(
        `UPDATE memory_items
         SET archived = 1, archived_reason = ?, updated_at = ?
         WHERE id = ?`
      )
      .run("forgotten", new Date().toISOString(), memoryId);
    return this.getById(memoryId);
  }

  block(memoryId: string) {
    this.ensureMemoryExists(memoryId);
    this.connection
      .prepare(
        `UPDATE memory_items
         SET blocked = 1, archived = 1, archived_reason = ?, updated_at = ?
         WHERE id = ?`
      )
      .run("blocked", new Date().toISOString(), memoryId);
    return this.getById(memoryId);
  }

  getMetrics(): MemoryMetrics {
    const total = (this.connection
      .prepare(
        `SELECT COUNT(1) as total
         FROM memory_items
         WHERE archived = 0`
      )
      .get() as { total: number }).total;

    const scopeRows = this.connection
      .prepare(
        `SELECT scope, COUNT(1) as count
         FROM memory_items
         WHERE archived = 0
         GROUP BY scope`
      )
      .all() as Array<{ scope: string; count: number }>;

    const byScope: Record<string, number> = {};
    for (const row of scopeRows) {
      byScope[row.scope] = row.count;
    }

    const byProject = this.connection
      .prepare(
        `SELECT COALESCE(project_id, 'none') as project_id, COUNT(1) as count
         FROM memory_items
         WHERE archived = 0
         GROUP BY project_id
         ORDER BY count DESC
         LIMIT 20`
      )
      .all() as Array<{ project_id: string; count: number }>;

    const orphans = (this.connection
      .prepare(
        `SELECT COUNT(1) as count
         FROM memory_items
         WHERE archived = 0
           AND scope = 'proyecto'
           AND project_id IS NULL`
      )
      .get() as { count: number }).count;

    const duplicates = (this.connection
      .prepare(
        `SELECT COUNT(1) as count
         FROM memory_items
         WHERE duplicate_of IS NOT NULL`
      )
      .get() as { count: number }).count;

    const blocked = (this.connection
      .prepare(
        `SELECT COUNT(1) as count
         FROM memory_items
         WHERE blocked = 1`
      )
      .get() as { count: number }).count;

    const archived = (this.connection
      .prepare(
        `SELECT COUNT(1) as count
         FROM memory_items
         WHERE archived = 1`
      )
      .get() as { count: number }).count;

    const temporaryActive = (this.connection
      .prepare(
        `SELECT COUNT(1) as count
         FROM memory_items
         WHERE archived = 0
           AND expires_at IS NOT NULL`
      )
      .get() as { count: number }).count;

    const vectorIndexed = (this.connection
      .prepare(
        `SELECT COUNT(1) as count
         FROM memory_embeddings`
      )
      .get() as { count: number }).count;

    return {
      total,
      byScope,
      byProject: byProject.map((row) => ({ projectId: row.project_id, count: row.count })),
      orphans,
      duplicates,
      blocked,
      temporaryActive,
      archived,
      vectorIndexed
    };
  }

  getById(memoryId: string) {
    const row = this.connection
      .prepare(
        `SELECT id, project_id, agent_id, scope, memory_type, content, source, created_by, timestamp, tags_json,
                updated_at, content_hash, duplicate_of, blocked, archived, archived_reason, expires_at
         FROM memory_items
         WHERE id = ?`
      )
      .get(memoryId) as MemoryRow | undefined;

    if (!row) {
      throw new NotFoundError(`Memory ${memoryId} no encontrada`);
    }

    return this.mapMemory(row);
  }

  private async rankRows(rows: MemoryRow[], input: SearchMemoryInput) {
    const query = input.q?.trim();
    const queryEmbedding = query ? await createEmbeddingAsync(query) : null;
    const localDimension = createEmbedding("").length;
    const embeddingMap = this.loadEmbeddings(rows.map((row) => row.id));

    const scored: MemorySearchResult[] = rows.map((row) => {
      const item = this.mapMemory(row);
      const lexical = query ? lexicalScore(query, item.content, item.tags) : 0;

      let semantic = 0;
      if (query && queryEmbedding) {
        const stored = embeddingMap.get(item.id);
        if (stored?.vector.length === queryEmbedding.length) {
          semantic = cosineSimilarity(queryEmbedding, stored.vector);
        } else if (queryEmbedding.length === localDimension) {
          semantic = cosineSimilarity(queryEmbedding, createEmbedding(item.content));
        }
      }

      let priority = 0;
      if (input.activeProjectId && item.projectId === input.activeProjectId) {
        priority += 0.22;
      }
      if (item.scope === "global") {
        priority += 0.1;
      }
      if (input.currentAgentId && item.agentId === input.currentAgentId) {
        priority += 0.16;
      }

      const finalScore = query ? semantic * 0.65 + lexical * 0.35 + priority : priority;
      return {
        ...item,
        semanticScore: Number(semantic.toFixed(4)),
        lexicalScore: Number(lexical.toFixed(4)),
        priorityScore: Number(priority.toFixed(4)),
        finalScore: Number(finalScore.toFixed(4))
      };
    });

    const filtered = query
      ? scored.filter((item) => item.lexicalScore > 0 || item.semanticScore >= 0.12)
      : scored;

    if (query) {
      filtered.sort((a, b) => b.finalScore - a.finalScore || b.timestamp.localeCompare(a.timestamp));
    } else {
      filtered.sort((a, b) => {
        const priorityDelta = b.priorityScore - a.priorityScore;
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        return b.timestamp.localeCompare(a.timestamp);
      });
    }

    return filtered;
  }

  private queryRows(input: SearchMemoryInput) {
    const rows = this.connection
      .prepare(
        `SELECT id, project_id, agent_id, scope, memory_type, content, source, created_by, timestamp, tags_json,
                updated_at, content_hash, duplicate_of, blocked, archived, archived_reason, expires_at
         FROM memory_items
         WHERE (? IS NULL OR scope = ?)
           AND (? IS NULL OR project_id = ?)
           AND (? IS NULL OR agent_id = ?)
           AND (? IS NULL OR memory_type = ?)
           AND (? IS NULL OR timestamp >= ?)
           AND (? IS NULL OR timestamp <= ?)
           AND (? = 1 OR archived = 0)
           AND (? = 1 OR blocked = 0)`
      )
      .all(
        input.scope ? normalizeScope(input.scope) : null,
        input.scope ? normalizeScope(input.scope) : null,
        input.projectId ?? null,
        input.projectId ?? null,
        input.agentId ?? null,
        input.agentId ?? null,
        input.memoryType ?? null,
        input.memoryType ?? null,
        input.from ?? null,
        input.from ?? null,
        input.to ?? null,
        input.to ?? null,
        input.includeArchived ? 1 : 0,
        input.includeBlocked ? 1 : 0
      ) as MemoryRow[];

    return rows;
  }

  private async upsertEmbedding(memoryId: string, content: string, contentHash: string, updatedAt: string) {
    const vector = await createEmbeddingAsync(content);
    this.connection
      .prepare(
        `INSERT INTO memory_embeddings (
          memory_id, embedding_dim, embedding_json, content_hash, updated_at, embedding_provider, embedding_model, embedding_version
        )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(memory_id) DO UPDATE SET
           embedding_dim = excluded.embedding_dim,
           embedding_json = excluded.embedding_json,
           content_hash = excluded.content_hash,
           updated_at = excluded.updated_at,
           embedding_provider = excluded.embedding_provider,
           embedding_model = excluded.embedding_model,
           embedding_version = excluded.embedding_version`
      )
      .run(
        memoryId,
        vector.length,
        JSON.stringify(vector),
        contentHash,
        updatedAt,
        embeddingProvider(),
        embeddingModel(),
        embeddingVersion()
      );
  }

  private loadEmbeddings(memoryIds: string[]) {
    const map = new Map<string, { vector: number[]; version: string | null; provider: string | null; model: string | null }>();
    if (memoryIds.length === 0) {
      return map;
    }

    const placeholders = memoryIds.map(() => "?").join(",");
    const rows = this.connection
      .prepare(
        `SELECT memory_id, embedding_dim, embedding_json, content_hash, embedding_provider, embedding_model, embedding_version
         FROM memory_embeddings
         WHERE memory_id IN (${placeholders})`
      )
      .all(...memoryIds) as EmbeddingRow[];

    for (const row of rows) {
      try {
        const vector = JSON.parse(row.embedding_json) as number[];
        if (!Array.isArray(vector) || vector.length !== row.embedding_dim) {
          continue;
        }
        map.set(row.memory_id, {
          vector,
          version: row.embedding_version ?? null,
          provider: row.embedding_provider ?? null,
          model: row.embedding_model ?? null
        });
      } catch {
        continue;
      }
    }

    return map;
  }

  private ensureMemoryExists(memoryId: string) {
    const row = this.connection
      .prepare(
        `SELECT id
         FROM memory_items
         WHERE id = ?`
      )
      .get(memoryId) as { id: string } | undefined;

    if (!row) {
      throw new NotFoundError(`Memory ${memoryId} no encontrada`);
    }
  }

  private mapMemory(row: MemoryRow): MemoryItem {
    return {
      id: row.id,
      ...(row.project_id ? { projectId: row.project_id } : {}),
      ...(row.agent_id ? { agentId: row.agent_id } : {}),
      scope: row.scope,
      ...(row.memory_type ? { memoryType: row.memory_type } : {}),
      content: row.content,
      source: row.source,
      ...(row.created_by ? { createdBy: row.created_by } : {}),
      timestamp: row.timestamp,
      tags: parseTags(row.tags_json),
      ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
      ...(row.content_hash ? { contentHash: row.content_hash } : {}),
      ...(row.duplicate_of ? { duplicateOf: row.duplicate_of } : {}),
      blocked: row.blocked === 1,
      archived: row.archived === 1,
      ...(row.archived_reason ? { archivedReason: row.archived_reason } : {}),
      ...(row.expires_at ? { expiresAt: row.expires_at } : {})
    };
  }
}

function parseTags(raw: string) {
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createContentHash(content: string, tags: string[]) {
  return createHash("sha1")
    .update(`${content.trim().toLowerCase()}|${tags.sort().join(",")}`)
    .digest("hex");
}

function shouldArchiveAsNoise(content: string, source: string, memoryType?: string) {
  if (memoryType && memoryType !== "contexto" && memoryType !== "evento") {
    return false;
  }

  const normalized = content.trim().toLowerCase();
  if (!source.includes("chat")) {
    return false;
  }

  const noisePatterns = [
    "hola",
    "buenos dias",
    "gracias",
    "ok",
    "vale",
    "jaja",
    "que tal",
    "como estas"
  ];

  return normalized.length <= 30 && noisePatterns.some((pattern) => normalized.includes(pattern));
}

function normalizeScope(scope: string) {
  if (scope === "project") {
    return "proyecto";
  }
  if (scope === "private") {
    return "privado";
  }
  return scope;
}
