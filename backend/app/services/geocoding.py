import logging

import requests


logger = logging.getLogger(__name__)

NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
GEOCODING_USER_AGENT = "Immo3D-AlexisRamez/1.0 (alexisramezdu62@gmail.com)"


def _build_manual_address(address: dict) -> str:
    road = address.get("road") or address.get("pedestrian") or address.get("footway") or ""
    house_number = address.get("house_number") or ""
    postcode = address.get("postcode") or ""
    city = (
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("municipality")
        or ""
    )

    street_part = " ".join(part for part in [house_number, road] if part).strip()
    city_part = " ".join(part for part in [postcode, city] if part).strip()

    if street_part and city_part:
        return f"{street_part}, {city_part}"
    if street_part:
        return street_part
    if city_part:
        return city_part

    return ""


def reverse_geocode_address(lat: float, lon: float) -> str:
    try:
        response = requests.get(
            NOMINATIM_REVERSE_URL,
            params={
                "lat": lat,
                "lon": lon,
                "format": "jsonv2",
                "addressdetails": 1,
                "zoom": 18,
                "accept-language": "fr",
            },
            headers={
                "User-Agent": GEOCODING_USER_AGENT,
                "Accept-Language": "fr",
            },
            timeout=10,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as error:
        logger.warning("Reverse geocoding failed for lat=%s lon=%s: %s", lat, lon, error)
        return ""
    except ValueError:
        logger.warning("Reverse geocoding returned invalid JSON for lat=%s lon=%s", lat, lon)
        return ""

    address = payload.get("address") or {}
    manual_address = _build_manual_address(address)
    if manual_address:
        return manual_address

    display_name = payload.get("display_name") or ""
    if isinstance(display_name, str):
        return display_name.split(", France")[0].strip()

    return ""


def _search_nominatim(query: str) -> list[dict]:
    try:
        response = requests.get(
            NOMINATIM_SEARCH_URL,
            params={
                "q": query,
                "format": "jsonv2",
                "limit": 12,
                "polygon_geojson": 1,
                "addressdetails": 1,
                "accept-language": "fr",
                "countrycodes": "fr",
            },
            headers={
                "User-Agent": GEOCODING_USER_AGENT,
                "Accept-Language": "fr",
            },
            timeout=12,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as error:
        logger.warning("Nominatim search failed for query=%s: %s", query, error)
        return []
    except ValueError:
        logger.warning("Nominatim search returned invalid JSON for query=%s", query)
        return []

    return payload if isinstance(payload, list) else []


def _search_nominatim_structured(**structured_params: str) -> list[dict]:
    try:
        response = requests.get(
            NOMINATIM_SEARCH_URL,
            params={
                **structured_params,
                "format": "jsonv2",
                "limit": 8,
                "polygon_geojson": 1,
                "addressdetails": 1,
                "accept-language": "fr",
                "countrycodes": "fr",
            },
            headers={
                "User-Agent": GEOCODING_USER_AGENT,
                "Accept-Language": "fr",
            },
            timeout=12,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as error:
        logger.warning("Structured Nominatim search failed for params=%s: %s", structured_params, error)
        return []
    except ValueError:
        logger.warning("Structured Nominatim search returned invalid JSON for params=%s", structured_params)
        return []

    return payload if isinstance(payload, list) else []


def _extract_boundary_candidate(results: list[dict]) -> dict | None:
    for candidate in results:
        geojson = candidate.get("geojson")
        if not isinstance(geojson, dict):
            continue

        if geojson.get("type") not in {"Polygon", "MultiPolygon"}:
            continue

        addresstype = (candidate.get("addresstype") or "").lower()
        category = (candidate.get("category") or "").lower()
        candidate_type = (candidate.get("type") or "").lower()

        if addresstype in {"city", "town", "village", "municipality", "postcode"}:
            return candidate

        if category == "boundary" and candidate_type == "administrative":
            return candidate

        if category == "place" and candidate_type in {"city", "town", "village"}:
            return candidate

    for candidate in results:
        geojson = candidate.get("geojson")
        if isinstance(geojson, dict) and geojson.get("type") in {"Polygon", "MultiPolygon"}:
            return candidate

    return None


def search_boundary(query: str) -> dict | None:
    trimmed_query = (query or "").strip()
    if not trimmed_query:
        return None

    search_payloads: list[tuple[str, dict | None]] = [(trimmed_query, None)]
    if trimmed_query.isdigit() and len(trimmed_query) == 5:
        search_payloads.extend(
            [
                (f"{trimmed_query}, France", None),
                ("", {"postalcode": trimmed_query, "country": "France"}),
            ]
        )
    else:
        search_payloads.extend(
            [
                (f"{trimmed_query}, France", None),
                (f"{trimmed_query}, Pas-de-Calais, Hauts-de-France, France", None),
                ("", {"city": trimmed_query, "country": "France"}),
            ]
        )

    for current_query, structured_params in search_payloads:
        results = (
            _search_nominatim_structured(**structured_params)
            if structured_params
            else _search_nominatim(current_query)
        )
        candidate = _extract_boundary_candidate(results)
        if candidate:
            geojson = candidate.get("geojson")
            display_name = candidate.get("display_name") or trimmed_query
            return {
                "display_name": display_name,
                "geojson": geojson,
            }

    return None
