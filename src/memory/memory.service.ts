import { Database } from "better-sqlite3";
import { DomainEvent, EventBus } from "../shared/events/event-bus";
import { createId } from "../shared/id";
import { AppError } from "../shared/http/errors";
import { MemoryItem } from "../types/domain";

export interface SaveMemoryInput {
  scope: string;
  content: string;
  source: string;
  timestamp?: string;
  tags?: string[];
}

export interface SearchMemoryInput {
  q?: string;
  tags?: string[];
  scope?: string;
}

interface MemoryRow {
  id: string;
  scope: string;
  content: string;
  source: string;
  timestamp: string;
  tags_json: string;
}

export class MemoryService {
  constructor(
    private readonly eventBus: EventBus,
    private readonly connection: Database
  ) {}

  enableEventCapture() {
    this.eventBus.subscribe("task_created", async (event) => {
      await this.save({
        scope: "project",
        content: `Task creada: ${String(event.payload.taskTitle ?? event.payload.taskId)}`,
        source: "event:task_created",
        tags: ["event", "project", "task_created"]
      });
    });

    this.eventBus.subscribe("chat_message_created", async (event) => {
      await this.save({
        scope: "chat",
        content: `Mensaje registrado en conversacion ${String(event.payload.conversationId)}`,
        source: "event:chat_message_created",
        tags: ["event", "chat", "chat_message_created"]
      });
    });
  }

  async save(input: SaveMemoryInput) {
    const content = input.content?.trim();
    if (!content) {
      throw new AppError("content es requerido para save memory", 400);
    }

    const item: MemoryItem = {
      id: createId("memory"),
      scope: input.scope,
      content,
      source: input.source,
      timestamp: input.timestamp ?? new Date().toISOString(),
      tags: input.tags ?? []
    };

    this.connection
      .prepare(
        `INSERT INTO memory_items (id, scope, content, source, timestamp, tags_json)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        item.id,
        item.scope,
        item.content,
        item.source,
        item.timestamp,
        JSON.stringify(item.tags)
      );

    const event: DomainEvent = {
      type: "memory_saved",
      payload: {
        memoryId: item.id,
        scope: item.scope
      },
      occurredAt: new Date().toISOString()
    };

    await this.eventBus.publish(event);
    return item;
  }

  search(input: SearchMemoryInput) {
    const rows = this.connection
      .prepare(
        `SELECT id, scope, content, source, timestamp, tags_json
         FROM memory_items
         ORDER BY timestamp DESC`
      )
      .all() as MemoryRow[];

    const query = input.q?.trim().toLowerCase();
    const tags = input.tags?.filter(Boolean) ?? [];

    return rows
      .map((row) => this.mapMemory(row))
      .filter((item) => {
        if (input.scope && item.scope !== input.scope) {
          return false;
        }
        if (query && !item.content.toLowerCase().includes(query)) {
          return false;
        }
        if (tags.length > 0 && !tags.every((tag) => item.tags.includes(tag))) {
          return false;
        }
        return true;
      });
  }

  listAll() {
    const rows = this.connection
      .prepare(
        `SELECT id, scope, content, source, timestamp, tags_json
         FROM memory_items
         ORDER BY timestamp DESC`
      )
      .all() as MemoryRow[];
    return rows.map((row) => this.mapMemory(row));
  }

  private mapMemory(row: MemoryRow): MemoryItem {
    return {
      id: row.id,
      scope: row.scope,
      content: row.content,
      source: row.source,
      timestamp: row.timestamp,
      tags: JSON.parse(row.tags_json) as string[]
    };
  }
}
