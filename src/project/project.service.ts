import { DomainEvent, EventBus } from "../shared/events/event-bus";
import { createId } from "../shared/id";
import { NotFoundError } from "../shared/http/errors";
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

export class ProjectService {
  private readonly projects: Project[] = [];
  private readonly tasks: Task[] = [];
  private readonly milestones: Milestone[] = [];

  constructor(private readonly eventBus: EventBus) {}

  createProject(input: CreateProjectInput) {
    const project: Project = {
      id: createId("project"),
      name: input.name,
      status: input.status ?? "active",
      createdAt: new Date().toISOString()
    };

    this.projects.push(project);
    return project;
  }

  listProjects() {
    return [...this.projects];
  }

  getProjectById(projectId: string) {
    const project = this.projects.find((item) => item.id === projectId);
    if (!project) {
      throw new NotFoundError(`Proyecto ${projectId} no encontrado`);
    }

    return project;
  }

  updateProject(projectId: string, input: UpdateProjectInput) {
    const project = this.getProjectById(projectId);
    if (input.name) {
      project.name = input.name;
    }
    if (input.status) {
      project.status = input.status;
    }

    return project;
  }

  deleteProject(projectId: string) {
    this.getProjectById(projectId);

    const projectIndex = this.projects.findIndex((item) => item.id === projectId);
    this.projects.splice(projectIndex, 1);

    for (let index = this.tasks.length - 1; index >= 0; index -= 1) {
      if (this.tasks[index]?.projectId === projectId) {
        this.tasks.splice(index, 1);
      }
    }

    for (let index = this.milestones.length - 1; index >= 0; index -= 1) {
      if (this.milestones[index]?.projectId === projectId) {
        this.milestones.splice(index, 1);
      }
    }
  }

  listTasks(projectId: string) {
    this.getProjectById(projectId);
    return this.tasks.filter((task) => task.projectId === projectId);
  }

  async createTask(projectId: string, input: CreateTaskInput) {
    this.getProjectById(projectId);

    const now = new Date().toISOString();
    const task: Task = {
      id: createId("task"),
      projectId,
      title: input.title,
      status: input.status ?? "todo",
      createdAt: now,
      updatedAt: now,
      ...(input.assignee ? { assignee: input.assignee } : {})
    };

    this.tasks.push(task);

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
    const task = this.tasks.find((candidate) => candidate.projectId === projectId && candidate.id === taskId);

    if (!task) {
      throw new NotFoundError(`Task ${taskId} no encontrada en proyecto ${projectId}`);
    }

    task.status = status;
    task.updatedAt = new Date().toISOString();

    const event: DomainEvent = {
      type: "task_status_changed",
      payload: {
        projectId,
        taskId: task.id,
        status: task.status
      },
      occurredAt: new Date().toISOString()
    };

    await this.eventBus.publish(event);
    return task;
  }

  createMilestone(projectId: string, input: CreateMilestoneInput) {
    this.getProjectById(projectId);
    const milestone: Milestone = {
      id: createId("milestone"),
      projectId,
      title: input.title,
      status: input.status ?? "planned",
      ...(input.dueDate ? { dueDate: input.dueDate } : {})
    };

    this.milestones.push(milestone);
    return milestone;
  }
}
