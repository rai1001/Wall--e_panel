import request from "supertest";
import { createApp } from "../src/app";

async function login(app: ReturnType<typeof createApp>) {
  const auth = await request(app)
    .post("/v1/auth/login")
    .send({ email: "admin@local", password: "admin123" });
  if (auth.status !== 200) {
    throw new Error(`No se pudo autenticar smoke admin: ${auth.status}`);
  }
  return String(auth.body.token);
}

async function run() {
  const app = createApp();
  const adminToken = await login(app);
  const viewerAuth = await request(app)
    .post("/v1/auth/login")
    .send({ email: "viewer@local", password: "viewer123" });
  if (viewerAuth.status !== 200) {
    throw new Error(`No se pudo autenticar smoke viewer: ${viewerAuth.status}`);
  }
  const viewerToken = String(viewerAuth.body.token);
  const adminHeaders = { authorization: `Bearer ${adminToken}` };
  const viewerHeaders = { authorization: `Bearer ${viewerToken}` };

  const project = await request(app)
    .post("/v1/projects")
    .set(adminHeaders)
    .send({ name: "Smoke Project" });

  if (project.status !== 201) {
    throw new Error(`No se pudo crear proyecto: ${project.status}`);
  }

  const projectId = String(project.body.id);

  const conversation = await request(app)
    .post("/v1/chat/conversations")
    .set(adminHeaders)
    .send({ title: "Smoke Conversation", projectId });

  if (conversation.status !== 201) {
    throw new Error(`No se pudo crear conversacion: ${conversation.status}`);
  }

  const conversationId = String(conversation.body.id);

  const rule = await request(app)
    .post("/v1/automation/rules")
    .set(adminHeaders)
    .send({
      name: "Smoke Task Rule",
      trigger: { type: "task_created" },
      actions: [{ type: "post_chat_message" }, { type: "save_memory" }]
    });

  if (rule.status !== 201) {
    throw new Error(`No se pudo crear regla: ${rule.status}`);
  }

  const task = await request(app)
    .post(`/v1/projects/${projectId}/tasks`)
    .set(adminHeaders)
    .send({ title: "Smoke task" });

  if (task.status !== 201) {
    throw new Error(`No se pudo crear tarea: ${task.status}`);
  }

  const messages = await request(app)
    .get(`/v1/chat/conversations/${conversationId}/messages`)
    .set(viewerHeaders);
  const memory = await request(app)
    .get("/v1/memory/search?tags=automation")
    .set(viewerHeaders);

  if (messages.status !== 200 || messages.body.length < 1) {
    throw new Error("No se detectaron mensajes automáticos en chat");
  }
  if (memory.status !== 200 || memory.body.length < 1) {
    throw new Error("No se detectaron registros en memoria");
  }

  // eslint-disable-next-line no-console
  console.log("Smoke Day 1 OK");
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        projectId,
        conversationId,
        messages: messages.body.length,
        memories: memory.body.length
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Smoke Day 1 FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
