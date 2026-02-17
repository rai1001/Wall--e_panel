import { Request, RequestHandler } from "express";
import { z, ZodSchema } from "zod";
import { AppError } from "./errors";

function toValidationError(error: z.ZodError) {
  return new AppError("Payload invalido", 422, {
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code
    }))
  });
}

export function validateBody<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return next(toValidationError(parsed.error));
    }
    req.body = parsed.data;
    return next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return next(toValidationError(parsed.error));
    }
    const currentQuery = req.query as Record<string, unknown>;
    for (const key of Object.keys(currentQuery)) {
      delete currentQuery[key];
    }
    Object.assign(currentQuery, parsed.data as Record<string, unknown>);
    return next();
  };
}

export function validateParams<T>(schema: ZodSchema<T>): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.params);
    if (!parsed.success) {
      return next(toValidationError(parsed.error));
    }
    const currentParams = req.params as Record<string, string>;
    for (const key of Object.keys(currentParams)) {
      delete currentParams[key];
    }
    Object.assign(currentParams, parsed.data as Request["params"]);
    return next();
  };
}
