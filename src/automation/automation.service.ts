import { createHash } from "node:crypto";
import cron, { ScheduledTask } from "node-cron";
import { Database } from "better-sqlite3";
import { ChatService } from "../chat/chat.service";
import { MemoryService } from "../memory/memory.service";
import { MetricsService } from "../ops/metrics.service";
import { DomainEvent, EventBus } from "../shared/events/event-bus";
import { AppError, NotFoundError } from "../shared/http/errors";
import { createId } from "../shared/id";
import { redactSensitiveData } from "../shared/security/redaction";
import {
  Action,
  AutomationRule,
  DeadLetter,
  DomainEventType,
  RunLog,
  Trigger,
  TriggerCondition
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
  correlationId?: string;
}

interface RuleRow {
  id: string;
  name: string;
  trigger_type: DomainEventType;
  trigger_filter_json: string | null;
  trigger_mode: "AND" | "OR" | null;
  trigger_conditions_json: string | null;
  trigger_cron: string | null;
  actions_json: string;
  enabled: number;
}

interface RunLogRow {
  id: string;
  rule_id: string;
  event_key: string;
  correlation_id: string | null;
  status: "success" | "failed";
  output: string;
  attempts: number;
  started_at: string;
  finished_at: string;
}

interface DeadLetterRow {
  id: string;
  rule_id: string;
  event_key: string;
  reason: string;
  payload_json: string;
  correlation_id: string | null;
  created_at: string;
}

export class AutomationService {
  private started = false;
  private readonly scheduledTasks = new Map<string, ScheduledTask>();

  constructor(
    private readonly eventBus: EventBus,
    private readonly chatService: ChatService,
    private readonly memoryService: MemoryService,
    private readonly connection: Database,
    private readonly metricsService: MetricsService
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

    this.scheduleCronRules();
  }

