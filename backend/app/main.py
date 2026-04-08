from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import Base, engine
from app.models import AppSession, BlacklistItem, CustomMarker, Note, User, YanportSession
from app.routers.auth import router as auth_router
from app.routers.biens import router as biens_router
from app.routers.blacklist import router as blacklist_router
from app.routers.markers import router as markers_router
from app.routers.notes import router as notes_router


Base.metadata.create_all(bind=engine)

app = FastAPI(title="Immo 3D API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_origin_regex=settings.cors_allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Immo 3D API OK"}


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(notes_router)
app.include_router(blacklist_router)
app.include_router(markers_router)
app.include_router(biens_router)
