import { Request, RequestHandler } from "express";
import { createId } from "../shared/id";
import { Role } from "../types/domain";

export interface AuditRecord {
  id: string;
  actorId: string;
  role: Role;
  action: string;
  resource: string;
  timestamp: string;
}

export class AuditService {
  private readonly records: AuditRecord[] = [];

  record(input: Omit<AuditRecord, "id" | "timestamp">) {
    const record: AuditRecord = {
      id: createId("audit"),
      timestamp: new Date().toISOString(),
      ...input
    };
    this.records.push(record);
    return record;
  }

  list() {
    return [...this.records];
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
