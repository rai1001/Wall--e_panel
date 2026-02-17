import { Database } from "better-sqlite3";
import { createId } from "../shared/id";
import { AppError, NotFoundError } from "../shared/http/errors";
import { Conversation, Message, MessageRole, Participant } from "../types/domain";
import { DomainEvent, EventBus } from "../shared/events/event-bus";

export interface CreateConversationInput {
  title: string;
  projectId?: string;
  participants?: Array<{ actorType: string; actorId: string }>;
}

export interface SendMessageInput {
  role: MessageRole;
  content: string;
  actorType?: string;
  actorId?: string;
}

interface ConversationRow {
  id: string;
  project_id: string | null;
  title: string;
  created_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

interface TimelineRow {
  message_id: string;
  conversation_id: string;
  project_id: string | null;
  conversation_title: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

interface ParticipantRow {
  id: string;
  conversation_id: string;
  actor_type: string;
  actor_id: string;
}

export interface ChatTimelineInput {
  projectId?: string;
  conversationId?: string;
  role?: MessageRole;
  from?: string;
  to?: string;
  limit?: number;
}

export interface ChatTimelineEntry {
  id: string;
  eventType: "chat_message_created";
  messageId: string;
  conversationId: string;
  conversationTitle: string;
  projectId?: string;
  role: MessageRole;
  content: string;
  timestamp: string;
}

export class ChatService {
  constructor(
    private readonly eventBus: EventBus,
    private readonly connection: Database
  ) {}

  createConversation(input: CreateConversationInput) {
    const title = input.title?.trim();
    if (!title) {
      throw new AppError("title es requerido para crear conversacion", 400);
    }

    const conversation: Conversation = {
      id: createId("conv"),
      title,
      createdAt: new Date().toISOString(),
      ...(input.projectId ? { projectId: input.projectId } : {})
    };

    this.connection
      .prepare(
        `INSERT INTO conversations (id, project_id, title, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(conversation.id, conversation.projectId ?? null, conversation.title, conversation.createdAt);

    const insertParticipant = this.connection.prepare(
      `INSERT INTO participants (id, conversation_id, actor_type, actor_id)
       VALUES (?, ?, ?, ?)`
    );

    for (const participant of input.participants ?? []) {
      insertParticipant.run(
        createId("participant"),
        conversation.id,
        participant.actorType,
        participant.actorId
      );
    }

    return conversation;
  }

  getConversationById(conversationId: string) {
    const row = this.connection
      .prepare(
        `SELECT id, project_id, title, created_at
         FROM conversations
         WHERE id = ?`
      )
      .get(conversationId) as ConversationRow | undefined;

    if (!row) {
      throw new NotFoundError(`Conversation ${conversationId} no encontrada`);
    }

    return this.mapConversation(row);
  }

  findConversationByProjectId(projectId: string) {
    const row = this.connection
      .prepare(
        `SELECT id, project_id, title, created_at
         FROM conversations
         WHERE project_id = ?
         ORDER BY created_at ASC
         LIMIT 1`
      )
      .get(projectId) as ConversationRow | undefined;

    return row ? this.mapConversation(row) : undefined;
  }

  createSystemConversationForProject(projectId: string) {
    return this.createConversation({
      title: `Proyecto ${projectId} - Conversacion`,
      projectId,
      participants: [{ actorType: "system", actorId: "automation-engine" }]
    });
  }

  async sendMessage(
    conversationId: string,
    input: SendMessageInput,
    meta: { correlationId?: string } = {}
  ) {
    this.getConversationById(conversationId);
    const content = input.content?.trim();
    if (!content) {
      throw new AppError("content es requerido para enviar mensaje", 400);
    }

    const message: Message = {
      id: createId("msg"),
      conversationId,
      role: input.role,
      content,
      createdAt: new Date().toISOString()
    };

    this.connection
      .prepare(
        `INSERT INTO messages (id, conversation_id, role, content, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(message.id, message.conversationId, message.role, message.content, message.createdAt);

    if (input.actorType && input.actorId) {
      const exists = this.connection
        .prepare(
          `SELECT 1
           FROM participants
           WHERE conversation_id = ? AND actor_type = ? AND actor_id = ?
           LIMIT 1`
        )
        .get(conversationId, input.actorType, input.actorId) as { 1: number } | undefined;

      if (!exists) {
        this.connection
          .prepare(
            `INSERT INTO participants (id, conversation_id, actor_type, actor_id)
             VALUES (?, ?, ?, ?)`
          )
          .run(createId("participant"), conversationId, input.actorType, input.actorId);
      }
    }

    const event: DomainEvent = {
      type: "chat_message_created",
      payload: {
        messageId: message.id,
        conversationId: message.conversationId,
        role: message.role
      },
      occurredAt: new Date().toISOString(),
      ...(meta.correlationId ? { correlationId: meta.correlationId } : {})
    };

    await this.eventBus.publish(event);
    return message;
  }

  listMessages(conversationId: string) {
    this.getConversationById(conversationId);

    const rows = this.connection
      .prepare(
        `SELECT id, conversation_id, role, content, created_at
         FROM messages
         WHERE conversation_id = ?
         ORDER BY created_at ASC`
      )
      .all(conversationId) as MessageRow[];

    return rows.map((row) => this.mapMessage(row));
  }

  listParticipants(conversationId: string) {
    this.getConversationById(conversationId);

    const rows = this.connection
      .prepare(
        `SELECT id, conversation_id, actor_type, actor_id
         FROM participants
         WHERE conversation_id = ?`
      )
      .all(conversationId) as ParticipantRow[];

    return rows.map((row) => this.mapParticipant(row));
  }

  listTimeline(input: ChatTimelineInput = {}): ChatTimelineEntry[] {
    const limit = input.limit && input.limit > 0 ? Math.min(input.limit, 200) : 50;

    const rows = this.connection
      .prepare(
        `SELECT
           m.id as message_id,
           m.conversation_id,
           c.project_id,
           c.title as conversation_title,
           m.role,
           m.content,
           m.created_at
         FROM messages m
         INNER JOIN conversations c
           ON c.id = m.conversation_id
         WHERE (? IS NULL OR c.project_id = ?)
           AND (? IS NULL OR m.conversation_id = ?)
           AND (? IS NULL OR m.role = ?)
           AND (? IS NULL OR m.created_at >= ?)
           AND (? IS NULL OR m.created_at <= ?)
         ORDER BY m.created_at DESC
         LIMIT ?`
      )
      .all(
        input.projectId ?? null,
        input.projectId ?? null,
        input.conversationId ?? null,
        input.conversationId ?? null,
        input.role ?? null,
        input.role ?? null,
        input.from ?? null,
        input.from ?? null,
        input.to ?? null,
        input.to ?? null,
        limit
      ) as TimelineRow[];

    return rows.map((row) => ({
      id: row.message_id,
      eventType: "chat_message_created",
      messageId: row.message_id,
      conversationId: row.conversation_id,
      conversationTitle: row.conversation_title,
      ...(row.project_id ? { projectId: row.project_id } : {}),
      role: row.role,
      content: row.content,
      timestamp: row.created_at
    }));
  }

  private mapConversation(row: ConversationRow): Conversation {
    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      ...(row.project_id ? { projectId: row.project_id } : {})
    };
  }

  private mapMessage(row: MessageRow): Message {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at
    };
  }

  private mapParticipant(row: ParticipantRow): Participant {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      actorType: row.actor_type,
      actorId: row.actor_id
    };
  }
}
