import { createId } from "../shared/id";
import { NotFoundError } from "../shared/http/errors";
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

export class ChatService {
  private readonly conversations: Conversation[] = [];
  private readonly messages: Message[] = [];
  private readonly participants: Participant[] = [];

  constructor(private readonly eventBus: EventBus) {}

  createConversation(input: CreateConversationInput) {
    const conversation: Conversation = {
      id: createId("conv"),
      title: input.title,
      createdAt: new Date().toISOString(),
      ...(input.projectId ? { projectId: input.projectId } : {})
    };

    this.conversations.push(conversation);

    for (const participant of input.participants ?? []) {
      this.participants.push({
        id: createId("participant"),
        conversationId: conversation.id,
        actorType: participant.actorType,
        actorId: participant.actorId
      });
    }

    return conversation;
  }

  getConversationById(conversationId: string) {
    const conversation = this.conversations.find((item) => item.id === conversationId);
    if (!conversation) {
      throw new NotFoundError(`Conversation ${conversationId} no encontrada`);
    }

    return conversation;
  }

  findConversationByProjectId(projectId: string) {
    return this.conversations.find((item) => item.projectId === projectId);
  }

  createSystemConversationForProject(projectId: string) {
    return this.createConversation({
      title: `Proyecto ${projectId} - Conversacion`,
      projectId,
      participants: [{ actorType: "system", actorId: "automation-engine" }]
    });
  }

  async sendMessage(conversationId: string, input: SendMessageInput) {
    this.getConversationById(conversationId);

    const message: Message = {
      id: createId("msg"),
      conversationId,
      role: input.role,
      content: input.content,
      createdAt: new Date().toISOString()
    };

    this.messages.push(message);

    if (input.actorType && input.actorId) {
      const alreadyExists = this.participants.some(
        (participant) =>
          participant.conversationId === conversationId &&
          participant.actorType === input.actorType &&
          participant.actorId === input.actorId
      );

      if (!alreadyExists) {
        this.participants.push({
          id: createId("participant"),
          conversationId,
          actorType: input.actorType,
          actorId: input.actorId
        });
      }
    }

    const event: DomainEvent = {
      type: "chat_message_created",
      payload: {
        messageId: message.id,
        conversationId: message.conversationId,
        role: message.role
      },
      occurredAt: new Date().toISOString()
    };

    await this.eventBus.publish(event);

    return message;
  }

  listMessages(conversationId: string) {
    this.getConversationById(conversationId);
    return this.messages.filter((message) => message.conversationId === conversationId);
  }

  listParticipants(conversationId: string) {
    this.getConversationById(conversationId);
    return this.participants.filter((participant) => participant.conversationId === conversationId);
  }
}
