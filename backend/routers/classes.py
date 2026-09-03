"""
routers/classes.py — Class management endpoints

Endpoints:
  POST /classes/create      → Teacher creates a class
  GET  /classes/my-classes  → Get classes for logged-in user (teacher = own, student = enrolled)
  POST /classes/join        → Student joins a class via join code
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field
from typing import List
import random
import string

from models import User, Class, Enrollment, Quiz
from dependencies import get_db, get_current_user, require_teacher, require_student

router = APIRouter(prefix="/classes", tags=["Classes"])


# ─────────────────────────────────────────────
# PYDANTIC SCHEMAS
# ─────────────────────────────────────────────

class CreateClassRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)


class ClassOut(BaseModel):
    id:               int
    name:             str
    code:             str
    teacher_id:       int
    assessment_count: int = 0
    is_deleted:       bool = False

    class Config:
        from_attributes = True


class JoinClassRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=20)


# ─────────────────────────────────────────────
# HELPER: generate unique class code
# ─────────────────────────────────────────────

def generate_class_code(length: int = 6) -> str:
    """
    Generates a random uppercase code like 'MATH3X'.
    We check uniqueness in the DB before using it.
    """
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))


# ─────────────────────────────────────────────
# ENDPOINT 1: POST /classes/create
# ─────────────────────────────────────────────
@router.post("/create", status_code=201)
async def create_class(
    body:    CreateClassRequest,
    teacher: User              = Depends(require_teacher),
    db:      AsyncSession      = Depends(get_db),
):
    """
    Teacher creates a new class.
    A unique 6-character join code is auto-generated server-side.
    Students use this code to join the class.
    """
    # 1. Enforce uniqueness: no two classes with the same name for this teacher
    existing = await db.execute(
        select(Class).where(func.lower(Class.name) == body.name.lower(), Class.teacher_id == teacher.id, Class.is_deleted == 0)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="You already have an active class with this name.")

    # 2. Generate a unique code
    while True:
        code   = generate_class_code()
        result = await db.execute(select(Class).where(Class.code == code))
        if not result.scalar_one_or_none():
            break  # code is unique, we can use it

    new_class = Class(
        name       = body.name,
        code       = code,
        teacher_id = teacher.id,
    )
    db.add(new_class)
    await db.commit()
    await db.refresh(new_class)

    return {
        "message":    f"Class '{body.name}' created successfully.",
        "id":         new_class.id,
        "name":       new_class.name,
        "code":       new_class.code,
        "teacher_id": new_class.teacher_id,
        "is_deleted": False
    }


# ─────────────────────────────────────────────
# ENDPOINT 2: GET /classes/my-classes
# ─────────────────────────────────────────────
@router.get("/my-classes", response_model=List[ClassOut])
async def get_my_classes(
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """
    Returns classes relevant to the logged-in user:
    - Teacher → classes they created (only active ones)
    - Student → classes they are enrolled in (including deleted ones so they can see the notification)
    - Admin   → all classes
    """
    if current_user.role == "teacher":
        result  = await db.execute(select(Class).where(Class.teacher_id == current_user.id, Class.is_deleted == 0))
        classes = result.scalars().all()

    elif current_user.role == "student":
        # Join Enrollment → Class to get enrolled classes
        result = await db.execute(
            select(Class)
            .join(Enrollment, Enrollment.class_id == Class.id)
            .where(Enrollment.student_id == current_user.id)
        )
        classes = result.scalars().all()

    elif current_user.role == "admin":
        result  = await db.execute(select(Class))
        classes = result.scalars().all()

    else:
        classes = []

    # Add assessment count to each class
    output = []
    for c in classes:
        count_result = await db.execute(
            select(func.count(Quiz.id)).where(Quiz.class_id == c.id)
        )
        count = count_result.scalar_one()
        output.append(ClassOut(
            id               = c.id,
            name             = c.name,
            code             = c.code,
            teacher_id       = c.teacher_id,
            assessment_count = count,
            is_deleted       = bool(c.is_deleted),
        ))

    return output

# ─────────────────────────────────────────────
# ENDPOINT: DELETE /classes/{class_id}
# ─────────────────────────────────────────────
@router.delete("/{class_id}", status_code=200)
async def delete_class(
    class_id: int,
    teacher: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """
    Soft deletes a class so students receive a removal notification.
    """
    result = await db.execute(
        select(Class).where(Class.id == class_id, Class.teacher_id == teacher.id)
    )
    found_class = result.scalar_one_or_none()
    
    if not found_class:
        raise HTTPException(status_code=404, detail="Class not found or not owned by you.")
    
    if found_class.is_deleted:
        raise HTTPException(status_code=400, detail="Class is already deleted.")
        
    found_class.is_deleted = 1
    await db.commit()
    return {"message": "Class removed successfully."}


# ─────────────────────────────────────────────
# ENDPOINT 3: POST /classes/join
# ─────────────────────────────────────────────
@router.post("/join")
async def join_class(
    body:    JoinClassRequest,
    student: User             = Depends(require_student),
    db:      AsyncSession     = Depends(get_db),
):
    """
    Student joins a class by entering the 6-char code the teacher shared.
    The code lookup is case-insensitive.
    """
    code = body.code.strip().upper()

    # Find the class
    result     = await db.execute(select(Class).where(Class.code == code))
    found_class = result.scalar_one_or_none()

    if not found_class:
        raise HTTPException(status_code=404, detail="Invalid class code. Check with your teacher.")

    # Check if already enrolled
    enroll_check = await db.execute(
        select(Enrollment).where(
            Enrollment.student_id == student.id,
            Enrollment.class_id   == found_class.id,
        )
    )
    if enroll_check.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already enrolled in this class.")

    # Create enrollment
    enrollment = Enrollment(student_id=student.id, class_id=found_class.id)
    db.add(enrollment)
    await db.commit()

    return {
        "message": f"Successfully joined '{found_class.name}'.",
        "class": {
            "id":   found_class.id,
            "name": found_class.name,
            "code": found_class.code,
        }
    }
