# Asistente Personal Modular - Day 1

Base funcional mínima con 5 dominios:
- `chat`
- `project`
- `memory`
- `automation`
- `policy` (RBAC + confirmaciones + auditoría básica)

Flujo integrado implementado:

`Crear tarea en Proyecto -> dispara Automatización -> genera mensaje en Chat -> guarda registro en Memoria`

## Quick Start

```bash
npm install
npm run dev
```

Verificación:

```bash
npm run typecheck
npm test
npm run smoke
```

## Arquitectura inicial

### Módulos
- `src/chat`: `Conversation`, `Message`, `Participant`, y API mínima de chat.
- `src/project`: `Project`, `Task`, `Milestone`, CRUD base y eventos de dominio.
- `src/memory`: `MemoryItem`, `save/search`, y captura automática de eventos.
- `src/automation`: `AutomationRule`, `Trigger`, `Action`, `RunLog`, motor trigger->acciones.
- `src/policy`: RBAC, confirmación de acciones sensibles y auditoría por endpoints sensibles.
- `src/shared`: `EventBus`, errores HTTP, utilidades.

### Relaciones entre módulos
1. `project` emite eventos (`task_created`, `task_status_changed`).
2. `automation` consume eventos y ejecuta acciones.
3. Acción `post_chat_message` usa `chat`.
4. Acción `save_memory` usa `memory`.
5. `memory` también captura eventos de `chat` y `project`.
6. `policy` protege endpoints principales con `can(action, resource, role)`.

### Flujo de eventos Day 1
1. `POST /projects/:id/tasks` crea tarea.
2. `project` emite `task_created`.
3. `automation` evalúa reglas habilitadas con trigger `task_created`.
4. Ejecuta acciones `post_chat_message` y `save_memory`.
5. Registra `RunLog` y publica `automation_rule_executed`.

## Contratos API mínimos

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

## RBAC Day 1

Roles: `admin`, `manager`, `member`, `viewer`  
Recursos: `chat`, `proyecto`, `memoria`, `automatizacion`  
Acciones: `create`, `read`, `update`, `delete`, `execute`

| Role | chat | proyecto | memoria | automatizacion |
| --- | --- | --- | --- | --- |
| admin | CRUD + execute | CRUD + execute | CRUD + execute | CRUD + execute |
| manager | CRUD | CRUD | CRUD | read + execute |
| member | create/read/update | create/read/update | create/read/update | read + execute |
| viewer | read | read | read | read |

Implementación:
- Matriz y `can`: `src/policy/rbac.ts`
- Middleware RBAC: `src/policy/middleware.ts`

## Seguridad Day 1

- Confirmación explícita para acciones sensibles (`external_action`, `shell_execution`, `mass_messaging`, `remote_action`) mediante header `x-confirmed: true`.
- Auditoría básica en endpoints sensibles de automatización (actor, role, acción, recurso, timestamp).

Implementación:
- Confirmación: `src/policy/approval.ts`
- Auditoría: `src/policy/audit.service.ts`

## Eventos de dominio soportados

- `task_created`
- `task_status_changed`
- `chat_message_created`
- `memory_saved`
- `automation_rule_executed`

## Decisiones técnicas Day 1

1. Stack Node.js/TypeScript + Express para iteración rápida.
2. Persistencia in-memory para validar contratos y flujo E2E.
3. Integración entre dominios por `EventBus` in-process.
4. Prioridad de seguridad por RBAC y confirmaciones antes de automatización avanzada.
5. Tests unitarios por dominio + test de integración del flujo completo + smoke script.
