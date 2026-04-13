import logging
import re

import requests


logger = logging.getLogger(__name__)

NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
BAN_SEARCH_URL = "https://api-adresse.data.gouv.fr/search/"
GEOCODING_USER_AGENT = "Immo3D-AlexisRamez/1.0 (alexisramezdu62@gmail.com)"
POSTCODE_PATTERN = re.compile(r"\b\d{5}\b")


def _request_json(url: str, *, params: dict, timeout: int, log_context: str) -> dict | list | None:
    try:
        response = requests.get(
            url,
            params=params,
            headers={
                "User-Agent": GEOCODING_USER_AGENT,
                "Accept-Language": "fr",
            },
            timeout=timeout,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as error:
        logger.warning("%s failed for params=%s: %s", log_context, params, error)
        return None
    except ValueError:
        logger.warning("%s returned invalid JSON for params=%s", log_context, params)
        return None

    if isinstance(payload, (dict, list)):
        return payload

    return None


def extract_postcode(value: str | None) -> str:
    match = POSTCODE_PATTERN.search(str(value or ""))
    return match.group(0) if match else ""


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


def _reverse_geocode_payload(lat: float, lon: float) -> dict:
    payload = _request_json(
        NOMINATIM_REVERSE_URL,
        params={
            "lat": lat,
            "lon": lon,
            "format": "jsonv2",
            "addressdetails": 1,
            "zoom": 18,
            "accept-language": "fr",
        },
        timeout=10,
        log_context="Reverse geocoding",
    )
    return payload if isinstance(payload, dict) else {}


def reverse_geocode_address(lat: float, lon: float) -> str:
    payload = _reverse_geocode_payload(lat, lon)
    if not payload:
        return ""

    address = payload.get("address") or {}
    manual_address = _build_manual_address(address)
    if manual_address:
        return manual_address

    display_name = payload.get("display_name") or ""
    if isinstance(display_name, str):
        return display_name.split(", France")[0].strip()

    return ""


def reverse_geocode_postcode(lat: float, lon: float) -> str:
    payload = _reverse_geocode_payload(lat, lon)
    if not payload:
        return ""

    address = payload.get("address") or {}
    postcode = extract_postcode(address.get("postcode"))
    if postcode:
        return postcode

    display_name = payload.get("display_name") or ""
    return extract_postcode(display_name)


def _search_nominatim(query: str) -> list[dict]:
    payload = _request_json(
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
        timeout=12,
        log_context="Nominatim search",
    )
    if payload is None:
        return []

    return payload if isinstance(payload, list) else []


def _search_nominatim_structured(**structured_params: str) -> list[dict]:
    payload = _request_json(
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
        timeout=12,
        log_context="Structured Nominatim search",
    )
    if payload is None:
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


def search_streets_by_postcode(postcode: str, query: str, limit: int = 12) -> list[dict]:
    normalized_postcode = extract_postcode(postcode)
    trimmed_query = (query or "").strip()
    if not normalized_postcode or len(trimmed_query) < 2:
        return []

    payload = _request_json(
        BAN_SEARCH_URL,
        params={
            "q": trimmed_query,
            "postcode": normalized_postcode,
            "type": "street",
            "limit": max(1, min(limit, 20)),
            "autocomplete": 1,
        },
        timeout=10,
        log_context="BAN street search",
    )
    if not isinstance(payload, dict):
        return []

    features = payload.get("features")
    if not isinstance(features, list):
        return []

    suggestions: list[dict] = []
    unique_labels: set[str] = set()
    for feature in features:
        properties = feature.get("properties") if isinstance(feature, dict) else None
        geometry = feature.get("geometry") if isinstance(feature, dict) else None
        if not isinstance(properties, dict) or not isinstance(geometry, dict):
            continue

        coordinates = geometry.get("coordinates")
        if not (isinstance(coordinates, list) and len(coordinates) >= 2):
            continue

        lon, lat = coordinates[0], coordinates[1]
        if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
            continue

        result_postcode = extract_postcode(properties.get("postcode"))
        if result_postcode and result_postcode != normalized_postcode:
            continue

        label = str(properties.get("label") or "").strip()
        if not label:
            street = str(properties.get("name") or "").strip()
            city = str(properties.get("city") or "").strip()
            if not street:
                continue
            city_part = f" {city}" if city else ""
            label = f"{street}, {normalized_postcode}{city_part}"

        normalized_label = label.lower()
        if normalized_label in unique_labels:
            continue

        unique_labels.add(normalized_label)
        suggestions.append(
            {
                "label": label,
                "lat": float(lat),
                "lon": float(lon),
            }
        )

    return suggestions
