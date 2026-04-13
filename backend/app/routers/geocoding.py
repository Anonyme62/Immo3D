from fastapi import APIRouter, Query

from app.services.geocoding import (
    reverse_geocode_postcode,
    search_boundary,
    search_streets_by_postcode,
)


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


@router.get("/postcode")
def get_postcode_from_coordinates(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
):
    postcode = reverse_geocode_postcode(lat, lon)
    return {
        "found": bool(postcode),
        "postcode": postcode,
    }


@router.get("/streets")
def get_streets_for_postcode(
    postcode: str = Query(min_length=5, max_length=10),
    q: str = Query(min_length=2, max_length=120),
    limit: int = Query(default=12, ge=1, le=20),
):
    streets = search_streets_by_postcode(postcode, q, limit)
    return {
        "postcode": postcode,
        "streets": streets,
    }
