import mimetypes
import uuid
from datetime import datetime, timezone
from urllib.parse import quote

from app.config import settings


SUPPORTED_IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
    "image/gif",
}


class ObjectStorageError(RuntimeError):
    pass


_storage_client = None


def is_supported_image_content_type(content_type: str) -> bool:
    normalized_content_type = str(content_type or "").strip().lower()
    return normalized_content_type in SUPPORTED_IMAGE_CONTENT_TYPES


def _guess_extension(content_type: str, file_name: str) -> str:
    from_mime = mimetypes.guess_extension(content_type.strip().lower()) or ""
    if from_mime:
        return from_mime

    from_filename = mimetypes.guess_type(file_name or "")[0]
    from_filename_extension = mimetypes.guess_extension(from_filename or "") or ""
    if from_filename_extension:
        return from_filename_extension

    return ".jpg"


def _build_object_key(user_id: str, purpose: str, file_name: str, content_type: str) -> str:
    now_utc = datetime.now(timezone.utc)
    date_prefix = now_utc.strftime("%Y/%m/%d")
    file_extension = _guess_extension(content_type, file_name)
    object_id = uuid.uuid4().hex
    normalized_purpose = "marker" if purpose == "marker" else "note"
    object_file_name = f"{object_id}{file_extension}"
    prefix = (settings.r2_object_key_prefix or "uploads").strip().strip("/")
    parts = [prefix, user_id, normalized_purpose, date_prefix, object_file_name]
    return "/".join(part for part in parts if part)


def _get_storage_client():
    global _storage_client
    if _storage_client is not None:
        return _storage_client

    try:
        import boto3
        from botocore.client import Config as BotoCoreConfig
    except ModuleNotFoundError as error:
        raise ObjectStorageError("Dependance boto3 manquante.") from error

    _storage_client = boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        region_name=settings.r2_region,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        config=BotoCoreConfig(signature_version="s3v4"),
    )
    return _storage_client


def _build_public_url(object_key: str) -> str:
    public_base_url = str(settings.r2_public_base_url or "").rstrip("/")
    normalized_key = quote(object_key.lstrip("/"), safe="/-_.~")
    return f"{public_base_url}/{normalized_key}"


def create_presigned_photo_upload(
    *,
    user_id: str,
    purpose: str,
    file_name: str,
    content_type: str,
    expires_in_seconds: int,
) -> dict[str, str | int | dict[str, str]]:
    if not settings.r2_configured:
        raise ObjectStorageError("R2 non configure.")

    object_key = _build_object_key(user_id, purpose, file_name, content_type)

    try:
        upload_url = _get_storage_client().generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": settings.r2_bucket,
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in_seconds,
            HttpMethod="PUT",
        )
    except Exception as error:
        raise ObjectStorageError("Generation URL upload impossible.") from error

    return {
        "upload_url": upload_url,
        "file_url": _build_public_url(object_key),
        "object_key": object_key,
        "headers": {"Content-Type": content_type},
        "expires_in_seconds": expires_in_seconds,
    }
