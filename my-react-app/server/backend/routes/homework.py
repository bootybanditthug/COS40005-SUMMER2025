import os
from pathlib import Path
from datetime import datetime
from typing import Optional, List
from fastapi.encoders import jsonable_encoder
from bson import ObjectId

from fastapi import APIRouter, UploadFile, Form, HTTPException, File
from fastapi.responses import JSONResponse

from db.connection import users_collection, homework_submissions_collection
from models.models import HomeworkSubmission, UploadedFile

router = APIRouter(prefix="/submissions", tags=["Homework"])

BASE_UPLOAD_DIR = Path("uploads")

def serialize_doc(doc):
    """Convert MongoDB _id to string."""
    if not doc:
        return doc
    doc["id"] = str(doc.get("_id"))
    doc.pop("_id", None)
    return doc


@router.post("")
async def submit_homework(
    case_id: str = Form(...),
    user_id: str = Form(...),
    notes: Optional[str] = Form(None),
    files: List[UploadFile] = File(default=[]),
):
    """Submit or update homework for a case with file uploads and notes."""
    
    try:
        user = await users_collection.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = None
    
    if not user:
        user = await users_collection.find_one({"user_id": user_id})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_folder = BASE_UPLOAD_DIR / str(user_id) / "homework" / case_id
    user_folder.mkdir(parents=True, exist_ok=True)

    uploaded_files = []
    for file in files:
        if file.filename:
            ext = os.path.splitext(file.filename)[1]
            timestamp = int(datetime.now().timestamp())
            filename = f"hw_{case_id}_{timestamp}_{file.filename}"
            file_path = user_folder / filename
            
            with open(file_path, "wb") as f:
                f.write(await file.read())
            
            file_url = f"/uploads/{user_id}/homework/{case_id}/{filename}"
            
            uploaded_files.append(
                UploadedFile(
                    name=file.filename,
                    url=file_url,
                    type=file.content_type or "application/octet-stream"
                )
            )

    existing_submission = await homework_submissions_collection.find_one({
        "case_id": case_id,
        "user_id": user_id
    })

    if existing_submission:
        existing_files = [UploadedFile(**f) for f in existing_submission.get("files", [])]
        all_files = existing_files + uploaded_files
        
        update_data = {
            "notes": notes if notes is not None else existing_submission.get("notes"),
            "files": [f.model_dump() for f in all_files],
            "updated_at": datetime.now(),
            "status": "grading"
        }
        
        await homework_submissions_collection.update_one(
            {"_id": existing_submission["_id"]},
            {"$set": update_data}
        )
        
        updated_submission = await homework_submissions_collection.find_one(
            {"_id": existing_submission["_id"]}
        )
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Homework updated successfully",
                "submission": serialize_doc(updated_submission)
            }
        )
    else:
        submission = HomeworkSubmission(
            case_id=case_id,
            user_id=user_id,
            notes=notes or "",
            files=uploaded_files,
            status="grading",
            submitted_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        result = await homework_submissions_collection.insert_one(
            submission.model_dump(by_alias=True, exclude_none=True)
        )
        
        submission.id = str(result.inserted_id)
        return JSONResponse(
            status_code=201,
            content={
                "status": "success",
                "message": "Homework submitted successfully",
                "submission": jsonable_encoder(submission)
            }
        )


@router.get("/{case_id}/{user_id}")
async def get_homework_submission(case_id: str, user_id: str):
    """Get homework submission for a specific case and user."""
    
    submission = await homework_submissions_collection.find_one({
        "case_id": case_id,
        "user_id": user_id
    })
    
    if not submission:
        return JSONResponse(
            status_code=404,
            content={"status": "none", "message": "No submission found"}
        )
    
    return serialize_doc(submission)


@router.get("/case/{case_id}")
async def get_all_submissions_for_case(case_id: str):
    """Get all homework submissions for a specific case (for instructors)."""
    
    submissions = []
    async for submission in homework_submissions_collection.find({"case_id": case_id}):
        submissions.append(serialize_doc(submission))
    
    return submissions
