export type Role = "admin" | "manager" | "member" | "viewer";

export type Resource = "chat" | "proyecto" | "memoria" | "automatizacion";

export type DomainAction = "create" | "read" | "update" | "delete" | "execute";

export type MessageRole = "user" | "assistant" | "system";

export interface Conversation {
  id: string;
  projectId?: string;
  title: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface Participant {
  id: string;
  conversationId: string;
  actorType: string;
  actorId: string;
}

export type ProjectStatus = "active" | "paused" | "done";
export type TaskStatus = "todo" | "in_progress" | "done";
export type MilestoneStatus = "planned" | "in_progress" | "done";

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  assignee?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  dueDate?: string;
  status: MilestoneStatus;
}

export interface MemoryItem {
  id: string;
  scope: string;
  content: string;
  source: string;
  timestamp: string;
  tags: string[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
  createdAt: string;
}

export type DomainEventType =
  | "task_created"
  | "task_status_changed"
  | "chat_message_created"
  | "memory_saved"
  | "automation_rule_executed";

export interface Trigger {
  type: DomainEventType;
  filter?: Record<string, string>;
}

export type AutomationActionType =
  | "post_chat_message"
  | "save_memory"
  | "external_action"
  | "shell_execution"
  | "mass_messaging"
  | "remote_action";

export interface Action {
  type: AutomationActionType;
  payload?: Record<string, unknown>;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: Trigger;
  actions: Action[];
  enabled: boolean;
}

export interface RunLog {
  id: string;
  ruleId: string;
  eventKey?: string;
  status: "success" | "failed";
  output: string;
  attempts?: number;
  startedAt: string;
  finishedAt: string;
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalRequest {
  id: string;
  actionType: string;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  requestedBy: string;
  approvedBy?: string;
  requestedAt: string;
  approvedAt?: string;
}
