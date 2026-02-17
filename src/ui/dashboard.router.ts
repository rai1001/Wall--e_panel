import { Router } from "express";
import { ApprovalService } from "../policy/approval.service";
import { AuditService } from "../policy/audit.service";
import { MemoryService } from "../memory/memory.service";
import { MetricsService } from "../ops/metrics.service";
import { asyncHandler } from "../shared/http/async-handler";

function renderOperationalDashboardHtml(token: string, role: string) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OpenClaw Control Deck - Workboard</title>
  <style>
    :root {
      --bg: #0b1220;
      --card: #121c2f;
      --line: #24314d;
      --text: #e8eefc;
      --muted: #9aa9c9;
      --ok: #1ec18b;
      --bad: #ff6f6f;
      --acc: #f9be4f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(180deg, #0a1220, #0d1628);
      color: var(--text);
    }
    .wrap {
      width: min(1200px, 100%);
      margin: 0 auto;
      padding: 16px;
      display: grid;
      gap: 12px;
    }
    .head {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--card);
      padding: 12px;
    }
    h1 {
      margin: 0;
      font-size: clamp(26px, 4vw, 44px);
      letter-spacing: -.03em;
    }
    .sub {
      margin-top: 4px;
      color: var(--muted);
      font-size: 13px;
    }
    .links {
      margin-top: 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .chip {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 6px 10px;
      color: var(--text);
      text-decoration: none;
      font-size: 12px;
      background: #16233b;
    }
    .status {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px;
      color: var(--muted);
      background: #101a2d;
      min-height: 44px;
    }
    .status.ok { border-color: #1f785f; color: #7de4bf; }
    .status.error { border-color: #893939; color: #ffb3b3; }
    .spotlight {
      border-color: #3b4f77;
      background:
        radial-gradient(circle at 10% 0%, rgba(249, 190, 79, 0.12), transparent 45%),
        linear-gradient(165deg, rgba(22, 35, 59, 0.95), rgba(15, 25, 44, 0.95));
    }
    .spotline {
      color: #f7d180;
      font-weight: 700;
      letter-spacing: .02em;
      font-size: 12px;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .quick-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 10px;
    }
    .quick-actions {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
    }
    .checkline {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-size: 12px;
    }
    .quick-summary {
      border: 1px dashed var(--line);
      border-radius: 8px;
      padding: 8px;
      color: var(--muted);
      font-size: 12px;
      background: rgba(255, 255, 255, 0.02);
      min-height: 42px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(280px, 1fr));
      gap: 12px;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--card);
      padding: 12px;
    }
    h2 {
      margin: 0 0 8px;
      font-size: 16px;
    }
    .hint {
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 8px;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 8px;
      margin-bottom: 8px;
    }
    .row.single { grid-template-columns: 1fr auto; }
    .row.chat { grid-template-columns: 120px 1fr auto; }
    input, select, button {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #0f192c;
      color: var(--text);
      padding: 8px 10px;
      font-size: 13px;
    }
    button {
      cursor: pointer;
      background: #1a2946;
      font-weight: 600;
    }
    button.primary {
      background: linear-gradient(140deg, var(--acc), #efab29);
      color: #261a00;
      border-color: #f3b53c;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th, td {
      text-align: left;
      padding: 6px 4px;
      border-bottom: 1px dashed var(--line);
      vertical-align: top;
    }
    th { color: var(--muted); font-size: 11px; }
    .mono { font-family: Consolas, monospace; font-size: 11px; }
    .conversation-note {
      border: 1px dashed var(--line);
      border-radius: 8px;
      padding: 8px;
      margin-bottom: 8px;
      color: var(--muted);
      font-size: 12px;
      background: rgba(255, 255, 255, 0.02);
    }
    @media (max-width: 900px) {
      .quick-grid { grid-template-columns: 1fr; }
      .quick-actions { grid-template-columns: 1fr; }
      .grid { grid-template-columns: 1fr; }
      .row { grid-template-columns: 1fr; }
      .row.single { grid-template-columns: 1fr; }
      .row.chat { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="head">
      <h1>OpenClaw Control Deck</h1>
      <div class="sub">role: ${role} | flujo diario simple: proyecto -> tarea -> automatizacion -> evidencia</div>
      <div class="links">
        <span class="chip">Projects</span>
        <span class="chip">Automations</span>
        <span class="chip">Chat Timeline</span>
        <span class="chip">Memory</span>
        <span class="chip">Permissions</span>
        <a class="chip" href="/v1/dashboard?classic=1">Modo clasico</a>
      </div>
    </section>

    <div id="status" class="status">Listo para operar.</div>

    <section class="card spotlight">
      <div class="spotline">Modo rapido diario</div>
      <h2>1 boton para lanzar flujo: proyecto -> tarea -> automatizacion -> chat -> memoria</h2>
      <div class="hint">Si no eliges proyecto existente, se crea uno nuevo. Luego se crea la tarea y se actualiza evidencia.</div>
      <div class="quick-grid">
        <div>
          <label class="hint" for="quickProject">Proyecto existente</label>
          <select id="quickProject">
            <option value="">(opcional) usar proyecto activo</option>
          </select>
        </div>
        <div>
          <label class="hint" for="quickProjectName">Nuevo proyecto (opcional)</label>
          <input id="quickProjectName" placeholder="Ej: Lanzamiento semanal Rai" />
        </div>
        <div>
          <label class="hint" for="quickTaskTitle">Tarea a lanzar (obligatorio)</label>
          <input id="quickTaskTitle" placeholder="Ej: Preparar propuesta final" required minlength="3" />
        </div>
        <div>
          <label class="hint" for="quickRuleMessage">Mensaje auto en chat (opcional)</label>
          <input id="quickRuleMessage" placeholder="Ej: Tarea registrada y en ejecucion" />
        </div>
      </div>
      <div class="quick-actions">
        <label class="checkline">
          <input id="quickEnsureRule" type="checkbox" checked />
          Asegurar regla base task_created -> chat + memory
        </label>
        <button id="quickRunBtn" class="primary" type="button">Crear y lanzar</button>
        <button id="quickOpenChatBtn" type="button">Ir a chat</button>
      </div>
      <div id="quickSummary" class="quick-summary mono">Sin ejecucion aun.</div>
    </section>

    <section class="grid">
      <article class="card">
        <h2>Paso 1. Proyecto</h2>
        <div class="hint">Crea o selecciona el proyecto activo.</div>
        <form id="projectForm" class="row">
          <input id="projectName" placeholder="Nombre proyecto" required minlength="3" />
          <select id="projectStatus">
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="done">done</option>
          </select>
          <button class="primary" type="submit">Crear proyecto</button>
        </form>
        <div class="row single">
          <select id="activeProject">
            <option value="">Selecciona proyecto</option>
          </select>
          <button id="refreshProjects" type="button">Refrescar</button>
        </div>
      </article>

      <article class="card">
        <h2>Paso 2. Tarea</h2>
        <div class="hint">Crear tarea dispara reglas task_created.</div>
        <form id="taskForm" class="row">
          <input id="taskTitle" placeholder="Titulo tarea" required minlength="3" />
          <select id="taskStatus">
            <option value="todo">todo</option>
            <option value="in_progress">in_progress</option>
            <option value="done">done</option>
          </select>
          <button class="primary" type="submit">Crear tarea</button>
        </form>
      </article>

      <article class="card">
        <h2>Paso 3. Automatizacion</h2>
        <div class="hint">Crea regla basica task_created -> chat + memory.</div>
        <form id="ruleForm" class="row">
          <input id="ruleName" placeholder="Nombre regla" required minlength="3" />
          <input id="ruleMessage" placeholder="Mensaje opcional" />
          <button class="primary" type="submit">Crear regla</button>
        </form>
        <div class="row single">
          <button id="bootstrapBtn" type="button">Crear flujo base (admin)</button>
          <button id="openLoginBtn" type="button">Re-login</button>
        </div>
      </article>

      <article class="card">
        <h2>Paso 4. Evidencia</h2>
        <div class="hint">Verifica runs, timeline y memoria del proyecto activo.</div>
        <div class="row single">
          <button id="refreshEvidence" class="primary" type="button">Actualizar evidencia</button>
          <button id="refreshRuns" type="button">Solo runs</button>
        </div>
      </article>

      <article class="card" id="chatCard">
        <h2>Paso 5. Chat operativo</h2>
        <div class="hint">Envio manual de mensajes. Si no existe conversacion para el proyecto, se crea al enviar.</div>
        <div id="chatConversationInfo" class="conversation-note mono">Conversacion: selecciona proyecto</div>
        <form id="chatSendForm" class="row chat">
          <select id="chatRole">
            <option value="user">user</option>
            <option value="assistant">assistant</option>
            <option value="system">system</option>
          </select>
          <input id="chatContent" placeholder="Mensaje para el chat del proyecto" required maxlength="4000" />
          <button class="primary" type="submit">Enviar</button>
        </form>
        <div class="row single">
          <button id="refreshChat" type="button">Refrescar chat</button>
          <button id="createConversationBtn" type="button">Nueva conversacion</button>
        </div>
      </article>
    </section>

    <section class="grid">
      <article class="card">
        <h2>Runs recientes</h2>
        <table>
          <thead><tr><th>Rule</th><th>Status</th><th>Attempts</th></tr></thead>
          <tbody id="runsBody"><tr><td colspan="3">Sin datos</td></tr></tbody>
        </table>
      </article>

      <article class="card">
        <h2>Chat timeline (proyecto activo)</h2>
        <table>
          <thead><tr><th>Timestamp</th><th>Conversacion</th><th>Role</th><th>Contenido</th></tr></thead>
          <tbody id="timelineBody"><tr><td colspan="4">Sin datos</td></tr></tbody>
        </table>
      </article>

      <article class="card" style="grid-column: 1 / -1;">
        <h2>Mensajes de la conversacion activa</h2>
        <table>
          <thead><tr><th>Timestamp</th><th>Role</th><th>Contenido</th></tr></thead>
          <tbody id="messagesBody"><tr><td colspan="3">Sin conversacion activa</td></tr></tbody>
        </table>
      </article>

      <article class="card" style="grid-column: 1 / -1;">
        <h2>Memoria (proyecto activo)</h2>
        <table>
          <thead><tr><th>ID</th><th>Scope</th><th>Contenido</th><th>Fecha</th></tr></thead>
          <tbody id="memoryBody"><tr><td colspan="4">Sin datos</td></tr></tbody>
        </table>
      </article>
    </section>
  </main>

  <script>
    const token = ${JSON.stringify(token)};
    const state = { projectId: "", conversationId: "", actorId: "anonymous" };

    const q = (id) => document.getElementById(id);
    const esc = (v) => String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

    function status(text, kind = "") {
      const el = q("status");
      el.textContent = text;
      el.className = "status" + (kind ? " " + kind : "");
    }

    async function api(url, options = {}) {
      const headers = Object.assign({}, options.headers || {});
      if (token && token.trim()) headers.authorization = token;
      if (options.body && !headers["content-type"]) headers["content-type"] = "application/json";

      const res = await fetch(url, {
        method: options.method || "GET",
        headers,
        body: options.body,
        credentials: "same-origin"
      });

      const raw = await res.text();
      let json = null;
      try { json = raw ? JSON.parse(raw) : null; } catch (_e) { json = null; }

      if (!res.ok) {
        const err = new Error((json && json.message) || ("HTTP " + res.status));
        err.status = res.status;
        throw err;
      }

      return json;
    }

    function setTableRows(tbodyId, html, fallbackColspan, fallbackText) {
      const tbody = q(tbodyId);
      tbody.innerHTML = html || '<tr><td colspan="' + fallbackColspan + '">' + esc(fallbackText) + '</td></tr>';
    }

    function setQuickSummary(text) {
      const node = q("quickSummary");
      if (node) {
        node.textContent = text;
      }
    }

    function syncProjectSelectors(projectId) {
      if (q("activeProject")) {
        q("activeProject").value = projectId || "";
      }
      if (q("quickProject")) {
        q("quickProject").value = projectId || "";
      }
    }

    function activeProjectId() {
      return q("activeProject").value || state.projectId;
    }

    function setConversationInfo(text) {
      const node = q("chatConversationInfo");
      if (node) {
        node.textContent = text;
      }
    }

    function projectLabel(projectId) {
      if (!projectId) {
        return "";
      }

      const select = q("activeProject");
      if (!(select instanceof HTMLSelectElement)) {
        return projectId;
      }

      const option = Array.from(select.options).find((item) => item.value === projectId);
      if (!option) {
        return projectId;
      }

      return String(option.textContent || "").replace(/\\s\\(.+\\)$/, "").trim() || projectId;
    }

    async function loadViewerIdentity() {
      try {
        const me = await api("/v1/auth/me");
        if (me && typeof me.actorId === "string" && me.actorId.trim()) {
          state.actorId = me.actorId.trim();
        }
      } catch (_error) {
        state.actorId = "anonymous";
      }
    }

    async function discoverConversationId(projectId) {
      if (!projectId) {
        return "";
      }

      const timeline = await api("/v1/chat/timeline?projectId=" + encodeURIComponent(projectId) + "&limit=25");
      const found = Array.isArray(timeline)
        ? timeline.find((item) => item && item.conversationId)
        : null;
      if (found && found.conversationId) {
        state.conversationId = String(found.conversationId);
      }

      return state.conversationId;
    }

    async function ensureConversationId(projectId, forceNew = false) {
      if (!projectId) {
        throw new Error("Selecciona proyecto antes de operar chat");
      }

      if (!forceNew && state.conversationId) {
        return state.conversationId;
      }

      if (!forceNew) {
        const existing = await discoverConversationId(projectId);
        if (existing) {
          setConversationInfo("Conversacion activa: " + existing + " (descubierta)");
          return existing;
        }
      }

      const conversation = await api("/v1/chat/conversations", {
        method: "POST",
        body: JSON.stringify({
          title: "Chat " + projectLabel(projectId),
          projectId
        })
      });

      state.conversationId = String(conversation.id);
      setConversationInfo("Conversacion activa: " + state.conversationId + " (creada ahora)");
      return state.conversationId;
    }

    function hasBaselineAutomationRule(rule) {
      if (!rule || !rule.trigger || rule.trigger.type !== "task_created") {
        return false;
      }

      const actionTypes = Array.isArray(rule.actions)
        ? rule.actions.map((action) => String(action.type || ""))
        : [];
      return actionTypes.includes("post_chat_message") && actionTypes.includes("save_memory");
    }

    async function ensureBaselineAutomationRule(message) {
      const rules = await api("/v1/automation/rules");
      const found = Array.isArray(rules)
        ? rules.find((rule) => hasBaselineAutomationRule(rule))
        : null;

      if (found) {
        if (!found.enabled) {
          await api("/v1/automation/rules/" + encodeURIComponent(found.id) + "/status", {
            method: "PATCH",
            body: JSON.stringify({ enabled: true })
          });
        }
        return found.id;
      }

      const messagePayload = message ? { content: message } : {};
      const created = await api("/v1/automation/rules", {
        method: "POST",
        body: JSON.stringify({
          name: "Regla base diaria task_created",
          trigger: { type: "task_created" },
          actions: [
            { type: "post_chat_message", payload: messagePayload },
            { type: "save_memory", payload: { scope: "proyecto", source: "workboard:quick-flow" } }
          ],
          enabled: true
        })
      });

      return created.id;
    }

    async function runQuickFlow() {
      const selectedProjectId = q("quickProject").value || activeProjectId();
      const newProjectName = q("quickProjectName").value.trim();
      const taskTitle = q("quickTaskTitle").value.trim();
      const message = q("quickRuleMessage").value.trim();
      const ensureRule = q("quickEnsureRule").checked;

      if (!taskTitle) {
        status("Escribe una tarea en Modo rapido.", "error");
        return;
      }

      let projectId = selectedProjectId;
      status("Ejecutando flujo rapido...", "");
      setQuickSummary("Procesando...");

      try {
        if (!projectId) {
          if (!newProjectName) {
            status("Selecciona proyecto o escribe nombre de proyecto nuevo.", "error");
            setQuickSummary("Fallo: falta proyecto.");
            return;
          }

          const project = await api("/v1/projects", {
            method: "POST",
            body: JSON.stringify({ name: newProjectName, status: "active" })
          });
          projectId = String(project.id);
          state.projectId = projectId;
          state.conversationId = "";
          await loadProjects();
          syncProjectSelectors(projectId);
        } else {
          state.projectId = projectId;
          syncProjectSelectors(projectId);
        }

        let ruleId = "sin-cambios";
        if (ensureRule) {
          ruleId = await ensureBaselineAutomationRule(message);
        }

        const conversationId = await ensureConversationId(projectId, false);
        const task = await api("/v1/projects/" + encodeURIComponent(projectId) + "/tasks", {
          method: "POST",
          body: JSON.stringify({ title: taskTitle, status: "todo" })
        });

        q("quickTaskTitle").value = "";
        if (!selectedProjectId) {
          q("quickProjectName").value = "";
        }

        setQuickSummary(
          "OK | proyecto: " + projectId +
          " | tarea: " + task.id +
          " | conversacion: " + conversationId +
          " | regla: " + ruleId
        );
        status("Flujo lanzado: tarea creada y evidencias actualizadas.", "ok");
        await loadEvidence();
      } catch (error) {
        setQuickSummary("Fallo: " + (error.message || "error inesperado"));
        status("Error en flujo rapido: " + (error.message || "fallo"), "error");
      }
    }

    function focusChatComposer() {
      const chatCard = q("chatCard");
      if (chatCard && typeof chatCard.scrollIntoView === "function") {
        chatCard.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      const input = q("chatContent");
      if (input && typeof input.focus === "function") {
        input.focus();
      }
    }

    async function loadProjects() {
      const projects = await api("/v1/projects");
      const optionsHtml = '<option value="">Selecciona proyecto</option>' +
        (projects || []).map((p) => '<option value="' + esc(p.id) + '">' + esc(p.name) + ' (' + esc(p.status) + ')</option>').join("");
      const select = q("activeProject");
      const quickSelect = q("quickProject");
      select.innerHTML = optionsHtml;
      if (quickSelect) {
        quickSelect.innerHTML = '<option value="">(opcional) usar proyecto activo</option>' +
          (projects || []).map((p) => '<option value="' + esc(p.id) + '">' + esc(p.name) + ' (' + esc(p.status) + ')</option>').join("");
      }

      if (!state.projectId && projects && projects.length > 0) {
        state.projectId = String(projects[0].id);
      } else if (state.projectId) {
        state.projectId = String(state.projectId);
      }

      syncProjectSelectors(state.projectId);
      setConversationInfo(state.projectId ? "Conversacion: pendiente de carga" : "Conversacion: selecciona proyecto");
      return projects;
    }

    async function createProject(event) {
      event.preventDefault();
      const name = q("projectName").value.trim();
      const statusValue = q("projectStatus").value;
      if (!name) return;

      status("Creando proyecto...", "");
      try {
        const project = await api("/v1/projects", {
          method: "POST",
          body: JSON.stringify({ name, status: statusValue })
        });
        q("projectName").value = "";
        state.projectId = String(project.id);
        state.conversationId = "";
        await loadProjects();
        status("Proyecto creado y seleccionado.", "ok");
      } catch (error) {
        status("Error creando proyecto: " + (error.message || "fallo"), "error");
      }
    }

    async function createTask(event) {
      event.preventDefault();
      const title = q("taskTitle").value.trim();
      const taskStatus = q("taskStatus").value;
      const projectId = q("activeProject").value || state.projectId;
      if (!projectId) {
        status("Selecciona proyecto antes de crear tarea.", "error");
        return;
      }
      if (!title) return;

      status("Creando tarea...", "");
      try {
        await api("/v1/projects/" + encodeURIComponent(projectId) + "/tasks", {
          method: "POST",
          body: JSON.stringify({ title, status: taskStatus })
        });
        q("taskTitle").value = "";
        state.projectId = projectId;
        status("Tarea creada. Si hay regla activa, se dispara automatizacion.", "ok");
        await loadEvidence();
      } catch (error) {
        status("Error creando tarea: " + (error.message || "fallo"), "error");
      }
    }

    async function createRule(event) {
      event.preventDefault();
      const ruleName = q("ruleName").value.trim();
      const ruleMessage = q("ruleMessage").value.trim();
      if (!ruleName) return;

      status("Creando regla...", "");
      try {
        await api("/v1/automation/rules", {
          method: "POST",
          body: JSON.stringify({
            name: ruleName,
            trigger: { type: "task_created" },
            actions: [
              { type: "post_chat_message", payload: ruleMessage ? { content: ruleMessage } : {} },
              { type: "save_memory", payload: { scope: "proyecto", source: "workboard:rule" } }
            ]
          })
        });
        q("ruleName").value = "";
        q("ruleMessage").value = "";
        status("Regla creada.", "ok");
      } catch (error) {
        status("Error creando regla: " + (error.message || "fallo"), "error");
      }
    }

    async function bootstrapFlow() {
      status("Creando flujo base...", "");
      try {
        const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, "");
        const result = await api("/v1/onboarding/bootstrap-flow", {
          method: "POST",
          body: JSON.stringify({
            projectName: "Proyecto rapido " + stamp,
            conversationTitle: "Conversacion rapida " + stamp,
            ruleName: "Regla rapida " + stamp
          })
        });

        if (result && result.project && result.project.id) {
          state.projectId = String(result.project.id);
          await loadProjects();
        }

        status("Flujo base creado. Ahora crea una tarea en Paso 2.", "ok");
      } catch (error) {
        if (error && error.status === 403) {
          status("Solo admin puede usar bootstrap flow.", "error");
          return;
        }
        status("Error bootstrap: " + (error.message || "fallo"), "error");
      }
    }

    async function loadRuns() {
      const runs = await api("/v1/automation/runs");
      const html = (runs || []).slice(0, 8).map((run) =>
        '<tr>' +
          '<td class="mono">' + esc(run.ruleId) + '</td>' +
          '<td>' + esc(run.status) + '</td>' +
          '<td>' + esc(run.attempts || 1) + '</td>' +
        '</tr>'
      ).join("");
      setTableRows("runsBody", html, 3, "Sin runs");
    }

    async function loadTimeline() {
      const projectId = activeProjectId();
      if (!projectId) {
        setTableRows("timelineBody", "", 4, "Selecciona proyecto");
        return [];
      }
      const timeline = await api("/v1/chat/timeline?projectId=" + encodeURIComponent(projectId) + "&limit=10");
      if (!state.conversationId && Array.isArray(timeline) && timeline.length > 0 && timeline[0]?.conversationId) {
        state.conversationId = String(timeline[0].conversationId);
        setConversationInfo("Conversacion activa: " + state.conversationId + " (timeline)");
      }
      const html = (timeline || []).map((item) =>
        '<tr>' +
          '<td class="mono">' + esc(item.timestamp) + '</td>' +
          '<td class="mono">' + esc(item.conversationTitle || item.conversationId) + '</td>' +
          '<td>' + esc(item.role) + '</td>' +
          '<td>' + esc(item.content) + '</td>' +
        '</tr>'
      ).join("");
      setTableRows("timelineBody", html, 4, "Sin mensajes del proyecto");
      return timeline;
    }

    async function loadConversationMessages(timeline = []) {
      const projectId = activeProjectId();
      if (!projectId) {
        state.conversationId = "";
        setConversationInfo("Conversacion: selecciona proyecto");
        setTableRows("messagesBody", "", 3, "Selecciona proyecto");
        return;
      }

      if (!state.conversationId && Array.isArray(timeline) && timeline.length > 0 && timeline[0]?.conversationId) {
        state.conversationId = String(timeline[0].conversationId);
      }

      if (!state.conversationId) {
        setConversationInfo("Sin conversacion. Envia mensaje o crea una nueva.");
        setTableRows("messagesBody", "", 3, "Sin conversacion para este proyecto");
        return;
      }

      try {
        const messages = await api("/v1/chat/conversations/" + encodeURIComponent(state.conversationId) + "/messages");
        const html = (messages || []).slice(-15).map((message) =>
          '<tr>' +
            '<td class="mono">' + esc(message.createdAt) + '</td>' +
            '<td>' + esc(message.role) + '</td>' +
            '<td>' + esc(message.content) + '</td>' +
          '</tr>'
        ).join("");
        setConversationInfo("Conversacion activa: " + state.conversationId);
        setTableRows("messagesBody", html, 3, "Sin mensajes en la conversacion");
      } catch (error) {
        if (error && error.status === 403) {
          state.conversationId = "";
          setConversationInfo("Sin acceso a la conversacion previa. Crea una nueva.");
          setTableRows("messagesBody", "", 3, "Sin acceso a la conversacion actual");
          return;
        }
        throw error;
      }
    }

    async function sendChatMessage(event) {
      event.preventDefault();
      const projectId = activeProjectId();
      const roleValue = q("chatRole").value || "user";
      const content = q("chatContent").value.trim();

      if (!projectId) {
        status("Selecciona proyecto antes de enviar mensaje.", "error");
        return;
      }

      if (!content) {
        status("Escribe un mensaje antes de enviar.", "error");
        return;
      }

      status("Enviando mensaje al chat...", "");

      try {
        let conversationId = await ensureConversationId(projectId, false);
        try {
          await api("/v1/chat/conversations/" + encodeURIComponent(conversationId) + "/messages", {
            method: "POST",
            body: JSON.stringify({
              role: roleValue,
              content,
              actorType: "user",
              actorId: state.actorId
            })
          });
        } catch (error) {
          if (!(error && error.status === 403)) {
            throw error;
          }

          conversationId = await ensureConversationId(projectId, true);
          await api("/v1/chat/conversations/" + encodeURIComponent(conversationId) + "/messages", {
            method: "POST",
            body: JSON.stringify({
              role: roleValue,
              content,
              actorType: "user",
              actorId: state.actorId
            })
          });
        }

        q("chatContent").value = "";
        status("Mensaje enviado al chat del proyecto.", "ok");
        await loadEvidence();
      } catch (error) {
        status("Error enviando mensaje: " + (error.message || "fallo"), "error");
      }
    }

    async function createConversationManually() {
      const projectId = activeProjectId();
      if (!projectId) {
        status("Selecciona proyecto antes de crear conversacion.", "error");
        return;
      }

      status("Creando conversacion...", "");
      try {
        await ensureConversationId(projectId, true);
        await loadConversationMessages();
        status("Conversacion creada y activa.", "ok");
      } catch (error) {
        status("Error creando conversacion: " + (error.message || "fallo"), "error");
      }
    }

    async function loadMemory() {
      const projectId = activeProjectId();
      if (!projectId) {
        setTableRows("memoryBody", "", 4, "Selecciona proyecto");
        return;
      }
      const memories = await api("/v1/memory/search?projectId=" + encodeURIComponent(projectId) + "&limit=10");
      const html = (memories || []).map((item) =>
        '<tr>' +
          '<td class="mono">' + esc(item.id) + '</td>' +
          '<td>' + esc(item.scope) + '</td>' +
          '<td>' + esc(item.content) + '</td>' +
          '<td class="mono">' + esc(item.timestamp) + '</td>' +
        '</tr>'
      ).join("");
      setTableRows("memoryBody", html, 4, "Sin memorias del proyecto");
    }

    async function loadEvidence() {
      try {
        const timelinePromise = loadTimeline();
        await Promise.all([loadRuns(), loadMemory()]);
        const timeline = await timelinePromise;
        await loadConversationMessages(timeline);
      } catch (error) {
        if (error && error.status === 401) {
          status("Unauthorized: vuelve a /login.", "error");
          return;
        }
        status("Error cargando evidencia: " + (error.message || "fallo"), "error");
      }
    }

    q("projectForm").addEventListener("submit", createProject);
    q("taskForm").addEventListener("submit", createTask);
    q("ruleForm").addEventListener("submit", createRule);
    q("chatSendForm").addEventListener("submit", sendChatMessage);
    q("quickRunBtn").addEventListener("click", runQuickFlow);
    q("quickOpenChatBtn").addEventListener("click", focusChatComposer);
    q("bootstrapBtn").addEventListener("click", bootstrapFlow);
    q("refreshChat").addEventListener("click", async () => {
      try {
        const timeline = await loadTimeline();
        await loadConversationMessages(timeline);
        status("Chat actualizado.", "ok");
      } catch (error) {
        status("Error actualizando chat: " + (error.message || "fallo"), "error");
      }
    });
    q("createConversationBtn").addEventListener("click", createConversationManually);
    q("refreshProjects").addEventListener("click", async () => {
      try {
        await loadProjects();
        status("Proyectos actualizados.", "ok");
      } catch (error) {
        status("Error cargando proyectos: " + (error.message || "fallo"), "error");
      }
    });
    q("activeProject").addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      state.projectId = target.value || "";
      state.conversationId = "";
      syncProjectSelectors(state.projectId);
      loadEvidence();
    });
    q("quickProject").addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      state.projectId = target.value || "";
      state.conversationId = "";
      syncProjectSelectors(state.projectId);
      if (state.projectId) {
        loadEvidence();
      } else {
        setConversationInfo("Conversacion: selecciona proyecto");
      }
    });
    q("refreshEvidence").addEventListener("click", loadEvidence);
    q("refreshRuns").addEventListener("click", loadRuns);
    q("openLoginBtn").addEventListener("click", () => { window.location.href = "/login"; });

    (async () => {
      try {
        await loadViewerIdentity();
        await loadProjects();
        await loadEvidence();
      } catch (error) {
        if (error && error.status === 401) {
          status("Unauthorized: inicia sesion en /login.", "error");
          return;
        }
        status("Error inicializando panel: " + (error.message || "fallo"), "error");
      }
    })();
  </script>
