# Prompt para Codex - Ejecucion desde informe de 6 subagentes

Usa como fuente principal:
- `docs/subagentes-resultados-2026-02-17.md`
- (opcional externo) `C:\Users\Israel\.openclaw\workspace\wall-e-control-panel\WALL-E_6_SUBAGENTS_FULL_REPORT.md`

Trabaja sobre este repo:
- `C:\wall-e panel`

## Contexto actual obligatorio

- Stack: Node.js + TypeScript + Express + SQLite.
- Day 5 ya esta implementado (dashboard modular + endpoints panel-ready + hardening de migracion `project_id`).
- Login por cookie funciona en `/login` y panel en `/v1/dashboard`.
- Embeddings reales de uso: `EMBEDDING_PROVIDER=google`.
- Rutas legacy siguen montadas con deprecation headers.

## Objetivo

Cerrar siguiente iteracion sin romper compatibilidad:
1. Baseline de seguridad aplicable a produccion.
2. UX operativa clara para uso diario.
3. Operabilidad y trazabilidad medible.

## Forma de trabajo

1. Leer `docs/subagentes-resultados-2026-02-17.md` completo.
2. Crear `PLAN_EXECUTION.md` con fases:
   - Fase 0 (quick wins)
   - Fase 1 (esta semana)
   - Fase 2 (2-6 semanas)
3. Implementar Fase 0 completa.
4. Dejar Fase 1 lista con tareas tecnicas accionables.
5. Commits pequenos, atomicos y claros.

## Fase 0 obligatoria (ahora)

### A) Seguridad de configuracion
- Fail-fast en produccion si hay JWT secrets inseguros o de ejemplo.
- Bloquear `ALLOW_LEGACY_HEADERS=true` en produccion.
- Evitar seed de credenciales default en produccion.

### B) Hardening HTTP y auth
- Confirmar `app.disable("x-powered-by")`.
- Usar `helmet` (o equivalente) con politica compatible para panel.
- Revisar flujo login/logout y documentar alcance de revocacion JWT.

### C) Autorizacion por ownership (anti-IDOR)
- Validar acceso por ownership donde aplique (project/chat/memory).
- Mantener RBAC existente y documentar cambios.

### D) UX minima segura
- Confirmacion explicita en acciones destructivas del panel (`forget`, `block`, `reject`).
- Estados por modulo: `loading`, `error`, `empty/no data` con mensaje accionable.

### E) Logging y datos sensibles
- Redactar o minimizar payload sensible en logs/dead letters/auditoria.

## Fase 1 (dejar preparada)

- Rate limit distribuido por endpoint/actor/ip con estrategia de proxy real.
- Tests de seguridad automatizados en CI (secret scan, payload validation, authz checks).
- Contratos API ejecutables y smoke e2e por modulo principal.
- Retencion y cumplimiento (policy de limpieza y evidencia operativa).

## Entregables obligatorios

1. `PLAN_EXECUTION.md`
2. `SECURITY_BASELINE_APPLIED.md`
3. `CHANGES_SUMMARY.md`
4. `NEXT_STEPS_P1_P2.md`
5. Codigo implementado y commiteado

## Validacion obligatoria

Ejecutar y reportar resultados reales:

1. `npm run typecheck`
2. `npm test`
3. `npm run smoke`
4. `npm run reindex`

## Formato de respuesta final

1. Resumen ejecutivo (max 10 lineas)
2. Archivos modificados/creados
3. Validaciones ejecutadas
4. Que quedo 100% hecho en Fase 0
5. Que queda listo para Fase 1

## Restricciones

- No hardcodear secretos.
- No abrir bypasses temporales de seguridad.
- No romper rutas existentes sin documentar migracion.
- Mantener trazabilidad por commit.
