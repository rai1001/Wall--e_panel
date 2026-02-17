import { Request, RequestHandler } from "express";
import { Database } from "better-sqlite3";
import { createId } from "../shared/id";
import { Role } from "../types/domain";

export interface AuditRecord {
  id: string;
  actorId: string;
  role: Role;
  action: string;
  resource: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

interface AuditRow {
  id: string;
  actor_id: string;
  role: Role;
  action: string;
  resource: string;
  timestamp: string;
  details_json: string | null;
}

export class AuditService {
  constructor(private readonly connection: Database) {}

  record(input: Omit<AuditRecord, "id" | "timestamp">) {
    const record: AuditRecord = {
      id: createId("audit"),
      timestamp: new Date().toISOString(),
      ...input
    };

    this.connection
      .prepare(
        `INSERT INTO audits (id, actor_id, role, action, resource, timestamp, details_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        record.id,
        record.actorId,
        record.role,
        record.action,
        record.resource,
        record.timestamp,
        record.details ? JSON.stringify(record.details) : null
      );

    return record;
  }

  list(limit = 50) {
    const rows = this.connection
      .prepare(
        `SELECT id, actor_id, role, action, resource, timestamp, details_json
         FROM audits
         ORDER BY timestamp DESC
         LIMIT ?`
      )
      .all(limit) as AuditRow[];

    return rows.map((row) => ({
      id: row.id,
      actorId: row.actor_id,
      role: row.role,
      action: row.action,
      resource: row.resource,
      timestamp: row.timestamp,
      ...(row.details_json
        ? { details: JSON.parse(row.details_json) as Record<string, unknown> }
        : {})
    }));
  }
}

export function auditSensitiveAction(
  auditService: AuditService,
  action: string,
  resource: string
): RequestHandler {
  return (req: Request, _res, next) => {
    auditService.record({
      actorId: req.actorId,
      role: req.role,
      action,
      resource
    });
    next();
  };
}
