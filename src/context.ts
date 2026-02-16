import { ChatService } from "./chat/chat.service";
import { ProjectService } from "./project/project.service";
import { EventBus } from "./shared/events/event-bus";

export interface AppContext {
  eventBus: EventBus;
  chatService: ChatService;
  projectService: ProjectService;
}

export function createAppContext(): AppContext {
  const eventBus = new EventBus();
  const chatService = new ChatService(eventBus);
  const projectService = new ProjectService(eventBus);

  return {
    eventBus,
    chatService,
    projectService
  };
}
