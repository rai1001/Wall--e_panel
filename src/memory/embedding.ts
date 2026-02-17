const EMBEDDING_DIM = 192;

function normalizeToken(token: string) {
  return token
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase()
    .trim();
}

function tokenize(text: string) {
  return text
    .split(/\s+/)
    .map((item) => normalizeToken(item))
    .filter((item) => item.length >= 2);
}

function hashToken(token: string) {
  let hash = 5381;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash * 33) ^ token.charCodeAt(i);
  }
  return Math.abs(hash);
}

export function createEmbedding(text: string) {
  const vector = new Array<number>(EMBEDDING_DIM).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return vector;
  }

  for (const token of tokens) {
    const hash = hashToken(token);
    const index = hash % EMBEDDING_DIM;
    vector[index] = (vector[index] ?? 0) + 1;

    const biToken = token.length >= 4 ? token.slice(0, 4) : token;
    const biHash = hashToken(`${biToken}_bi`);
    const biIndex = biHash % EMBEDDING_DIM;
    vector[biIndex] = (vector[biIndex] ?? 0) + 0.6;
  }

  const norm = Math.sqrt(vector.reduce((acc, value) => acc + value * value, 0));
  if (norm === 0) {
    return vector;
  }

  return vector.map((value) => value / norm);
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
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return 0;
  }

  const haystack = `${text} ${tags.join(" ")}`.toLowerCase();
  let matches = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) {
      matches += 1;
    }
  }

  return matches / queryTokens.length;
}

export function embeddingDimension() {
  return EMBEDDING_DIM;
}
