import { Database } from "better-sqlite3";
import { createId } from "../shared/id";
import { ApprovalRequiredError, AppError, NotFoundError } from "../shared/http/errors";
import { ApprovalRequest, ApprovalStatus } from "../types/domain";

interface ApprovalRow {
  id: string;
  action_type: string;
  payload_json: string;
  status: ApprovalStatus;
  requested_by: string;
  approved_by: string | null;
  requested_at: string;
  approved_at: string | null;
}

export interface RequestApprovalInput {
  actionType: string;
  payload: Record<string, unknown>;
  requestedBy: string;
}

export class ApprovalService {
  constructor(private readonly connection: Database) {}

  request(input: RequestApprovalInput) {
    const approval: ApprovalRequest = {
      id: createId("approval"),
      actionType: input.actionType,
      payload: input.payload,
      status: "pending",
      requestedBy: input.requestedBy,
      requestedAt: new Date().toISOString()
    };

    this.connection
      .prepare(
        `INSERT INTO approvals (id, action_type, payload_json, status, requested_by, approved_by, requested_at, approved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        approval.id,
        approval.actionType,
        JSON.stringify(approval.payload),
        approval.status,
        approval.requestedBy,
        null,
        approval.requestedAt,
        null
      );

    return approval;
  }

  approve(approvalId: string, approvedBy: string) {
    const approval = this.getById(approvalId);
    if (approval.status !== "pending") {
      throw new AppError(`La aprobacion ${approvalId} no esta pendiente`, 409);
    }

    const approvedAt = new Date().toISOString();
    this.connection
      .prepare(
        `UPDATE approvals
         SET status = ?, approved_by = ?, approved_at = ?
         WHERE id = ?`
      )
      .run("approved", approvedBy, approvedAt, approvalId);

    return this.getById(approvalId);
  }

  reject(approvalId: string, approvedBy: string) {
    const approval = this.getById(approvalId);
    if (approval.status !== "pending") {
      throw new AppError(`La aprobacion ${approvalId} no esta pendiente`, 409);
    }

    const approvedAt = new Date().toISOString();
    this.connection
      .prepare(
        `UPDATE approvals
         SET status = ?, approved_by = ?, approved_at = ?
         WHERE id = ?`
      )
      .run("rejected", approvedBy, approvedAt, approvalId);

    return this.getById(approvalId);
  }

  list(status?: ApprovalStatus) {
    const rows = status
      ? (this.connection
          .prepare(
            `SELECT id, action_type, payload_json, status, requested_by, approved_by, requested_at, approved_at
             FROM approvals
             WHERE status = ?
             ORDER BY requested_at DESC`
          )
          .all(status) as ApprovalRow[])
      : (this.connection
          .prepare(
            `SELECT id, action_type, payload_json, status, requested_by, approved_by, requested_at, approved_at
             FROM approvals
             ORDER BY requested_at DESC`
          )
          .all() as ApprovalRow[]);

    return rows.map((row) => this.mapRow(row));
  }

  getById(approvalId: string) {
    const row = this.connection
      .prepare(
        `SELECT id, action_type, payload_json, status, requested_by, approved_by, requested_at, approved_at
         FROM approvals
         WHERE id = ?`
      )
      .get(approvalId) as ApprovalRow | undefined;

    if (!row) {
      throw new NotFoundError(`Aprobacion ${approvalId} no encontrada`);
    }

    return this.mapRow(row);
  }

  ensureApproved(approvalId: string) {
    const approval = this.getById(approvalId);
    if (approval.status !== "approved") {
      throw new ApprovalRequiredError("La accion sensible requiere aprobacion", {
        approvalId,
        status: approval.status
      });
    }
    return approval;
  }

  private mapRow(row: ApprovalRow): ApprovalRequest {
    return {
      id: row.id,
      actionType: row.action_type,
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
      status: row.status,
      requestedBy: row.requested_by,
      requestedAt: row.requested_at,
      ...(row.approved_by ? { approvedBy: row.approved_by } : {}),
      ...(row.approved_at ? { approvedAt: row.approved_at } : {})
    };
  }
}
