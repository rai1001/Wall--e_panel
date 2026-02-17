# Day 4 Checklist - Embeddings + Distributed Rate Limit

## 1) Embedding quality
- [x] Upgraded local embedding algorithm (`semantic-hash-v2`)
- [x] Added semantic alias mapping and richer lexical matching
- [x] Added embedding quality tests

## 2) Embedding backend flexibility
- [x] Added `EMBEDDING_PROVIDER` support (`local` / `openai`)
- [x] Added fallback behavior to local embeddings on provider failure
- [x] Stored embedding metadata (`provider/model/version`) in DB

## 3) Distributed rate limit
- [x] Added SQLite-backed shared limiter table (`rate_limit_buckets`)
- [x] Added backend selection via `RATE_LIMIT_STORE`
- [x] Added test proving counter sharing across two instances

## 4) Documentation and operations
- [x] Updated `.env.example` with new flags
- [x] Updated `README` known issues and env docs
- [x] Updated runbook/troubleshooting for Day 4 operation
