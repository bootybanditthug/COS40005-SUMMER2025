from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from bson import ObjectId
from datetime import datetime, timezone

from db.connection import (
    homeworks_collection, homework_targets_collection,
    homework_uploads_collection, homework_questions_collection
)
from models.homework import HomeworkCreate, HomeworkOut

router = APIRouter(prefix="/api", tags=["Homework"])

def now_iso():
    return datetime.now(timezone.utc).isoformat()

@router.post("/instructor/homeworks")
async def create_homework(payload: HomeworkCreate):
    # Create homework
    hw_doc = {
        "case_id": payload.case_id,
        "due_at": payload.due_at,
        "instructions": payload.instructions,
        "checklist": payload.checklist or [],
        "status": "active",
        "created_at": now_iso()
    }
    res = await homeworks_collection.insert_one(hw_doc)
    hw_id = str(res.inserted_id)

    # Targets
    if payload.audience == "all":
        await homework_targets_collection.insert_one({
            "homework_id": hw_id, "all_flag": True
        })
    elif payload.audience == "group":
        await homework_targets_collection.insert_one({
            "homework_id": hw_id, "group_name": payload.group_name
        })
    else:
        # list
        await homework_targets_collection.insert_one({
            "homework_id": hw_id, "student_ids": payload.student_ids or []
        })

    # Uploads
    if payload.uploads:
        await homework_uploads_collection.insert_many([
            { "homework_id": hw_id, **u.model_dump() } for u in payload.uploads
        ])

    # Questions
    if payload.questions:
        # preserve order by idx
        await homework_questions_collection.insert_many([
            { "homework_id": hw_id, "idx": i, **q.model_dump() }
            for i, q in enumerate(payload.questions)
        ])

    return { "homework_id": hw_id, "status": "active" }

@router.get("/homeworks/by-case", response_model=HomeworkOut)
async def homework_by_case(caseId: str = Query(..., alias="caseId"),
                           userId: str = Query(..., alias="userId")):
    # Find active homework for this case
    hw = await homeworks_collection.find_one({"case_id": caseId, "status": "active"})
    if not hw:
        # no homework -> empty response
        return HomeworkOut(
            homework_id="",
            case_id=caseId,
            status="active",
            due_at="",
            assigned=False,
            instructions=None,
            uploads=[],
            questions=[]
        )

    hw_id = str(hw["_id"])

    # Check assignment audience
    target = await homework_targets_collection.find_one({"homework_id": hw_id})
    assigned = False
    if target:
        if target.get("all_flag"):
            assigned = True
        elif target.get("group_name"):
            # TODO: resolve group membership if you support groups; for now treat as assigned
            assigned = True
        elif userId in (target.get("student_ids") or []):
            assigned = True

    uploads = await homework_uploads_collection.find({"homework_id": hw_id}).to_list(100)
    for u in uploads:
        u.pop("_id", None)

    qdocs = await homework_questions_collection.find({"homework_id": hw_id}).sort("idx", 1).to_list(200)
    for q in qdocs:
        q.pop("_id", None)
        q.pop("homework_id", None)

    return HomeworkOut(
        homework_id=hw_id,
        case_id=hw["case_id"],
        status=hw.get("status","active"),
        due_at=hw.get("due_at",""),
        assigned=assigned,
        instructions=hw.get("instructions"),
        uploads=uploads,
        questions=qdocs
    )
