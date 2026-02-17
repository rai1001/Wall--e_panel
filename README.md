# Asistente Personal Modular - v1 Final

Backend modular con 5 dominios:
- `chat`
- `project`
- `memory`
- `automation`
- `policy`

Flujo E2E obligatorio activo:

`Crear tarea en Proyecto -> dispara Automatizacion -> genera mensaje en Chat -> guarda Memoria`

## Stack
- Node.js + TypeScript
- Express
- SQLite (`better-sqlite3`)
- JWT (`jsonwebtoken`) + password hashing (`bcryptjs`)
- Vitest + Supertest

## Quick Start

```bash
npm install
npm run dev
```

Credenciales seeded:
- `admin@local` / `admin123`
- `manager@local` / `manager123`
- `member@local` / `member123`
- `viewer@local` / `viewer123`

## Verificacion

```bash
npm run typecheck
npm test
npm run smoke
```

Todo en un solo comando:

```bash
npm run ci
```

## Arquitectura

### Modulos
- `src/chat`: conversaciones, mensajes, participantes.
- `src/project`: proyectos, tareas, milestones.
- `src/memory`: memoria utilizable y busqueda.
- `src/automation`: reglas, triggers, acciones y run logs.
- `src/policy`: RBAC, auth JWT, aprobaciones sensibles y auditoria.
- `src/shared`: event bus, db, errores y utilidades.

### Relaciones
1. `project` emite eventos (`task_created`, `task_status_changed`).
2. `automation` consume eventos y ejecuta acciones.
3. `automation` usa `chat` para `post_chat_message`.
4. `automation` usa `memory` para `save_memory`.
5. `memory` guarda trazas automaticas de eventos de `chat` y `project`.
6. `policy` aplica autenticacion y permisos en endpoints.

### Persistencia
- SQLite en `data/assistant.db` (modo app normal).
- En tests se usa `:memory:` para ejecucion aislada.
- Esquema inicial en `src/shared/db/database.ts`.

## Seguridad

### Auth
- `POST /auth/login` devuelve JWT.
- Rutas de dominio exigen token Bearer.
- `GET /auth/me` devuelve actor autenticado.

### RBAC
Roles: `admin`, `manager`, `member`, `viewer`  
Recursos: `chat`, `proyecto`, `memoria`, `automatizacion`  
Acciones: `create`, `read`, `update`, `delete`, `execute`

| Role | chat | proyecto | memoria | automatizacion |
| --- | --- | --- | --- | --- |
| admin | CRUD + execute | CRUD + execute | CRUD + execute | CRUD + execute |
| manager | CRUD | CRUD | CRUD | read + execute |
| member | create/read/update | create/read/update | create/read/update | read + execute |
| viewer | read | read | read | read |

Implementacion:
- `src/policy/rbac.ts`
- `src/policy/middleware.ts`

### Acciones sensibles y aprobaciones
Acciones sensibles:
- `external_action`
- `shell_execution`
- `mass_messaging`
- `remote_action`

Flujo:
1. Se intenta crear/testear regla sensible.
2. API responde `412 ApprovalRequiredError` con `approvalId`.
3. `admin` o `manager` aprueba en `/policy/approvals/:id/approve`.
4. Se reintenta con headers:
   - `x-confirmed: true`
   - `x-approval-id: <approvalId>`

## Endpoints principales

### Auth
- `POST /auth/login`
- `GET /auth/me`

### Chat
- `POST /chat/conversations`
- `POST /chat/conversations/:id/messages`
- `GET /chat/conversations/:id/messages`

### Project
- `POST /projects`
- `GET /projects`
- `GET /projects/:id`
- `PATCH /projects/:id`
- `DELETE /projects/:id`
- `POST /projects/:id/tasks`
- `GET /projects/:id/tasks`
- `PATCH /projects/:id/tasks/:taskId/status`

### Memory
- `POST /memory/save`
- `GET /memory/search?q=&tags=&scope=`

### Automation
- `POST /automation/rules`
- `GET /automation/rules`
- `POST /automation/rules/:id/test`
- `GET /automation/runs`

### Policy
- `GET /policy/approvals`
- `POST /policy/approvals/:id/approve`
- `POST /policy/approvals/:id/reject`
- `GET /policy/audit`

### Onboarding
- `POST /onboarding/bootstrap-flow`

### OpenAPI
- `GET /openapi.yaml`
- Especificacion completa en `docs/openapi.yaml`.

## Resiliencia en automatizacion
- Reintentos por accion (`maxAttempts`, default 3).
- Idempotencia por `event_key` en `processed_events`.
- Run logs persistentes con estado, salida y cantidad de intentos.

## Documentacion tecnica
- ADR Day 1: `docs/adr-day1.md`
- ADR Day 2: `docs/adr-day2.md`
- Checklist Day 2 ejecutado: `docs/day2-checklist.md`
- Siguientes mejoras: `docs/day3-checklist.md`