</body>
</html>`;
}

function renderDashboardHtml(token: string, role: string) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OpenClaw Control Deck</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --ink: #eef3ff;
      --muted: #96a6ba;
      --line: rgba(255,255,255,.16);
      --accent: #ffd166;
      --ok: #2dd4bf;
      --bad: #ff6363;
      --warn: #fbbf24;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      font-family: "Space Grotesk", sans-serif;
      background:
        radial-gradient(circle at 10% 15%, #27324d, transparent 33%),
        radial-gradient(circle at 88% 20%, #614320, transparent 35%),
        linear-gradient(165deg, #070b12, #0d1520 58%, #060a10);
      min-height: 100vh;
    }
    .shell {
      width: min(1440px, 100%);
      margin: 0 auto;
      display: grid;
      grid-template-columns: 250px 1fr;
      gap: 14px;
      padding: 14px;
    }
    .sidebar, .main {
      border: 1px solid var(--line);
      border-radius: 16px;
      background: linear-gradient(165deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
      backdrop-filter: blur(5px);
      box-shadow: 0 22px 64px rgba(0,0,0,.34);
    }
    .sidebar {
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: calc(100vh - 28px);
      position: sticky;
      top: 14px;
    }
    .brand {
      text-transform: uppercase;
      font-weight: 700;
      font-size: 22px;
      letter-spacing: -.03em;
      line-height: .95;
    }
    .sub {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .1em;
      font-family: "IBM Plex Mono", monospace;
    }
    .pill {
      display: inline-block;
      width: fit-content;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .07em;
      font-family: "IBM Plex Mono", monospace;
    }
    .pill.ok { color: var(--ok); }
    .pill.bad { color: var(--bad); }
    .pill.warn { color: var(--warn); }
    .nav {
      display: grid;
      gap: 8px;
      margin-top: 6px;
    }
    .nav button {
      width: 100%;
      text-align: left;
      padding: 10px 11px;
      border: 1px solid var(--line);
      border-radius: 10px;
      color: var(--ink);
      background: rgba(255,255,255,.03);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .08em;
      font-family: "IBM Plex Mono", monospace;
      cursor: pointer;
    }
    .nav button.active {
      border-color: var(--accent);
      background: linear-gradient(140deg, #ffd166, #f7b953);
      color: #151106;
    }
    .main { padding: 14px; min-height: calc(100vh - 28px); }
    .head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      align-items: end;
      margin-bottom: 10px;
    }
    .head h1 {
      margin: 0;
      font-size: clamp(24px, 4vw, 42px);
      letter-spacing: -.03em;
      text-transform: uppercase;
      line-height: .95;
    }
    .head .meta {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .08em;
      font-family: "IBM Plex Mono", monospace;
    }
    .actions { display: flex; gap: 8px; }
    button, input, select {
      font-family: "IBM Plex Mono", monospace;
      font-size: 11px;
    }
    button {
      border: 1px solid var(--line);
      border-radius: 9px;
      background: rgba(255,255,255,.04);
      color: var(--ink);
      padding: 7px 9px;
      text-transform: uppercase;
      letter-spacing: .08em;
      cursor: pointer;
    }
    .views .view { display: none; }
    .views .view.active { display: block; }
    .status {
      display: none;
      margin: 8px 0;
      border: 1px dashed var(--line);
      border-radius: 8px;
      padding: 8px;
      color: var(--muted);
      font-size: 12px;
    }
    .status.show { display: block; }
    .status.error { color: var(--bad); border-color: rgba(255,99,99,.45); }
    .status.ok { color: var(--ok); border-color: rgba(45,212,191,.45); }
    .grid2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 10px;
      background: rgba(255,255,255,.04);
    }
    .card h2 {
      margin: 0 0 8px;
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .09em;
      font-family: "IBM Plex Mono", monospace;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
    }
    .stat {
      border: 1px solid var(--line);
      border-radius: 9px;
      padding: 8px;
    }
    .stat .k {
      color: var(--muted);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .08em;
      font-family: "IBM Plex Mono", monospace;
    }
    .stat .v {
      margin-top: 3px;
      font-size: 21px;
      font-weight: 700;
    }
    .controls {
      display: grid;
      grid-template-columns: repeat(6, minmax(90px, 1fr));
      gap: 8px;
      margin-bottom: 8px;
    }
    input, select {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255,255,255,.03);
      color: var(--ink);
      padding: 7px 8px;
    }
    .inline {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
    }
    .inline > * { flex: 1; }
    .inline .fit { flex: 0 0 auto; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th, td {
      padding: 7px 6px;
      text-align: left;
      border-bottom: 1px dashed var(--line);
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .08em;
      font-family: "IBM Plex Mono", monospace;
    }
    .mono { font-family: "IBM Plex Mono", monospace; }
    @media (max-width: 1160px) {
      .shell { grid-template-columns: 1fr; }
      .sidebar { min-height: auto; position: static; }
      .grid2 { grid-template-columns: 1fr; }
      .stats { grid-template-columns: repeat(3, 1fr); }
    }
    @media (max-width: 760px) {
      .controls { grid-template-columns: repeat(2, minmax(110px, 1fr)); }
      .stats { grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">OpenClaw<br/>Control Deck</div>
      <div class="sub">panel day 5 operativo</div>
      <span class="pill">role: ${role}</span>
      <nav class="nav">
        <button class="active" data-module="dashboard" type="button">Dashboard</button>
        <button data-module="projects" type="button">Projects</button>
        <button data-module="automations" type="button">Automations</button>
        <button data-module="chat" type="button">Chat Timeline</button>
        <button data-module="memory" type="button">Memory</button>
        <button data-module="permissions" type="button">Permissions</button>
      </nav>
      <div class="sub" style="margin-top:auto; line-height:1.6;">
        /login (secure entry)<br/>
        /v1/* versioned API<br/>
        embedding: google
      </div>
    </aside>
    <main class="main">
      <header class="head">
        <div>
          <h1 id="moduleTitle">Dashboard</h1>
          <div class="meta" id="moduleSubtitle">salud, memoria y aprobaciones</div>
        </div>
        <div class="actions">
          <button id="refreshModule" type="button">Refresh Module</button>
          <button id="goLogin" type="button">Re-login</button>
        </div>
      </header>

      <div class="views">
        <section class="view active" data-view="dashboard">
          <div class="status" id="status-dashboard"></div>
          <section class="card">
            <h2>Flujo Rapido (3 pasos)</h2>
            <div class="inline">
              <button class="fit" data-action="nav-module" data-target-module="projects" type="button">1) Proyecto + tarea</button>
              <button class="fit" data-action="nav-module" data-target-module="automations" type="button">2) Regla automatica</button>
              <button class="fit" data-action="nav-module" data-target-module="chat" type="button">3) Ver timeline</button>
            </div>
            <div class="inline">
              <button class="fit" data-action="bootstrap-flow" type="button">Crear flujo base (admin)</button>
            </div>
            <div class="sub" style="line-height:1.6;">Objetivo: crear tarea y validar que aparezca en chat/memoria con trazabilidad.</div>
          </section>
          <div style="height:10px"></div>
          <section class="card">
            <h2>Metricas Operativas</h2>
            <div class="stats">
              <div class="stat"><div class="k">Requests</div><div class="v" id="requestsTotal">-</div></div>
              <div class="stat"><div class="k">Errors</div><div class="v" id="requestsErr">-</div></div>
              <div class="stat"><div class="k">Memories</div><div class="v" id="memoryTotal">-</div></div>
              <div class="stat"><div class="k">Retries</div><div class="v" id="automationRetries">-</div></div>
              <div class="stat"><div class="k">Old Emb %</div><div class="v" id="embeddingOldPct">-</div></div>
              <div class="stat"><div class="k">RL Buckets</div><div class="v" id="rateLimitBuckets">-</div></div>
            </div>
            <div class="sub" id="runtimePin" style="margin-top:8px;">runtime: -</div>
          </section>
          <div style="height:10px"></div>
          <div class="grid2">
            <section class="card">
              <h2>Rate Limit Health</h2>
              <div class="inline">
                <span class="pill">backend <span id="rlBackend">-</span></span>
                <span class="pill">avg <span id="rlWindow">-</span></span>
                <span class="pill">evictions <span id="rlEvictions">-</span></span>
              </div>
              <table>
                <thead><tr><th>Key</th><th>Blocked</th></tr></thead>
                <tbody id="rlTopBody"><tr><td colspan="2">Sin datos</td></tr></tbody>
              </table>
            </section>
            <section class="card">
              <h2>Runs recientes</h2>
              <table>
                <thead><tr><th>Rule</th><th>Status</th><th>Attempts</th><th>Event</th></tr></thead>
                <tbody id="runsBody"><tr><td colspan="4">Sin datos</td></tr></tbody>
              </table>
              <div class="sub" style="margin-top:8px;">Aprobaciones y auditoria se operan en el modulo Permissions.</div>
            </section>
          </div>
        </section>

        <section class="view" data-view="projects">
          <div class="status" id="status-projects"></div>
          <div class="grid2">
            <section class="card">
              <h2>Paso 1: Crear Proyecto</h2>
              <form id="projectCreateForm" class="inline">
                <input id="projectName" required minlength="3" placeholder="Nombre del proyecto" />
                <select id="projectStatus"><option value="active">active</option><option value="paused">paused</option><option value="done">done</option></select>
                <button class="fit" type="submit">Crear</button>
              </form>
              <div class="sub" style="margin-top:6px;">Luego crea tareas para activar automatizaciones.</div>
              <div style="height:10px"></div>
              <h2>Paso 2: Crear Tarea</h2>
              <form id="taskCreateForm" class="controls" style="margin-bottom:0;">
                <select id="taskProjectId">
                  <option value="">Selecciona proyecto</option>
                </select>
                <input id="taskTitle" required minlength="3" placeholder="Titulo de tarea" />
                <select id="taskStatus">
                  <option value="todo">todo</option>
                  <option value="in_progress">in_progress</option>
                  <option value="done">done</option>
                </select>
                <input id="taskAssignee" placeholder="assignee opcional" />
                <button type="submit">Crear tarea</button>
              </form>
            </section>
            <section class="card">
              <h2>Paso 3: Ver y mover tareas</h2>
              <div class="inline">
                <select id="tasksProjectFilter">
                  <option value="">Selecciona proyecto</option>
                </select>
                <button class="fit" id="tasksRefreshButton" type="button">Cargar tareas</button>
              </div>
              <table>
                <thead><tr><th>ID</th><th>Titulo</th><th>Status</th><th>Assignee</th><th>Updated</th><th>Ops</th></tr></thead>
                <tbody id="tasksBody"><tr><td colspan="6">Selecciona un proyecto para ver tareas</td></tr></tbody>
              </table>
            </section>
          </div>
          <div style="height:10px"></div>
          <section class="card">
            <h2>Lista de Proyectos</h2>
            <table>
              <thead><tr><th>ID</th><th>Nombre</th><th>Status</th><th>Creado</th><th>Actualizar</th></tr></thead>
              <tbody id="projectsBody"><tr><td colspan="5">Sin datos</td></tr></tbody>
            </table>
          </section>
        </section>
        <section class="view" data-view="automations">
          <div class="status" id="status-automations"></div>
          <section class="card">
            <h2>Crear Regla Basica</h2>
            <form id="automationCreateForm" class="controls" style="margin-bottom:0;">
              <input id="ruleName" required minlength="3" placeholder="Nombre regla" />
              <select id="ruleTriggerType"><option value="task_created">task_created</option><option value="task_status_changed">task_status_changed</option></select>
              <input id="ruleMessage" placeholder="Mensaje chat (opcional)" />
              <select id="ruleMemoryScope"><option value="proyecto">memoria proyecto</option><option value="global">memoria global</option><option value="privado">memoria privado</option></select>
              <button type="submit">Crear regla</button>
            </form>
          </section>
          <div style="height:10px"></div>
          <div class="grid2">
            <section class="card">
              <h2>Reglas</h2>
              <table>
                <thead><tr><th>ID</th><th>Nombre</th><th>Trigger</th><th>Enabled</th><th>Ops</th></tr></thead>
                <tbody id="rulesBody"><tr><td colspan="5">Sin datos</td></tr></tbody>
              </table>
            </section>
            <section class="card">
              <h2>Ultimos Runs</h2>
              <table>
                <thead><tr><th>Rule</th><th>Status</th><th>Attempts</th><th>Start</th></tr></thead>
                <tbody id="automationRunsBody"><tr><td colspan="4">Sin datos</td></tr></tbody>
              </table>
            </section>
          </div>
        </section>

        <section class="view" data-view="chat">
          <div class="status" id="status-chat"></div>
          <section class="card">
            <h2>Filtros Timeline</h2>
            <form id="chatFilterForm" class="controls" style="margin-bottom:0;">
              <input id="chatProjectId" placeholder="project_id" />
              <input id="chatConversationId" placeholder="conversation_id" />
              <select id="chatRole"><option value="">role</option><option value="user">user</option><option value="assistant">assistant</option><option value="system">system</option></select>
              <input id="chatFrom" placeholder="from ISO" />
              <input id="chatTo" placeholder="to ISO" />
              <input id="chatLimit" type="number" min="1" max="200" value="50" />
              <button type="submit">Consultar</button>
            </form>
          </section>
          <div style="height:10px"></div>
          <section class="card">
            <h2>Chat Timeline</h2>
            <table>
              <thead><tr><th>Timestamp</th><th>Proyecto</th><th>Conversation</th><th>Role</th><th>Event</th><th>Contenido</th></tr></thead>
              <tbody id="chatTimelineBody"><tr><td colspan="6">Sin datos</td></tr></tbody>
            </table>
          </section>
        </section>

        <section class="view" data-view="memory">
          <div class="status" id="status-memory"></div>
          <section class="card">
            <h2>Memorias Compartidas</h2>
            <div class="controls">
              <input id="fProject" placeholder="project_id" />
              <input id="fAgent" placeholder="agent_id" />
              <select id="fScope"><option value="">scope</option><option value="global">global</option><option value="proyecto">proyecto</option><option value="privado">privado</option></select>
              <input id="fType" placeholder="tipo" />
              <input id="fFrom" placeholder="desde ISO" />
              <input id="fTo" placeholder="hasta ISO" />
            </div>
            <div class="inline">
              <input id="fQuery" placeholder="buscar semantica/texto" />
              <button class="fit" id="memoryFilterButton" type="button">Filtrar</button>
            </div>
            <table>
              <thead><tr><th>ID</th><th>Proyecto</th><th>Agente</th><th>Scope</th><th>Tipo</th><th>Contenido</th><th>Autor</th><th>Fecha</th><th>Ops</th></tr></thead>
              <tbody id="memoryBody"><tr><td colspan="9">Sin datos</td></tr></tbody>
            </table>
          </section>
        </section>

        <section class="view" data-view="permissions">
          <div class="status" id="status-permissions"></div>
          <div class="grid2">
            <section class="card">
              <h2>Aprobaciones pendientes</h2>
              <table>
                <thead><tr><th>ID</th><th>Action</th><th>Status</th><th>Ops</th></tr></thead>
                <tbody id="approvalsBody"><tr><td colspan="4">Sin datos</td></tr></tbody>
              </table>
            </section>
            <section class="card">
              <h2>Auditoria agregada</h2>
              <table>
                <thead><tr><th>Actor</th><th>Action</th><th>Resource</th><th>Total</th></tr></thead>
                <tbody id="permissionsAuditBody"><tr><td colspan="4">Sin datos</td></tr></tbody>
              </table>
            </section>
          </div>
        </section>
      </div>
    </main>
  </div>

  <script>
    const token = ${JSON.stringify(token)};
    const modules = {
      dashboard: ["Dashboard", "salud, memoria y aprobaciones"],
      projects: ["Projects", "flujo guiado de proyecto y tareas"],
      automations: ["Automations", "reglas, estado y runs"],
      chat: ["Chat Timeline", "mensajes recientes con filtros"],
      memory: ["Memory", "busqueda y acciones sobre memoria compartida"],
      permissions: ["Permissions", "aprobaciones y trazabilidad de acciones sensibles"]
    };
    const state = {
      current: "dashboard",
      projects: [],
      selectedProjectId: ""
    };

    function q(id) { return document.getElementById(id); }

    function esc(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function setStatus(moduleName, text, kind) {
      const el = q("status-" + moduleName);
      if (!el) return;
      if (!text) {
        el.className = "status";
        el.textContent = "";
        return;
      }
      el.className = "status show " + (kind || "");
      el.textContent = text;
    }

    function setTableMessage(tbodyId, colspan, text) {
      const tbody = q(tbodyId);
      if (!tbody) return;
      tbody.innerHTML = '<tr><td colspan="' + colspan + '">' + esc(text) + '</td></tr>';
    }

    function populateProjectSelects(projects) {
      const selects = [q("taskProjectId"), q("tasksProjectFilter")];
      selects.forEach((select) => {
        if (!(select instanceof HTMLSelectElement)) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">Selecciona proyecto</option>' +
          projects.map((item) => '<option value="' + esc(item.id) + '">' + esc(item.name) + ' (' + esc(item.status) + ')</option>').join("");
        if (currentValue && projects.some((item) => item.id === currentValue)) {
          select.value = currentValue;
        }
      });
    }

    function pill(value) {
      const low = String(value || "").toLowerCase();
      let cls = "pill";
      if (["success", "approved", "active", "done", "enabled"].includes(low)) cls += " ok";
      if (["failed", "rejected", "blocked", "disabled"].includes(low)) cls += " bad";
      if (["pending", "paused", "todo"].includes(low)) cls += " warn";
      return '<span class="' + cls + '">' + esc(value || "-") + '</span>';
    }

    async function fetchJson(url, options) {
      const opt = options || {};
      const headers = Object.assign({}, opt.headers || {});
      if (token && token.trim()) headers.authorization = token;
      if (opt.body && !headers["content-type"]) headers["content-type"] = "application/json";

      const response = await fetch(url, {
        method: opt.method || "GET",
        headers,
        body: opt.body,
        credentials: "same-origin"
      });

      const raw = await response.text();
      let payload = null;
      try { payload = raw ? JSON.parse(raw) : null; } catch (_error) { payload = null; }

      if (!response.ok) {
        const error = new Error((payload && payload.message) || ("Error HTTP " + response.status));
        error.status = response.status;
        throw error;
      }
      return payload;
    }

    function reportError(moduleName, error) {
      if (error && error.status === 401) {
        setStatus(moduleName, "Unauthorized: inicia sesion en /login y vuelve a cargar.", "error");
        return;
      }
      setStatus(moduleName, "Error: " + (error.message || "fallo inesperado"), "error");
    }

    function activate(moduleName) {
      state.current = moduleName;
      document.querySelectorAll("[data-module]").forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        el.classList.toggle("active", el.getAttribute("data-module") === moduleName);
      });
      document.querySelectorAll("[data-view]").forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        el.classList.toggle("active", el.getAttribute("data-view") === moduleName);
      });
      q("moduleTitle").textContent = modules[moduleName][0];
      q("moduleSubtitle").textContent = modules[moduleName][1];
      if (moduleName === "chat" && state.selectedProjectId) {
        const input = q("chatProjectId");
        if (input && !input.value) {
          input.value = state.selectedProjectId;
        }
      }
      loadCurrent();
    }

    async function loadCurrent() {
      if (state.current === "dashboard") return loadDashboard();
      if (state.current === "projects") return loadProjects();
      if (state.current === "automations") return loadAutomations();
      if (state.current === "chat") return loadChatTimeline();
      if (state.current === "memory") return loadMemoryModule();
      return loadPermissionsModule();
    }
    async function loadDashboard() {
      setStatus("dashboard", "Cargando dashboard...", "");
      setTableMessage("runsBody", 4, "Cargando...");
      setTableMessage("rlTopBody", 2, "Cargando...");
      try {
        const [metrics, memoryMetrics, runs, rateLimit] = await Promise.all([
          fetchJson("/v1/ops/metrics"),
          fetchJson("/v1/ops/memory/metrics"),
          fetchJson("/v1/automation/runs"),
          fetchJson("/v1/ops/rate-limit/health?limit=6")
        ]);

        q("requestsTotal").textContent = String(((metrics || {}).requests || {}).total || 0);
        q("requestsErr").textContent = String(((metrics || {}).requests || {}).errors || 0);
        q("memoryTotal").textContent = String((memoryMetrics || {}).total || 0);
        q("automationRetries").textContent = String(((metrics || {}).automation || {}).retries || 0);
        q("embeddingOldPct").textContent = String((((memoryMetrics || {}).embeddingDrift || {}).oldVersionPct || 0) + "%");
        q("rateLimitBuckets").textContent = String((rateLimit || {}).activeBuckets || 0);
        q("runtimePin").textContent =
          "runtime: " +
          ((((memoryMetrics || {}).embeddingRuntime || {}).provider) || "-") + "/" +
          ((((memoryMetrics || {}).embeddingRuntime || {}).model) || "-") + "/" +
          ((((memoryMetrics || {}).embeddingRuntime || {}).version) || "-");
        q("rlBackend").textContent = String((rateLimit || {}).backend || "-");
        q("rlWindow").textContent = String((rateLimit || {}).averageWindowMs || 0) + "ms";
        q("rlEvictions").textContent = String((rateLimit || {}).evictions || 0);

        const blocked = (rateLimit || {}).topBlockedKeys || [];
        q("rlTopBody").innerHTML = blocked.length === 0
          ? '<tr><td colspan="2">Sin bloqueos</td></tr>'
          : blocked.map((item) => '<tr><td class="mono">' + esc(item.key) + '</td><td>' + esc(item.blockedCount) + '</td></tr>').join("");

        q("runsBody").innerHTML = (runs || []).length === 0
          ? '<tr><td colspan="4">Sin runs</td></tr>'
          : runs.slice(0, 10).map((item) => (
              '<tr>' +
                '<td class="mono">' + esc(item.ruleId) + '</td>' +
                '<td>' + pill(item.status) + '</td>' +
                '<td>' + esc(item.attempts || 1) + '</td>' +
                '<td class="mono">' + esc(item.eventKey || "-") + '</td>' +
              '</tr>'
            )).join("");

        setStatus("dashboard", "", "");
      } catch (error) {
        reportError("dashboard", error);
      }
    }

    async function loadMemoryPanel() {
      setTableMessage("memoryBody", 9, "Cargando memorias...");
      const params = new URLSearchParams();
      const map = {
        projectId: q("fProject").value.trim(),
        agentId: q("fAgent").value.trim(),
        scope: q("fScope").value,
        memoryType: q("fType").value.trim(),
        from: q("fFrom").value.trim(),
        to: q("fTo").value.trim(),
        q: q("fQuery").value.trim()
      };
      Object.keys(map).forEach((key) => {
        const value = map[key];
        if (value) params.set(key, value);
      });
      params.set("limit", "80");

      try {
        const memories = await fetchJson("/v1/memory/panel?" + params.toString());
        q("memoryBody").innerHTML = !Array.isArray(memories) || memories.length === 0
          ? '<tr><td colspan="9">Sin memorias para los filtros actuales</td></tr>'
          : memories.map((item) => (
              '<tr>' +
                '<td class="mono">' + esc(item.id) + '</td>' +
                '<td class="mono">' + esc(item.projectId || "-") + '</td>' +
                '<td class="mono">' + esc(item.agentId || "-") + '</td>' +
                '<td>' + pill(item.scope) + '</td>' +
                '<td class="mono">' + esc(item.memoryType || "-") + '</td>' +
                '<td>' + esc(item.content) + '</td>' +
                '<td class="mono">' + esc(item.createdBy || "-") + '</td>' +
                '<td class="mono">' + esc(item.timestamp) + '</td>' +
                '<td><button data-action="memory-promote" data-memory-id="' + esc(item.id) + '">promote</button> <button data-action="memory-forget" data-memory-id="' + esc(item.id) + '">forget</button> <button data-action="memory-block" data-memory-id="' + esc(item.id) + '">block</button></td>' +
              '</tr>'
            )).join("");
      } catch (error) {
        setTableMessage("memoryBody", 9, "Error cargando memorias: " + (error.message || "fallo"));
      }
    }

    async function loadMemoryModule() {
      setStatus("memory", "Cargando memoria...", "");
      await loadMemoryPanel();
      setStatus("memory", "", "");
    }

    async function loadPermissionsModule() {
      setStatus("permissions", "Cargando aprobaciones y auditoria...", "");
      setTableMessage("approvalsBody", 4, "Cargando...");
      setTableMessage("permissionsAuditBody", 4, "Cargando...");

      try {
        const [approvals, auditAggregated] = await Promise.all([
          fetchJson("/v1/policy/approvals?status=pending"),
          fetchJson("/v1/ops/audit/aggregated?limit=20")
        ]);

        q("approvalsBody").innerHTML = !Array.isArray(approvals) || approvals.length === 0
          ? '<tr><td colspan="4">No hay aprobaciones pendientes</td></tr>'
          : approvals.map((item) => (
              '<tr>' +
                '<td class="mono">' + esc(item.id) + '</td>' +
                '<td class="mono">' + esc(item.actionType) + '</td>' +
                '<td>' + pill(item.status) + '</td>' +
                '<td><button data-action="approval-approve" data-approval-id="' + esc(item.id) + '">approve</button> <button data-action="approval-reject" data-approval-id="' + esc(item.id) + '">reject</button></td>' +
              '</tr>'
            )).join("");

        q("permissionsAuditBody").innerHTML =
          !Array.isArray(auditAggregated) || auditAggregated.length === 0
            ? '<tr><td colspan="4">No hay eventos de auditoria en el rango actual</td></tr>'
            : auditAggregated.map((item) => (
                '<tr>' +
                  '<td class="mono">' + esc(item.actorId || "-") + '</td>' +
                  '<td class="mono">' + esc(item.action || "-") + '</td>' +
                  '<td class="mono">' + esc(item.resource || "-") + '</td>' +
                  '<td>' + esc(item.total || 0) + '</td>' +
                '</tr>'
              )).join("");

        setStatus("permissions", "", "");
      } catch (error) {
        reportError("permissions", error);
      }
    }

    async function loadProjects() {
      setStatus("projects", "Cargando proyectos...", "");
      setTableMessage("projectsBody", 5, "Cargando...");
      setTableMessage("tasksBody", 6, "Cargando...");
      try {
        const projects = await fetchJson("/v1/projects");
        state.projects = Array.isArray(projects) ? projects : [];
        populateProjectSelects(state.projects);

        if (!state.selectedProjectId && state.projects.length > 0) {
          state.selectedProjectId = state.projects[0].id;
          if (q("tasksProjectFilter")) q("tasksProjectFilter").value = state.selectedProjectId;
          if (q("taskProjectId")) q("taskProjectId").value = state.selectedProjectId;
        }

        q("projectsBody").innerHTML = !Array.isArray(projects) || projects.length === 0
          ? '<tr><td colspan="5">No hay proyectos creados. Usa "Paso 1" para crear el primero.</td></tr>'
          : projects.map((item) => (
              '<tr>' +
                '<td class="mono">' + esc(item.id) + '</td>' +
                '<td>' + esc(item.name) + '</td>' +
                '<td>' + pill(item.status) + '</td>' +
                '<td class="mono">' + esc(item.createdAt) + '</td>' +
                '<td><div class="inline"><select data-field="project-status"><option value="active"' + (item.status === "active" ? " selected" : "") + '>active</option><option value="paused"' + (item.status === "paused" ? " selected" : "") + '>paused</option><option value="done"' + (item.status === "done" ? " selected" : "") + '>done</option></select><button class="fit" data-action="project-update-status" data-project-id="' + esc(item.id) + '">guardar</button></div></td>' +
              '</tr>'
            )).join("");

        if (state.selectedProjectId) {
          await loadProjectTasks(state.selectedProjectId);
          setStatus("projects", "Proyecto y tareas listos para operar.", "ok");
        } else {
          setTableMessage("tasksBody", 6, "No hay tareas porque aun no hay proyectos.");
          setStatus("projects", "No data: crea tu primer proyecto y luego una tarea.", "ok");
        }
      } catch (error) {
        reportError("projects", error);
      }
    }

    async function loadAutomations() {
      setStatus("automations", "Cargando reglas y runs...", "");
      setTableMessage("rulesBody", 5, "Cargando...");
      setTableMessage("automationRunsBody", 4, "Cargando...");
      try {
        const [rules, runs] = await Promise.all([
          fetchJson("/v1/automation/rules"),
          fetchJson("/v1/automation/runs")
        ]);

        q("rulesBody").innerHTML = !Array.isArray(rules) || rules.length === 0
          ? '<tr><td colspan="5">No hay reglas</td></tr>'
          : rules.map((item) => (
              '<tr>' +
                '<td class="mono">' + esc(item.id) + '</td>' +
                '<td>' + esc(item.name) + '</td>' +
                '<td class="mono">' + esc(((item || {}).trigger || {}).type || "-") + '</td>' +
                '<td>' + pill(item.enabled ? "enabled" : "disabled") + '</td>' +
                '<td><button data-action="rule-toggle" data-rule-id="' + esc(item.id) + '" data-enabled="' + esc((!item.enabled).toString()) + '">' + (item.enabled ? "disable" : "enable") + '</button></td>' +
              '</tr>'
            )).join("");

        q("automationRunsBody").innerHTML = !Array.isArray(runs) || runs.length === 0
          ? '<tr><td colspan="4">Sin runs</td></tr>'
          : runs.slice(0, 12).map((item) => (
              '<tr>' +
                '<td class="mono">' + esc(item.ruleId) + '</td>' +
                '<td>' + pill(item.status) + '</td>' +
                '<td>' + esc(item.attempts || 1) + '</td>' +
                '<td class="mono">' + esc(item.startedAt) + '</td>' +
              '</tr>'
            )).join("");

        setStatus("automations", "", "");
      } catch (error) {
        reportError("automations", error);
      }
    }

    async function loadChatTimeline() {
      setStatus("chat", "Cargando timeline...", "");
      setTableMessage("chatTimelineBody", 6, "Cargando...");
      const params = new URLSearchParams();
      const map = {
        projectId: q("chatProjectId").value.trim(),
        conversationId: q("chatConversationId").value.trim(),
        role: q("chatRole").value,
        from: q("chatFrom").value.trim(),
        to: q("chatTo").value.trim(),
        limit: q("chatLimit").value.trim()
      };
      Object.keys(map).forEach((key) => {
        const value = map[key];
        if (value) params.set(key, value);
      });

      try {
        const timeline = await fetchJson("/v1/chat/timeline?" + params.toString());
        q("chatTimelineBody").innerHTML = !Array.isArray(timeline) || timeline.length === 0
          ? '<tr><td colspan="6">No hay mensajes para los filtros actuales</td></tr>'
          : timeline.map((item) => (
              '<tr>' +
                '<td class="mono">' + esc(item.timestamp) + '</td>' +
                '<td class="mono">' + esc(item.projectId || "-") + '</td>' +
                '<td class="mono">' + esc(item.conversationTitle || item.conversationId) + '</td>' +
                '<td>' + pill(item.role) + '</td>' +
                '<td class="mono">' + esc(item.eventType || "chat_message_created") + '</td>' +
                '<td>' + esc(item.content) + '</td>' +
              '</tr>'
            )).join("");
        setStatus("chat", (timeline || []).length ? "" : "No data: ajusta filtros.", (timeline || []).length ? "" : "ok");
      } catch (error) {
        reportError("chat", error);
      }
    }

    async function createProject(event) {
      event.preventDefault();
      const name = q("projectName").value.trim();
      const status = q("projectStatus").value;
      if (!name) return;
      setStatus("projects", "Creando proyecto...", "");
      try {
        const project = await fetchJson("/v1/projects", {
          method: "POST",
          body: JSON.stringify({ name, status })
        });
        q("projectName").value = "";
        if (project && project.id) {
          state.selectedProjectId = String(project.id);
        }
        setStatus("projects", "Proyecto creado.", "ok");
        await loadProjects();
      } catch (error) {
        reportError("projects", error);
      }
    }

    async function createTask(event) {
      event.preventDefault();
      const projectId = q("taskProjectId").value;
      const title = q("taskTitle").value.trim();
      const status = q("taskStatus").value;
      const assignee = q("taskAssignee").value.trim();

      if (!projectId) {
        setStatus("projects", "Selecciona un proyecto antes de crear tarea.", "error");
        return;
      }
      if (!title) {
        setStatus("projects", "El titulo de la tarea es obligatorio.", "error");
        return;
      }

      setStatus("projects", "Creando tarea...", "");
      try {
        await fetchJson("/v1/projects/" + encodeURIComponent(projectId) + "/tasks", {
          method: "POST",
          body: JSON.stringify({
            title,
            status: status || "todo",
            assignee: assignee || undefined
          })
        });
        q("taskTitle").value = "";
        q("taskAssignee").value = "";
        state.selectedProjectId = projectId;
        q("tasksProjectFilter").value = projectId;
        setStatus("projects", "Tarea creada. Debe disparar automatizaciones si hay reglas activas.", "ok");
        await loadProjectTasks(projectId);
      } catch (error) {
        reportError("projects", error);
      }
    }

    async function loadProjectTasks(projectId) {
      if (!projectId) {
        setTableMessage("tasksBody", 6, "Selecciona un proyecto para ver tareas.");
        return;
      }

      setTableMessage("tasksBody", 6, "Cargando tareas...");
      try {
        const tasks = await fetchJson("/v1/projects/" + encodeURIComponent(projectId) + "/tasks");
        q("tasksBody").innerHTML = !Array.isArray(tasks) || tasks.length === 0
          ? '<tr><td colspan="6">No hay tareas en este proyecto. Usa "Paso 2" para crear la primera.</td></tr>'
          : tasks.map((task) => (
              '<tr>' +
                '<td class="mono">' + esc(task.id) + '</td>' +
                '<td>' + esc(task.title) + '</td>' +
                '<td>' + pill(task.status) + '</td>' +
                '<td class="mono">' + esc(task.assignee || "-") + '</td>' +
                '<td class="mono">' + esc(task.updatedAt || task.createdAt || "-") + '</td>' +
                '<td><div class="inline"><select data-field="task-status"><option value="todo"' + (task.status === "todo" ? " selected" : "") + '>todo</option><option value="in_progress"' + (task.status === "in_progress" ? " selected" : "") + '>in_progress</option><option value="done"' + (task.status === "done" ? " selected" : "") + '>done</option></select><button class="fit" data-action="task-update-status" data-project-id="' + esc(projectId) + '" data-task-id="' + esc(task.id) + '">guardar</button></div></td>' +
              '</tr>'
            )).join("");
      } catch (error) {
        setTableMessage("tasksBody", 6, "Error cargando tareas: " + (error.message || "fallo"));
      }
    }

    async function createRule(event) {
      event.preventDefault();
      const name = q("ruleName").value.trim();
      const triggerType = q("ruleTriggerType").value;
      const ruleMessage = q("ruleMessage").value.trim();
      const memoryScope = q("ruleMemoryScope").value;
      if (!name) return;
      setStatus("automations", "Creando regla...", "");
      try {
        await fetchJson("/v1/automation/rules", {
          method: "POST",
          body: JSON.stringify({
            name,
            trigger: { type: triggerType },
            actions: [
              { type: "post_chat_message", payload: ruleMessage ? { content: ruleMessage } : {} },
              {
                type: "save_memory",
                payload: {
                  scope: memoryScope || "proyecto",
                  source: "dashboard:automation",
                  content: "Regla " + name + " ejecutada",
                  tags: ["dashboard", "automation"]
                }
              }
            ]
          })
        });
        q("ruleName").value = "";
        q("ruleMessage").value = "";
        setStatus("automations", "Regla creada.", "ok");
        await loadAutomations();
      } catch (error) {
        reportError("automations", error);
      }
    }
    async function updateProjectStatus(projectId, row) {
      const select = row ? row.querySelector('select[data-field="project-status"]') : null;
      const status = select ? select.value : null;
      if (!status) return;
      try {
        await fetchJson("/v1/projects/" + encodeURIComponent(projectId), {
          method: "PATCH",
          body: JSON.stringify({ status })
        });
        setStatus("projects", "Estado actualizado.", "ok");
        await loadProjects();
      } catch (error) {
        reportError("projects", error);
      }
    }

    async function bootstrapFlow() {
      setStatus("dashboard", "Creando flujo base...", "");
      try {
        const now = new Date();
        const suffix = now.toISOString().slice(11, 19).replace(/:/g, "");
        const payload = {
          projectName: "Proyecto rapido " + suffix,
          conversationTitle: "Conversacion rapida " + suffix,
          ruleName: "Regla rapida " + suffix
        };

        const result = await fetchJson("/v1/onboarding/bootstrap-flow", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        if (result && result.project && result.project.id) {
          state.selectedProjectId = String(result.project.id);
        }

        setStatus(
          "dashboard",
          "Flujo base creado. Ve a Projects para crear tarea y validar la automatizacion.",
          "ok"
        );
      } catch (error) {
        if (error && error.status === 403) {
          setStatus("dashboard", "Solo admin puede ejecutar bootstrap-flow.", "error");
          return;
        }
        reportError("dashboard", error);
      }
    }

    async function updateTaskStatus(projectId, taskId, row) {
      const select = row ? row.querySelector('select[data-field="task-status"]') : null;
      const status = select ? select.value : null;
      if (!status) return;

      try {
        await fetchJson(
          "/v1/projects/" + encodeURIComponent(projectId) + "/tasks/" + encodeURIComponent(taskId) + "/status",
          {
            method: "PATCH",
            body: JSON.stringify({ status })
          }
        );
        setStatus("projects", "Estado de tarea actualizado.", "ok");
        await loadProjectTasks(projectId);
      } catch (error) {
        reportError("projects", error);
      }
    }

    async function toggleRule(ruleId, enabled) {
      try {
        await fetchJson("/v1/automation/rules/" + encodeURIComponent(ruleId) + "/status", {
          method: "PATCH",
          body: JSON.stringify({ enabled })
        });
        setStatus("automations", "Regla actualizada.", "ok");
        await loadAutomations();
      } catch (error) {
        reportError("automations", error);
      }
    }

    async function approveAction(approvalId, action) {
      try {
        await fetchJson("/v1/policy/approvals/" + encodeURIComponent(approvalId) + "/" + action, { method: "POST" });
        await loadPermissionsModule();
      } catch (error) {
        reportError("permissions", error);
      }
    }

    async function memoryAction(memoryId, action) {
      try {
        await fetchJson("/v1/memory/" + encodeURIComponent(memoryId) + "/" + action, { method: "POST" });
        await loadMemoryModule();
      } catch (error) {
        reportError("memory", error);
      }
    }

    function bindEvents() {
      document.querySelectorAll("[data-module]").forEach((el) => {
        el.addEventListener("click", () => {
          const moduleName = el.getAttribute("data-module");
          if (!moduleName) return;
          activate(moduleName);
        });
      });

      q("refreshModule").addEventListener("click", () => loadCurrent());
      q("goLogin").addEventListener("click", () => {
        window.location.href = "/login";
      });

      q("memoryFilterButton").addEventListener("click", () => loadMemoryModule());
      q("projectCreateForm").addEventListener("submit", createProject);
      q("taskCreateForm").addEventListener("submit", createTask);
      q("tasksRefreshButton").addEventListener("click", () => {
        const projectId = q("tasksProjectFilter").value;
        state.selectedProjectId = projectId || "";
        loadProjectTasks(projectId);
      });
      q("tasksProjectFilter").addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement)) return;
        state.selectedProjectId = target.value || "";
        if (q("taskProjectId")) q("taskProjectId").value = target.value;
        loadProjectTasks(target.value);
      });
      q("taskProjectId").addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement)) return;
        state.selectedProjectId = target.value || "";
        if (q("tasksProjectFilter")) q("tasksProjectFilter").value = target.value;
      });
      q("automationCreateForm").addEventListener("submit", createRule);
      q("chatFilterForm").addEventListener("submit", (event) => {
        event.preventDefault();
        loadChatTimeline();
      });

      document.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const action = target.getAttribute("data-action");
        if (!action) return;

        if (action === "approval-approve" || action === "approval-reject") {
          const approvalId = target.getAttribute("data-approval-id");
          if (!approvalId) return;
          if (action === "approval-reject") {
            const confirmed = window.confirm(
              "Vas a rechazar una accion sensible. Esta accion no se puede deshacer facilmente. Continuar?"
            );
            if (!confirmed) return;
          }
          approveAction(approvalId, action === "approval-approve" ? "approve" : "reject");
          return;
        }

        if (action === "memory-promote" || action === "memory-forget" || action === "memory-block") {
          const memoryId = target.getAttribute("data-memory-id");
          if (!memoryId) return;
          if (action === "memory-forget") {
            const confirmed = window.confirm(
              "Olvidar memoria archivara este item. Confirmar accion?"
            );
            if (!confirmed) return;
          }
          if (action === "memory-block") {
            const confirmed = window.confirm(
              "Bloquear memoria la marcara como bloqueada y archivada. Confirmar accion?"
            );
            if (!confirmed) return;
          }
          const endpointAction = action === "memory-promote"
            ? "promote-global"
            : action === "memory-forget"
              ? "forget"
              : "block";
          memoryAction(memoryId, endpointAction);
          return;
        }

        if (action === "rule-toggle") {
          const ruleId = target.getAttribute("data-rule-id");
          const enabledRaw = target.getAttribute("data-enabled");
          if (!ruleId || !enabledRaw) return;
          toggleRule(ruleId, enabledRaw === "true");
          return;
        }

        if (action === "task-update-status") {
          const projectId = target.getAttribute("data-project-id");
          const taskId = target.getAttribute("data-task-id");
          const row = target.closest("tr");
          if (!projectId || !taskId || !row) return;
          updateTaskStatus(projectId, taskId, row);
          return;
        }

        if (action === "project-update-status") {
          const projectId = target.getAttribute("data-project-id");
          const row = target.closest("tr");
          if (!projectId || !row) return;
          updateProjectStatus(projectId, row);
          return;
        }

        if (action === "nav-module") {
          const targetModule = target.getAttribute("data-target-module");
          if (!targetModule || !modules[targetModule]) return;
          activate(targetModule);
          return;
        }

        if (action === "bootstrap-flow") {
          bootstrapFlow();
        }
      });
    }

    bindEvents();
    activate("dashboard");
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
      const classicMode = String(req.query.classic ?? "") === "1";
      const html = classicMode
        ? renderDashboardHtml(authHeader, req.role)
        : renderOperationalDashboardHtml(authHeader, req.role);
      res.type("text/html").send(html);
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
