"""
routers/quizzes.py — Quiz/Assessment endpoints (the core of AssessIQ)

Endpoints:
  POST /quizzes/generate-quiz          → AI generates questions (preview, NOT saved)
  POST /quizzes/create-quiz            → Save & publish the final quiz
  GET  /quizzes/get-quizzes            → List quizzes (role-aware)
  GET  /quizzes/get-quiz/{id}          → Get one quiz (strips correct answers for students)
  PUT  /quizzes/update-quiz/{id}       → Teacher edits a quiz
  DELETE /quizzes/delete-quiz/{id}     → Teacher or Admin deletes a quiz
  POST /quizzes/submit-answers/{id}    → Student submits their answers

The AI generation uses OpenRouter API (same key as frontend aiService.js).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict, Literal
from datetime import datetime
import httpx
import json
import os
from dotenv import load_dotenv

from models import User, Quiz, Class, Enrollment, Submission
from dependencies import get_db, get_current_user, require_teacher, require_student

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL   = os.getenv("OPENROUTER_MODEL", "openrouter/auto")

router = APIRouter(prefix="/quizzes", tags=["Quizzes"])


# ─────────────────────────────────────────────
# PYDANTIC SCHEMAS
# ─────────────────────────────────────────────

class GenerateQuizRequest(BaseModel):
    """
    All form fields from CreateAssessmentModal.jsx
    This is exactly what the teacher fills out before hitting "Generate Questions"
    """
    title:          str            = Field(..., min_length=2)
    class_id:       int
    type:           str            = "MCQ"          # MCQ | MSQ | Short Answer | Long Answer | Mix | etc.
    difficulty:     str            = "Medium"       # Easy | Medium | Hard
    bloom_level:    str            = "Understanding"
    total_marks:    float          = 50
    num_questions:  int            = Field(default=10, ge=1, le=50)
    duration:       int            = 30             # minutes
    negative_marks: float          = 0
    deadline:       Optional[str]  = None           # ISO string from datetime-local input
    document_id:    Optional[int]  = None           # if teacher uploaded a PDF first
    topic:          Optional[str]  = None           # manual topic if no PDF


class CreateQuizRequest(BaseModel):
    """Same as Generate, but also includes the final questions list"""
    title:          str
    class_id:       int
    type:           str   = "MCQ"
    difficulty:     str   = "Medium"
    bloom_level:    str   = "Understanding"
    total_marks:    float = 50
    duration:       int   = 30
    negative_marks: float = 0
    deadline:       Optional[str]   = None
    questions:      List[Dict[str, Any]] = []


class SubmitAnswersRequest(BaseModel):
    answers: Dict[str, Any] = {}   # { "q_ai_1": "Option A", "q_ai_2": "True" }


class QuizOut(BaseModel):
    id:             int
    title:          str
    class_id:       int
    teacher_id:     int
    type:           str
    difficulty:     str
    bloom_level:    str
    total_marks:    float
    duration:       int
    negative_marks: float
    deadline:       Optional[datetime]
    questions:      List[Dict[str, Any]]
    status:         str
    created_at:     datetime

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# HELPER: Build OpenRouter API prompt
# ─────────────────────────────────────────────

def build_prompt(body: GenerateQuizRequest, source_text: Optional[str]) -> str:
    """
    Builds the AI prompt based on the form data.
    The output format (JSON array) is specified so the AI returns parseable questions.
    """
    context = f"Use this content as the source:\n\n{source_text[:4000]}" if source_text else \
              f"Generate questions on the topic: {body.topic or body.title}"

    question_format = {
        "MCQ":          'Return MCQ questions with a detailed "options" array containing actual answer choices (not just A,B,C,D) and "correctAnswer" matching exactly one option.',
        "True/False":   'Return True/False questions with "correctAnswer": "True" or "False"',
        "Short Answer": 'Return short answer questions with "sampleAnswer": "..."',
        "Long Answer":  'Return long answer questions with "sampleAnswer": "..."',
        "MSQ":          'Return MSQ (multi-select) questions with "options": [...] and "correctAnswers": ["A","C"]',
        "Fill in Blank": 'Return fill-in-the-blank with "correctAnswer": "word"',
        "Mix":          'Return a mix of MCQ, Short Answer, and True/False questions',
    }.get(body.type, 'Return MCQ questions with options and correctAnswer')

    return f"""You are an expert educational assessment creator.

{context}

Generate EXACTLY {body.num_questions} questions.
Type: {body.type}
Difficulty: {body.difficulty}
Bloom's Taxonomy Level: {body.bloom_level}
Total Marks: {body.total_marks}
Negative Marks per wrong answer: {body.negative_marks}

