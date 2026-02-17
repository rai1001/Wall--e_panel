# Phase Compliance Audit (PRD + Prompts)

Fecha: 2026-02-17
Base:
- `docs/PROMPT_CODEX_FROM_6_SUBAGENTS.md`
- `docs/subagentes-resultados-2026-02-17.md`
- PRD/SPEC v1 compartido en el hilo

## Estado por bloque

### Fase 0 (baseline de seguridad)
- `Hecho`: fail-fast en produccion para JWT y legacy headers.
- `Hecho`: hardening HTTP (`helmet`, `x-powered-by` off).
- `Hecho`: ownership anti-IDOR en project/chat/memory.
- `Hecho`: redaccion de datos sensibles en auditoria y dead-letter.
- `Hecho`: confirmaciones en acciones destructivas.

### Fase 1 (operatividad esta semana)
- `Hecho parcial`: rate limit por estrategia actor/ip y trust proxy.
  - Implementado doble limitador en login (IP + email).
  - Configurable por env.
- `Hecho parcial`: tests de seguridad automatizados.
  - Nuevos tests de trust proxy y estrategia de rate-limit.
- `Pendiente`: secret scan en CI y policy formal de retencion/compliance.
- `Pendiente`: contract tests OpenAPI automatizados.

### UX operativa (brecha principal reportada)
- `Hecho`: flujo guiado de tareas en modulo Projects.
  - Crear proyecto -> crear tarea -> actualizar estado de tarea.
- `Hecho`: CTA de flujo rapido en dashboard (3 pasos).
- `Hecho`: modulos visibles separados para Memory y Permissions.
- `Pendiente`: simplificar aun mas microcopy/terminologia para usuario no tecnico.

## Evidencia de codigo
- `src/ui/dashboard.router.ts`
- `src/shared/http/rate-limit.ts`
- `src/policy/auth.router.ts`
- `src/app.ts`
- `src/config/network.ts`
- `tests/integration/day6-rate-limit-strategy.test.ts`
- `tests/unit/network.config.test.ts`

## Criterio de validacion ejecutado
- `npm run typecheck` OK
- `npm test` OK
- `npm run smoke` OK
- `npm run reindex` OK
