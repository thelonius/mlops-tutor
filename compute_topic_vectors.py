#!/usr/bin/env python3
"""
Compute topic embeddings using the same model as jobs_vectorize.py.
Saves data/topic_vectors.json: {topic_id: [float, ...]}.
Run locally before deploy whenever curriculum topics change.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from curriculum import TOPICS

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
OUT = Path(__file__).parent / "data" / "topic_vectors.json"


def topic_text(tid: str, t: dict) -> str:
    parts = [
        t.get("title", ""),
        t.get("what", ""),
        t.get("why", ""),
        t.get("interview_focus", ""),
    ]
    return " ".join(p for p in parts if p)


def main():
    from sentence_transformers import SentenceTransformer

    print(f"Loading {MODEL_NAME}...", flush=True)
    model = SentenceTransformer(MODEL_NAME)

    ids = list(TOPICS.keys())
    texts = [topic_text(tid, TOPICS[tid]) for tid in ids]

    print(f"Embedding {len(ids)} topics...", flush=True)
    vecs = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)

    result = {tid: vec.tolist() for tid, vec in zip(ids, vecs)}
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False))
    print(f"Saved {len(result)} topic vectors → {OUT}")


if __name__ == "__main__":
    main()
