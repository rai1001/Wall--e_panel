import { AutomationService } from "./automation/automation.service";
import { ChatService } from "./chat/chat.service";
import { MemoryService } from "./memory/memory.service";
import { ProjectService } from "./project/project.service";
import { EventBus } from "./shared/events/event-bus";

export interface AppContext {
  eventBus: EventBus;
  chatService: ChatService;
  projectService: ProjectService;
  memoryService: MemoryService;
  automationService: AutomationService;
}

export function createAppContext(): AppContext {
  const eventBus = new EventBus();
  const chatService = new ChatService(eventBus);
  const projectService = new ProjectService(eventBus);
  const memoryService = new MemoryService(eventBus);
  const automationService = new AutomationService(eventBus, chatService, memoryService);
  memoryService.enableEventCapture();
  automationService.start();

  return {
    eventBus,
    chatService,
    projectService,
    memoryService,
    automationService
  };
}
