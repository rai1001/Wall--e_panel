# ADR Day 2 - Persistencia, Auth y Aprobaciones

## Status
Accepted

## Fecha
2026-02-17

## Contexto
La base Day 1 cumplia flujo E2E pero era in-memory, sin identidad fuerte y con confirmaciones solo por header.

## Decisiones

1. **Persistencia SQLite**
   Se migra a SQLite (`better-sqlite3`) con esquema inicial en `src/shared/db/database.ts`.

2. **Autenticacion JWT**
   Se agrega `AuthService` con login por usuarios seed y validacion Bearer token.

3. **Autorizacion**
   Se mantiene RBAC Day 1 y ahora se exige identidad autenticada para rutas de dominio.

4. **Aprobaciones sensibles**
   Se modelan como entidad persistente (`approvals`) con estados:
   - `pending`
   - `approved`
   - `rejected`

5. **Auditoria persistente**
   Se registra actividad sensible en tabla `audits`.

6. **Resiliencia automatizacion**
   Se incorporan:
   - reintentos por accion
   - idempotencia por `event_key`
   - run logs persistentes

## Consecuencias

- Mejora de seguridad y trazabilidad.
- Persistencia de estado entre reinicios.
- Mayor complejidad de infraestructura local (DB + seed + migraciones simples).

## Trade-offs

- Se priorizo simplicidad de entrega sobre normalizacion avanzada del esquema.
- Se mantiene un unico proceso (event bus in-process), no mensajeria distribuida.
