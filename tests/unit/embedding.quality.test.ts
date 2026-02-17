import { describe, expect, it } from "vitest";
import { cosineSimilarity, createEmbedding, embeddingDimension, embeddingVersion, lexicalScore } from "../../src/memory/embedding";

describe("Embedding quality", () => {
  it("prioritizes semantically related content over unrelated text", () => {
    const query = "base de datos postgres transaccional";
    const relevant = "Decidimos usar PostgreSQL para transacciones criticas y consistencia ACID.";
    const unrelated = "Comprar cafe y leche para la oficina.";

    const queryVector = createEmbedding(query);
    const relevantScore = cosineSimilarity(queryVector, createEmbedding(relevant));
    const unrelatedScore = cosineSimilarity(queryVector, createEmbedding(unrelated));

    expect(relevantScore).toBeGreaterThan(unrelatedScore);
    expect(relevantScore).toBeGreaterThan(0.25);
  });

  it("keeps lexical score aligned with normalized terms and tags", () => {
    const score = lexicalScore(
      "auditoria seguridad",
      "Priorizar trazabilidad y seguridad en cambios sensibles",
      ["audit", "policy"]
    );

    expect(score).toBeGreaterThan(0.4);
    expect(embeddingDimension()).toBeGreaterThanOrEqual(256);
    expect(embeddingVersion()).toBeTruthy();
  });
});
