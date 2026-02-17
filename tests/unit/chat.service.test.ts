import { describe, expect, it } from "vitest";
import { ChatService } from "../../src/chat/chat.service";
import { EventBus } from "../../src/shared/events/event-bus";
import { createDatabaseClient } from "../../src/shared/db/database";

describe("ChatService", () => {
  it("crea conversacion y envia/lista mensajes", async () => {
    const dbClient = createDatabaseClient(":memory:");
    const service = new ChatService(new EventBus(), dbClient.connection);
    const conversation = service.createConversation({
      title: "Conversacion de prueba",
      participants: [{ actorType: "user", actorId: "rai" }]
    });

    const message = await service.sendMessage(conversation.id, {
      role: "user",
      content: "Hola equipo",
      actorType: "user",
      actorId: "rai"
    });

    const messages = service.listMessages(conversation.id);
    const participants = service.listParticipants(conversation.id);

    expect(message.content).toBe("Hola equipo");
    expect(messages).toHaveLength(1);
    expect(participants.some((item) => item.actorId === "rai")).toBe(true);
    dbClient.close();
  });
});
