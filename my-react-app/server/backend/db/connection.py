from motor.motor_asyncio import AsyncIOMotorClient
from decouple import config

MONGO_URL = config("MONGO_URL", default="mongodb://localhost:27017")

client = AsyncIOMotorClient(MONGO_URL)
db = client["project"]
users_collection = db["users"]
approvals_collection = db["approvals"]
annotations_collection = db["annotations"]
versions_collection = db["annotation_versions"]
forum_collection = db["forum"]

# ===== NEW collections =====
homeworks_collection = db["homeworks"]
homework_targets_collection = db["homework_targets"]
homework_uploads_collection = db["homework_uploads"]
homework_questions_collection = db["homework_questions"]
submissions_collection = db["submissions"]
