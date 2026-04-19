import os
import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db import Base, engine, ensure_sqlite_compatibility_migrations
from app.models import AppSession, BlacklistItem, CustomMarker, Note, User, YanportSession
from app.routers.auth import router as auth_router
from app.routers.billing import router as billing_router
from app.routers.biens import router as biens_router
from app.routers.blacklist import router as blacklist_router
from app.routers.geocoding import router as geocoding_router
from app.routers.markers import router as markers_router
from app.routers.notes import router as notes_router
from app.routers.uploads import router as uploads_router


Base.metadata.create_all(bind=engine)
ensure_sqlite_compatibility_migrations()

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
FRONTEND_DIST_CANDIDATES = (
    ("backend_frontend_dist", BACKEND_ROOT / "frontend_dist"),
    ("vite_dist", REPO_ROOT / "immo-app" / "dist"),
)


def get_directory_latest_mtime(directory: Path) -> float:
    if not directory.exists():
        return 0.0

    latest_mtime = directory.stat().st_mtime
    try:
        for child in directory.rglob("*"):
            try:
                child_mtime = child.stat().st_mtime
            except OSError:
                continue
            if child_mtime > latest_mtime:
                latest_mtime = child_mtime
    except OSError:
        return latest_mtime

    return latest_mtime


def resolve_frontend_dist():
    available_directories = []
    for source, path in FRONTEND_DIST_CANDIDATES:
        if not path.exists():
            continue
        available_directories.append(
            (get_directory_latest_mtime(path), source, path)
        )

    if not available_directories:
        return BACKEND_ROOT / "frontend_dist", "missing", None

    available_directories.sort(key=lambda item: item[0], reverse=True)
    latest_mtime, source, path = available_directories[0]
    return (
        path,
        source,
        datetime.fromtimestamp(latest_mtime, timezone.utc).isoformat(),
    )


FRONTEND_DIST, FRONTEND_DIST_SOURCE, FRONTEND_DIST_UPDATED_AT = resolve_frontend_dist()

app = FastAPI(title="Immo 3D API", version="1.0.0")

APP_BUILD_VERSION = os.environ.get("APP_BUILD_VERSION", "dev").strip() or "dev"
APP_BUILD_REF = (
    os.environ.get("APP_BUILD_REF")
    or os.environ.get("GIT_COMMIT")
    or "local"
).strip()
APP_BUILD_TIME = os.environ.get("APP_BUILD_TIME", "").strip()
APP_STARTED_AT = datetime.now(timezone.utc).isoformat()


def build_runtime_config_js() -> str:
    runtime_api_base_url = ""
    runtime_cesium_ion_token = settings.cesium_ion_token or ""
    runtime_build_version = APP_BUILD_VERSION
    runtime_build_ref = APP_BUILD_REF

    return "\n".join(
        [
            "window.__IMMO3D_RUNTIME_CONFIG__ = window.__IMMO3D_RUNTIME_CONFIG__ || {};",
            f"window.__IMMO3D_RUNTIME_CONFIG__.apiBaseUrl = window.__IMMO3D_RUNTIME_CONFIG__.apiBaseUrl || {json.dumps(runtime_api_base_url)};",
            f"window.__IMMO3D_RUNTIME_CONFIG__.cesiumIonToken = window.__IMMO3D_RUNTIME_CONFIG__.cesiumIonToken || {json.dumps(runtime_cesium_ion_token)};",
            f"window.__IMMO3D_RUNTIME_CONFIG__.buildVersion = window.__IMMO3D_RUNTIME_CONFIG__.buildVersion || {json.dumps(runtime_build_version)};",
            f"window.__IMMO3D_RUNTIME_CONFIG__.buildRef = window.__IMMO3D_RUNTIME_CONFIG__.buildRef || {json.dumps(runtime_build_ref)};",
            "",
        ]
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_origin_regex=settings.cors_allowed_origin_regex or None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.allowed_hosts_list,
)

app.add_middleware(
    GZipMiddleware,
    minimum_size=1024,
    compresslevel=6,
)


