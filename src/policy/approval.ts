import { Request } from "express";
import { ApprovalRequiredError } from "../shared/http/errors";
import { AutomationActionType } from "../types/domain";

const SENSITIVE_ACTIONS = new Set<AutomationActionType>([
  "external_action",
  "shell_execution",
  "mass_messaging",
  "remote_action"
]);

export function hasSensitiveActions(actions: Array<{ type: AutomationActionType }>) {
  return actions.some((action) => SENSITIVE_ACTIONS.has(action.type));
}

export function assertConfirmed(req: Request) {
  const confirmed = req.header("x-confirmed");
  if (confirmed !== "true") {
    throw new ApprovalRequiredError(
      "Accion sensible requiere confirmacion explicita (header x-confirmed: true)."
    );
  }
}
