from urllib.parse import urlparse

from fastapi import HTTPException

MAX_REMOTE_PHOTO_URL_LENGTH = 3_000


def sanitize_photo_references(
    photos: list[str] | None,
    *,
    max_photos: int,
    max_data_url_length: int,
) -> list[str]:
    _ = max_data_url_length
    sanitized: list[str] = []

    for photo in photos or []:
        if not isinstance(photo, str):
            continue

        normalized_photo = photo.strip()
        if not normalized_photo:
            continue

        lowered = normalized_photo.lower()
        if lowered.startswith("data:image/"):
            raise HTTPException(
                status_code=400,
                detail="Format photo non supporte. Utilise une URL distante.",
            )
        elif lowered.startswith("https://") or lowered.startswith("http://"):
            if len(normalized_photo) > MAX_REMOTE_PHOTO_URL_LENGTH:
                raise HTTPException(
                    status_code=400,
                    detail="Une URL photo est invalide ou trop longue.",
                )

            parsed_url = urlparse(normalized_photo)
            if not parsed_url.scheme or not parsed_url.netloc:
                raise HTTPException(
                    status_code=400,
                    detail="Une URL photo est invalide ou trop longue.",
                )
        else:
            raise HTTPException(
                status_code=400,
                detail="Format photo non supporte.",
            )

        sanitized.append(normalized_photo)
        if len(sanitized) >= max_photos:
            break

    return sanitized
