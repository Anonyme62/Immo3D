from datetime import datetime

from pydantic import BaseModel, Field


class YanportLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=255)


class UserResponse(BaseModel):
    id: str
    yanport_username: str
    yanport_email: str | None = None
    stripe_customer_id: str | None = None
    subscription_status: str | None = None
    subscription_current_period_end: datetime | None = None
    subscription_cancel_at_period_end: bool = False
    has_active_subscription: bool
    has_app_access: bool
    billing_required: bool
    has_billing_bypass: bool

    model_config = {"from_attributes": True}


class AuthStatusResponse(BaseModel):
    authenticated: bool
    user: UserResponse | None = None
    csrf_token: str | None = None


class BillingSessionResponse(BaseModel):
    url: str


class CheckoutSessionSyncRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=255)


class NoteUpsertRequest(BaseModel):
    bien_id: str = Field(min_length=1, max_length=255)
    note: str = Field(default="", max_length=5000)


class NoteResponse(BaseModel):
    id: int
    user_id: str
    bien_id: str
    note: str

    model_config = {"from_attributes": True}


class BlacklistUpsertRequest(BaseModel):
    bien_id: str = Field(min_length=1, max_length=255)
    surface: float | None = None
    prix: float | None = None


class BlacklistResponse(BaseModel):
    id: int
    user_id: str
    bien_id: str
    surface: float | None = None
    prix: float | None = None

    model_config = {"from_attributes": True}


class BienResponse(BaseModel):
    id: str
    prix: float | None = None
    surface: float | None = None
    adresse: str
    anciennete: int | None = None
    statut: str
    blackliste: bool
    sans_adresse: bool
    lat: float | None = None
    lon: float | None = None
    agence: str = ""
    annonceur_type: str = ""
    photos: list[str] = Field(default_factory=list)
    photos_leboncoin: list[str] = Field(default_factory=list)
    lien_annonce: str = ""
    lien_leboncoin: str = ""
    lien_yanport: str = ""
    lien_bienici: str = ""
    lien_seloger: str = ""
    lien_paruvendu: str = ""
    lien_logicimmo: str = ""
    lien_figaro: str = ""
    note: str = ""
    favorite: bool = False
    de_cote: bool = False
    placed_manually: bool = False


class CustomMarkerCreateRequest(BaseModel):
    lat: float
    lon: float
    search_zone: str = Field(default="", max_length=64)
    note: str = Field(default="", min_length=1, max_length=5000)


class CustomMarkerUpdateRequest(BaseModel):
    note: str = Field(default="", min_length=1, max_length=5000)


class CustomMarkerResponse(BaseModel):
    id: str
    user_id: str
    lat: float
    lon: float
    search_zone: str = ""
    note: str

    model_config = {"from_attributes": True}


class FavoriteBienRequest(BaseModel):
    bien_id: str = Field(min_length=1, max_length=255)


class FavoriteBienResponse(BaseModel):
    id: int
    user_id: str
    bien_id: str

    model_config = {"from_attributes": True}


class SetAsideBienRequest(BaseModel):
    bien_id: str = Field(min_length=1, max_length=255)


class SetAsideBienResponse(BaseModel):
    id: int
    user_id: str
    bien_id: str

    model_config = {"from_attributes": True}


class BienPlacementRequest(BaseModel):
    lat: float
    lon: float
    manual_address: str = Field(default="", max_length=500)


class BienPlacementResponse(BaseModel):
    id: int
    user_id: str
    bien_id: str
    lat: float
    lon: float
    manual_address: str

    model_config = {"from_attributes": True}
