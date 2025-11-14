from fastapi import APIRouter, HTTPException
from datetime import datetime
from bson import ObjectId
from db.connection import annotations_collection, versions_collection
from models.models import Annotation, AnnotationVersion

router = APIRouter(prefix="/annotations", tags=["Annotations"])


# --- Save a new annotation (optional direct save) ---
@router.post("/")
async def save_annotation(annotation: Annotation):
    annotation_dict = annotation.model_dump()
    annotation_dict["created_at"] = datetime.now()
    annotation_dict["updated_at"] = datetime.now()
    result = await annotations_collection.insert_one(annotation_dict)
    annotation_dict["_id"] = str(result.inserted_id)
    return annotation_dict


# --- Get all annotations for a case (optional) ---
@router.get("/{case_id}")
async def get_annotations(case_id: str):
    annotations = await annotations_collection.find({"case_id": case_id}).to_list(1000)
    for ann in annotations:
        ann["_id"] = str(ann["_id"])
    return annotations


@router.post("/version")
async def save_annotation_version(version: AnnotationVersion):
    version_dict = version.model_dump()
    case_id = version_dict["caseId"]
    user_id = version_dict["userId"]

    last_version = await versions_collection.find_one(
        {"caseId": case_id, "userId": user_id},
        sort=[("version", -1)]
    )
    next_version_number = (last_version["version"] + 1) if last_version and "version" in last_version else 1

    version_dict["version"] = next_version_number
    version_dict["createdAt"] = datetime.now()

    result = await versions_collection.insert_one(version_dict)
    version_dict["_id"] = str(result.inserted_id)

    return {
        "message": f"Version v{next_version_number} saved",
        "version": version_dict
    }


@router.get("/version/{case_id}/{user_id}")
async def get_annotation_versions(case_id: str, user_id: str):
    versions = await versions_collection.find(
        {"caseId": case_id, "userId": user_id}
    ).sort("version", -1).to_list(100)

    for v in versions:
        v["_id"] = str(v["_id"])
    return versions


# --- Delete a version and renumber subsequent ones ---
@router.delete("/version/{version_id}")
async def delete_annotation_version(version_id: str):
    doc = await versions_collection.find_one({"_id": ObjectId(version_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Version not found")

    await versions_collection.delete_one({"_id": ObjectId(version_id)})

    # Renumber remaining versions for the same user & case
    case_id = doc["caseId"]
    user_id = doc["userId"]
    versions = await versions_collection.find(
        {"caseId": case_id, "userId": user_id}
    ).sort("createdAt", 1).to_list(100)

    for i, v in enumerate(versions, start=1):
        await versions_collection.update_one({"_id": v["_id"]}, {"$set": {"version": i}})

    return {"message": "Version deleted and renumbered successfully"}