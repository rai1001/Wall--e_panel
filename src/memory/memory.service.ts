import { DomainEvent, EventBus } from "../shared/events/event-bus";
import { createId } from "../shared/id";
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

export class MemoryService {
  private readonly items: MemoryItem[] = [];

  constructor(private readonly eventBus: EventBus) {}

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
    const item: MemoryItem = {
      id: createId("memory"),
      scope: input.scope,
      content: input.content,
      source: input.source,
      timestamp: input.timestamp ?? new Date().toISOString(),
      tags: input.tags ?? []
    };

    this.items.push(item);

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
    const query = input.q?.trim().toLowerCase();
    const tags = input.tags?.filter(Boolean) ?? [];

    return this.items.filter((item) => {
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
    return [...this.items];
  }
}
