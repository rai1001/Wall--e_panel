const EMBEDDING_DIM = 384;
const EMBEDDING_VERSION = "semantic-hash-v2";
const EMBEDDING_PROVIDER = "local";
const EMBEDDING_MODEL = "semantic-hash-v2";
const GOOGLE_EMBEDDING_DEFAULT_MODEL = "text-embedding-004";

const STOP_WORDS = new Set([
  "a",
  "al",
  "an",
  "and",
  "are",
  "as",
  "at",
  "con",
  "de",
  "del",
  "el",
  "en",
  "es",
  "for",
  "from",
  "in",
  "is",
  "la",
  "las",
  "los",
  "of",
  "on",
  "or",
  "para",
  "por",
  "que",
  "the",
  "to",
  "un",
  "una",
  "y"
]);

const CONCEPT_ALIASES: Record<string, string[]> = {
  database: [
    "acid",
    "base",
    "data",
    "database",
    "datos",
    "db",
    "mysql",
    "postgres",
    "postgresql",
    "query",
    "sql",
    "sqlite",
    "transaccion",
    "transaccional"
  ],
  security: [
    "audit",
    "auditoria",
    "auth",
    "authentication",
    "autenticacion",
    "jwt",
    "permiso",
    "policy",
    "rbac",
    "secure",
    "security",
    "seguridad",
    "token"
  ],
  automation: [
    "action",
    "automation",
    "automatizacion",
    "event",
    "execute",
    "job",
    "regla",
    "rule",
    "schedule",
    "trigger"
  ],
  project: [
    "deliverable",
    "hito",
    "milestone",
    "project",
    "proyecto",
    "sprint",
    "story",
    "task",
    "tarea"
  ],
  memory: [
    "context",
    "contexto",
    "knowledge",
    "memoria",
    "memory",
    "preference",
    "preferencia",
    "recall",
    "record"
  ],
  communication: [
    "chat",
    "conversation",
    "conversacion",
    "mensaje",
    "message",
    "reply",
    "response"
  ]
};

const ALIAS_TO_CONCEPT = buildAliasIndex(CONCEPT_ALIASES);

function normalizeToken(token: string) {
  return token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase()
    .trim();
}

function stemToken(token: string) {
  const rules = [
    /aciones$/,
    /acion$/,
    /mente$/,
    /idades$/,
    /idad$/,
    /ciones$/,
    /cion$/,
    /ing$/,
    /edly$/,
    /edly$/,
    /ed$/,
    /es$/,
    /s$/
  ];

  let current = token;
  for (const rule of rules) {
    if (current.length <= 4) {
      break;
    }
    if (rule.test(current)) {
      current = current.replace(rule, "");
      break;
    }
  }

  if (current.length > 6 && (current.endsWith("ar") || current.endsWith("er") || current.endsWith("ir"))) {
    return current.slice(0, -2);
  }

  return current;
}

function tokenize(text: string) {
  return text
    .split(/\s+/)
    .map((item) => normalizeToken(item))
    .filter((item) => item.length >= 2)
    .filter((item) => !STOP_WORDS.has(item));
}

function tokenizeWithStems(text: string) {
  const tokens = tokenize(text);
  return tokens.map((token) => ({ token, stem: stemToken(token) }));
}

function hashToken(token: string) {
  let hash = 5381;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash * 33) ^ token.charCodeAt(i);
  }
  return Math.abs(hash);
}

function addFeature(vector: number[], key: string, weight: number) {
  const index = hashToken(key) % EMBEDDING_DIM;
  vector[index] = (vector[index] ?? 0) + weight;
}

function addCharNgrams(vector: number[], token: string, weight: number) {
  if (token.length < 3) {
    addFeature(vector, `char:${token}`, weight);
    return;
  }

  for (let size = 3; size <= 4; size += 1) {
    if (token.length < size) {
      continue;
    }

    for (let i = 0; i <= token.length - size; i += 1) {
      const ngram = token.slice(i, i + size);
      addFeature(vector, `char:${ngram}`, weight / size);
    }
  }
}

function conceptForToken(token: string, stem: string) {
  return ALIAS_TO_CONCEPT.get(token) ?? ALIAS_TO_CONCEPT.get(stem);
}

function normalizeVector(vector: number[]) {
  const norm = Math.sqrt(vector.reduce((acc, value) => acc + value * value, 0));
  if (norm === 0) {
    return vector;
  }
  return vector.map((value) => value / norm);
}

