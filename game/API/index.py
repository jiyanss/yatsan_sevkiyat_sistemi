import json
import os
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Bilgi Yarışması")

BASE_DIR = Path(__file__).resolve().parent.parent
QUESTIONS = json.loads((BASE_DIR / "data" / "questions.json").read_text(encoding="utf-8"))

# ---------- Firebase (env değişkeni yoksa skorlar bellekte tutulur) ----------
firestore = None
db = None
try:
    cred_json = os.environ.get("FIREBASE_CREDENTIALS", "")
    if cred_json:
        import firebase_admin
        from firebase_admin import credentials, firestore

        if not firebase_admin._apps:
            firebase_admin.initialize_app(credentials.Certificate(json.loads(cred_json)))
        db = firestore.client()
except Exception as exc:
    print("Firebase başlatılamadı, skorlar bellekte tutulacak →", exc)

memory_scores: list[dict] = []


def save_score(username, score, correct, total, category):
    doc = {
        "username": (username or "Misafir")[:30],
        "score": score,
        "correct": correct,
        "total": total,
        "category": category or "Karışık",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    if db:
        db.collection("scores").add(doc)
    else:
        memory_scores.append(doc)
        del memory_scores[:-100]


@app.get("/api/categories")
def get_categories():
    return sorted({q["category"] for q in QUESTIONS})


@app.get("/api/quiz")
def get_quiz(category: Optional[str] = None, count: int = 10):
    pool = [q for q in QUESTIONS if q["category"] == category] if category else QUESTIONS
    if not pool:
        raise HTTPException(404, "Bu kategoride soru bulunamadı")
    picked = random.sample(pool, k=min(count, len(pool)))
    # correct alanı gönderilmiyor → hile yapmak zor, değerlendirme sunucuda
    return [{"id": q["id"], "question": q["question"], "options": q["options"]} for q in picked]


class SubmitIn(BaseModel):
    username: str
    category: Optional[str] = None
    answers: dict[str, int]  # ör: {"gk1": 2, "bil3": 0}


@app.post("/api/submit")
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

    save_score(payload.username, score, correct, len(payload.answers), payload.category)
    return {"username": payload.username, "score": score, "correct": correct, "review": review}


@app.get("/api/leaderboard")
def get_leaderboard(limit: int = 10):
    if db:
        docs = (db.collection("scores")
                .order_by("score", direction=firestore.Query.DESCENDING)
                .limit(limit).stream())
        return [d.to_dict() for d in docs]
    return sorted(memory_scores, key=lambda s: s["score"], reverse=True)[:limit]


# Yerel geliştirme için: arayüzü de aynı sunucudan servis et
try:
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="static")
except Exception:
    pass
