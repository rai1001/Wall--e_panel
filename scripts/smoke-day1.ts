import request from "supertest";
import { createApp } from "../src/app";

async function run() {
  const app = createApp();
  const adminHeaders = { "x-role": "admin", "x-actor-id": "smoke-admin" };

  const project = await request(app)
    .post("/projects")
    .set(adminHeaders)
    .send({ name: "Smoke Project" });

  if (project.status !== 201) {
    throw new Error(`No se pudo crear proyecto: ${project.status}`);
  }

  const projectId = String(project.body.id);

  const conversation = await request(app)
    .post("/chat/conversations")
    .set(adminHeaders)
    .send({ title: "Smoke Conversation", projectId });

  if (conversation.status !== 201) {
    throw new Error(`No se pudo crear conversacion: ${conversation.status}`);
  }

  const conversationId = String(conversation.body.id);

  const rule = await request(app)
    .post("/automation/rules")
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
    .post(`/projects/${projectId}/tasks`)
    .set(adminHeaders)
    .send({ title: "Smoke task" });

  if (task.status !== 201) {
    throw new Error(`No se pudo crear tarea: ${task.status}`);
  }

  const messages = await request(app)
    .get(`/chat/conversations/${conversationId}/messages`)
    .set({ "x-role": "viewer", "x-actor-id": "smoke-viewer" });
  const memory = await request(app)
    .get("/memory/search?tags=automation")
    .set({ "x-role": "viewer", "x-actor-id": "smoke-viewer" });

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
