import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Database } from "better-sqlite3";
import { UnauthorizedError } from "../shared/http/errors";
import { Role } from "../types/domain";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  password_hash: string;
}

export interface AuthTokenPayload {
  sub: string;
  role: Role;
  email: string;
  name: string;
}

export interface LoginResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
  };
}

export class AuthService {
  constructor(
    private readonly connection: Database,
    private readonly jwtSecret = process.env.JWT_SECRET ?? "dev-secret-change-me"
  ) {}

  login(email: string, password: string): LoginResult {
    const row = this.connection
      .prepare(
        `SELECT id, email, name, role, password_hash
         FROM users
         WHERE email = ?`
      )
      .get(email) as UserRow | undefined;

    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      throw new UnauthorizedError("Credenciales invalidas");
    }

    const payload: AuthTokenPayload = {
      sub: row.id,
      role: row.role,
      email: row.email,
      name: row.name
    };

    const token = jwt.sign(payload, this.jwtSecret, { expiresIn: "12h" });

    return {
      token,
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role
      }
    };
  }

  verifyToken(token: string): AuthTokenPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      if (typeof decoded !== "object" || !decoded) {
        throw new Error("Invalid token payload");
      }

      const payload = decoded as Partial<AuthTokenPayload>;
      if (!payload.sub || !payload.role || !payload.email || !payload.name) {
        throw new Error("Incomplete token payload");
      }

      return {
        sub: payload.sub,
        role: payload.role,
        email: payload.email,
        name: payload.name
      };
    } catch (_error) {
      throw new UnauthorizedError("Token invalido o expirado");
    }
  }
}
