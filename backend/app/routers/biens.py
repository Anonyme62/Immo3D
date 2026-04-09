from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import BienPlacement, BlacklistItem, FavoriteBien, Note, SetAsideBien, User, YanportSession
from app.security import decrypt_sensitive_value
from app.schemas import (
    BienPlacementRequest,
    BienPlacementResponse,
    BienResponse,
    FavoriteBienRequest,
    FavoriteBienResponse,
    SetAsideBienRequest,
    SetAsideBienResponse,
)
from app.services.geocoding import reverse_geocode_address
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

    favorite_rows = db.query(FavoriteBien).filter(FavoriteBien.user_id == user.id).all()
    favorite_ids = {row.bien_id for row in favorite_rows}

    set_aside_rows = db.query(SetAsideBien).filter(SetAsideBien.user_id == user.id).all()
    set_aside_ids = {row.bien_id for row in set_aside_rows}

    placement_rows = db.query(BienPlacement).filter(BienPlacement.user_id == user.id).all()
    placements_map = {
        row.bien_id: {
            "lat": row.lat,
            "lon": row.lon,
            "manual_address": row.manual_address,
        }
        for row in placement_rows
    }

    biens_bruts = fetch_properties(
        access_token=decrypt_sensitive_value(yanport_session.access_token),
        zip_code=zip_code,
        ville=ville,
    )

    return [
        map_property_for_front(
            bien,
            blacklist_ids,
            notes_map,
            favorite_ids,
            set_aside_ids,
            placements_map,
        )
        for bien in biens_bruts
    ]


@router.post("/favorites", response_model=FavoriteBienResponse)
def add_favorite(
    payload: FavoriteBienRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    favorite = (
        db.query(FavoriteBien)
        .filter(FavoriteBien.user_id == user.id, FavoriteBien.bien_id == payload.bien_id)
        .first()
    )

    if favorite:
        return favorite

    favorite = FavoriteBien(user_id=user.id, bien_id=payload.bien_id)
    db.add(favorite)
    db.commit()
    db.refresh(favorite)
    return favorite


@router.delete("/favorites/{bien_id}")
def remove_favorite(
    bien_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    favorite = (
        db.query(FavoriteBien)
        .filter(FavoriteBien.user_id == user.id, FavoriteBien.bien_id == bien_id)
        .first()
    )

    if favorite:
        db.delete(favorite)
        db.commit()

    return {"success": True}


@router.post("/set-aside", response_model=SetAsideBienResponse)
def add_set_aside(
    payload: SetAsideBienRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    set_aside = (
        db.query(SetAsideBien)
        .filter(SetAsideBien.user_id == user.id, SetAsideBien.bien_id == payload.bien_id)
        .first()
    )

    if set_aside:
        return set_aside

    set_aside = SetAsideBien(user_id=user.id, bien_id=payload.bien_id)
    db.add(set_aside)
    db.commit()
    db.refresh(set_aside)
    return set_aside


@router.delete("/set-aside/{bien_id}")
def remove_set_aside(
    bien_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    set_aside = (
        db.query(SetAsideBien)
        .filter(SetAsideBien.user_id == user.id, SetAsideBien.bien_id == bien_id)
        .first()
    )

    if set_aside:
        db.delete(set_aside)
        db.commit()

    return {"success": True}


@router.put("/{bien_id}/placement", response_model=BienPlacementResponse)
def upsert_bien_placement(
    bien_id: str,
    payload: BienPlacementRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    placement = (
        db.query(BienPlacement)
        .filter(BienPlacement.user_id == user.id, BienPlacement.bien_id == bien_id)
        .first()
    )

    if not placement:
        placement = BienPlacement(user_id=user.id, bien_id=bien_id)
        db.add(placement)

    manual_address = payload.manual_address.strip() or reverse_geocode_address(
        payload.lat, payload.lon
    )

    placement.lat = payload.lat
    placement.lon = payload.lon
    placement.manual_address = manual_address
    db.commit()
    db.refresh(placement)
    return placement


@router.delete("/{bien_id}/placement")
def delete_bien_placement(
    bien_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    placement = (
        db.query(BienPlacement)
        .filter(BienPlacement.user_id == user.id, BienPlacement.bien_id == bien_id)
        .first()
    )

    if placement:
        db.delete(placement)
        db.commit()

    return {"success": True}
