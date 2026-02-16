# ADR Day 1 - Base MVP Modular

## Status
Accepted

## Contexto
El repositorio inició vacío y el objetivo del Día 1 exige entregar 5 dominios funcionales con un flujo E2E mínimo y RBAC aplicado.

## Decisiones
1. Elegir Node.js + TypeScript + Express por velocidad de entrega.
2. Implementar persistencia in-memory para validar contratos primero.
3. Separar dominios por carpetas y conectar con event bus in-process.
4. Priorizar seguridad por `policy` (RBAC + confirmaciones sensibles).

## Consecuencias
- Ventaja: entrega rápida y testable.
- Riesgo: estado efímero al reiniciar proceso.
- Mitigación Day 2: migrar a persistencia real y agregar auth completa.

## Ambiguedades resueltas
- Sin stack previo detectable: se crea base TS/Express.
- Sin DB especificada para Day 1: se usa almacenamiento en memoria.
