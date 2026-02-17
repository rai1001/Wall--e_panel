import { Router } from "express";
import { z } from "zod";
import { requirePermission } from "../policy/middleware";
import { asyncHandler } from "../shared/http/async-handler";
import { AppError, ForbiddenError } from "../shared/http/errors";
import { validateBody, validateParams } from "../shared/http/validation";
import { ProjectService } from "./project.service";
import { Role } from "../types/domain";

const projectStatusSchema = z.enum(["active", "paused", "done"]);
const taskStatusSchema = z.enum(["todo", "in_progress", "done"]);

const projectBodySchema = z.object({
  name: z.string().min(3).max(180),
  status: projectStatusSchema.optional()
});

const updateProjectBodySchema = z.object({
  name: z.string().min(3).max(180).optional(),
  status: projectStatusSchema.optional()
});

const taskBodySchema = z.object({
  title: z.string().min(3).max(180),
  status: taskStatusSchema.optional(),
  assignee: z.string().optional()
});

const taskStatusBodySchema = z.object({
  status: taskStatusSchema
});

const projectParamSchema = z.object({
  id: z.string().min(1)
});

const taskParamSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1)
});

export function createProjectRouter(projectService: ProjectService) {
  const router = Router();

  function enforceProjectOwnership(
    role: Role,
    actorId: string,
    projectId: string
  ) {
    if (role === "admin" || role === "manager") {
      return;
    }

    const hasAccess = projectService.canActorAccessProject(projectId, actorId, role);
    if (!hasAccess) {
      throw new ForbiddenError(
        `Actor ${actorId} no autorizado para operar proyecto ${projectId}`
      );
    }
  }

  router.post(
    "/",
    requirePermission("create", "proyecto"),
    validateBody(projectBodySchema),
    asyncHandler(async (req, res) => {
      const project = projectService.createProject({
        name: req.body.name,
        status: req.body.status,
        createdBy: req.actorId
      });
      res.status(201).json(project);
    })
  );

  router.get(
    "/",
    requirePermission("read", "proyecto"),
    asyncHandler(async (req, res) => {
      if (req.role === "admin" || req.role === "manager") {
        res.status(200).json(projectService.listProjects());
        return;
      }

      res.status(200).json(projectService.listProjectsForActor(req.actorId, req.role));
    })
  );

  router.get(
    "/:id",
    requirePermission("read", "proyecto"),
    validateParams(projectParamSchema),
    asyncHandler(async (req, res) => {
      const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!projectId) {
        throw new AppError("project id requerido", 400);
      }

      enforceProjectOwnership(req.role, req.actorId, projectId);
      res.status(200).json(projectService.getProjectById(projectId));
    })
  );

  router.patch(
    "/:id",
    requirePermission("update", "proyecto"),
    validateParams(projectParamSchema),
    validateBody(updateProjectBodySchema),
    asyncHandler(async (req, res) => {
      const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!projectId) {
        throw new AppError("project id requerido", 400);
      }

      enforceProjectOwnership(req.role, req.actorId, projectId);
      const project = projectService.updateProject(projectId, {
        name: req.body.name,
        status: req.body.status
      });

      res.status(200).json(project);
    })
  );

  router.delete(
    "/:id",
    requirePermission("delete", "proyecto"),
    validateParams(projectParamSchema),
    asyncHandler(async (req, res) => {
      const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!projectId) {
        throw new AppError("project id requerido", 400);
      }

      enforceProjectOwnership(req.role, req.actorId, projectId);
      projectService.deleteProject(projectId);
      res.status(204).send();
    })
  );

  router.post(
    "/:id/tasks",
    requirePermission("create", "proyecto"),
    validateParams(projectParamSchema),
    validateBody(taskBodySchema),
    asyncHandler(async (req, res) => {
      const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!projectId) {
        throw new AppError("project id requerido", 400);
      }

      enforceProjectOwnership(req.role, req.actorId, projectId);
      const task = await projectService.createTask(
        projectId,
        {
          title: req.body.title,
          status: req.body.status,
          assignee: req.body.assignee
        },
        { correlationId: req.correlationId }
      );

      res.status(201).json(task);
    })
  );

  router.get(
    "/:id/tasks",
    requirePermission("read", "proyecto"),
    validateParams(projectParamSchema),
    asyncHandler(async (req, res) => {
      const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!projectId) {
        throw new AppError("project id requerido", 400);
      }

      enforceProjectOwnership(req.role, req.actorId, projectId);
      res.status(200).json(projectService.listTasks(projectId));
    })
  );

  router.patch(
    "/:id/tasks/:taskId/status",
    requirePermission("update", "proyecto"),
    validateParams(taskParamSchema),
    validateBody(taskStatusBodySchema),
    asyncHandler(async (req, res) => {
      const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
      if (!projectId || !taskId) {
        throw new AppError("project id y task id son requeridos", 400);
      }

      enforceProjectOwnership(req.role, req.actorId, projectId);
      const task = await projectService.updateTaskStatus(
        projectId,
        taskId,
        req.body.status,
        { correlationId: req.correlationId }
      );
      res.status(200).json(task);
    })
  );

  return router;
}
