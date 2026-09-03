"""
models.py — All SQLAlchemy table models

Each class here = one table in assessiq.db
Each class attribute = one column in that table

SQLAlchemy reads these classes and creates the actual SQL tables.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


def now_utc():
    """Returns current UTC time. Used as default for timestamps."""
    return datetime.now(timezone.utc)


# ─────────────────────────────────────────────
# TABLE 1: users
# Stores everyone — students, teachers, admins, parents
# ─────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String, nullable=False)
    email           = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role            = Column(String, nullable=False)           # student | teacher | admin | parent
    status          = Column(String, default="active")         # active | suspended
    children_emails = Column(JSON, default=list)               # only used by parent role: ["child1@gmail.com"]
    created_at      = Column(DateTime, default=now_utc)

    # Relationships (SQLAlchemy links these for easy querying)
    classes     = relationship("Class", back_populates="teacher", foreign_keys="Class.teacher_id")
    enrollments = relationship("Enrollment", back_populates="student", foreign_keys="Enrollment.student_id")
    quizzes     = relationship("Quiz", back_populates="teacher")
    submissions = relationship("Submission", back_populates="student")


# ─────────────────────────────────────────────
# TABLE 2: classes
# A class is created by a teacher. Students join via a code.
# ─────────────────────────────────────────────
class Class(Base):
    __tablename__ = "classes"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, nullable=False)
    code       = Column(String, unique=True, index=True, nullable=False)  # e.g. "MATH01"
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_deleted = Column(Integer, default=0)  # 0=false, 1=true for SQLite boolean
    created_at = Column(DateTime, default=now_utc)

    teacher     = relationship("User", back_populates="classes", foreign_keys=[teacher_id])
    enrollments = relationship("Enrollment", back_populates="class_", cascade="all, delete-orphan")
    quizzes     = relationship("Quiz", back_populates="class_")


# ─────────────────────────────────────────────
# TABLE 3: enrollments
# Many-to-many: one student can be in many classes,
# one class can have many students
# ─────────────────────────────────────────────
class Enrollment(Base):
    __tablename__ = "enrollments"

    id          = Column(Integer, primary_key=True, index=True)
    student_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    class_id    = Column(Integer, ForeignKey("classes.id"), nullable=False)
    enrolled_at = Column(DateTime, default=now_utc)

    student = relationship("User", back_populates="enrollments", foreign_keys=[student_id])
    class_  = relationship("Class", back_populates="enrollments")


# ─────────────────────────────────────────────
# TABLE 4: documents
# Stores extracted text from uploaded PDFs.
# We never store the actual PDF binary — just the text.
# ─────────────────────────────────────────────
class Document(Base):
    __tablename__ = "documents"

    id             = Column(Integer, primary_key=True, index=True)
    title          = Column(String, nullable=False)
    teacher_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    extracted_text = Column(Text, nullable=False)              # the raw text from the PDF
    char_count     = Column(Integer, default=0)
    uploaded_at    = Column(DateTime, default=now_utc)


# ─────────────────────────────────────────────
# TABLE 5: quizzes
# A quiz belongs to a class. Created by a teacher.
# Contains all form data from CreateAssessmentModal.
# ─────────────────────────────────────────────
class Quiz(Base):
    __tablename__ = "quizzes"

    id             = Column(Integer, primary_key=True, index=True)
    title          = Column(String, nullable=False)
    class_id       = Column(Integer, ForeignKey("classes.id"), nullable=False)
    teacher_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    type           = Column(String, default="MCQ")             # MCQ | MSQ | Short Answer | etc.
    difficulty     = Column(String, default="Medium")          # Easy | Medium | Hard
    bloom_level    = Column(String, default="Understanding")   # Remember | Understand | Apply | ...
    total_marks    = Column(Float, default=50)
    duration       = Column(Integer, default=30)               # minutes
    deadline       = Column(DateTime, nullable=True)
    negative_marks = Column(Float, default=0)
    questions      = Column(JSON, default=list)                # [{id, type, text, options, correct, maxMarks}]
    status         = Column(String, default="published")       # draft | published

    created_at = Column(DateTime, default=now_utc)

    teacher     = relationship("User", back_populates="quizzes")
    class_      = relationship("Class", back_populates="quizzes")
    submissions = relationship("Submission", back_populates="quiz", cascade="all, delete-orphan")


# ─────────────────────────────────────────────
# TABLE 6: submissions
# A student's attempt at a quiz.
# MCQ is auto-graded, subjective waits for teacher review.
# ─────────────────────────────────────────────
class Submission(Base):
    __tablename__ = "submissions"

    id           = Column(Integer, primary_key=True, index=True)
    quiz_id      = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    student_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    answers      = Column(JSON, default=dict)      # { "q_ai_1": "Option A", "q_ai_2": "True" }
    mcq_score    = Column(Float, default=0)        # auto-calculated on submit
    mcq_total    = Column(Float, default=0)        # total marks for objective questions
    manual_score = Column(Float, nullable=True)    # null until teacher grades it
    manual_total = Column(Float, default=0)        # total marks for subjective questions
    percentage   = Column(Float, default=0)
    feedback     = Column(Text, nullable=True)     # teacher's written feedback
    status       = Column(String, default="submitted")  # submitted | graded
    submitted_at = Column(DateTime, default=now_utc)

    quiz    = relationship("Quiz", back_populates="submissions")
    student = relationship("User", back_populates="submissions")
