from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import Note, User
from app.schemas import NoteResponse, NoteUpsertRequest


router = APIRouter(prefix="/notes", tags=["notes"])


@router.post("", response_model=NoteResponse)
def upsert_note(
    payload: NoteUpsertRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    existing = (
        db.query(Note)
        .filter(Note.user_id == user.id, Note.bien_id == payload.bien_id)
        .first()
    )

    if existing:
        existing.note = payload.note or ""
        db.commit()
        db.refresh(existing)
        return existing

    note = Note(
        user_id=user.id,
        bien_id=payload.bien_id,
        note=payload.note or "",
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get("/{bien_id}", response_model=NoteResponse | None)
def get_note(
    bien_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    note = (
        db.query(Note)
        .filter(Note.user_id == user.id, Note.bien_id == bien_id)
        .first()
    )
    return note