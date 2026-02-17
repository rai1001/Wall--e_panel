# Security baseline aplicado (Fase 0)

Fecha: 2026-02-17
Estado: completado

## 1) Configuracion segura en runtime
- Archivo: `src/config/runtime-security.ts`
- Integracion: `src/context.ts`
- Resultado:
  - En `NODE_ENV=production` falla el arranque si:
    - faltan `JWT_SECRET/JWT_SECRETS`
    - hay secreto debil (longitud corta o marcador inseguro)
    - `ALLOW_LEGACY_HEADERS=true`

## 2) Auth/JWT endurecido
- Archivo: `src/policy/auth.service.ts`
- Resultado:
  - En `production` no hay fallback a secretos de desarrollo.
  - Soporte de rotacion via `JWT_SECRETS` (`kid` activo + aceptados).

## 3) Seed seguro para produccion
- Archivo: `src/shared/db/database.ts`
- Resultado:
  - Se evita seed de usuarios default en `production`.
  - Excepcion controlada: `ALLOW_PROD_SEED=true`.

## 4) Hardening HTTP
- Archivo: `src/app.ts`
- Dependencia: `helmet`
- Resultado:
  - `x-powered-by` deshabilitado.
  - CSP y cabeceras seguras compatibles con panel/login.

## 5) Ownership (anti-IDOR)
- Archivos:
  - `src/project/project.service.ts`, `src/project/project.router.ts`
  - `src/chat/chat.service.ts`, `src/chat/chat.router.ts`
  - `src/memory/memory.service.ts`, `src/memory/memory.router.ts`
- Resultado:
  - Roles no admin/manager solo operan recursos propios/relacionados.
  - RBAC existente se mantiene como control vertical.

## 6) UX de acciones sensibles
- Archivo: `src/ui/dashboard.router.ts`
- Resultado:
  - Confirmacion explicita antes de `forget`, `block`, `reject`.

## 7) Redaccion de datos sensibles
- Archivo: `src/shared/security/redaction.ts`
- Integrado en:
  - `src/policy/audit.service.ts`
  - `src/automation/automation.service.ts`
- Resultado:
  - Se reducen fugas de secretos/tokens en auditoria y dead letters.

## 8) Cobertura de pruebas nuevas
- `tests/unit/runtime-security.test.ts`
- `tests/unit/database.seed.production.test.ts`
- `tests/unit/redaction.test.ts`
- `tests/integration/day6-ownership.test.ts`

## 9) Compatibilidad
- Rutas existentes se mantienen.
- Legacy headers siguen para no-produccion segun politica endurecida.
