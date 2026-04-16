import re

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_subscribed_user, require_valid_csrf
from app.models import CustomMarker, User
from app.photo_refs import sanitize_photo_references
from app.schemas import (
    CustomMarkerCreateRequest,
    CustomMarkerResponse,
    CustomMarkerUpdateRequest,
)


router = APIRouter(prefix="/markers", tags=["markers"])

MAX_MARKER_PHOTOS = 8
MAX_MARKER_PHOTO_LENGTH = 1_200_000
POSTCODE_PATTERN = re.compile(r"\b\d{5}\b")


def normalize_search_zone(value: str | None) -> str:
    return (value or "").strip()


def extract_postcode(value: str | None) -> str:
    match = POSTCODE_PATTERN.search(str(value or ""))
    return match.group(0) if match else ""


def sanitize_marker_photos(photos: list[str] | None) -> list[str]:
    return sanitize_photo_references(
        photos,
        max_photos=MAX_MARKER_PHOTOS,
        max_data_url_length=MAX_MARKER_PHOTO_LENGTH,
    )


@router.get("", response_model=list[CustomMarkerResponse])
def list_markers(
    zone: str = Query(default=""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_subscribed_user),
):
    normalized_zone = normalize_search_zone(zone)
    query = db.query(CustomMarker).filter(CustomMarker.user_id == user.id)

    if normalized_zone:
        requested_postcode = extract_postcode(normalized_zone)
        if requested_postcode:
            postcode_like = f"%{requested_postcode}%"
            query = query.filter(
                or_(
                    CustomMarker.search_zone.ilike(postcode_like),
                    CustomMarker.address.ilike(postcode_like),
                )
            )
        else:
            normalized_zone_lower = normalized_zone.lower()
            zone_like = f"%{normalized_zone_lower}%"
            query = query.filter(
                or_(
                    func.lower(CustomMarker.search_zone) == normalized_zone_lower,
                    func.lower(CustomMarker.search_zone).like(zone_like),
                )
            )

    return query.order_by(CustomMarker.updated_at.desc(), CustomMarker.created_at.desc()).all()


@router.post("", response_model=CustomMarkerResponse)
def create_marker(
    payload: CustomMarkerCreateRequest,
    db: Session = Depends(get_db),
    _: object = Depends(require_valid_csrf),
    user: User = Depends(get_current_subscribed_user),
):
    marker = CustomMarker(
        user_id=user.id,
        lat=payload.lat,
        lon=payload.lon,
        search_zone=normalize_search_zone(payload.search_zone),
        address=(payload.address or "").strip(),
        note=payload.note.strip(),
        photos=sanitize_marker_photos(payload.photos),
    )
    db.add(marker)
    db.commit()
    db.refresh(marker)
    return marker


@router.patch("/{marker_id}", response_model=CustomMarkerResponse)
def update_marker(
    marker_id: str,
    payload: CustomMarkerUpdateRequest,
    db: Session = Depends(get_db),
    _: object = Depends(require_valid_csrf),
    user: User = Depends(get_current_subscribed_user),
):
    marker = (
        db.query(CustomMarker)
        .filter(CustomMarker.id == marker_id, CustomMarker.user_id == user.id)
        .first()
    )

    if not marker:
        raise HTTPException(status_code=404, detail="Repere introuvable")

    marker.note = payload.note.strip()
    marker.address = (payload.address or "").strip()
    marker.photos = sanitize_marker_photos(payload.photos)
    db.commit()
    db.refresh(marker)
    return marker


@router.delete("/{marker_id}")
def delete_marker(
    marker_id: str,
    db: Session = Depends(get_db),
    _: object = Depends(require_valid_csrf),
    user: User = Depends(get_current_subscribed_user),
):
    marker = (
        db.query(CustomMarker)
        .filter(CustomMarker.id == marker_id, CustomMarker.user_id == user.id)
        .first()
    )

    if marker:
        db.delete(marker)
        db.commit()

    return {"success": True}
