# submissions.py
# Handles fetching and grading of student submissions.
# Added get-submissions in Sep 2025 — was missing and caused the teacher
# submissions tab to always 404. Fixed the grade URL too (was /grade/{id},
# should be /{id}/grade to match the router prefix).

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional

from models import User, Submission, Quiz, Enrollment, Class
from dependencies import get_db, require_teacher, get_current_user

router = APIRouter(prefix="/submissions", tags=["Submissions"])


# returns submissions for whoever is logged in:
#   teacher → only their own quizzes' submissions
#   student → only their own
#   admin   → everything
@router.get("/get-submissions")
async def get_submissions(
    quiz_id:      Optional[int] = Query(None),
    student_id:   Optional[int] = Query(None),
    current_user: User          = Depends(get_current_user),
    db:           AsyncSession  = Depends(get_db),
):
    query = select(Submission)

    if current_user.role == "teacher":
        # only show submissions for quizzes this teacher created
        quiz_result = await db.execute(
            select(Quiz.id).where(Quiz.teacher_id == current_user.id)
        )
        teacher_quiz_ids = [r for r in quiz_result.scalars().all()]
        if not teacher_quiz_ids:
            return []
        query = query.where(Submission.quiz_id.in_(teacher_quiz_ids))

    elif current_user.role == "student":
        query = query.where(Submission.student_id == current_user.id)

    # optional filters from the frontend
    if quiz_id is not None:
        query = query.where(Submission.quiz_id == quiz_id)
    if student_id is not None:
        query = query.where(Submission.student_id == student_id)

    query = query.order_by(Submission.submitted_at.desc())
    result = await db.execute(query)
    subs   = result.scalars().all()

    output = []
    for s in subs:
        quiz_result = await db.execute(select(Quiz).where(Quiz.id == s.quiz_id))
        quiz        = quiz_result.scalar_one_or_none()

        student_result = await db.execute(select(User).where(User.id == s.student_id))
        student        = student_result.scalar_one_or_none()

        output.append({
            "id":               s.id,
            "quiz_id":          s.quiz_id,
            "assessmentId":     s.quiz_id,     # camelCase alias so the frontend doesn't break
            "assessmentTitle":  quiz.title if quiz else "Unknown Assessment",
            "class_id":         quiz.class_id if quiz else None,
            "student_id":       s.student_id,
            "studentEmail":     student.email if student else "unknown",
            "studentName":      student.name  if student else "Unknown",
            "answers":          s.answers,
            "mcq_score":        s.mcq_score,
            "mcq_total":        s.mcq_total,
            "manual_score":     s.manual_score,
            "manual_total":     s.manual_total,
            "percentage":       s.percentage,
            "feedback":         s.feedback,
            "status":           s.status,
            "submitted_at":     s.submitted_at.isoformat(),
        })

    return output


class GradeSubmissionRequest(BaseModel):
    manual_score: float = Field(..., ge=0)
    feedback:     str   = ""


# teacher hits this from the ReviewCenter after reading the student's subjective answers
@router.patch("/{submission_id}/grade")
async def grade_submission(
    submission_id: int,
    body:          GradeSubmissionRequest,
    teacher:       User         = Depends(require_teacher),
    db:            AsyncSession = Depends(get_db),
):
    result     = await db.execute(select(Submission).where(Submission.id == submission_id))
    submission = result.scalar_one_or_none()

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")

    # make sure this submission actually belongs to one of the teacher's quizzes
    quiz_result = await db.execute(select(Quiz).where(Quiz.id == submission.quiz_id))
    quiz        = quiz_result.scalar_one_or_none()

    if not quiz or quiz.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="You can only grade submissions for your own quizzes.")

    if body.manual_score > (submission.manual_total or 0):
        raise HTTPException(
            status_code=400,
            detail=f"Score {body.manual_score} exceeds max manual marks {submission.manual_total}."
        )

    submission.manual_score = body.manual_score
    submission.feedback     = body.feedback
    submission.status       = "graded"

    # recalculate the overall percentage with the new manual score added in
    total_score    = (submission.mcq_score or 0) + body.manual_score
    total_possible = (submission.mcq_total or 0) + (submission.manual_total or 0)
    submission.percentage = round((total_score / total_possible * 100), 2) if total_possible > 0 else 0

    await db.commit()
    await db.refresh(submission)

    return {
        "message":       "Submission graded successfully.",
        "submission_id": submission.id,
        "manual_score":  submission.manual_score,
        "percentage":    submission.percentage,
        "status":        submission.status,
    }
