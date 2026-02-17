import { ChatService } from "../chat/chat.service";
import { MemoryService } from "../memory/memory.service";
import { hasSensitiveActions } from "../policy/approval";
import { DomainEvent, EventBus } from "../shared/events/event-bus";
import { ApprovalRequiredError, NotFoundError } from "../shared/http/errors";
import { createId } from "../shared/id";
import {
  Action,
  AutomationRule,
  DomainEventType,
  RunLog,
  Trigger
} from "../types/domain";

export interface CreateRuleInput {
  name: string;
  trigger: Trigger;
  actions: Action[];
  enabled?: boolean;
}

export interface TestRuleInput {
  eventType?: DomainEventType;
  eventPayload?: Record<string, unknown>;
  confirmed?: boolean;
}

export class AutomationService {
  private readonly rules: AutomationRule[] = [];
  private readonly runLogs: RunLog[] = [];
  private started = false;

  constructor(
    private readonly eventBus: EventBus,
    private readonly chatService: ChatService,
    private readonly memoryService: MemoryService
  ) {}

  start() {
    if (this.started) {
      return;
    }
    this.started = true;

    this.eventBus.subscribe("task_created", async (event) => {
      await this.handleEvent(event);
    });
    this.eventBus.subscribe("task_status_changed", async (event) => {
      await this.handleEvent(event);
    });
  }

  createRule(input: CreateRuleInput, confirmed = false) {
    if (hasSensitiveActions(input.actions) && !confirmed) {
      throw new ApprovalRequiredError(
        "La regla contiene acciones sensibles y requiere confirmacion explicita."
      );
    }

    const rule: AutomationRule = {
      id: createId("rule"),
      name: input.name,
      trigger: input.trigger,
      actions: input.actions,
      enabled: input.enabled ?? true
    };

    this.rules.push(rule);
    return rule;
  }

  listRules() {
    return [...this.rules];
  }

  listRunLogs() {
    return [...this.runLogs];
  }

  getRuleById(ruleId: string) {
    const rule = this.rules.find((candidate) => candidate.id === ruleId);
    if (!rule) {
      throw new NotFoundError(`Automation rule ${ruleId} no encontrada`);
    }
    return rule;
  }

  async testRule(ruleId: string, input: TestRuleInput = {}) {
    const rule = this.getRuleById(ruleId);
    if (hasSensitiveActions(rule.actions) && !input.confirmed) {
      throw new ApprovalRequiredError(
        "Test de regla sensible requiere confirmacion explicita."
      );
    }

    const event: DomainEvent = {
      type: input.eventType ?? rule.trigger.type,
      payload: input.eventPayload ?? {},
      occurredAt: new Date().toISOString()
    };

    await this.executeRule(rule, event);
    return this.runLogs[this.runLogs.length - 1];
  }

  private async handleEvent(event: DomainEvent) {
    const activeRules = this.rules.filter((rule) => rule.enabled);
    for (const rule of activeRules) {
      if (!this.matches(rule, event)) {
        continue;
      }

      await this.executeRule(rule, event);
    }
  }

  private matches(rule: AutomationRule, event: DomainEvent) {
    if (rule.trigger.type !== event.type) {
      return false;
    }

    if (!rule.trigger.filter) {
      return true;
    }

    for (const [key, value] of Object.entries(rule.trigger.filter)) {
      if (String(event.payload[key]) !== value) {
        return false;
      }
    }

    return true;
  }

  private async executeRule(rule: AutomationRule, event: DomainEvent) {
    const startedAt = new Date().toISOString();
    const runLog: RunLog = {
      id: createId("run"),
      ruleId: rule.id,
      status: "success",
      output: "ok",
      startedAt,
      finishedAt: startedAt
    };

    try {
      for (const action of rule.actions) {
        await this.executeAction(rule, action, event);
      }

      runLog.status = "success";
      runLog.output = `Regla ${rule.name} ejecutada`;
    } catch (error) {
      runLog.status = "failed";
      runLog.output = error instanceof Error ? error.message : "Unknown automation error";
    }

    runLog.finishedAt = new Date().toISOString();
    this.runLogs.push(runLog);

    await this.eventBus.publish({
      type: "automation_rule_executed",
      payload: {
        runLogId: runLog.id,
        ruleId: runLog.ruleId,
        status: runLog.status
      },
      occurredAt: new Date().toISOString()
    });
  }

  private async executeAction(rule: AutomationRule, action: Action, event: DomainEvent) {
    switch (action.type) {
      case "post_chat_message": {
        const payload = action.payload ?? {};
        const projectId = this.readString(event.payload.projectId);
        const conversationFromPayload = this.readString(payload.conversationId);

        let conversationId = conversationFromPayload;
        if (!conversationId && projectId) {
          const conversation = this.chatService.findConversationByProjectId(projectId);
          if (conversation) {
            conversationId = conversation.id;
          } else {
            conversationId = this.chatService.createSystemConversationForProject(projectId).id;
          }
        }

        if (!conversationId) {
          throw new NotFoundError(
            "No se encontro conversationId para ejecutar post_chat_message"
          );
        }

        const defaultContent = `Task creada: ${this.readString(event.payload.taskTitle) ?? this.readString(event.payload.taskId) ?? "sin titulo"} (${rule.name})`;
        const content = this.readString(payload.content) ?? defaultContent;

        await this.chatService.sendMessage(conversationId, {
          role: "system",
          content,
          actorType: "system",
          actorId: "automation-engine"
        });
        return;
      }
      case "save_memory": {
        const payload = action.payload ?? {};
        const projectId = this.readString(event.payload.projectId);
        const tagsFromPayload = Array.isArray(payload.tags)
          ? payload.tags.map((tag) => String(tag))
          : [];

        await this.memoryService.save({
          scope: this.readString(payload.scope) ?? (projectId ? "project" : "global"),
          content:
            this.readString(payload.content) ??
            `Automatizacion ${rule.name} ejecutada por ${event.type}`,
          source: this.readString(payload.source) ?? `automation:${rule.id}`,
          tags: tagsFromPayload.length > 0 ? tagsFromPayload : ["automation", event.type]
        });
        return;
      }
      default: {
        throw new Error(`Tipo de accion no soportado en Day 1: ${action.type}`);
      }
    }
  }

  private readString(value: unknown): string | undefined {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }

    return undefined;
  }
}
