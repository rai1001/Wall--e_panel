# Day 2 Checklist

1. Persistencia y datos
- Definir DB (PostgreSQL o SQLite) y migraciones.
- Reemplazar repositorios in-memory por repositorios persistentes.
- Añadir índices para búsquedas de memoria por `scope/tags/text`.

2. Seguridad
- Implementar autenticación real (JWT/OAuth).
- Sustituir headers `x-role` por claims verificadas.
- Persistir auditoría y crear endpoint de consulta con filtros.

3. Automatización
- Añadir retries + backoff + idempotencia por evento.
- Soportar condiciones más expresivas en `trigger.filter`.
- Evitar loops de reglas con control de profundidad/correlación.

4. UX/API
- Estandarizar errores de validación por contrato.
- Publicar OpenAPI para endpoints Day 1.
- Crear endpoint de onboarding para flujo E2E guiado.

5. Calidad
- Cobertura mínima por dominio.
- Pipeline CI con `typecheck`, `test` y smoke.
- Tests de regresión para RBAC y aprobaciones sensibles.
