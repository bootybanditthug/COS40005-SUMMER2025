from fastapi import APIRouter, HTTPException, Query
from bson import ObjectId
from datetime import datetime, timezone
from typing import Optional, List

from db.connection import (
    submissions_collection, homeworks_collection
)
from models.submission import SubmissionCreate, SubmissionOut, GradeRequest

router = APIRouter(prefix="/api", tags=["Submissions"])

def now_iso():
    return datetime.now(timezone.utc).isoformat()

# ---------- Student: my submission ----------
@router.get("/submissions/mine", response_model=SubmissionOut)
async def my_submission(homeworkId: str = Query(..., alias="homeworkId"),
                        userId: str = Query(..., alias="userId")):
    sub = await submissions_collection.find_one({"homework_id": homeworkId, "user_id": userId})
    if not sub:
        return SubmissionOut(submission_id="", status="none")
    sub["submission_id"] = str(sub["_id"])
    sub.pop("_id", None)
    return SubmissionOut(**sub)

# ---------- Student: create/update submission ----------
@router.post("/submissions", response_model=SubmissionOut)
async def create_or_update_submission(
    homeworkId: str = Query(..., alias="homeworkId"),
    caseId: str = Query(..., alias="caseId"),
    userId: str = Query(..., alias="userId"),
    payload: SubmissionCreate = None
):
    hw = await homeworks_collection.find_one({"_id": ObjectId(homeworkId)})
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")

    sub = await submissions_collection.find_one({"homework_id": homeworkId, "user_id": userId})
    doc = {
        "homework_id": homeworkId,
        "case_id": caseId,
        "user_id": userId,
        "notes": (payload.notes if payload else None),
        "files": (payload.files if payload else None),
        "answers": (payload.answers if payload else None),
        "status": "submitted",
        "updated_at": now_iso()
    }
    if not sub:
        doc["created_at"] = now_iso()
        res = await submissions_collection.insert_one(doc)
        doc["submission_id"] = str(res.inserted_id)
    else:
        await submissions_collection.update_one({"_id": sub["_id"]}, {"$set": doc})
        doc["submission_id"] = str(sub["_id"])

    return SubmissionOut(**doc)

# ---------- Instructor: list submissions ----------
@router.get("/instructor/submissions")
async def list_submissions(caseId: Optional[str] = None,
                           status: Optional[str] = None):
    q = {}
    if caseId: q["case_id"] = caseId
    if status: q["status"] = status
    cursor = submissions_collection.find(q).sort("updated_at", -1)
    items = []
    async for s in cursor:
        items.append({
            "id": str(s["_id"]),
            "case_id": s["case_id"],
            "case_title": "",  # FE có mock title, bạn có thể join từ bảng case nếu có
            "student_id": s["user_id"],
            "status": s.get("status","submitted"),
            "score": s.get("score"),
            "updated_at": s.get("updated_at")
        })
    return items

# ---------- Instructor: grade ----------
@router.post("/submissions/{submission_id}/grade")
async def grade_submission(submission_id: str, payload: GradeRequest):
    sub = await submissions_collection.find_one({"_id": ObjectId(submission_id)})
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    await submissions_collection.update_one(
        {"_id": sub["_id"]},
        {"$set": {
            "score": payload.score,
            "rubric": payload.rubric,
            "feedback": payload.feedback,
            "status": "graded",
            "graded_at": now_iso()
        }}
    )
    return {"status": "graded", "score": payload.score, "graded_at": now_iso()}
