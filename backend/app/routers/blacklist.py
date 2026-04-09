from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_subscribed_user, require_valid_csrf
from app.models import BlacklistItem, User
from app.schemas import BlacklistResponse, BlacklistUpsertRequest


router = APIRouter(prefix="/blacklist", tags=["blacklist"])


@router.post("", response_model=BlacklistResponse)
def add_to_blacklist(
    payload: BlacklistUpsertRequest,
    db: Session = Depends(get_db),
    _: object = Depends(require_valid_csrf),
    user: User = Depends(get_current_subscribed_user),
):
    existing = (
        db.query(BlacklistItem)
        .filter(BlacklistItem.user_id == user.id, BlacklistItem.bien_id == payload.bien_id)
        .first()
    )

    if existing:
        existing.surface = payload.surface
        existing.prix = payload.prix
        db.commit()
        db.refresh(existing)
        return existing

    item = BlacklistItem(
        user_id=user.id,
        bien_id=payload.bien_id,
        surface=payload.surface,
        prix=payload.prix,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{bien_id}")
def remove_from_blacklist(
    bien_id: str,
    db: Session = Depends(get_db),
    _: object = Depends(require_valid_csrf),
    user: User = Depends(get_current_subscribed_user),
):
    item = (
        db.query(BlacklistItem)
        .filter(BlacklistItem.user_id == user.id, BlacklistItem.bien_id == bien_id)
        .first()
    )

    if item:
        db.delete(item)
        db.commit()

    return {"success": True}


@router.get("/{bien_id}", response_model=BlacklistResponse | None)
def get_blacklist_item(
    bien_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_subscribed_user),
):
    item = (
        db.query(BlacklistItem)
        .filter(BlacklistItem.user_id == user.id, BlacklistItem.bien_id == bien_id)
        .first()
    )
    return item
