from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Union

# ---- Uploads ----
class HWUpload(BaseModel):
    name: str
    url: str
    type: str
    size: int

# ---- Questions ----
class QuestionShort(BaseModel):
    type: Literal["short"]
    prompt: str
    points: int
    guidance: Optional[str] = None
    expectedAnswer: Optional[str] = None
    imageIndex: Optional[int] = None

class QuestionMCQ(BaseModel):
    type: Literal["mcq"]
    prompt: str
    points: int
    guidance: Optional[str] = None
    options: List[str]
    correctIndex: Optional[int] = None
    imageIndex: Optional[int] = None

Question = Union[QuestionShort, QuestionMCQ]

# ---- Create / Out ----
class HomeworkCreate(BaseModel):
    case_id: str
    due_at: str  # ISO
    audience: Literal["all", "group", "list"]
    group_name: Optional[str] = None
    student_ids: Optional[List[str]] = None
    instructions: Optional[str] = None
    checklist: Optional[List[str]] = None
    uploads: List[HWUpload] = Field(default_factory=list)
    questions: List[Question] = Field(default_factory=list)

class HomeworkOut(BaseModel):
    homework_id: str
    case_id: str
    status: Literal["active", "closed"]
    due_at: str
    assigned: bool
    instructions: Optional[str] = None
    uploads: List[HWUpload] = Field(default_factory=list)
    questions: List[Question] = Field(default_factory=list)
