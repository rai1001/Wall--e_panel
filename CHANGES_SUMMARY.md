# Resumen de cambios ejecutados

Fecha: 2026-02-17

## Codigo
- `src/config/runtime-security.ts`
  - Nuevo guard de configuracion segura para produccion.

- `src/context.ts`
  - Arranque fail-fast con `assertRuntimeSecurityConfig`.

- `src/policy/auth.service.ts`
  - Eliminado fallback inseguro en produccion.
  - Ajustes para rotacion de secretos JWT.

- `src/shared/db/database.ts`
  - Seed por defecto bloqueado en produccion.
  - Columna/index de ownership para `projects.created_by`.

- `src/app.ts`
  - Hardening HTTP: `helmet`, CSP y `x-powered-by` deshabilitado.
  - Endpoint `.well-known/appspecific/...` para evitar ruido DevTools.

- `src/policy/middleware.ts`
  - Legacy headers deshabilitados automaticamente en produccion.

- `src/project/project.service.ts`
  - Ownership en proyecto y listado acotado por actor.

- `src/project/project.router.ts`
  - Enforcement de ownership en endpoints clave.

- `src/chat/chat.service.ts`
  - Owner/participantes en conversaciones.
  - Verificacion de acceso por actor.

- `src/chat/chat.router.ts`
  - Enforcement de ownership para leer/publicar mensajes.

- `src/memory/memory.service.ts`
  - Ownership en acciones de mutacion (`promote`, `forget`, `block`).

- `src/memory/memory.router.ts`
  - Paso de contexto actor/rol para checks de ownership.

- `src/policy/audit.service.ts`
  - Auditoria con payload redactado.

- `src/automation/automation.service.ts`
  - Dead letters con payload redactado.

- `src/ui/dashboard.router.ts`
  - Confirmaciones de acciones destructivas.

- `scripts/smoke-day1.ts`
  - Ajustado a ownership actual (viewer participante en conversacion smoke).

## Dependencias
- `package.json`
- `package-lock.json`
  - Agregado `helmet`.

## Tests
- Nuevos:
  - `tests/unit/runtime-security.test.ts`
  - `tests/unit/database.seed.production.test.ts`
  - `tests/unit/redaction.test.ts`
  - `tests/integration/day6-ownership.test.ts`

- Ajustados:
  - `tests/integration/day1-flow.test.ts`
  - `tests/integration/onboarding.test.ts`

## Resultado
- Baseline de seguridad de Fase 0 implementado y validado.
