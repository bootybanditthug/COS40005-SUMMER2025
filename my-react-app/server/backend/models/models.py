from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, Dict, Any, List, Literal

class User(BaseModel):
    firstName: str
    lastName: str
    email: EmailStr
    password: str
    created_at: datetime = "if this is missing, it's probably bugged. Uh oh."
    dob: str = "None"
    role: str
    suspension: bool = "0"
    last_active: datetime | None = None

class Approval(BaseModel):
    id: str
    status: str = "pending"

class UserUpdate(BaseModel):
    firstName: str
    lastName: str

class Annotation(BaseModel):
    id: Optional[str] = None      
    case_id: str                   
    user_id: str                   
    type: str                      
    data: Dict[str, Any]            
    created_at: datetime = datetime.now()
    updated_at: datetime = datetime.now()

class AnnotationVersion(BaseModel):
    id: Optional[str] = None
    caseId: str
    userId: str
    annotations: List[Dict[str, Any]]
    createdAt: datetime = datetime.now()

class ForumAuthor(BaseModel):
    user_id: Optional[str] = None
    name: Optional[str] = None
    avatarUrl: Optional[str] = None

class ForumReply(BaseModel):
    id: str
    author: ForumAuthor
    role: Optional[Literal["student", "instructor", "admin"]] = None
    content: str
    timestamp: datetime = Field(default_factory=datetime.now)

class ForumThread(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    author: ForumAuthor
    title: str
    content: str
    tags: List[str] = Field(default_factory=list)
    imageUrl: Optional[str] = None
    replies: List[ForumReply] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=datetime.now)

    class Config:
        populate_by_name = True
        from_attributes = True
