import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Database } from "better-sqlite3";
import { AppError, UnauthorizedError } from "../shared/http/errors";
import { Role } from "../types/domain";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  password_hash: string;
}

interface LoginStateRow {
  email: string;
  failed_count: number;
  locked_until: string | null;
}

interface JwtKey {
  kid: string;
  value: string;
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
  private readonly jwtKeys: JwtKey[];

  constructor(private readonly connection: Database) {
    const envKeys = process.env.JWT_SECRETS
      ? process.env.JWT_SECRETS.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
    const fallback = process.env.JWT_SECRET ?? "dev-secret-change-me";
    const all = envKeys.length > 0 ? envKeys : [fallback];
    this.jwtKeys = all.map((value, index) => ({ kid: `k${index + 1}`, value }));
  }

  login(email: string, password: string): LoginResult {
    const normalizedEmail = email.trim().toLowerCase();
    this.ensureNotLocked(normalizedEmail);

    const row = this.connection
      .prepare(
        `SELECT id, email, name, role, password_hash
         FROM users
         WHERE email = ?`
      )
      .get(normalizedEmail) as UserRow | undefined;

    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      this.registerFailedAttempt(normalizedEmail);
      throw new UnauthorizedError("Credenciales invalidas");
    }

    this.clearLoginState(normalizedEmail);

    const payload: AuthTokenPayload = {
      sub: row.id,
      role: row.role,
      email: row.email,
      name: row.name
    };

    const activeKey = this.jwtKeys[0] ?? { kid: "k1", value: "dev-secret-change-me" };
    const token = jwt.sign(payload, activeKey.value, {
      expiresIn: "12h",
      keyid: activeKey.kid
    });

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
    const decoded = jwt.decode(token, { complete: true });
    const kid = decoded && typeof decoded === "object" ? String(decoded.header?.kid ?? "") : "";
    const candidates = kid
      ? this.jwtKeys.filter((key) => key.kid === kid)
      : this.jwtKeys;

    for (const key of candidates.length > 0 ? candidates : this.jwtKeys) {
      try {
        const verified = jwt.verify(token, key.value);
        if (typeof verified !== "object" || !verified) {
          continue;
        }

        const payload = verified as Partial<AuthTokenPayload>;
        if (!payload.sub || !payload.role || !payload.email || !payload.name) {
          continue;
        }

        return {
          sub: payload.sub,
          role: payload.role,
          email: payload.email,
          name: payload.name
        };
      } catch (_error) {
        continue;
      }
    }

    throw new UnauthorizedError("Token invalido o expirado");
  }

  keyInfo() {
    return {
      activeKid: this.jwtKeys[0]?.kid ?? null,
      acceptedKids: this.jwtKeys.map((item) => item.kid)
    };
  }

  private ensureNotLocked(email: string) {
    const state = this.connection
      .prepare(
        `SELECT email, failed_count, locked_until
         FROM auth_login_state
         WHERE email = ?`
      )
      .get(email) as LoginStateRow | undefined;

    if (!state?.locked_until) {
      return;
    }

    const lockTime = new Date(state.locked_until).getTime();
    if (Number.isNaN(lockTime)) {
      return;
    }

    if (Date.now() < lockTime) {
      throw new AppError("Cuenta bloqueada temporalmente por intentos fallidos", 423, {
        lockedUntil: state.locked_until
      });
    }
  }

  private registerFailedAttempt(email: string) {
    const current = this.connection
      .prepare(
        `SELECT email, failed_count, locked_until
         FROM auth_login_state
         WHERE email = ?`
      )
      .get(email) as LoginStateRow | undefined;

    const failedCount = (current?.failed_count ?? 0) + 1;
    const now = new Date();
    let lockedUntil: string | null = null;

    if (failedCount >= 3) {
      const exponent = Math.min(6, failedCount - 3);
      const lockMinutes = Math.min(30, 2 ** exponent);
      lockedUntil = new Date(now.getTime() + lockMinutes * 60_000).toISOString();
    }

    this.connection
      .prepare(
        `INSERT INTO auth_login_state (email, failed_count, locked_until, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           failed_count = excluded.failed_count,
           locked_until = excluded.locked_until,
           updated_at = excluded.updated_at`
      )
      .run(email, failedCount, lockedUntil, now.toISOString());
  }

  private clearLoginState(email: string) {
    this.connection.prepare(`DELETE FROM auth_login_state WHERE email = ?`).run(email);
  }
}
