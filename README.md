# Asistente Personal Modular - Day 1

MVP funcional con cinco dominios: `chat`, `project`, `memory`, `automation`, `policy`.

## Objetivo Day 1
Entregar base modular mínima con flujo integrado:

`Crear tarea en Proyecto -> dispara Automatización -> genera mensaje en Chat -> guarda registro en Memoria`

## Stack
- Node.js + TypeScript
- Express (API)
- Vitest + Supertest (testing)
- Persistencia in-memory (iteración rápida)

## Módulos
- `src/chat`: conversaciones, mensajes, participantes.
- `src/project`: proyectos, tareas, milestones.
- `src/memory`: memoria utilizable.
- `src/automation`: reglas, triggers, acciones y run logs.
- `src/policy`: RBAC + confirmaciones.
- `src/shared`: utilidades compartidas (event bus, errores, ids).

## Flujo de eventos
1. `project` crea tarea y emite `task_created`.
2. `automation` consume `task_created`.
3. `automation` ejecuta `post_chat_message`.
4. `automation` ejecuta `save_memory`.
5. `automation` registra `automation_rule_executed`.

## Estado actual
Bloque A inicializado. El resto de módulos se completa en los siguientes bloques.
