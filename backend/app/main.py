from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db import Base, engine, ensure_sqlite_compatibility_migrations
from app.models import AppSession, BlacklistItem, CustomMarker, Note, User, YanportSession
from app.routers.auth import router as auth_router
from app.routers.biens import router as biens_router
from app.routers.blacklist import router as blacklist_router
from app.routers.geocoding import router as geocoding_router
from app.routers.markers import router as markers_router
from app.routers.notes import router as notes_router


Base.metadata.create_all(bind=engine)
ensure_sqlite_compatibility_migrations()

BACKEND_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIST = BACKEND_ROOT / "frontend_dist"

app = FastAPI(title="Immo 3D API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_origin_regex=settings.cors_allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(notes_router)
app.include_router(blacklist_router)
app.include_router(markers_router)
app.include_router(biens_router)
app.include_router(geocoding_router)


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


    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        reserved_prefixes = (
            "auth",
            "biens",
            "blacklist",
            "notes",
            "markers",
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
