# ADR Day 3 - Memoria compartida robusta y operabilidad

## Status
Accepted

## Fecha
2026-02-17

## Contexto
Se requiere cerrar hardening y operatividad para uso diario real con:
- memoria persistente compartida entre agentes/proyectos
- búsqueda semántica real
- higiene de datos
- observabilidad operativa
- controles de seguridad adicionales

## Decisiones

1. **Memoria híbrida con embeddings en SQLite**
   - Se incorpora tabla `memory_embeddings` y ranking híbrido (semantic + lexical + prioridad contextual).
   - Se evita dependencia externa de vector DB para mantener despliegue local simple.

2. **Namespaces explícitos de memoria**
   - `project_id`, `agent_id`, `scope`, `memory_type`, `source`, `created_by`, `timestamp`.
   - Permite trazabilidad multiagente y aislamiento por contexto.

3. **Política de recuperación priorizada**
   - Boost de relevancia por:
     - proyecto activo
     - memorias globales
     - memorias del agente actual
   - Filtrado estricto para memorias privadas de otros agentes.

4. **Data hygiene incorporada al dominio**
   - Deduplicación por hash semántico aproximado.
   - TTL y archivado de memorias temporales.
   - Limpieza de `processed_events` para controlar crecimiento.

5. **Operación panel-first**
   - Endpoints para métricas y auditoría agregada.
   - Dashboard HTML operativo para memorias, aprobaciones y runs.
   - CLI como fallback mediante scripts de backup/restore/reindex/reset.

6. **Seguridad incremental**
   - Rate limit en login.
   - Lockout progresivo por intentos fallidos.
   - Rotación de JWT con múltiples secretos (`JWT_SECRETS` + `kid`).
   - Validación fuerte con Zod.

## Consecuencias
- Mejor trazabilidad y control operativo en memoria compartida.
- Mayor complejidad de esquema y mantenimiento.
- Rendimiento de búsqueda vectorial O(n) en SQLite (aceptable para v1; candidato a ANN/vector DB en v2).

## Riesgos asumidos
- Embeddings hash-based locales no alcanzan calidad de modelos semánticos SOTA.
- Dashboard HTML server-side simple (funcional, no framework SPA completo).
