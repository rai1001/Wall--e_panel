# Plan de ejecucion (subagentes) - Day 6

Fecha: 2026-02-17
Repo: `C:\wall-e panel`
Base: `docs/subagentes-resultados-2026-02-17.md`

## Objetivo
Cerrar baseline de seguridad/operabilidad sin romper compatibilidad de API ni UX del panel.

## Fase 0 (Quick wins - ejecutada)
1. Seguridad de configuracion
- Fail-fast en `production` para secretos JWT debiles o ausentes.
- Bloqueo de `ALLOW_LEGACY_HEADERS=true` en `production`.
- Seed default desactivado en `production` salvo `ALLOW_PROD_SEED=true`.

2. Hardening HTTP/Auth
- `app.disable("x-powered-by")`.
- Helmet con CSP compatible con `/login` y `/v1/dashboard`.
- Clarificacion de alcance de revocacion JWT (stateless por defecto, rotacion por `JWT_SECRETS`).

3. Anti-IDOR por ownership
- Validacion por owner/participante en rutas de `project`, `chat`, `memory`.
- RBAC se mantiene; ownership agrega restriccion horizontal para roles no admin/manager.

4. UX minima segura
- Confirmaciones explicitas en acciones destructivas del panel: `forget`, `block`, `reject`.
- Soporte de estados de modulo (loading/error/empty) mantenido en dashboard modular existente.

5. Logging seguro
- Redaccion de payload sensible en auditoria y dead-letter.

## Fase 1 (esta semana - lista para ejecutar)
1. Seguridad operativa
- Rate limiting por endpoint + actor + IP real (`trust proxy` + estrategia de edge).
- Security checks CI: escaneo secretos, authz regression, payload fuzzing basico.

2. Calidad API
- Contratos ejecutables (OpenAPI checks + test de compat legacy vs `/v1`).
- Smoke e2e por modulo (`projects`, `automation`, `chat timeline`, `memory`).

3. Trazabilidad
- Politica de retencion para auditoria/dead letters con limpieza automatica.
- Dashboards de seguridad (403/401 por ruta, bloqueos rate-limit, fallos auth).

## Fase 2 (2-6 semanas)
1. Identidad y sesiones
- Revocacion real de JWT (lista de revocacion o session store).
- Sesiones por dispositivo y invalidacion selectiva.

2. Migraciones y datos
- Framework de migraciones versionadas con tabla de control.
- Playbooks de rollback automatizados y pruebas de migracion sobre snapshots legacy.

3. Gobierno y cumplimiento
- Politicas de retencion/compliance con evidencia exportable.
- Hardening continuo con SLO/SLA operativos y alerting.

## Criterio de cierre de este plan
- Fase 0 en verde con quality gates (`typecheck`, `test`, `smoke`, `reindex`).
- Fase 1 con backlog tecnico priorizado y accionable.