  createRule(input: CreateRuleInput) {
    const name = input.name?.trim();
    if (!name) {
      throw new AppError("name es requerido para crear regla", 400);
    }
    if (!Array.isArray(input.actions) || input.actions.length === 0) {
      throw new AppError("actions debe contener al menos una accion", 400);
    }
    if (input.trigger.type === "scheduled_tick") {
      if (!input.trigger.cron || !cron.validate(input.trigger.cron)) {
        throw new AppError("Reglas scheduled_tick requieren trigger.cron valido", 422);
      }
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
        `INSERT INTO automation_rules (
          id, name, trigger_type, trigger_filter_json, trigger_mode, trigger_conditions_json, trigger_cron, actions_json, enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        rule.id,
        rule.name,
        rule.trigger.type,
        rule.trigger.filter ? JSON.stringify(rule.trigger.filter) : null,
        rule.trigger.mode ?? null,
        rule.trigger.conditions ? JSON.stringify(rule.trigger.conditions) : null,
        rule.trigger.cron ?? null,
        JSON.stringify(rule.actions),
        rule.enabled ? 1 : 0
      );

    if (rule.enabled) {
      this.scheduleRule(rule);
    }

    return rule;
  }

  listRules() {
    const rows = this.connection
      .prepare(
        `SELECT id, name, trigger_type, trigger_filter_json, trigger_mode, trigger_conditions_json, trigger_cron, actions_json, enabled
         FROM automation_rules
         ORDER BY id DESC`
      )
      .all() as RuleRow[];
    return rows.map((row) => this.mapRule(row));
  }

  listRunLogs() {
    const rows = this.connection
      .prepare(
        `SELECT id, rule_id, event_key, correlation_id, status, output, attempts, started_at, finished_at
         FROM run_logs
         ORDER BY started_at DESC`
      )
      .all() as RunLogRow[];
    return rows.map((row) => this.mapRunLog(row));
  }

  listDeadLetters() {
    const rows = this.connection
      .prepare(
        `SELECT id, rule_id, event_key, reason, payload_json, correlation_id, created_at
         FROM dead_letters
         ORDER BY created_at DESC`
      )
      .all() as DeadLetterRow[];

    return rows.map((row) => this.mapDeadLetter(row));
  }

  projectHeartbeats(options: { windowMinutes?: number; bucketSeconds?: number } = {}) {
    const windowMinutes = Math.max(5, Math.min(240, Math.floor(options.windowMinutes ?? 30)));
    const bucketSeconds = Math.max(10, Math.min(300, Math.floor(options.bucketSeconds ?? 60)));
    const bucketMs = bucketSeconds * 1000;
    const nowMs = Date.now();
    const fromIso = new Date(nowMs - windowMinutes * 60_000).toISOString();

    const rows = this.connection
      .prepare(
        `SELECT id, rule_id, event_key, correlation_id, status, output, attempts, started_at, finished_at
         FROM run_logs
         WHERE started_at >= ?
         ORDER BY started_at ASC`
      )
      .all(fromIso) as RunLogRow[];

    const projectSeries = new Map<string, Map<number, number>>();
    for (const row of rows) {
      const startedAtMs = new Date(row.started_at).getTime();
      if (Number.isNaN(startedAtMs)) {
        continue;
      }

      const projectId = this.extractProjectIdFromEventKey(row.event_key) ?? "sin_proyecto";
      const bucket = Math.floor(startedAtMs / bucketMs) * bucketMs;
      const buckets = projectSeries.get(projectId) ?? new Map<number, number>();
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
      projectSeries.set(projectId, buckets);
    }

    const activeCutoff = nowMs - bucketMs * 2;
    const projects = Array.from(projectSeries.entries())
      .map(([projectId, buckets]) => {
        const series = Array.from(buckets.entries())
          .map(([timestampMs, count]) => ({
            timestamp: new Date(timestampMs).toISOString(),
            count
          }))
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        const total = series.reduce((acc, item) => acc + item.count, 0);
        const last = series.length > 0 ? series[series.length - 1] : undefined;
        const lastAtMs = last ? new Date(last.timestamp).getTime() : 0;

        return {
          projectId,
          totalHeartbeats: total,
          active: lastAtMs >= activeCutoff,
          lastHeartbeatAt: last?.timestamp ?? null,
          series
        };
      })
      .sort((a, b) => {
        if (a.active !== b.active) {
          return a.active ? -1 : 1;
        }
        return b.totalHeartbeats - a.totalHeartbeats;
      });

    return {
      generatedAt: new Date().toISOString(),
      windowMinutes,
      bucketSeconds,
      projects
    };
  }

  healthSummary(options: { from?: string; to?: string } = {}) {
    const rows = this.connection
      .prepare(
        `SELECT id, rule_id, event_key, correlation_id, status, output, attempts, started_at, finished_at
         FROM run_logs
         WHERE (? IS NULL OR started_at >= ?)
           AND (? IS NULL OR started_at <= ?)
         ORDER BY started_at DESC`
      )
      .all(options.from ?? null, options.from ?? null, options.to ?? null, options.to ?? null) as RunLogRow[];

    const totalRuns = rows.length;
    const failedRuns = rows.filter((row) => row.status === "failed").length;
    const retries = rows.reduce((acc, row) => acc + Math.max(0, row.attempts - 1), 0);

    const latencies = rows.map((row) => {
      const start = new Date(row.started_at).getTime();
      const end = new Date(row.finished_at).getTime();
      if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
        return 0;
      }
      return end - start;
    });

    const avgLatencyMs =
      latencies.length > 0
        ? Number((latencies.reduce((acc, value) => acc + value, 0) / latencies.length).toFixed(2))
        : 0;
    const sorted = [...latencies].sort((a, b) => a - b);
    const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
    const p95LatencyMs = Number((sorted[p95Index] ?? 0).toFixed(2));

    return {
      totalRuns,
      okRuns: totalRuns - failedRuns,
      failedRuns,
      retries,
      avgLatencyMs,
      p95LatencyMs,
      recentDeadLetters: this.listDeadLetters().slice(0, 10)
    };
  }

  getRuleById(ruleId: string) {
    const row = this.connection
      .prepare(
        `SELECT id, name, trigger_type, trigger_filter_json, trigger_mode, trigger_conditions_json, trigger_cron, actions_json, enabled
         FROM automation_rules
         WHERE id = ?`
      )
      .get(ruleId) as RuleRow | undefined;

    if (!row) {
      throw new NotFoundError(`Automation rule ${ruleId} no encontrada`);
    }
    return this.mapRule(row);
  }

  setRuleEnabled(ruleId: string, enabled: boolean) {
    const current = this.getRuleById(ruleId);
    const nextEnabled = Boolean(enabled);

    this.connection
      .prepare(
        `UPDATE automation_rules
         SET enabled = ?
         WHERE id = ?`
      )
      .run(nextEnabled ? 1 : 0, ruleId);

    const updated: AutomationRule = {
      ...current,
      enabled: nextEnabled
    };

    if (nextEnabled) {
      this.scheduleRule(updated);
    } else {
      this.stopScheduledRule(ruleId);
    }

    return updated;
  }

  async testRule(ruleId: string, input: TestRuleInput = {}) {
    const rule = this.getRuleById(ruleId);
    const event: DomainEvent = {
      type: input.eventType ?? rule.trigger.type,
      payload: input.eventPayload ?? {},
      occurredAt: new Date().toISOString(),
      ...(input.correlationId ? { correlationId: input.correlationId } : {})
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

  private scheduleCronRules() {
    const rules = this.listRules().filter((rule) => rule.enabled);
    for (const rule of rules) {
      this.scheduleRule(rule);
    }
  }

  private scheduleRule(rule: AutomationRule) {
    if (rule.trigger.type !== "scheduled_tick" || !rule.trigger.cron) {
      return;
    }

    this.stopScheduledRule(rule.id);

    if (!cron.validate(rule.trigger.cron)) {
      return;
    }

    const task = cron.schedule(rule.trigger.cron, async () => {
      const event: DomainEvent = {
        type: "scheduled_tick",
        payload: {
          ruleId: rule.id,
          tickAt: new Date().toISOString()
        },
        occurredAt: new Date().toISOString(),
        correlationId: createId("corr")
      };

      const eventKey = this.buildEventKey(rule, event);
      if (this.isAlreadyProcessed(eventKey)) {
        return;
      }

      await this.executeRule(rule, event, eventKey);
      this.markAsProcessed(eventKey);
    });

    this.scheduledTasks.set(rule.id, task);
  }

  private stopScheduledRule(ruleId: string) {
    const scheduled = this.scheduledTasks.get(ruleId);
    if (!scheduled) {
      return;
    }

    scheduled.stop();
    this.scheduledTasks.delete(ruleId);
  }

  private matches(rule: AutomationRule, event: DomainEvent) {
    if (rule.trigger.type !== event.type) {
      return false;
    }

    const conditions: TriggerCondition[] = [];
    if (rule.trigger.filter) {
      for (const [field, value] of Object.entries(rule.trigger.filter)) {
        conditions.push({ field, operator: "eq", value });
      }
    }
    for (const item of rule.trigger.conditions ?? []) {
      conditions.push(item);
    }

    if (conditions.length === 0) {
      return true;
    }

    const mode = rule.trigger.mode ?? "AND";
    const evaluated = conditions.map((condition) => this.evaluateCondition(condition, event.payload));
    return mode === "OR" ? evaluated.some(Boolean) : evaluated.every(Boolean);
  }

  private evaluateCondition(condition: TriggerCondition, payload: Record<string, unknown>) {
    const actual = payload[condition.field];
    const expected = condition.value;

    switch (condition.operator) {
      case "eq":
        return String(actual) === String(expected);
      case "neq":
        return String(actual) !== String(expected);
      case "contains":
        return String(actual ?? "").includes(String(expected));
      case "starts_with":
        return String(actual ?? "").startsWith(String(expected));
      case "ends_with":
        return String(actual ?? "").endsWith(String(expected));
      case "gt":
        return Number(actual) > Number(expected);
      case "gte":
        return Number(actual) >= Number(expected);
      case "lt":
        return Number(actual) < Number(expected);
      case "lte":
        return Number(actual) <= Number(expected);
      default:
        return false;
    }
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
      finishedAt: new Date().toISOString(),
      ...(event.correlationId ? { correlationId: event.correlationId } : {})
    };

    this.connection
      .prepare(
        `INSERT INTO run_logs (id, rule_id, event_key, correlation_id, status, output, attempts, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        runLog.id,
        runLog.ruleId,
        runLog.eventKey ?? "",
        runLog.correlationId ?? null,
        runLog.status,
        runLog.output,
        runLog.attempts ?? 0,
        runLog.startedAt,
        runLog.finishedAt
      );

    this.metricsService.recordAutomationRun(runLog.status, runLog.attempts ?? 1);

    if (runLog.status === "failed") {
      this.pushDeadLetter(rule, eventKey, runLog.output, event);
    }

    await this.eventBus.publish({
      type: "automation_rule_executed",
      payload: {
        runLogId: runLog.id,
        ruleId: runLog.ruleId,
        status: runLog.status,
        eventKey
      },
      occurredAt: new Date().toISOString(),
      ...(event.correlationId ? { correlationId: event.correlationId } : {})
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

        await this.chatService.sendMessage(
          conversationId,
          {
            role: "system",
            content,
            actorType: "system",
            actorId: "automation-engine"
          },
          event.correlationId ? { correlationId: event.correlationId } : {}
        );
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

        await this.memoryService.save(
          {
            scope: this.readString(payload.scope) ?? (projectId ? "project" : "global"),
            content:
              this.readString(payload.content) ??
              `Automatizacion ${rule.name} ejecutada por ${event.type}`,
            source: this.readString(payload.source) ?? `automation:${rule.id}`,
            tags: tagsFromPayload.length > 0 ? tagsFromPayload : ["automation", event.type]
          },
          event.correlationId ? { correlationId: event.correlationId } : {}
        );
        return;
      }
      case "external_action":
      case "shell_execution":
      case "mass_messaging":
      case "remote_action":
        throw new Error(`Accion sensible ${action.type} requiere integracion externa (Day 4+)`);
      default: {
        const exhaustive: never = action.type;
        throw new Error(`Tipo de accion no soportado: ${String(exhaustive)}`);
      }
    }
  }

  private pushDeadLetter(
    rule: AutomationRule,
    eventKey: string,
    reason: string,
    event: DomainEvent
  ) {
    const sanitizedPayload = redactSensitiveData(event.payload) as Record<string, unknown>;

    const deadLetter: DeadLetter = {
      id: createId("dlq"),
      ruleId: rule.id,
      eventKey,
      reason,
      payload: sanitizedPayload,
      createdAt: new Date().toISOString(),
      ...(event.correlationId ? { correlationId: event.correlationId } : {})
    };

    this.connection
      .prepare(
        `INSERT INTO dead_letters (id, rule_id, event_key, reason, payload_json, correlation_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        deadLetter.id,
        deadLetter.ruleId,
        deadLetter.eventKey,
        deadLetter.reason,
        JSON.stringify(deadLetter.payload),
        deadLetter.correlationId ?? null,
        deadLetter.createdAt
      );
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
          : {}),
        ...(row.trigger_mode ? { mode: row.trigger_mode } : {}),
        ...(row.trigger_conditions_json
          ? { conditions: JSON.parse(row.trigger_conditions_json) as TriggerCondition[] }
          : {}),
        ...(row.trigger_cron ? { cron: row.trigger_cron } : {})
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
      finishedAt: row.finished_at,
      ...(row.correlation_id ? { correlationId: row.correlation_id } : {})
    };
  }

  private mapDeadLetter(row: DeadLetterRow): DeadLetter {
    return {
      id: row.id,
      ruleId: row.rule_id,
      eventKey: row.event_key,
      reason: row.reason,
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
      createdAt: row.created_at,
      ...(row.correlation_id ? { correlationId: row.correlation_id } : {})
    };
  }

  private readString(value: unknown): string | undefined {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
    return undefined;
  }

  private extractProjectIdFromEventKey(eventKey: string) {
    if (!eventKey) {
      return undefined;
    }
    const parts = eventKey.split(":");
    const project = parts[2];
    if (!project || project.length === 0) {
      return undefined;
    }
    return project;
  }
}
