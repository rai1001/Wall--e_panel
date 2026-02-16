import { Router } from "express";
import { requirePermission } from "../policy/middleware";
import { asyncHandler } from "../shared/http/async-handler";
import { AppError } from "../shared/http/errors";
import { ProjectService } from "./project.service";

export function createProjectRouter(projectService: ProjectService) {
  const router = Router();

  router.post(
    "/",
    requirePermission("create", "proyecto"),
    asyncHandler(async (req, res) => {
      const project = projectService.createProject({
        name: req.body.name,
        status: req.body.status
      });
      res.status(201).json(project);
    })
  );

  router.get(
    "/",
    requirePermission("read", "proyecto"),
    asyncHandler(async (_req, res) => {
      res.status(200).json(projectService.listProjects());
    })
  );

  router.get(
    "/:id",
    requirePermission("read", "proyecto"),
    asyncHandler(async (req, res) => {
      const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!projectId) {
        throw new AppError("project id requerido", 400);
      }

      res.status(200).json(projectService.getProjectById(projectId));
    })
  );

  router.patch(
    "/:id",
    requirePermission("update", "proyecto"),
    asyncHandler(async (req, res) => {
      const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!projectId) {
        throw new AppError("project id requerido", 400);
      }

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
    asyncHandler(async (req, res) => {
      const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!projectId) {
        throw new AppError("project id requerido", 400);
      }

      projectService.deleteProject(projectId);
      res.status(204).send();
    })
  );

  router.post(
    "/:id/tasks",
    requirePermission("create", "proyecto"),
    asyncHandler(async (req, res) => {
      const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!projectId) {
        throw new AppError("project id requerido", 400);
      }

      const task = await projectService.createTask(projectId, {
        title: req.body.title,
        status: req.body.status,
        assignee: req.body.assignee
      });

      res.status(201).json(task);
    })
  );

  router.get(
    "/:id/tasks",
    requirePermission("read", "proyecto"),
    asyncHandler(async (req, res) => {
      const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!projectId) {
        throw new AppError("project id requerido", 400);
      }

      res.status(200).json(projectService.listTasks(projectId));
    })
  );

  router.patch(
    "/:id/tasks/:taskId/status",
    requirePermission("update", "proyecto"),
    asyncHandler(async (req, res) => {
      const projectId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
      if (!projectId || !taskId) {
        throw new AppError("project id y task id son requeridos", 400);
      }

      const task = await projectService.updateTaskStatus(projectId, taskId, req.body.status);
      res.status(200).json(task);
    })
  );

  return router;
}
