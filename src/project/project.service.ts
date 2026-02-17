import { Database } from "better-sqlite3";
import { DomainEvent, EventBus } from "../shared/events/event-bus";
import { createId } from "../shared/id";
import { AppError, NotFoundError } from "../shared/http/errors";
import { Milestone, Project, ProjectStatus, Task, TaskStatus } from "../types/domain";

export interface CreateProjectInput {
  name: string;
  status?: ProjectStatus;
}

export interface UpdateProjectInput {
  name?: string;
  status?: ProjectStatus;
}

export interface CreateTaskInput {
  title: string;
  status?: TaskStatus;
  assignee?: string;
}

export interface CreateMilestoneInput {
  title: string;
  dueDate?: string;
  status?: Milestone["status"];
}

interface ProjectRow {
  id: string;
  name: string;
  status: ProjectStatus;
  created_at: string;
}

interface TaskRow {
  id: string;
  project_id: string;
  title: string;
  status: TaskStatus;
  assignee: string | null;
  created_at: string;
  updated_at: string;
}

interface MilestoneRow {
  id: string;
  project_id: string;
  title: string;
  due_date: string | null;
  status: Milestone["status"];
}

export class ProjectService {
  constructor(
    private readonly eventBus: EventBus,
    private readonly connection: Database
  ) {}

  createProject(input: CreateProjectInput) {
    const name = input.name?.trim();
    if (!name) {
      throw new AppError("name es requerido para crear proyecto", 400);
    }

    const project: Project = {
      id: createId("project"),
      name,
      status: input.status ?? "active",
      createdAt: new Date().toISOString()
    };

    this.connection
      .prepare(
        `INSERT INTO projects (id, name, status, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(project.id, project.name, project.status, project.createdAt);

    return project;
  }

  listProjects() {
    const rows = this.connection
      .prepare(
        `SELECT id, name, status, created_at
         FROM projects
         ORDER BY created_at DESC`
      )
      .all() as ProjectRow[];

    return rows.map((row) => this.mapProject(row));
  }

  getProjectById(projectId: string) {
    const row = this.connection
      .prepare(
        `SELECT id, name, status, created_at
         FROM projects
         WHERE id = ?`
      )
      .get(projectId) as ProjectRow | undefined;

    if (!row) {
      throw new NotFoundError(`Proyecto ${projectId} no encontrado`);
    }

    return this.mapProject(row);
  }

  updateProject(projectId: string, input: UpdateProjectInput) {
    const project = this.getProjectById(projectId);
    const nextName = input.name?.trim() || project.name;
    const nextStatus = input.status ?? project.status;

    this.connection
      .prepare(
        `UPDATE projects
         SET name = ?, status = ?
         WHERE id = ?`
      )
      .run(nextName, nextStatus, projectId);

    return this.getProjectById(projectId);
  }

  deleteProject(projectId: string) {
    this.getProjectById(projectId);
    this.connection.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  }

  listTasks(projectId: string) {
    this.getProjectById(projectId);
    const rows = this.connection
      .prepare(
        `SELECT id, project_id, title, status, assignee, created_at, updated_at
         FROM tasks
         WHERE project_id = ?
         ORDER BY created_at DESC`
      )
      .all(projectId) as TaskRow[];

    return rows.map((row) => this.mapTask(row));
  }

  async createTask(projectId: string, input: CreateTaskInput) {
    this.getProjectById(projectId);
    const title = input.title?.trim();
    if (!title) {
      throw new AppError("title es requerido para crear task", 400);
    }

    const now = new Date().toISOString();
    const task: Task = {
      id: createId("task"),
      projectId,
      title,
      status: input.status ?? "todo",
      createdAt: now,
      updatedAt: now,
      ...(input.assignee ? { assignee: input.assignee } : {})
    };

    this.connection
      .prepare(
        `INSERT INTO tasks (id, project_id, title, status, assignee, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        task.id,
        task.projectId,
        task.title,
        task.status,
        task.assignee ?? null,
        task.createdAt,
        task.updatedAt
      );

    const event: DomainEvent = {
      type: "task_created",
      payload: {
        projectId,
        taskId: task.id,
        taskTitle: task.title,
        taskStatus: task.status
      },
      occurredAt: new Date().toISOString()
    };

    await this.eventBus.publish(event);
    return task;
  }

  async updateTaskStatus(projectId: string, taskId: string, status: TaskStatus) {
    this.getProjectById(projectId);
    const existing = this.connection
      .prepare(
        `SELECT id, project_id, title, status, assignee, created_at, updated_at
         FROM tasks
         WHERE project_id = ? AND id = ?`
      )
      .get(projectId, taskId) as TaskRow | undefined;

    if (!existing) {
      throw new NotFoundError(`Task ${taskId} no encontrada en proyecto ${projectId}`);
    }

    const updatedAt = new Date().toISOString();
    this.connection
      .prepare(
        `UPDATE tasks
         SET status = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(status, updatedAt, taskId);

    const event: DomainEvent = {
      type: "task_status_changed",
      payload: {
        projectId,
        taskId,
        status
      },
      occurredAt: new Date().toISOString()
    };

    await this.eventBus.publish(event);

    const row = this.connection
      .prepare(
        `SELECT id, project_id, title, status, assignee, created_at, updated_at
         FROM tasks
         WHERE id = ?`
      )
      .get(taskId) as TaskRow;
    return this.mapTask(row);
  }

  createMilestone(projectId: string, input: CreateMilestoneInput) {
    this.getProjectById(projectId);
    const title = input.title?.trim();
    if (!title) {
      throw new AppError("title es requerido para crear milestone", 400);
    }

    const milestone: Milestone = {
      id: createId("milestone"),
      projectId,
      title,
      status: input.status ?? "planned",
      ...(input.dueDate ? { dueDate: input.dueDate } : {})
    };

    this.connection
      .prepare(
        `INSERT INTO milestones (id, project_id, title, due_date, status)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        milestone.id,
        milestone.projectId,
        milestone.title,
        milestone.dueDate ?? null,
        milestone.status
      );

    return milestone;
  }

  private mapProject(row: ProjectRow): Project {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      createdAt: row.created_at
    };
  }

  private mapTask(row: TaskRow): Task {
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...(row.assignee ? { assignee: row.assignee } : {})
    };
  }

  private mapMilestone(row: MilestoneRow): Milestone {
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      status: row.status,
      ...(row.due_date ? { dueDate: row.due_date } : {})
    };
  }
}
