import logging
from datetime import datetime, timezone
from urllib.parse import quote_plus

import requests
from fastapi import HTTPException


YANPORT_LOGIN_URL = "https://api.yanport.com/users/auth"
YANPORT_PROPERTIES_URL = "https://api.yanport.com/properties"
logger = logging.getLogger(__name__)


def yanport_browser_headers() -> dict:
    return {
        "Accept": "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0",
        "Origin": "https://app.yanport.com",
        "Referer": "https://app.yanport.com/",
    }


def yanport_request(method: str, url: str, **kwargs) -> requests.Response:
    with requests.Session() as session:
        session.trust_env = False
        return session.request(method=method, url=url, **kwargs)


def login_to_yanport(username: str, password: str) -> dict:
    try:
        response = yanport_request(
            "POST",
            YANPORT_LOGIN_URL,
            headers={
                **yanport_browser_headers(),
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            },
            data={
                "username": username,
                "password": password,
                "rememberMe": "false",
            },
            timeout=30,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Impossible de joindre Yanport: {exc}")

    if response.status_code in {400, 401, 403}:
        raise HTTPException(status_code=401, detail="Identifiants Yanport invalides")

    if response.status_code != 200:
        logger.warning(
            "Yanport login error status=%s body=%s",
            response.status_code,
            response.text[:300],
        )
        raise HTTPException(
            status_code=502,
            detail="Service d'authentification Yanport indisponible.",
        )

    try:
        data = response.json()
    except Exception:
        data = {"token": response.text.strip()}

    if isinstance(data, str):
        data = {"token": data}

    token = (
        data.get("token")
        or data.get("jwt")
        or data.get("accessToken")
        or data.get("id_token")
    )

    if not token:
        raise HTTPException(status_code=401, detail="Reponse Yanport invalide")

    return {
        "token": token,
        "username": username,
        "email": data.get("email"),
    }


def build_properties_url(zip_code: str | None = None, ville: str | None = None) -> str:
    url = (
        f"{YANPORT_PROPERTIES_URL}"
        "?from=0"
        "&size=100"
        "&sort=marketing.publicationStartDate:desc"
        "&precision=ACCURATE"
        "&source=AD"
        "&marketingTypes=SALE"
        "&active=true"
    )

    if zip_code and zip_code.strip():
        url += f"&zipCodes={quote_plus(zip_code.strip())}"

    if ville and ville.strip():
        url += f"&cities={quote_plus(ville.strip())}"

    return url


def fetch_properties(
    access_token: str, zip_code: str | None = None, ville: str | None = None
) -> list[dict]:
    url = build_properties_url(zip_code=zip_code, ville=ville)

    try:
        response = yanport_request(
            "GET",
            url,
            headers={
                **yanport_browser_headers(),
                "Authorization": f"Bearer {access_token}",
            },
            timeout=30,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Impossible de joindre Yanport: {exc}")

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="Session Yanport expiree. Merci de vous reconnecter.")

    if response.status_code != 200:
        logger.warning(
            "Yanport properties error status=%s body=%s",
            response.status_code,
            response.text[:500],
        )
        raise HTTPException(
            status_code=502,
            detail="Erreur lors de la recuperation des biens Yanport.",
        )

    data = response.json()
    return data.get("hits", [])


def normalize_number(value):
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return None


def compute_anciennete(publication_date):
    if not publication_date:
        return None

    try:
        date_str = publication_date.replace("Z", "+00:00")
        date_obj = datetime.fromisoformat(date_str)

        if date_obj.tzinfo is None:
            date_obj = date_obj.replace(tzinfo=timezone.utc)

        now = datetime.now(timezone.utc)
        return (now - date_obj).days
    except Exception:
        return None


def extract_agence(bien: dict) -> str:
    dealers = bien.get("marketing", {}).get("dealers", [])

    for dealer in dealers:
        if dealer.get("type") == "AGENCY" and dealer.get("name"):
            return dealer.get("name")

    for dealer in dealers:
        if dealer.get("name"):
            return dealer.get("name")

    return (
        bien.get("agency", {}).get("name")
        or bien.get("agencyName")
        or bien.get("publisher", {}).get("name")
        or bien.get("publisherName")
        or bien.get("dealer", {}).get("name")
        or bien.get("dealerName")
        or ""
    )


def extract_annonceur_type(bien: dict) -> str:
    dealers = bien.get("marketing", {}).get("dealers", [])

    dealer_types = [
        str(dealer.get("type", "")).strip().upper()
        for dealer in dealers
        if str(dealer.get("type", "")).strip()
    ]

    if "PRIVATE" in dealer_types:
        return "particulier"

    if "AGENCY" in dealer_types or "PROFESSIONAL" in dealer_types:
        return "professionnel"

    agency = extract_agence(bien).strip()
    return "professionnel" if agency else "particulier"


def map_property_for_front(
    bien: dict,
    blacklist_ids: set[str],
    notes_map: dict[str, str],
    favorite_ids: set[str] | None = None,
    set_aside_ids: set[str] | None = None,
    placements_map: dict[str, dict] | None = None,
) -> dict:
    id_bien = str(bien.get("id", ""))

    marketing = bien.get("marketing", {})
    features = bien.get("features", {})
    geometry = features.get("geometry", {})
    visual = features.get("visual", {})
    address = bien.get("address", {})
    location = address.get("location", {})

    prix = marketing.get("price")
    surface = geometry.get("surface")
    adresse = address.get("formatted", "") or ""
    lat = location.get("lat")
    lon = location.get("lon")
    images = visual.get("images", [])
    agence = extract_agence(bien)
    annonceur_type = extract_annonceur_type(bien)
    date_pub = marketing.get("publicationStartDate")
    anciennete = compute_anciennete(date_pub)
    ads = bien.get("ads", [])

    lien_annonce = ""
    lien_leboncoin = ""
    lien_bienici = ""
    lien_seloger = ""
    lien_paruvendu = ""
    lien_logicimmo = ""
    lien_figaro = ""

    for ad in ads:
        url = ad.get("url", "") or ""
        source = (ad.get("crawlSource", "") or "").upper()

        if not url:
            continue

        if not lien_annonce:
            lien_annonce = url

        if source == "LE_BON_COIN":
            lien_leboncoin = url
        elif source == "BIEN_ICI":
            lien_bienici = url
        elif source == "SE_LOGER":
            lien_seloger = url
        elif source == "PARU_VENDU":
            lien_paruvendu = url
        elif source == "LOGIC_IMMO":
            lien_logicimmo = url
        elif source in {"EXPLORIMMO", "FIGARO"}:
            lien_figaro = url

    lien_yanport = f"https://app.yanport.com/properties/{id_bien}"

    placement = (placements_map or {}).get(id_bien)
    if placement:
        lat = placement.get("lat", lat)
        lon = placement.get("lon", lon)
        if placement.get("manual_address", "").strip():
            adresse = placement["manual_address"].strip()

    blacklisted = id_bien in blacklist_ids
    sans_adresse = lat is None or lon is None
    note = notes_map.get(id_bien, "")
    favorite = id_bien in (favorite_ids or set())
    de_cote = id_bien in (set_aside_ids or set())
    placed_manually = placement is not None

    if sans_adresse:
        adresse = ""

    if blacklisted:
        statut = "blackliste"
    elif anciennete is not None and anciennete < 7:
        statut = "nouveau"
    else:
        statut = "actif"

    return {
        "id": id_bien,
        "prix": normalize_number(prix),
        "surface": normalize_number(surface),
        "adresse": adresse,
        "anciennete": anciennete,
        "statut": statut,
        "blackliste": blacklisted,
        "sans_adresse": sans_adresse,
        "lat": lat,
        "lon": lon,
        "agence": agence,
        "annonceur_type": annonceur_type,
        "photos": images,
        # Yanport expose une galerie unique. On la rattache a Leboncoin
        # uniquement lorsqu'une annonce Leboncoin existe pour ce bien.
        "photos_leboncoin": images if lien_leboncoin else [],
        "lien_annonce": lien_annonce,
        "lien_leboncoin": lien_leboncoin,
        "lien_yanport": lien_yanport,
        "lien_bienici": lien_bienici,
        "lien_seloger": lien_seloger,
        "lien_paruvendu": lien_paruvendu,
        "lien_logicimmo": lien_logicimmo,
        "lien_figaro": lien_figaro,
        "note": note,
        "favorite": favorite,
        "de_cote": de_cote,
        "placed_manually": placed_manually,
    }
