from pydantic import BaseModel
from typing import Optional, List, Any, Literal

class FileItem(BaseModel):
    name: str
    url: str
    type: str
    size: int

class AnswerItem(BaseModel):
    index: int        # index of question
    value: Any        # string for short, number for mcq choice

class SubmissionCreate(BaseModel):
    notes: Optional[str] = None
    files: Optional[List[FileItem]] = None
    answers: Optional[List[AnswerItem]] = None

class SubmissionOut(BaseModel):
    submission_id: str
    status: Literal["none", "submitted", "grading", "graded"]
    score: Optional[int] = None
    notes: Optional[str] = None
    files: Optional[List[FileItem]] = None
    answers: Optional[List[AnswerItem]] = None
    updated_at: Optional[str] = None

class GradeRequest(BaseModel):
    score: int
    rubric: List[dict]  # [{"id":"crit-1","points":5}, ...]
    feedback: str | None = None
