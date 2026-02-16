export class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}

export class ApprovalRequiredError extends AppError {
  constructor(message: string) {
    super(message, 412);
    this.name = "ApprovalRequiredError";
  }
}
