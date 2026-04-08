from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import BlacklistItem, Note, User, YanportSession
from app.security import decrypt_sensitive_value
from app.schemas import BienResponse
from app.services.yanport import fetch_properties, map_property_for_front


router = APIRouter(prefix="/biens", tags=["biens"])


@router.get("", response_model=list[BienResponse])
def get_biens(
    zip_code: str | None = None,
    ville: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    yanport_session = db.query(YanportSession).filter(YanportSession.user_id == user.id).first()
    if not yanport_session:
        raise HTTPException(status_code=401, detail="Session Yanport introuvable. Merci de vous reconnecter.")

    blacklist_rows = db.query(BlacklistItem).filter(BlacklistItem.user_id == user.id).all()
    blacklist_ids = {row.bien_id for row in blacklist_rows}

    note_rows = db.query(Note).filter(Note.user_id == user.id).all()
    notes_map = {row.bien_id: row.note for row in note_rows}

    biens_bruts = fetch_properties(
        access_token=decrypt_sensitive_value(yanport_session.access_token),
        zip_code=zip_code,
        ville=ville,
    )

    return [
        map_property_for_front(bien, blacklist_ids, notes_map)
        for bien in biens_bruts
    ]
