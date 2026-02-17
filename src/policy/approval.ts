import { AutomationActionType } from "../types/domain";

export const SENSITIVE_ACTIONS = new Set<AutomationActionType>([
  "external_action",
  "shell_execution",
  "mass_messaging",
  "remote_action"
]);

export function hasSensitiveActions(actions: Array<{ type: AutomationActionType }>) {
  return actions.some((action) => SENSITIVE_ACTIONS.has(action.type));
}
