import { AutomationService } from "./automation/automation.service";
import { ChatService } from "./chat/chat.service";
import { MemoryService } from "./memory/memory.service";
import { MetricsService } from "./ops/metrics.service";
import { ApprovalService } from "./policy/approval.service";
import { AuditService } from "./policy/audit.service";
import { AuthService } from "./policy/auth.service";
import { ProjectService } from "./project/project.service";
import { createDatabaseClient, DatabaseClient } from "./shared/db/database";
import { EventBus } from "./shared/events/event-bus";
import { RateLimiter } from "./shared/http/rate-limit";

export interface AppContext {
  dbClient: DatabaseClient;
  eventBus: EventBus;
  authService: AuthService;
  approvalService: ApprovalService;
  auditService: AuditService;
  metricsService: MetricsService;
  rateLimiter: RateLimiter;
  chatService: ChatService;
  projectService: ProjectService;
  memoryService: MemoryService;
  automationService: AutomationService;
  dispose: () => void;
}

export interface AppContextOptions {
  dbPath?: string;
}

export function createAppContext(options: AppContextOptions = {}): AppContext {
  const dbClient = createDatabaseClient(options.dbPath);
  const eventBus = new EventBus();
  const authService = new AuthService(dbClient.connection);
  const approvalService = new ApprovalService(dbClient.connection);
  const auditService = new AuditService(dbClient.connection);
  const metricsService = new MetricsService();
  const configuredRateLimitStore = (process.env.RATE_LIMIT_STORE ?? "db").toLowerCase();
  const rateLimiter = new RateLimiter({
    backend: configuredRateLimitStore === "memory" ? "memory" : "db",
    connection: dbClient.connection
  });
  const chatService = new ChatService(eventBus, dbClient.connection);
  const projectService = new ProjectService(eventBus, dbClient.connection);
  const memoryService = new MemoryService(eventBus, dbClient.connection);
  const automationService = new AutomationService(
    eventBus,
    chatService,
    memoryService,
    dbClient.connection,
    metricsService
  );

  memoryService.enableEventCapture();
  automationService.start();

  return {
    dbClient,
    eventBus,
    authService,
    approvalService,
    auditService,
    metricsService,
    rateLimiter,
    chatService,
    projectService,
    memoryService,
    automationService,
    dispose: () => {
      dbClient.close();
    }
  };
}
