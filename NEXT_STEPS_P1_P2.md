# Next steps (P1/P2)

Fecha: 2026-02-17

## P1 (esta semana)
1. Rate limit de produccion
- Diferenciar politicas por endpoint sensible (`/auth/login`, `/automation/*`, `/memory/*`).
- Incluir IP real con `trust proxy` y validacion de cabeceras en edge.

2. Seguridad automatizada en CI
- Secret scan en PR.
- Tests de regresion authz (403/401 esperados) por modulo.
- Validacion de payloads criticos con casos malformed/fuzz basico.

3. Contratos API
- Verificacion de compatibilidad (`/v1` vs rutas legacy).
- Checks de OpenAPI para no romper clientes del panel.

4. Observabilidad util
- Metricas: ratio 401/403, login lockouts, bloqueos de rate limit, errores de automation.
- Dashboards operativos para soporte diario.

5. Runbook operativo
- Procedimiento de respuesta ante:
  - secreto JWT comprometido,
  - falla de proveedor de embeddings Google,
  - degradacion de DB/rate-limit store.

## P2 (2-6 semanas)
1. Sesiones y revocacion real
- Blacklist/allowlist de JWT o session store dedicado.
- Logout global y por dispositivo.

2. Migraciones versionadas
- Tabla `schema_migrations` con version + checksum.
- Rollback probado sobre snapshot real legacy.

3. Gobernanza de datos
- Retencion por tipo de evidencia (auditoria/dead letters/memory temporal).
- Limpieza programada con evidencia de ejecucion.

4. Seguridad avanzada
- Endurecer CSP removiendo `unsafe-inline` con nonce/hashes.
- Revisar cabeceras para despliegue final (HSTS segun TLS real).

5. Calidad de producto
- E2E web reales del panel (login -> proyectos -> automations -> timeline).
- KPIs de UX operativa (tiempo de tarea, errores recuperables, estados vacios).

## Dependencias para iniciar P1
- Mantener Fase 0 en verde en CI.
- Congelar contratos actuales durante hardening para evitar drift funcional.
