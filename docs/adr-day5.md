# ADR Day 5 - Dashboard modular usable for daily operation

## Status
Accepted (2026-02-17)

## Context
Previous dashboard version was mostly operational telemetry and memory tooling.
For daily usage, users needed practical flows for projects, automation management and chat visibility from a single panel.

## Decision
Refactor `/v1/dashboard` into a modular control panel with four views:
- Dashboard
- Projects
- Automations
- Chat Timeline

And extend API surface minimally (without large rewrites):
- `GET /v1/chat/timeline`
- `PATCH /v1/automation/rules/:id/status`
- keep existing project CRUD endpoints

## Rationale
- Reuses existing domain services and authorization middleware.
- Avoids introducing a separate frontend build/deploy pipeline (keeps Express-rendered HTML for now).
- Preserves backward compatibility and legacy route mounting strategy.

## Migration/Safety
- Harden DB migration for legacy `project_id` paths in `conversations` and `memory_items`.
- Keep migration idempotent with table/column/index guards.

## Consequences
Positive:
- Panel is usable by non-technical daily workflow.
- Faster operational loop from a single authenticated view.

Tradeoffs:
- Dashboard UI remains server-rendered string HTML/JS (maintainability lower than dedicated frontend app).
- Some rich UX capabilities (pagination, advanced drilldown) are deferred.

## Follow-up
- If panel complexity grows, split UI into static assets or SPA while keeping same `/v1/*` contracts.
- Add richer chat timeline events beyond chat messages if needed (cross-domain timeline).
