"""
routers/documents.py — PDF Upload and management endpoints

Endpoints:
  POST   /documents/upload-pdf           → Teacher uploads PDF, we extract text and store it
  GET    /documents/get-documents        → Teacher sees their uploaded documents
  DELETE /documents/delete-document/{id} → Teacher deletes a document

This is used in CreateAssessmentModal when the teacher uploads a PDF
before clicking "Generate Questions". We extract the text here,
then pass document_id to /quizzes/generate-quiz.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import io

from models import User, Document
from dependencies import get_db, require_teacher

router = APIRouter(prefix="/documents", tags=["Documents"])


# ─────────────────────────────────────────────
# HELPER: Extract text from PDF bytes
# Uses PyMuPDF (imported as fitz)
# ─────────────────────────────────────────────

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Reads PDF bytes in memory (no disk save) and extracts all text.
    PyMuPDF (fitz) is fast and handles most PDF formats.
    """
    try:
        import fitz  # PyMuPDF
        doc  = fitz.open(stream=file_bytes, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text.strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not extract text from PDF: {str(e)}")


def extract_text_from_image(file_bytes: bytes) -> str:
    """
    Basic placeholder — for image files we return a message.
    In production you'd use an OCR service here.
    """
    return "Image uploaded. Please describe the content manually in the topic field."


# ─────────────────────────────────────────────
# PYDANTIC SCHEMAS
# ─────────────────────────────────────────────

class DocumentOut(BaseModel):
    id:          int
    title:       str
    char_count:  int
    uploaded_at: datetime

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# ENDPOINT 1: POST /documents/upload-pdf
# ─────────────────────────────────────────────
@router.post("/upload-pdf", status_code=201)
async def upload_pdf(
    file:    UploadFile        = File(...),
    title:   Optional[str]    = Form(None),
    teacher: User              = Depends(require_teacher),
    db:      AsyncSession      = Depends(get_db),
):
    """
    Teacher uploads a PDF or image file.
    We read the bytes in memory, extract text, and store in DB.
    The actual file is NEVER saved to disk — just the extracted text.

    Returns document_id which is then used in /quizzes/generate-quiz
    """
    # Validate file type
    allowed = ["application/pdf", "image/jpeg", "image/png", "image/jpg"]
    content_type = file.content_type or ""

    if content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Only PDF, JPG, PNG files allowed. Got: {content_type}"
        )

    # Read file bytes into memory
    file_bytes = await file.read()

    # Extract text based on file type
    if "pdf" in content_type:
        extracted_text = extract_text_from_pdf(file_bytes)
    else:
        extracted_text = extract_text_from_image(file_bytes)

    if not extracted_text:
        raise HTTPException(status_code=400, detail="Could not extract any text from the file.")

    # Store in database
    doc_title = title or file.filename or "Uploaded Document"
    doc = Document(
        title          = doc_title,
        teacher_id     = teacher.id,
        extracted_text = extracted_text,
        char_count     = len(extracted_text),
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    return {
        "document_id": doc.id,
        "title":       doc.title,
        "char_count":  doc.char_count,
        "message":     "PDF processed successfully. Use document_id when generating quiz."
    }


# ─────────────────────────────────────────────
# ENDPOINT 2: GET /documents/get-documents
# ─────────────────────────────────────────────
@router.get("/get-documents", response_model=List[DocumentOut])
async def get_documents(
    teacher: User         = Depends(require_teacher),
    db:      AsyncSession = Depends(get_db),
):
    """
    Returns all documents uploaded by this teacher.
    """
    result = await db.execute(
        select(Document)
        .where(Document.teacher_id == teacher.id)
        .order_by(Document.uploaded_at.desc())
    )
    return result.scalars().all()


# ─────────────────────────────────────────────
# ENDPOINT 3: DELETE /documents/delete-document/{document_id}
# ─────────────────────────────────────────────
@router.delete("/delete-document/{document_id}")
async def delete_document(
    document_id: int,
    teacher:     User         = Depends(require_teacher),
    db:          AsyncSession = Depends(get_db),
):
    """
    Deletes a document. Teacher can only delete their own documents.
    """
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc    = result.scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if doc.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="You can only delete your own documents.")

    await db.delete(doc)
    await db.commit()

    return {"message": "Document deleted successfully."}
