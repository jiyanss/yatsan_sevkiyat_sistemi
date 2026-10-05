import json
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from firebase_client import db

app = FastAPI(title="Yatsan Oyun Merkezi")

BASE_DIR = Path(__file__).resolve().parent.parent
QUESTIONS = json.loads(
    (BASE_DIR / "data" / "game_questions.json").read_text(encoding="utf-8")
)

SCORES_COL = "game_scores"
memory_scores: list[dict] = []


class SubmitIn(BaseModel):
    username: str
    category: Optional[str] = None
    answers: dict[str, int]


@app.get("/api/game/categories")
def get_categories():
    return sorted({q["category"] for q in QUESTIONS})


@app.get("/api/game/start")
def start_quiz(category: Optional[str] = None, count: int = 10):
    pool = [q for q in QUESTIONS if q["category"] == category] if category else QUESTIONS
    if not pool:
        raise HTTPException(404, "Bu kategoride soru bulunamadı")
    picked = random.sample(pool, k=min(count, len(pool)))
    return [{"id": q["id"], "question": q["question"], "options": q["options"]} for q in picked]


@app.post("/api/game/submit")
def submit(payload: SubmitIn):
    by_id = {q["id"]: q for q in QUESTIONS}
    score, correct, review = 0, 0, []

    for qid, chosen in payload.answers.items():
        q = by_id.get(qid)
        if not q:
            continue
        is_ok = chosen == q["correct"]
        score += 100 if is_ok else 0
        correct += 1 if is_ok else 0
        review.append({
            "question": q["question"],
            "options": q["options"],
            "chosen": chosen,
            "correctIndex": q["correct"],
            "isCorrect": is_ok,
        })

    doc = {
        "username": (payload.username or "Misafir")[:30],
        "score": score,
        "correct": correct,
        "total": len(payload.answers),
        "category": payload.category or "Karışık",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    if db:
        db.collection(SCORES_COL).add(doc)
    else:
        memory_scores.append(doc)
        del memory_scores[:-100]

    return {"username": doc["username"], "score": score, "correct": correct, "review": review}


@app.get("/api/game/leaderboard")
def get_leaderboard(limit: int = 10):
    if db:
        from firebase_admin import firestore
        docs = (db.collection(SCORES_COL)
                .order_by("score", direction=firestore.Query.DESCENDING)
                .limit(limit).stream())
        return [d.to_dict() for d in docs]
    return sorted(memory_scores, key=lambda s: s["score"], reverse=True)[:limit]
