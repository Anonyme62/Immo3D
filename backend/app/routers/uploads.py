from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.deps import get_current_subscribed_user, require_valid_csrf
from app.models import User
from app.schemas import PhotoUploadInitRequest, PhotoUploadInitResponse
from app.services.object_storage import (
    ObjectStorageError,
    create_presigned_photo_upload,
    is_supported_image_content_type,
)

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/photo/init", response_model=PhotoUploadInitResponse)
def create_photo_upload_ticket(
    payload: PhotoUploadInitRequest,
    _: object = Depends(require_valid_csrf),
    user: User = Depends(get_current_subscribed_user),
):
    if not settings.r2_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stockage photo objet non configure.",
        )

    content_type = payload.content_type.strip().lower()
    if not is_supported_image_content_type(content_type):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Type de photo non supporte.",
        )

    if payload.content_length > settings.photo_upload_max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Photo trop lourde. Maximum {settings.photo_upload_max_bytes} octets.",
        )

    try:
        upload_ticket = create_presigned_photo_upload(
            user_id=user.id,
            purpose=payload.purpose,
            file_name=payload.file_name.strip(),
            content_type=content_type,
            expires_in_seconds=settings.r2_upload_url_ttl_seconds,
        )
    except ObjectStorageError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Impossible de preparer l'upload photo.",
        ) from error

    return {
        "upload_url": upload_ticket["upload_url"],
        "file_url": upload_ticket["file_url"],
        "object_key": upload_ticket["object_key"],
        "method": "PUT",
        "headers": upload_ticket["headers"],
        "expires_in_seconds": upload_ticket["expires_in_seconds"],
    }
