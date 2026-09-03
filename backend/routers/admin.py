"""
routers/admin.py — Admin-only endpoints

Endpoints:
  GET   /admin/stats                  → Platform overview counts
  GET   /admin/users                  → List all users (filter by role)
  GET   /admin/classes                → List all classes with enrollment counts
  PATCH /admin/users/{user_id}/status → Suspend or activate a teacher/student
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime

from models import User, Class, Quiz, Enrollment, Submission
from dependencies import get_db, require_admin

router = APIRouter(prefix="/admin", tags=["Admin"])


# ─────────────────────────────────────────────
# PYDANTIC SCHEMAS
# ─────────────────────────────────────────────

class UserStatusUpdate(BaseModel):
    status: Literal["active", "suspended"]


# ─────────────────────────────────────────────
# ENDPOINT 1: GET /admin/stats
# ─────────────────────────────────────────────
@router.get("/stats")
async def get_stats(
    admin: User         = Depends(require_admin),
    db:    AsyncSession = Depends(get_db),
):
    """
    Returns platform-wide counts for the Admin Overview tab.
    
    Used by: AdminDashboard.jsx — the "Platform Statistics" bento grid
    (Total Teachers, Total Students, Total Assessments)
    """
    teacher_count = await db.execute(
        select(func.count()).select_from(User).where(User.role == "teacher")
    )
    student_count = await db.execute(
        select(func.count()).select_from(User).where(User.role == "student")
    )
    quiz_count = await db.execute(
        select(func.count()).select_from(Quiz)
    )
    class_count = await db.execute(
        select(func.count()).select_from(Class)
    )

    return {
        "total_teachers":    teacher_count.scalar_one(),
        "total_students":    student_count.scalar_one(),
        "total_assessments": quiz_count.scalar_one(),
        "total_classes":     class_count.scalar_one(),
    }


# ─────────────────────────────────────────────
# ENDPOINT 2: GET /admin/users
# ─────────────────────────────────────────────
@router.get("/users")
async def get_all_users(
    role:  Optional[str] = Query(None, description="Filter by role: teacher | student | parent"),
    admin: User          = Depends(require_admin),
    db:    AsyncSession  = Depends(get_db),
):
    """
    Returns all users, optionally filtered by role.
    
    Used by:
    - AdminDashboard Teachers tab  → ?role=teacher
    - AdminDashboard Management tab → ?role=teacher (for suspend/activate)
    """
    query = select(User)
    if role:
        query = query.where(User.role == role)

    result = await db.execute(query)
    users  = result.scalars().all()

    output = []
    for u in users:
        # Count how many quizzes this teacher created
        quiz_count = 0
        if u.role == "teacher":
            count_result = await db.execute(
                select(func.count()).select_from(Quiz).where(Quiz.teacher_id == u.id)
            )
            quiz_count = count_result.scalar_one()

        output.append({
            "id":               u.id,
            "name":             u.name,
            "email":            u.email,
            "role":             u.role,
            "status":           u.status,
            "assessment_count": quiz_count,
            "created_at":       u.created_at.isoformat(),
        })

    return output


# ─────────────────────────────────────────────
# ENDPOINT 3: GET /admin/classes
# ─────────────────────────────────────────────
@router.get("/classes")
async def get_all_classes(
    admin: User         = Depends(require_admin),
    db:    AsyncSession = Depends(get_db),
):
    """
    Returns all classes with teacher name and enrolled student count.
    
    Used by: AdminDashboard Classes tab
    """
    result  = await db.execute(select(Class))
    classes = result.scalars().all()

    output = []
    for c in classes:
        # Get teacher name
        teacher_result = await db.execute(select(User).where(User.id == c.teacher_id))
        teacher        = teacher_result.scalar_one_or_none()

        # Get enrollment count
        enroll_result  = await db.execute(
            select(func.count()).select_from(Enrollment).where(Enrollment.class_id == c.id)
        )
        enrolled_count = enroll_result.scalar_one()

        output.append({
            "id":             c.id,
            "name":           c.name,
            "code":           c.code,
            "teacher_name":   teacher.name if teacher else "Unknown",
            "teacher_email":  teacher.email if teacher else "",
            "enrolled_count": enrolled_count,
            "created_at":     c.created_at.isoformat(),
        })

    return output


# ─────────────────────────────────────────────
# ENDPOINT 4: PATCH /admin/users/{user_id}/status
# ─────────────────────────────────────────────
@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: int,
    body:    UserStatusUpdate,
    admin:   User         = Depends(require_admin),
    db:      AsyncSession = Depends(get_db),
):
    """
    Suspends or reactivates a user (usually a teacher).
    
    Used by: AdminDashboard → handleSuspendTeacher()
    
    Important: The suspend check in get_current_user (dependencies.py) means
    a suspended user can't make ANY authenticated request — even with a valid token.
    This is real-time suspension without needing to invalidate tokens.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user   = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Prevent admin from suspending themselves
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot suspend your own account.")

    user.status = body.status
    await db.commit()
    await db.refresh(user)

    action = "suspended" if body.status == "suspended" else "activated"
    return {
        "message": f"User '{user.name}' has been {action}.",
        "user": {
            "id":     user.id,
            "email":  user.email,
            "status": user.status,
        }
    }
