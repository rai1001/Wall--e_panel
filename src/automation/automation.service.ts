import { createHash } from "node:crypto";
import { Database } from "better-sqlite3";
import { ChatService } from "../chat/chat.service";
import { MemoryService } from "../memory/memory.service";
import { DomainEvent, EventBus } from "../shared/events/event-bus";
import { AppError, NotFoundError } from "../shared/http/errors";
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
}

interface RuleRow {
  id: string;
  name: string;
  trigger_type: DomainEventType;
  trigger_filter_json: string | null;
  actions_json: string;
  enabled: number;
}

interface RunLogRow {
  id: string;
  rule_id: string;
  event_key: string;
  status: "success" | "failed";
  output: string;
  attempts: number;
  started_at: string;
  finished_at: string;
}

export class AutomationService {
  private started = false;

  constructor(
    private readonly eventBus: EventBus,
    private readonly chatService: ChatService,
    private readonly memoryService: MemoryService,
    private readonly connection: Database
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

  createRule(input: CreateRuleInput) {
    const name = input.name?.trim();
    if (!name) {
      throw new AppError("name es requerido para crear regla", 400);
    }
    if (!Array.isArray(input.actions) || input.actions.length === 0) {
      throw new AppError("actions debe contener al menos una accion", 400);
    }

    const rule: AutomationRule = {
      id: createId("rule"),
      name,
      trigger: input.trigger,
      actions: input.actions,
      enabled: input.enabled ?? true
    };

    this.connection
      .prepare(
        `INSERT INTO automation_rules (id, name, trigger_type, trigger_filter_json, actions_json, enabled)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        rule.id,
        rule.name,
        rule.trigger.type,
        rule.trigger.filter ? JSON.stringify(rule.trigger.filter) : null,
        JSON.stringify(rule.actions),
        rule.enabled ? 1 : 0
      );

    return rule;
  }

  listRules() {
    const rows = this.connection
      .prepare(
        `SELECT id, name, trigger_type, trigger_filter_json, actions_json, enabled
         FROM automation_rules
         ORDER BY id DESC`
      )
      .all() as RuleRow[];
    return rows.map((row) => this.mapRule(row));
  }

  listRunLogs() {
    const rows = this.connection
      .prepare(
        `SELECT id, rule_id, event_key, status, output, attempts, started_at, finished_at
         FROM run_logs
         ORDER BY started_at DESC`
      )
      .all() as RunLogRow[];
    return rows.map((row) => this.mapRunLog(row));
  }

  getRuleById(ruleId: string) {
    const row = this.connection
      .prepare(
        `SELECT id, name, trigger_type, trigger_filter_json, actions_json, enabled
         FROM automation_rules
         WHERE id = ?`
      )
      .get(ruleId) as RuleRow | undefined;

    if (!row) {
      throw new NotFoundError(`Automation rule ${ruleId} no encontrada`);
    }
    return this.mapRule(row);
  }

  async testRule(ruleId: string, input: TestRuleInput = {}) {
    const rule = this.getRuleById(ruleId);
    const event: DomainEvent = {
      type: input.eventType ?? rule.trigger.type,
      payload: input.eventPayload ?? {},
      occurredAt: new Date().toISOString()
    };

    await this.executeRule(rule, event, `${this.buildEventKey(rule, event)}:manual_test`);
    return this.listRunLogs()[0];
  }

  private async handleEvent(event: DomainEvent) {
    const activeRules = this.listRules().filter((rule) => rule.enabled);
    for (const rule of activeRules) {
      if (!this.matches(rule, event)) {
        continue;
      }

      const eventKey = this.buildEventKey(rule, event);
      if (this.isAlreadyProcessed(eventKey)) {
        continue;
      }

      await this.executeRule(rule, event, eventKey);
      this.markAsProcessed(eventKey);
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

  private async executeRule(rule: AutomationRule, event: DomainEvent, eventKey: string) {
    const startedAt = new Date().toISOString();
    let attempts = 0;
    let status: "success" | "failed" = "success";
    let output = `Regla ${rule.name} ejecutada`;

    try {
      for (const action of rule.actions) {
        let actionAttempt = 0;
        const maxAttempts = this.resolveMaxAttempts(action);
        let done = false;

        while (!done) {
          actionAttempt += 1;
          attempts += 1;
          try {
            await this.executeAction(rule, action, event, actionAttempt);
            done = true;
          } catch (error) {
            if (actionAttempt >= maxAttempts) {
              throw error;
            }
          }
        }
      }
    } catch (error) {
      status = "failed";
      output = error instanceof Error ? error.message : "Unknown automation error";
    }

    const runLog: RunLog = {
      id: createId("run"),
      ruleId: rule.id,
      eventKey,
      status,
      output,
      attempts,
      startedAt,
      finishedAt: new Date().toISOString()
    };

    this.connection
      .prepare(
        `INSERT INTO run_logs (id, rule_id, event_key, status, output, attempts, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        runLog.id,
        runLog.ruleId,
        runLog.eventKey ?? "",
        runLog.status,
        runLog.output,
        runLog.attempts ?? 0,
        runLog.startedAt,
        runLog.finishedAt
      );

    await this.eventBus.publish({
      type: "automation_rule_executed",
      payload: {
        runLogId: runLog.id,
        ruleId: runLog.ruleId,
        status: runLog.status,
        eventKey
      },
      occurredAt: new Date().toISOString()
    });
  }

  private resolveMaxAttempts(action: Action) {
    const payloadAttempts = action.payload?.maxAttempts;
    if (typeof payloadAttempts === "number" && payloadAttempts > 0 && payloadAttempts <= 5) {
      return Math.floor(payloadAttempts);
    }
    return 3;
  }

  private async executeAction(
    rule: AutomationRule,
    action: Action,
    event: DomainEvent,
    actionAttempt: number
  ) {
    switch (action.type) {
      case "post_chat_message": {
        const payload = action.payload ?? {};
        const projectId = this.readString(event.payload.projectId);
        const conversationFromPayload = this.readString(payload.conversationId);

        let conversationId = conversationFromPayload;
        if (!conversationId && projectId) {
          const conversation = this.chatService.findConversationByProjectId(projectId);
          conversationId = conversation
            ? conversation.id
            : this.chatService.createSystemConversationForProject(projectId).id;
        }

        if (!conversationId) {
          throw new NotFoundError(
            "No se encontro conversationId para ejecutar post_chat_message"
          );
        }

        const defaultContent = `Task creada: ${this.readString(event.payload.taskTitle) ?? this.readString(event.payload.taskId) ?? "sin titulo"} (${rule.name})`;
        const content = this.readString(payload.content) ?? defaultContent;

        if (payload.failOnce === true && actionAttempt === 1) {
          throw new Error("Simulated transient error in post_chat_message");
        }

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

        if (payload.failOnce === true && actionAttempt === 1) {
          throw new Error("Simulated transient error in save_memory");
        }

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
      case "external_action":
      case "shell_execution":
      case "mass_messaging":
      case "remote_action":
        throw new Error(`Accion sensible ${action.type} requiere integracion externa (Day 3+)`);
      default: {
        const exhaustive: never = action.type;
        throw new Error(`Tipo de accion no soportado: ${String(exhaustive)}`);
      }
    }
  }

  private buildEventKey(rule: AutomationRule, event: DomainEvent) {
    const taskId = this.readString(event.payload.taskId) ?? "";
    const projectId = this.readString(event.payload.projectId) ?? "";
    const raw = JSON.stringify(event.payload);
    const hash = createHash("sha1").update(raw).digest("hex").slice(0, 12);
    return `${rule.id}:${event.type}:${projectId}:${taskId}:${hash}`;
  }

  private isAlreadyProcessed(eventKey: string) {
    const row = this.connection
      .prepare(
        `SELECT event_key
         FROM processed_events
         WHERE event_key = ?`
      )
      .get(eventKey) as { event_key: string } | undefined;
    return Boolean(row);
  }

  private markAsProcessed(eventKey: string) {
    this.connection
      .prepare(
        `INSERT OR IGNORE INTO processed_events (event_key, processed_at)
         VALUES (?, ?)`
      )
      .run(eventKey, new Date().toISOString());
  }

  private mapRule(row: RuleRow): AutomationRule {
    return {
      id: row.id,
      name: row.name,
      trigger: {
        type: row.trigger_type,
        ...(row.trigger_filter_json
          ? { filter: JSON.parse(row.trigger_filter_json) as Record<string, string> }
          : {})
      },
      actions: JSON.parse(row.actions_json) as Action[],
      enabled: row.enabled === 1
    };
  }

  private mapRunLog(row: RunLogRow): RunLog {
    return {
      id: row.id,
      ruleId: row.rule_id,
      eventKey: row.event_key,
      status: row.status,
      output: row.output,
      attempts: row.attempts,
      startedAt: row.started_at,
      finishedAt: row.finished_at
    };
  }

  private readString(value: unknown): string | undefined {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
    return undefined;
  }
}