{question_format}

IMPORTANT: Return ONLY a valid JSON array. No explanations, no markdown, no code blocks. Each question must have:
- "id": unique string like "q_ai_1"
- "type": question type
- "text": the question text
- "maxMarks": marks for this question (distribute {body.total_marks} across all questions)
- "options": required for MCQ/MSQ, must be an array of actual string choices (e.g. ["Apple", "Banana", "Orange", "Grape"])

Example output:
[
  {{
    "id": "q_ai_1",
    "type": "mcq",
    "text": "What is photosynthesis?",
    "options": ["A process in animals", "Converting sunlight to energy", "Breaking down food", "Cell division"],
    "correctAnswer": "Converting sunlight to energy",
    "maxMarks": 5
  }}
]"""


async def call_openrouter(prompt: str) -> List[dict]:
    """
    Sends the prompt to OpenRouter API and parses the JSON response.
    OpenRouter is like a unified gateway to many AI models (GPT, Claude, Llama etc.)
    """
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type":  "application/json",
        "HTTP-Referer":  "https://assessiq.app",
        "X-Title":       "AssessIQ",
    }
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 4096,   # capped — default was 65535 which exceeds free credits
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"AI service error: {response.status_code} — {response.text[:200]}"
        )

    data    = response.json()
    content = data["choices"][0]["message"]["content"].strip()

    # Remove any markdown code blocks if model added them
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]

    try:
        questions = json.loads(content)
        if not isinstance(questions, list):
            raise ValueError("Expected a JSON array")
        return questions
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(
            status_code=502,
            detail=f"AI returned invalid JSON. Try again. Error: {str(e)}"
        )


# ─────────────────────────────────────────────
# HELPER: Auto-grade MCQ/MSQ/True-False
# ─────────────────────────────────────────────

def grade_answers(questions: list, answers: dict, negative_marks: float) -> tuple:
    """
    Auto-grades objective questions (MCQ, MSQ, True/False, Fill in Blank).
    Returns (mcq_score, mcq_total, manual_total, graded_status)
    """
    mcq_score    = 0.0
    mcq_total    = 0.0
    manual_total = 0.0

    objective_types  = {"mcq", "msq", "true_false", "true/false", "fill in blank", "fill_in_blank", "matching"}
    subjective_types = {"short_answer", "short answer", "long_answer", "long answer"}

    for q in questions:
        q_type = q.get("type", "").lower()
        marks  = float(q.get("maxMarks", 1))

        if q_type in subjective_types:
            manual_total += marks
            continue

        # Objective — count in auto-grade
        mcq_total += marks
        student_answer = answers.get(q.get("id", ""))

        if student_answer is None:
            continue  # unanswered — no negative marks

        if q_type in {"mcq", "true_false", "true/false", "fill_in_blank", "fill in blank"}:
            correct = q.get("correctAnswer", "")
            if str(student_answer).strip().lower() == str(correct).strip().lower():
                mcq_score += marks
            else:
                mcq_score -= float(negative_marks)  # negative marking

        elif q_type == "msq":
            correct_set = set(q.get("correctAnswers", []))
            student_set = set(student_answer) if isinstance(student_answer, list) else {student_answer}
            if correct_set == student_set:
                mcq_score += marks
            else:
                mcq_score -= float(negative_marks)

    mcq_score = max(0, mcq_score)  # floor at 0
    status    = "submitted" if manual_total > 0 else "graded"
    return mcq_score, mcq_total, manual_total, status


# ─────────────────────────────────────────────
# ENDPOINT 1: POST /quizzes/generate-quiz
# ─────────────────────────────────────────────
@router.post("/generate-quiz")
async def generate_quiz(
    body:    GenerateQuizRequest,
    teacher: User              = Depends(require_teacher),
    db:      AsyncSession      = Depends(get_db),
):
    """
    Generates quiz questions via AI. Does NOT save anything.
    Teacher previews and edits, then calls /create-quiz to finalize.
    """
    # Verify teacher owns the class
    class_result = await db.execute(
        select(Class).where(Class.id == body.class_id, Class.teacher_id == teacher.id)
    )
    if not class_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Class not found or you don't own it.")

    # Get source text from document if provided
    source_text = None
    if body.document_id:
        from models import Document
        doc_result = await db.execute(
            select(Document).where(Document.id == body.document_id, Document.teacher_id == teacher.id)
        )
        doc = doc_result.scalar_one_or_none()
        if doc:
            source_text = doc.extracted_text

    prompt    = build_prompt(body, source_text)
    questions = await call_openrouter(prompt)
    
    # Strictly enforce the number of questions
    if questions and len(questions) > body.num_questions:
        questions = questions[:body.num_questions]

    # Normalize maxMarks to ensure they sum exactly to body.total_marks
    if questions:
        current_total = sum(float(q.get("maxMarks", 1)) for q in questions)
        target_total = float(body.total_marks)
        
        if current_total > 0 and target_total > 0 and current_total != target_total:
            scale = target_total / current_total
            new_total = 0.0
            for i, q in enumerate(questions):
                if i == len(questions) - 1:
                    # Give remainder to the last question to avoid float rounding issues
                    q["maxMarks"] = round(target_total - new_total, 2)
                else:
                    scaled = round(float(q.get("maxMarks", 1)) * scale, 2)
                    q["maxMarks"] = scaled
                    new_total += scaled

    return {
        "questions":    questions,
        "total":        len(questions),
        "message":      "Questions generated. Review and edit before finalizing.",
    }


# ─────────────────────────────────────────────
# ENDPOINT 2: POST /quizzes/create-quiz
# ─────────────────────────────────────────────
@router.post("/create-quiz", status_code=201)
async def create_quiz(
    body:    CreateQuizRequest,
    teacher: User              = Depends(require_teacher),
    db:      AsyncSession      = Depends(get_db),
):
    """
    Saves and publishes the final quiz (after teacher has edited the generated questions).
    This is what "Finalize & Launch" in the frontend calls.
    """
    class_result = await db.execute(
        select(Class).where(Class.id == body.class_id, Class.teacher_id == teacher.id)
    )
    if not class_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Class not found or you don't own it.")

    # Parse deadline string to datetime if provided
    deadline = None
    if body.deadline:
        try:
            deadline = datetime.fromisoformat(body.deadline.replace("Z", "+00:00"))
        except ValueError:
            pass  # ignore invalid deadline

    quiz = Quiz(
        title          = body.title,
        class_id       = body.class_id,
        teacher_id     = teacher.id,
        type           = body.type,
        difficulty     = body.difficulty,
        bloom_level    = body.bloom_level,
        total_marks    = body.total_marks,
        duration       = body.duration,
        negative_marks = body.negative_marks,
        deadline       = deadline,
        questions      = body.questions,
        status         = "published",
    )
    db.add(quiz)
    await db.commit()
    await db.refresh(quiz)

    return {
        "message": f"Assessment '{quiz.title}' published successfully.",
        "quiz_id": quiz.id,
    }


# ─────────────────────────────────────────────
# ENDPOINT 3: GET /quizzes/get-quizzes
# ─────────────────────────────────────────────
@router.get("/get-quizzes")
async def get_quizzes(
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """
    Returns quizzes based on role:
    - Teacher → only their own quizzes
    - Student → quizzes from classes they're enrolled in
    - Admin   → all quizzes
    """
    if current_user.role == "teacher":
        result  = await db.execute(select(Quiz).where(Quiz.teacher_id == current_user.id))
        quizzes = result.scalars().all()

    elif current_user.role == "student":
        # Get classes the student is enrolled in, ignoring deleted classes
        enroll_result = await db.execute(
            select(Enrollment.class_id)
            .join(Class, Class.id == Enrollment.class_id)
            .where(Enrollment.student_id == current_user.id, Class.is_deleted == 0)
        )
        class_ids = [r for r in enroll_result.scalars().all()]

        if not class_ids:
            return []

        result  = await db.execute(
            select(Quiz)
            .where(Quiz.class_id.in_(class_ids), Quiz.status == "published")
        )
        quizzes = result.scalars().all()

    else:  # admin or parent
        result  = await db.execute(select(Quiz))
        quizzes = result.scalars().all()

    # For students: strip correct answers
    output = []
    for q in quizzes:
        q_dict = {
            "id":             q.id,
            "title":          q.title,
            "class_id":       q.class_id,
            "teacher_id":     q.teacher_id,
            "type":           q.type,
            "difficulty":     q.difficulty,
            "bloom_level":    q.bloom_level,
            "total_marks":    q.total_marks,
            "duration":       q.duration,
            "negative_marks": q.negative_marks,
            "deadline":       q.deadline.isoformat() if q.deadline else None,
            "status":         q.status,
            "created_at":     q.created_at.isoformat(),
            "question_count": len(q.questions),
        }
        if current_user.role != "student":
            q_dict["questions"] = q.questions  # teachers/admins see full data
        output.append(q_dict)

    return output


# ─────────────────────────────────────────────
# ENDPOINT 4: GET /quizzes/get-quiz/{quiz_id}
# ─────────────────────────────────────────────
@router.get("/get-quiz/{quiz_id}")
async def get_quiz(
    quiz_id:      int,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """
    Returns a single quiz.
    For students → strips out correctAnswer and correctAnswers from questions.
    """
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    quiz   = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found.")

    questions = quiz.questions

    # Strip correct answers for students
    if current_user.role == "student":
        safe_questions = []
        for q in questions:
            safe_q = {k: v for k, v in q.items() if k not in ("correctAnswer", "correctAnswers", "sampleAnswer")}
            safe_questions.append(safe_q)
        questions = safe_questions

    return {
        "id":             quiz.id,
        "title":          quiz.title,
        "class_id":       quiz.class_id,
        "teacher_id":     quiz.teacher_id,
        "type":           quiz.type,
        "difficulty":     quiz.difficulty,
        "bloom_level":    quiz.bloom_level,
        "total_marks":    quiz.total_marks,
        "duration":       quiz.duration,
        "negative_marks": quiz.negative_marks,
        "deadline":       quiz.deadline.isoformat() if quiz.deadline else None,
        "questions":      questions,
        "status":         quiz.status,
    }


# ─────────────────────────────────────────────
# ENDPOINT 5: PUT /quizzes/update-quiz/{quiz_id}
# ─────────────────────────────────────────────
@router.put("/update-quiz/{quiz_id}")
async def update_quiz(
    quiz_id: int,
    body:    CreateQuizRequest,
    teacher: User              = Depends(require_teacher),
    db:      AsyncSession      = Depends(get_db),
):
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    quiz   = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found.")
    if quiz.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="You can only edit your own quizzes.")

    quiz.title          = body.title
    quiz.type           = body.type
    quiz.difficulty     = body.difficulty
    quiz.bloom_level    = body.bloom_level
    quiz.total_marks    = body.total_marks
    quiz.duration       = body.duration
    quiz.negative_marks = body.negative_marks
    quiz.questions      = body.questions

    if body.deadline:
        try:
            quiz.deadline = datetime.fromisoformat(body.deadline.replace("Z", "+00:00"))
        except ValueError:
            pass

    await db.commit()
    await db.refresh(quiz)
    return {"message": "Quiz updated.", "quiz_id": quiz.id}


# ─────────────────────────────────────────────
# ENDPOINT 6: DELETE /quizzes/delete-quiz/{quiz_id}
# ─────────────────────────────────────────────
@router.delete("/delete-quiz/{quiz_id}")
async def delete_quiz(
    quiz_id:      int,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    quiz   = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found.")

    # Teachers can only delete their own; admins can delete any
    if current_user.role == "teacher" and quiz.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own quizzes.")
    if current_user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Unauthorized.")

    await db.delete(quiz)
    await db.commit()
    return {"message": "Quiz deleted."}


# ─────────────────────────────────────────────
# ENDPOINT 7: POST /quizzes/submit-answers/{quiz_id}
# ─────────────────────────────────────────────
@router.post("/submit-answers/{quiz_id}", status_code=201)
async def submit_answers(
    quiz_id: int,
    body:    SubmitAnswersRequest,
    student: User              = Depends(require_student),
    db:      AsyncSession      = Depends(get_db),
):
    """
    Student submits their answers for a quiz.
    MCQ/True-False/Fill-in-Blank → auto-graded immediately.
    Short/Long Answer → status = 'submitted', waits for teacher.
    """
    # Get quiz
    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    quiz   = result.scalar_one_or_none()

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found.")

    # Check if student already submitted
    existing = await db.execute(
        select(Submission).where(
            Submission.quiz_id    == quiz_id,
            Submission.student_id == student.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="You have already submitted this quiz.")

    # Auto-grade
    mcq_score, mcq_total, manual_total, sub_status = grade_answers(
        quiz.questions,
        body.answers,
        quiz.negative_marks
    )

    # Calculate percentage
    total_possible = mcq_total + manual_total
    percentage = round((mcq_score / total_possible * 100), 2) if total_possible > 0 else 0

    submission = Submission(
        quiz_id      = quiz_id,
        student_id   = student.id,
        answers      = body.answers,
        mcq_score    = mcq_score,
        mcq_total    = mcq_total,
        manual_score = None,
        manual_total = manual_total,
        percentage   = percentage,
        status       = sub_status,
    )
    db.add(submission)
    await db.commit()
    await db.refresh(submission)

    return {
        "submission_id": submission.id,
        "mcq_score":     mcq_score,
        "mcq_total":     mcq_total,
        "manual_total":  manual_total,
        "percentage":    percentage,
        "status":        sub_status,
        "message":       "Submitted successfully!" if sub_status == "graded" else "Submitted. Awaiting teacher review for subjective questions.",
    }
