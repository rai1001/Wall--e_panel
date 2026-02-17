export function renderLoginPageHtml() {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OpenClaw Login</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #070b12;
      --card: rgba(14, 21, 31, 0.88);
      --line: rgba(255, 255, 255, 0.14);
      --ink: #f2f7ff;
      --muted: #8ea1b8;
      --accent: #ffd166;
      --ok: #2dd4bf;
      --bad: #ff6363;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      color: var(--ink);
      font-family: "Space Grotesk", sans-serif;
      background:
        radial-gradient(circle at 15% 18%, #27344e 0%, transparent 30%),
        radial-gradient(circle at 82% 20%, #5a3e1f 0%, transparent 34%),
        linear-gradient(165deg, #070b12, #101929 62%, #080d14);
    }
    .shell {
      width: min(92vw, 960px);
      border: 1px solid var(--line);
      border-radius: 22px;
      overflow: hidden;
      background: linear-gradient(140deg, rgba(255,255,255,.07), rgba(255,255,255,.015));
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      box-shadow: 0 28px 100px rgba(0,0,0,.45);
      backdrop-filter: blur(7px);
    }
    .hero {
      padding: 28px;
      border-right: 1px solid var(--line);
      background:
        linear-gradient(135deg, rgba(255, 209, 102, 0.12), rgba(255, 255, 255, 0));
    }
    .eyebrow {
      font-family: "IBM Plex Mono", monospace;
      letter-spacing: .11em;
      text-transform: uppercase;
      font-size: 11px;
      color: var(--muted);
    }
    h1 {
      margin: 14px 0 10px 0;
      font-size: clamp(28px, 5vw, 50px);
      line-height: .95;
      text-transform: uppercase;
      letter-spacing: -.03em;
    }
    p {
      margin: 0;
      font-size: 13px;
      line-height: 1.55;
      color: var(--muted);
      max-width: 38ch;
    }
    .keyline {
      margin-top: 20px;
      display: grid;
      gap: 8px;
      font-family: "IBM Plex Mono", monospace;
      font-size: 11px;
      color: var(--muted);
    }
    .form {
      padding: 28px;
      display: grid;
      align-content: center;
      gap: 10px;
      background: var(--card);
    }
    label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .1em;
      color: var(--muted);
      font-family: "IBM Plex Mono", monospace;
    }
    input {
      width: 100%;
      border-radius: 11px;
      border: 1px solid var(--line);
      padding: 11px 12px;
      background: rgba(255,255,255,.05);
      color: var(--ink);
      font-family: "IBM Plex Mono", monospace;
      font-size: 13px;
      outline: none;
    }
    input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(255,209,102,.18);
    }
    button {
      margin-top: 8px;
      border: 1px solid var(--accent);
      border-radius: 11px;
      padding: 11px 13px;
      background: linear-gradient(140deg, #ffd166, #f3b347);
      color: #1a1205;
      text-transform: uppercase;
      letter-spacing: .08em;
      font-family: "IBM Plex Mono", monospace;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    button:disabled {
      opacity: .7;
      cursor: wait;
    }
    .meta {
      margin-top: 6px;
      min-height: 18px;
      font-size: 12px;
      color: var(--muted);
    }
    .meta.ok { color: var(--ok); }
    .meta.bad { color: var(--bad); }
    .tips {
      margin-top: 12px;
      border-top: 1px dashed var(--line);
      padding-top: 11px;
      font-family: "IBM Plex Mono", monospace;
      font-size: 11px;
      color: var(--muted);
      line-height: 1.6;
    }
    @media (max-width: 880px) {
      .shell { grid-template-columns: 1fr; }
      .hero { border-right: 0; border-bottom: 1px solid var(--line); }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <div class="eyebrow">OpenClaw Panel</div>
      <h1>Control Deck</h1>
      <p>Inicia sesion para entrar al panel operativo de memoria, automatizacion, auditoria y aprobaciones.</p>
      <div class="keyline">
        <span>Endpoint API: <strong>/v1/*</strong></span>
        <span>Dashboard: <strong>/v1/dashboard</strong></span>
        <span>Sesion: <strong>cookie segura oc_token</strong></span>
      </div>
    </section>
    <form class="form" id="loginForm">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="username" placeholder="admin@local" required />

      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" placeholder="********" required />

      <button id="submitButton" type="submit">Entrar al Dashboard</button>
      <div id="meta" class="meta"></div>
      <div class="tips">
        Demo users por defecto: admin@local/admin123, manager@local/manager123, member@local/member123, viewer@local/viewer123.
      </div>
    </form>
  </div>

  <script>
    const form = document.getElementById("loginForm");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const submitButton = document.getElementById("submitButton");
    const meta = document.getElementById("meta");

    function setMeta(text, mode) {
      meta.textContent = text;
      meta.className = "meta " + (mode || "");
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setMeta("", "");
      submitButton.disabled = true;
      submitButton.textContent = "Validando...";

      try {
        const response = await fetch("/v1/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: emailInput.value.trim(),
            password: passwordInput.value
          })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || "Credenciales invalidas");
        }

        setMeta("Sesion iniciada. Abriendo dashboard...", "ok");
        window.location.href = "/v1/dashboard";
      } catch (error) {
        setMeta(error.message || "No se pudo iniciar sesion", "bad");
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Entrar al Dashboard";
      }
    });
  </script>
</body>
</html>`;
}
