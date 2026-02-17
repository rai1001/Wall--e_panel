# ADR Day 1 - Arquitectura Base y Decisiones

## Status
Accepted

## Fecha
2026-02-17

## Contexto
Se pidió construir en Día 1 un asistente modular con dominios `chat`, `project`, `memory`, `automation`, `policy`, priorizando permisos y con flujo E2E operativo.

El repositorio estaba vacío al inicio.

## Decisiones principales

1. **Stack de implementación**
   Se adopta Node.js + TypeScript + Express + Vitest/Supertest.
   Motivo: velocidad de entrega y buena mantenibilidad para API modular.

2. **Persistencia**
   Se usa almacenamiento in-memory.
   Motivo: validar rápidamente contratos y comportamiento E2E del PRD/SPEC.

3. **Integración entre módulos**
   Se implementa `EventBus` in-process con eventos de dominio.
   Motivo: desacoplar módulos sin introducir mensajería distribuida en v1.

4. **Seguridad primero**
   Se implementa RBAC centralizado (`can(action, resource, role)`) en middleware.
   Motivo: requisito explícito de “Permisos primero”.

5. **Acciones sensibles**
   Se exige confirmación explícita (`x-confirmed: true`) para acciones de alto riesgo.
   Motivo: cumplir modo seguro por defecto y prevención de ejecución accidental.

6. **Auditoría básica**
   Se agrega auditoría in-memory en endpoints sensibles de automatización.
   Motivo: trazabilidad mínima por actor/acción/timestamp en Día 1.

## Ambigüedades detectadas y resolución

1. **Stack no especificado en código existente**
   Resolución: bootstrap TS/Express documentado en este ADR.

2. **Sin base de datos definida para Día 1**
   Resolución: estado en memoria con tests que prueban contratos.

3. **Cómo mapear `project_id` y conversación**
   Resolución: `Conversation.projectId` opcional y búsqueda por proyecto para acciones automáticas.

4. **Acciones sensibles no consumidas por el flujo principal**
   Resolución: soporte y validación implementados, aunque la regla E2E obligatoria usa acciones no sensibles.

## Consecuencias

- **Positivas**
  - Entrega rápida con módulos separados y contratos claros.
  - Flujo E2E verificable por test de integración y smoke script.
  - Seguridad base aplicada en endpoints principales.

- **Riesgos**
  - Estado efímero al reiniciar proceso.
  - Sin autenticación de identidad fuerte (solo `x-role`/`x-actor-id`).

## Siguientes pasos (resumen Day 2)

- Persistencia real (DB + migraciones).
- Autenticación/identidad robusta.
- Aprobaciones interactivas.
- Reintentos/idempotencia en automatización.
