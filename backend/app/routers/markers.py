from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import CustomMarker, User
from app.schemas import (
    CustomMarkerCreateRequest,
    CustomMarkerResponse,
    CustomMarkerUpdateRequest,
)


router = APIRouter(prefix="/markers", tags=["markers"])


def normalize_search_zone(value: str | None) -> str:
    return (value or "").strip()


@router.get("", response_model=list[CustomMarkerResponse])
def list_markers(
    zone: str = Query(default=""),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
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
    user: User = Depends(get_current_user),
):
    marker = CustomMarker(
        user_id=user.id,
        lat=payload.lat,
        lon=payload.lon,
        search_zone=normalize_search_zone(payload.search_zone),
        note=payload.note.strip(),
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
    user: User = Depends(get_current_user),
):
    marker = (
        db.query(CustomMarker)
        .filter(CustomMarker.id == marker_id, CustomMarker.user_id == user.id)
        .first()
    )

    if not marker:
        raise HTTPException(status_code=404, detail="Repere introuvable")

    marker.note = payload.note.strip()
    db.commit()
    db.refresh(marker)
    return marker


@router.delete("/{marker_id}")
def delete_marker(
    marker_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
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
