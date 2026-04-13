from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_subscribed_user, require_valid_csrf
from app.models import CustomMarker, User
from app.schemas import (
    CustomMarkerCreateRequest,
    CustomMarkerResponse,
    CustomMarkerUpdateRequest,
)


router = APIRouter(prefix="/markers", tags=["markers"])

MAX_MARKER_PHOTOS = 8
MAX_MARKER_PHOTO_LENGTH = 1_200_000


def normalize_search_zone(value: str | None) -> str:
    return (value or "").strip()


def sanitize_marker_photos(photos: list[str] | None) -> list[str]:
    sanitized: list[str] = []
    for photo in photos or []:
        if not isinstance(photo, str):
            continue
        normalized_photo = photo.strip()
        if not normalized_photo:
            continue
        if len(normalized_photo) > MAX_MARKER_PHOTO_LENGTH:
            raise HTTPException(
                status_code=400,
                detail="Une photo est trop volumineuse pour etre enregistree.",
            )
        sanitized.append(normalized_photo)

        if len(sanitized) >= MAX_MARKER_PHOTOS:
            break

    return sanitized


@router.get("", response_model=list[CustomMarkerResponse])
def list_markers(
    zone: str = Query(default=""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_subscribed_user),
):
    normalized_zone = normalize_search_zone(zone)
    return (
        db.query(CustomMarker)
        .filter(
            CustomMarker.user_id == user.id,
            CustomMarker.search_zone == normalized_zone,
        )
        .order_by(CustomMarker.updated_at.desc(), CustomMarker.created_at.desc())
        .all()
    )


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
