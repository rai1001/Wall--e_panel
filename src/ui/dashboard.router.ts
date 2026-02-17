import { Router } from "express";
import { ApprovalService } from "../policy/approval.service";
import { AuditService } from "../policy/audit.service";
import { MemoryService } from "../memory/memory.service";
import { MetricsService } from "../ops/metrics.service";
import { asyncHandler } from "../shared/http/async-handler";

function renderDashboardHtml(token: string, role: string) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OpenClaw Memory Control Deck</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0f141f;
      --panel: #131f2f;
      --panel-2: #0f1824;
      --ink: #f0f7ff;
      --muted: #8ea1b8;
      --line: rgba(255,255,255,.14);
      --accent: #ffd166;
      --ok: #2dd4bf;
      --bad: #ff6363;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      font-family: "Space Grotesk", sans-serif;
      background:
        radial-gradient(circle at 12% 20%, #2d3958 0%, transparent 33%),
        radial-gradient(circle at 84% 20%, #63411f 0%, transparent 35%),
        linear-gradient(160deg, #0d131d, #070b12);
      min-height: 100vh;
    }
    .wrap { max-width: 1300px; margin: 0 auto; padding: 22px; }
    h1 { margin: 0; font-size: clamp(26px, 4.3vw, 48px); text-transform: uppercase; letter-spacing: -.02em; }
    .sub { margin-top: 6px; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .1em; font-family: "IBM Plex Mono", monospace; }
    .grid { display: grid; gap: 14px; grid-template-columns: 1fr 1fr; margin-top: 16px; }
    .card {
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 14px;
      background: linear-gradient(160deg, rgba(255,255,255,.05), rgba(255,255,255,.02));
      backdrop-filter: blur(4px);
    }
    .card h2 { margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: .09em; }
    .stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
    .stat { border: 1px solid var(--line); border-radius: 10px; padding: 8px; }
    .stat .k { font-size: 11px; color: var(--muted); text-transform: uppercase; font-family: "IBM Plex Mono", monospace; }
    .stat .v { font-size: 23px; font-weight: 700; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { text-align: left; border-bottom: 1px dashed var(--line); padding: 8px 6px; vertical-align: top; }
    th { font-size: 10px; text-transform: uppercase; color: var(--muted); letter-spacing: .08em; }
    .mono { font-family: "IBM Plex Mono", monospace; }
    .controls { display: grid; grid-template-columns: repeat(6, minmax(100px, 1fr)); gap: 8px; }
    input, select {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255,255,255,.04);
      color: var(--ink);
      padding: 7px 8px;
      font-family: "IBM Plex Mono", monospace;
      font-size: 11px;
    }
    button {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255,255,255,.05);
      color: var(--ink);
      padding: 6px 9px;
      font-family: "IBM Plex Mono", monospace;
      font-size: 11px;
      text-transform: uppercase;
      cursor: pointer;
    }
    button:hover { border-color: var(--accent); color: var(--accent); }
    .pill { padding: 2px 7px; border-radius: 999px; border: 1px solid var(--line); font-size: 10px; font-family: "IBM Plex Mono", monospace; }
    .ok { color: var(--ok); }
    .bad { color: var(--bad); }
    @media (max-width: 1080px) {
      .grid { grid-template-columns: 1fr; }
      .controls { grid-template-columns: repeat(2, minmax(100px, 1fr)); }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>OpenClaw Control Deck</h1>
    <div class="sub">role: <span class="mono">${role}</span> / panel operativo de memorias y automatizaciones</div>
    <div class="grid">
      <section class="card">
        <h2>Metricas Operativas</h2>
        <div class="stats">
          <div class="stat"><div class="k">Requests</div><div class="v" id="requestsTotal">-</div></div>
          <div class="stat"><div class="k">Err</div><div class="v" id="requestsErr">-</div></div>
          <div class="stat"><div class="k">Memories</div><div class="v" id="memoryTotal">-</div></div>
          <div class="stat"><div class="k">Retries</div><div class="v" id="automationRetries">-</div></div>
          <div class="stat"><div class="k">Emb v</div><div class="v" id="embeddingOldPct">-</div></div>
          <div class="stat"><div class="k">RL Buckets</div><div class="v" id="rateLimitBuckets">-</div></div>
        </div>
        <div style="margin-top:8px; font-size:11px; color:var(--muted);" class="mono" id="runtimePin">runtime: -</div>
      </section>
      <section class="card">
        <h2>Rate Limit Health</h2>
        <div style="display:flex; gap:8px; margin-bottom:8px;">
          <span class="pill">backend <span id="rlBackend">-</span></span>
          <span class="pill">avg window <span id="rlWindow">-</span></span>
          <span class="pill">evictions <span id="rlEvictions">-</span></span>
        </div>
        <table>
          <thead><tr><th>Key</th><th>Blocked</th></tr></thead>
          <tbody id="rlTopBody"></tbody>
        </table>
      </section>
      <section class="card">
        <h2>Aprobaciones + Runs</h2>
        <table>
          <thead><tr><th>ID</th><th>Action</th><th>Status</th><th>Ops</th></tr></thead>
          <tbody id="approvalsBody"></tbody>
        </table>
        <div style="height:8px"></div>
        <table>
          <thead><tr><th>Rule</th><th>Status</th><th>Attempts</th><th>Event</th></tr></thead>
          <tbody id="runsBody"></tbody>
        </table>
      </section>
      <section class="card" style="grid-column:1 / -1;">
        <h2>Memorias Compartidas</h2>
        <div class="controls">
          <input id="fProject" placeholder="project_id" />
          <input id="fAgent" placeholder="agent_id" />
          <select id="fScope"><option value="">scope</option><option>global</option><option>proyecto</option><option>privado</option></select>
          <input id="fType" placeholder="tipo" />
          <input id="fFrom" placeholder="desde ISO" />
          <input id="fTo" placeholder="hasta ISO" />
        </div>
        <div style="display:flex; gap:8px; margin:8px 0;">
          <input id="fQuery" placeholder="buscar semantica/texto" style="flex:1" />
          <button onclick="loadMemory()">Filtrar</button>
        </div>
        <table>
          <thead><tr><th>ID</th><th>Proyecto</th><th>Agente</th><th>Scope</th><th>Tipo</th><th>Contenido</th><th>Autor</th><th>Fecha</th><th>Ops</th></tr></thead>
          <tbody id="memoryBody"></tbody>
        </table>
      </section>
    </div>
  </div>
  <script>
    const token = ${JSON.stringify(token)};
    const headers = { "authorization": token, "content-type": "application/json" };

    function q(id) { return document.getElementById(id); }
    async function fetchJson(url, options = {}) {
      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...(options.headers || {}) }
      });
      if (!response.ok) {
        throw new Error(url + " -> " + response.status);
      }
      return response.json();
    }

    async function approve(id, action) {
      await fetchJson('/v1/policy/approvals/' + id + '/' + action, { method: 'POST' });
      await load();
    }

    async function memoryAction(id, action) {
      await fetchJson('/v1/memory/' + id + '/' + action, { method: 'POST' });
      await loadMemory();
    }

    async function loadMemory() {
      const params = new URLSearchParams();
      if (q('fProject').value) params.set('projectId', q('fProject').value);
      if (q('fAgent').value) params.set('agentId', q('fAgent').value);
      if (q('fScope').value) params.set('scope', q('fScope').value);
      if (q('fType').value) params.set('memoryType', q('fType').value);
      if (q('fFrom').value) params.set('from', q('fFrom').value);
      if (q('fTo').value) params.set('to', q('fTo').value);
      if (q('fQuery').value) params.set('q', q('fQuery').value);
      params.set('limit', '80');
      const memories = await fetchJson('/v1/memory/panel?' + params.toString(), { method: 'GET' });

      q('memoryBody').innerHTML = memories.map(item => (
        '<tr>' +
          '<td class="mono">' + item.id + '</td>' +
          '<td class="mono">' + (item.projectId || '-') + '</td>' +
          '<td class="mono">' + (item.agentId || '-') + '</td>' +
          '<td><span class="pill">' + item.scope + '</span></td>' +
          '<td class="mono">' + (item.memoryType || '-') + '</td>' +
          '<td>' + item.content + '</td>' +
          '<td class="mono">' + (item.createdBy || '-') + '</td>' +
          '<td class="mono">' + item.timestamp + '</td>' +
          '<td>' +
            '<button onclick="memoryAction(\\'' + item.id + '\\', \\'promote-global\\')">promote</button> ' +
            '<button onclick="memoryAction(\\'' + item.id + '\\', \\'forget\\')">forget</button> ' +
            '<button onclick="memoryAction(\\'' + item.id + '\\', \\'block\\')">block</button>' +
          '</td>' +
        '</tr>'
      )).join('') || '<tr><td colspan="9">Sin memorias</td></tr>';
    }

    async function load() {
      const [metrics, memoryMetrics, approvals, runs, rateLimitHealth] = await Promise.all([
        fetchJson('/v1/ops/metrics'),
        fetchJson('/v1/ops/memory/metrics'),
        fetchJson('/v1/policy/approvals?status=pending'),
        fetchJson('/v1/automation/runs'),
        fetchJson('/v1/ops/rate-limit/health?limit=6')
      ]);

      q('requestsTotal').textContent = metrics.requests.total;
      q('requestsErr').textContent = metrics.requests.errors;
      q('memoryTotal').textContent = memoryMetrics.total;
      q('automationRetries').textContent = metrics.automation.retries;
      q('embeddingOldPct').textContent = (memoryMetrics.embeddingDrift?.oldVersionPct || 0) + '%';
      q('rateLimitBuckets').textContent = rateLimitHealth.activeBuckets;
      q('runtimePin').textContent =
        'runtime: ' +
        (memoryMetrics.embeddingRuntime?.provider || '-') + '/' +
        (memoryMetrics.embeddingRuntime?.model || '-') + '/' +
        (memoryMetrics.embeddingRuntime?.version || '-');
      q('rlBackend').textContent = rateLimitHealth.backend;
      q('rlWindow').textContent = String(rateLimitHealth.averageWindowMs || 0) + 'ms';
      q('rlEvictions').textContent = String(rateLimitHealth.evictions || 0);

      q('rlTopBody').innerHTML = (rateLimitHealth.topBlockedKeys || []).map(item => (
        '<tr><td class=\"mono\">' + item.key + '</td><td>' + item.blockedCount + '</td></tr>'
      )).join('') || '<tr><td colspan=\"2\">Sin bloqueos</td></tr>';

      q('approvalsBody').innerHTML = approvals.map(item => (
        '<tr>' +
          '<td class="mono">' + item.id + '</td>' +
          '<td class="mono">' + item.actionType + '</td>' +
          '<td><span class="pill">' + item.status + '</span></td>' +
          '<td><button onclick="approve(\\'' + item.id + '\\', \\'approve\\')">approve</button> <button onclick="approve(\\'' + item.id + '\\', \\'reject\\')">reject</button></td>' +
        '</tr>'
      )).join('') || '<tr><td colspan="4">Sin pendientes</td></tr>';

      q('runsBody').innerHTML = runs.slice(0, 8).map(item => (
        '<tr>' +
          '<td class="mono">' + item.ruleId + '</td>' +
          '<td><span class="pill ' + (item.status === 'success' ? 'ok' : 'bad') + '">' + item.status + '</span></td>' +
          '<td>' + (item.attempts || 1) + '</td>' +
          '<td class="mono">' + (item.eventKey || '-') + '</td>' +
        '</tr>'
      )).join('');

      await loadMemory();
    }

    load().catch((error) => {
      console.error(error);
      alert('No se pudo cargar dashboard: ' + error.message);
    });
  </script>
</body>
</html>`;
}

export function createDashboardRouter(
  metricsService: MetricsService,
  auditService: AuditService,
  approvalService: ApprovalService,
  memoryService: MemoryService
) {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const authHeader = req.header("authorization") ?? "";
      res.type("text/html").send(renderDashboardHtml(authHeader, req.role));
    })
  );

  router.get(
    "/data",
    asyncHandler(async (_req, res) => {
      res.status(200).json({
        metrics: metricsService.snapshot(),
        memoryMetrics: memoryService.getMetrics(),
        approvals: approvalService.list("pending"),
        audit: auditService.list(25)
      });
    })
  );

  return router;
}
