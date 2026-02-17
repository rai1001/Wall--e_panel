import { Role } from "./domain";

declare global {
  namespace Express {
    interface Request {
      role: Role;
      actorId: string;
      userId?: string;
      correlationId: string;
    }
  }
}

export {};
