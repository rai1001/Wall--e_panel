import { ChatService } from "./chat/chat.service";
import { EventBus } from "./shared/events/event-bus";

export interface AppContext {
  eventBus: EventBus;
  chatService: ChatService;
}

export function createAppContext(): AppContext {
  const eventBus = new EventBus();
  const chatService = new ChatService(eventBus);

  return {
    eventBus,
    chatService
  };
}
