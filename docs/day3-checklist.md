# Day 3 Checklist (Pendiente)

1. API contract hardening
- Validacion estructural de payloads con esquemas (zod o similar).
- Versionado de API (`/v1`) y manejo de deprecaciones.

2. Automatizacion avanzada
- Condiciones compuestas (AND/OR) en triggers.
- Dead-letter queue para fallos permanentes.
- Programacion temporal (`cron`) para reglas.

3. Seguridad adicional
- Rotacion de secretos JWT.
- Rate limiting por endpoint.
- Bloqueo progresivo por intentos fallidos de login.

4. Observabilidad
- Metricas (latencia, error rate, retries).
- Correlation ID por request y por evento.
- Dashboard operacional basico.

5. Producto
- UI minima para aprobaciones y run logs.
- Plantillas de reglas comunes para onboarding rapido.
