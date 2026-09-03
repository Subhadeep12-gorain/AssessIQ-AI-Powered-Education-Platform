"""
routers/parent.py — Parent dashboard data endpoint

Endpoint:
  GET /parent/children → Returns all linked children's data (results, classes, scores)

Used by: ParentDashboard.jsx — loads everything in one API call instead of many localStorage reads.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from models import User, Submission, Enrollment, Class, Quiz
from dependencies import get_db, require_parent

router = APIRouter(prefix="/parent", tags=["Parent"])


# ─────────────────────────────────────────────
# ENDPOINT: GET /parent/children
# ─────────────────────────────────────────────
@router.get("/children")
async def get_children_data(
    parent: User         = Depends(require_parent),
    db:     AsyncSession = Depends(get_db),
):
    """
    Returns complete performance data for all children linked to this parent.
    
    ParentDashboard.jsx does this per-child:
      - results: list of submissions with assessment title, class name, score %
      - avg_score: average across all results
      - completed_count: number of submitted assessments
      - classes_joined: number of enrolled classes
    """
    children_emails = parent.children_emails or []

    if not children_emails:
        return []

    children_data = []

    for email in children_emails:
        # Find the student
        student_result = await db.execute(
            select(User).where(User.email == email, User.role == "student")
        )
        student = student_result.scalar_one_or_none()

        if not student:
            # Student email linked but not registered yet
            children_data.append({
                "email":           email,
                "name":            "Not Registered Yet",
                "avg_score":       0,
                "completed_count": 0,
                "classes_joined":  0,
                "results":         [],
                "not_found":       True,
            })
            continue

        # Get all submissions for this student
        sub_result   = await db.execute(
            select(Submission).where(Submission.student_id == student.id)
        )
        submissions  = sub_result.scalars().all()

        # Build results list with assessment and class details
        results = []
        for sub in submissions:
            # Get quiz details
            quiz_result = await db.execute(select(Quiz).where(Quiz.id == sub.quiz_id))
            quiz        = quiz_result.scalar_one_or_none()

            # Get class name
            class_name = "Unknown"
            if quiz:
                class_result = await db.execute(select(Class).where(Class.id == quiz.class_id))
                cls          = class_result.scalar_one_or_none()
                class_name   = cls.name if cls else "Unknown"

            results.append({
                "submission_id":    sub.id,
                "assessment_title": quiz.title if quiz else "Unknown Assessment",
                "class_name":       class_name,
                "mcq_score":        sub.mcq_score,
                "mcq_total":        sub.mcq_total,
                "manual_score":     sub.manual_score,
                "manual_total":     sub.manual_total,
                "percent":          sub.percentage,
                "status":           sub.status,
                "submitted_at":     sub.submitted_at.isoformat(),
            })

        # Calculate stats
        graded_results = [r for r in results if r["status"] == "graded"]
        avg_score = (
            round(sum(r["percent"] for r in graded_results) / len(graded_results), 1)
            if graded_results else 0
        )

        # Get enrolled classes count
        enroll_result = await db.execute(
            select(Enrollment).where(Enrollment.student_id == student.id)
        )
        enrolled_classes = enroll_result.scalars().all()

        children_data.append({
            "id":              student.id,
            "email":           student.email,
            "name":            student.name,
            "avg_score":       avg_score,
            "completed_count": len(submissions),
            "classes_joined":  len(enrolled_classes),
            "results":         sorted(results, key=lambda r: r["submitted_at"], reverse=True),
            "not_found":       False,
        })

    return children_data


# ─────────────────────────────────────────────
# ENDPOINT: POST /parent/link-child
# ─────────────────────────────────────────────
class LinkChildRequest(BaseModel):
    email: str

@router.post("/link-child")
async def link_child(
    body: LinkChildRequest,
    parent: User = Depends(require_parent),
    db: AsyncSession = Depends(get_db),
):
    """
    Links a student's email to this parent's account.
    Verifies that the student exists in the database.
    """
    email = body.email.strip().lower()

    if not email:
        raise HTTPException(status_code=400, detail="Student email is required.")

    # Check if student exists
    student_result = await db.execute(select(User).where(User.email == email, User.role == "student"))
    student = student_result.scalar_one_or_none()

    if not student:
        raise HTTPException(status_code=404, detail="No student found with this email.")

    # Get current list or initialize empty list
    # Because of JSON type mutability in SQLAlchemy, we create a new list
    current_emails = list(parent.children_emails or [])

    if email in current_emails:
        raise HTTPException(status_code=400, detail="This student is already linked to your account.")

    current_emails.append(email)
    parent.children_emails = current_emails

    await db.commit()
    return {"success": True, "message": f"Successfully linked {student.name or email}."}
