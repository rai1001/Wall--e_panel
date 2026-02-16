import { DomainAction, Resource, Role } from "../types/domain";

type PermissionMatrix = Record<Role, Record<Resource, DomainAction[]>>;

export const ROLE_PERMISSIONS: PermissionMatrix = {
  admin: {
    chat: ["create", "read", "update", "delete", "execute"],
    proyecto: ["create", "read", "update", "delete", "execute"],
    memoria: ["create", "read", "update", "delete", "execute"],
    automatizacion: ["create", "read", "update", "delete", "execute"]
  },
  manager: {
    chat: ["create", "read", "update", "delete"],
    proyecto: ["create", "read", "update", "delete"],
    memoria: ["create", "read", "update", "delete"],
    automatizacion: ["read", "execute"]
  },
  member: {
    chat: ["create", "read", "update"],
    proyecto: ["create", "read", "update"],
    memoria: ["create", "read", "update"],
    automatizacion: ["read", "execute"]
  },
  viewer: {
    chat: ["read"],
    proyecto: ["read"],
    memoria: ["read"],
    automatizacion: ["read"]
  }
};

export function isRole(value: string | undefined): value is Role {
  return value === "admin" || value === "manager" || value === "member" || value === "viewer";
}

export function can(action: DomainAction, resource: Resource, role: Role) {
  return ROLE_PERMISSIONS[role][resource].includes(action);
}
