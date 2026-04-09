from fastapi import APIRouter, Query

from app.services.geocoding import search_boundary


router = APIRouter(prefix="/geocoding", tags=["geocoding"])


@router.get("/boundary")
def get_boundary(
    q: str = Query(min_length=2, max_length=255),
):
    boundary = search_boundary(q)
    if not boundary:
        return {"found": False, "display_name": q, "geojson": None}

    return {
        "found": True,
        "display_name": boundary["display_name"],
        "geojson": boundary["geojson"],
    }