export function createEmbedding(text: string) {
  const vector = new Array<number>(EMBEDDING_DIM).fill(0);
  const items = tokenizeWithStems(text);
  if (items.length === 0) {
    return vector;
  }

  const concepts = new Set<string>();
  for (let i = 0; i < items.length; i += 1) {
    const current = items[i];
    if (!current) {
      continue;
    }

    const importance = 1 + Math.min(1, current.token.length / 10);

    addFeature(vector, `tok:${current.token}`, 1.25 * importance);
    addFeature(vector, `stem:${current.stem}`, 0.95 * importance);
    addCharNgrams(vector, current.stem, 0.4);

    const concept = conceptForToken(current.token, current.stem);
    if (concept) {
      concepts.add(concept);
      addFeature(vector, `concept:${concept}`, 2.4);
    }

    const next = items[i + 1];
    if (next) {
      addFeature(vector, `bigram:${current.stem}_${next.stem}`, 0.85);
    }
  }

  for (const concept of concepts) {
    addFeature(vector, `concept-bias:${concept}`, 1.2);
  }

  return normalizeVector(vector);
}

export async function createEmbeddingAsync(text: string) {
  const provider = (process.env.EMBEDDING_PROVIDER ?? "local").toLowerCase();
  if (provider !== "google") {
    return createEmbedding(text);
  }

  const key = process.env.GOOGLE_API_KEY;
  if (!key) {
    return createEmbedding(text);
  }

  const model = process.env.GOOGLE_EMBEDDING_MODEL ?? GOOGLE_EMBEDDING_DEFAULT_MODEL;
  const encodedModel = encodeURIComponent(model);
  const encodedKey = encodeURIComponent(key);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodedModel}:embedContent?key=${encodedKey}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        content: {
          parts: [{ text }]
        },
        taskType: "RETRIEVAL_DOCUMENT"
      })
    });

    if (!response.ok) {
      return createEmbedding(text);
    }

    const payload = (await response.json()) as {
      embedding?: {
        values?: number[];
      };
    };
    const embedding = payload.embedding?.values;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      return createEmbedding(text);
    }

    return normalizeVector(embedding.map((value) => Number(value) || 0));
  } catch {
    return createEmbedding(text);
  }
}

export function embeddingMetadata() {
  const provider = (process.env.EMBEDDING_PROVIDER ?? "local").toLowerCase();
  if (provider === "google" && process.env.GOOGLE_API_KEY) {
    return {
      provider: "google",
      model: process.env.GOOGLE_EMBEDDING_MODEL ?? GOOGLE_EMBEDDING_DEFAULT_MODEL,
      version: "google-compatible-v1",
      dimension: 768
    };
  }

  return {
    provider: EMBEDDING_PROVIDER,
    model: EMBEDDING_MODEL,
    version: EMBEDDING_VERSION,
    dimension: EMBEDDING_DIM
  };
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return dot;
}

export function lexicalScore(query: string, text: string, tags: string[]) {
  const queryItems = tokenizeWithStems(query);
  if (queryItems.length === 0) {
    return 0;
  }

  const textItems = tokenizeWithStems(`${text} ${tags.join(" ")}`);
  const tokens = new Set(textItems.map((item) => item.token));
  const stems = new Set(textItems.map((item) => item.stem));

  let matches = 0;
  for (const item of queryItems) {
    if (tokens.has(item.token) || stems.has(item.stem)) {
      matches += 1;
      continue;
    }

    const concept = conceptForToken(item.token, item.stem);
    if (!concept) {
      continue;
    }

    if (textItems.some((candidate) => conceptForToken(candidate.token, candidate.stem) === concept)) {
      matches += 0.8;
    }
  }

  const normalizedQuery = normalizeToken(query);
  const normalizedText = normalizeToken(text);
  const phraseBonus =
    normalizedQuery.length >= 4 && normalizedText.includes(normalizedQuery) ? 0.15 : 0;

  return Math.min(1, matches / queryItems.length + phraseBonus);
}

export function embeddingDimension() {
  return embeddingMetadata().dimension;
}

export function embeddingVersion() {
  return embeddingMetadata().version;
}

export function embeddingProvider() {
  return embeddingMetadata().provider;
}

export function embeddingModel() {
  return embeddingMetadata().model;
}

function buildAliasIndex(data: Record<string, string[]>) {
  const map = new Map<string, string>();
  for (const [concept, aliases] of Object.entries(data)) {
    map.set(concept, concept);
    for (const alias of aliases) {
      const normalized = normalizeToken(alias);
      if (!normalized) {
        continue;
      }
      map.set(normalized, concept);
      map.set(stemToken(normalized), concept);
    }
  }
  return map;
}
