import { Message } from "../types/domain";

const LOCAL_PROVIDER = "local";
const LOCAL_MODEL = "openclaw-local-assistant-v1";
const GOOGLE_DEFAULT_MODEL = "gemini-1.5-flash";

export interface AssistantReplyResult {
  text: string;
  provider: string;
  model: string;
}

function readProvider() {
  return (process.env.CHAT_ASSISTANT_PROVIDER ?? "").trim().toLowerCase();
}

function resolveProvider() {
  const configured = readProvider();
  if (configured === "google" && process.env.GOOGLE_API_KEY) {
    return "google";
  }
  if (configured === "local") {
    return LOCAL_PROVIDER;
  }
  if (process.env.GOOGLE_API_KEY) {
    return "google";
  }
  return LOCAL_PROVIDER;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function localReply(messages: Message[]) {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  const userText = cleanText(lastUser?.content ?? "");
  if (!userText) {
    return "Estoy listo. Dime la tarea concreta y te propongo los siguientes pasos.";
  }

  const short = userText.length > 220 ? `${userText.slice(0, 220)}...` : userText;
  return [
    `Entendido: ${short}`,
    "Siguiente paso recomendado:",
    "1) Confirma prioridad y fecha objetivo.",
    "2) Divide en 2-3 subtareas ejecutables hoy.",
    "3) Te devuelvo un plan corto y accionable."
  ].join("\n");
}

function toGoogleRole(role: Message["role"]) {
  if (role === "assistant") {
    return "model";
  }
  return "user";
}

function extractGoogleText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const candidates = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return "";
  }

  const first = candidates[0];
  const parts = first?.content?.parts;
  if (!Array.isArray(parts)) {
    return "";
  }

  const text = parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
  return text;
}

export class ChatAssistantService {
  async generateReply(messages: Message[], signal?: AbortSignal): Promise<AssistantReplyResult> {
    const provider = resolveProvider();
    if (provider !== "google") {
      return {
        text: localReply(messages),
        provider: LOCAL_PROVIDER,
        model: LOCAL_MODEL
      };
    }

    const key = process.env.GOOGLE_API_KEY;
    if (!key) {
      return {
        text: localReply(messages),
        provider: LOCAL_PROVIDER,
        model: LOCAL_MODEL
      };
    }

    const model = process.env.GOOGLE_CHAT_MODEL ?? GOOGLE_DEFAULT_MODEL;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const trimmed = messages.slice(-20);
    const contents = trimmed.map((message) => ({
      role: toGoogleRole(message.role),
      parts: [{ text: message.content }]
    }));

    const systemText =
      "Eres OpenClaw, un asistente operativo para proyectos. Responde en espanol, concreto, con siguientes pasos accionables.";

    try {
      const requestInit: RequestInit = {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemText }]
          },
          contents,
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 700
          }
        })
      };
      if (signal) {
        requestInit.signal = signal;
      }

      const response = await fetch(endpoint, requestInit);

      if (!response.ok) {
        return {
          text: localReply(messages),
          provider: LOCAL_PROVIDER,
          model: LOCAL_MODEL
        };
      }

      const payload = (await response.json()) as unknown;
      const generated = extractGoogleText(payload);
      if (!generated) {
        return {
          text: localReply(messages),
          provider: LOCAL_PROVIDER,
          model: LOCAL_MODEL
        };
      }

      return {
        text: generated,
        provider: "google",
        model
      };
    } catch {
      return {
        text: localReply(messages),
        provider: LOCAL_PROVIDER,
        model: LOCAL_MODEL
      };
    }
  }

  async streamReply(
    messages: Message[],
    onDelta: (delta: string) => Promise<void> | void,
    signal?: AbortSignal
  ): Promise<AssistantReplyResult> {
    const result = await this.generateReply(messages, signal);
    const normalized = result.text.replace(/\r\n/g, "\n");

    let emitted = false;
    const parts = normalized.split(/(\s+)/).filter((token) => token.length > 0);
    for (const token of parts) {
      if (signal?.aborted) {
        break;
      }
      await onDelta(token);
      emitted = true;
      await sleep(16);
    }

    if (!emitted && normalized) {
      await onDelta(normalized);
    }

    return result;
  }
}