def is_spa_navigation_request(path: str) -> bool:
    if not FRONTEND_DIST.exists():
        return False

    reserved_prefixes = (
        "/auth",
        "/biens",
        "/blacklist",
        "/notes",
        "/markers",
        "/billing",
        "/uploads",
        "/health",
        "/geocoding",
        "/docs",
        "/openapi.json",
        "/redoc",
        "/assets",
        "/cesium",
        "/favicon.svg",
        "/icons.svg",
        "/test-bien.kml",
    )

    if path.startswith(reserved_prefixes):
        return False

    return "." not in Path(path).name


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), camera=(), microphone=()")
    if settings.app_env.lower() == "production":
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

    protected_prefixes = (
        "/auth",
        "/biens",
        "/notes",
        "/markers",
        "/blacklist",
        "/billing",
        "/uploads",
    )
    if request.url.path.startswith(protected_prefixes):
        response.headers.setdefault("Cache-Control", "no-store")
        return response

    if request.method == "GET":
        path = request.url.path
        if path.startswith("/assets/"):
            response.headers.setdefault("Cache-Control", "public, max-age=31536000, immutable")
        elif path.startswith("/cesium/"):
            response.headers.setdefault("Cache-Control", "public, max-age=604800")
        elif path in {"/", "/index.html", "/runtime-config.js", "/sw.js"}:
            response.headers.setdefault("Cache-Control", "no-store")
        elif is_spa_navigation_request(path):
            response.headers.setdefault("Cache-Control", "no-store")

    return response


@app.get("/health")
def health():
    return {
        "status": "ok",
        "api_version": app.version,
        "app_env": settings.app_env,
        "build_version": APP_BUILD_VERSION,
        "build_ref": APP_BUILD_REF,
        "build_time": APP_BUILD_TIME,
        "started_at": APP_STARTED_AT,
        "frontend_dist_present": FRONTEND_DIST.exists(),
        "frontend_dist_source": FRONTEND_DIST_SOURCE,
        "frontend_dist_updated_at": FRONTEND_DIST_UPDATED_AT,
    }


app.include_router(auth_router)
app.include_router(billing_router)
app.include_router(notes_router)
app.include_router(blacklist_router)
app.include_router(markers_router)
app.include_router(biens_router)
app.include_router(geocoding_router)
app.include_router(uploads_router)


if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    cesium_dir = FRONTEND_DIST / "cesium"

    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend-assets")

    if cesium_dir.exists():
        app.mount("/cesium", StaticFiles(directory=cesium_dir), name="frontend-cesium")

    @app.get("/", include_in_schema=False)
    def serve_index():
        return FileResponse(FRONTEND_DIST / "index.html")


    @app.get("/favicon.svg", include_in_schema=False)
    def serve_favicon():
        return FileResponse(FRONTEND_DIST / "favicon.svg")


    @app.get("/icons.svg", include_in_schema=False)
    def serve_icons():
        return FileResponse(FRONTEND_DIST / "icons.svg")


    @app.get("/test-bien.kml", include_in_schema=False)
    def serve_test_kml():
        return FileResponse(FRONTEND_DIST / "test-bien.kml")


    @app.get("/runtime-config.js", include_in_schema=False)
    def serve_runtime_config():
        return Response(
            content=build_runtime_config_js(),
            media_type="application/javascript; charset=utf-8",
        )


    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        reserved_prefixes = (
            "auth",
            "biens",
            "blacklist",
            "notes",
            "markers",
            "billing",
            "uploads",
            "health",
            "geocoding",
            "docs",
            "openapi.json",
            "redoc",
            "assets",
            "cesium",
            "favicon.svg",
            "icons.svg",
            "test-bien.kml",
        )

        if full_path.startswith(reserved_prefixes):
            raise HTTPException(status_code=404)

        requested_path = FRONTEND_DIST / full_path
        if full_path and requested_path.is_file():
            return FileResponse(requested_path)

        return FileResponse(FRONTEND_DIST / "index.html")
else:
    @app.get("/")
    def root():
        return {"message": "Immo 3D API OK"}
