from fastapi import HTTPException

from app.models import BlacklistItem, Note, User, YanportSession
from app.security import build_lookup_hash
from tests.support import BackendApiTestCase


def sample_property(
    bien_id: str,
    *,
    prix: int = 125000,
    surface: int = 82,
    adresse: str = "10 Rue de Test, 62670 Mazingarbe",
    lat: float = 50.471,
    lon: float = 2.718,
    agence: str = "Agence Test",
    publication_date: str = "2026-04-01T10:00:00Z",
):
    return {
        "id": bien_id,
        "marketing": {
            "price": prix,
            "publicationStartDate": publication_date,
            "dealers": [
                {
                    "type": "AGENCY",
                    "name": agence,
                }
            ],
        },
        "features": {
            "geometry": {
                "surface": surface,
            },
            "visual": {
                "images": [
                    "https://example.test/photo-1.jpg",
                ]
            },
        },
        "address": {
            "formatted": adresse,
            "location": {
                "lat": lat,
                "lon": lon,
            },
        },
        "ads": [
            {
                "url": "https://example.test/annonce",
                "crawlSource": "LE_BON_COIN",
            }
        ],
    }


class BiensTests(BackendApiTestCase):
    def setUp(self):
        super().setUp()

        def fake_yanport_login(username, password):
            return {
                "username": username,
                "email": f"{username}@example.com",
                "token": f"token-{username}",
            }

        self.set_fake_yanport_login(fake_yanport_login)

    def test_biens_uses_current_user_notes_and_blacklist_only(self):
        seen_calls = []

        def fake_fetch_properties(access_token, zip_code=None, ville=None):
            seen_calls.append(
                {
                    "access_token": access_token,
                    "zip_code": zip_code,
                    "ville": ville,
                }
            )
            return [
                sample_property("bien-1"),
                sample_property(
                    "bien-2",
                    prix=248000,
                    adresse="20 Rue des Fleurs, 62670 Mazingarbe",
                    lat=50.472,
                    lon=2.719,
                    publication_date="2026-03-01T10:00:00Z",
                ),
            ]

        self.set_fake_fetch_properties(fake_fetch_properties)

        self.login("alexis")
        with self.TestSessionLocal() as db:
            alexis_user_id = (
                db.query(User)
                .filter(User.yanport_username_hash == build_lookup_hash("alexis"))
                .first()
                .id
            )
            db.add(Note(user_id=alexis_user_id, bien_id="bien-1", note="Note Alexis"))
            db.add(BlacklistItem(user_id=alexis_user_id, bien_id="bien-2", surface=82, prix=248000))
            db.commit()
        self.logout()

        self.login("marine")
        with self.TestSessionLocal() as db:
            marine_user_id = (
                db.query(User)
                .filter(User.yanport_username_hash == build_lookup_hash("marine"))
                .first()
                .id
            )
            db.add(Note(user_id=marine_user_id, bien_id="bien-1", note="Note Marine"))
            db.commit()
        self.logout()

        self.login("alexis")
        response = self.client.get("/biens", params={"zip_code": "62670"})

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 2)
        self.assertEqual(seen_calls[0]["access_token"], "token-alexis")
        self.assertEqual(seen_calls[0]["zip_code"], "62670")

        bien_1 = next(item for item in data if item["id"] == "bien-1")
        bien_2 = next(item for item in data if item["id"] == "bien-2")

        self.assertEqual(bien_1["note"], "Note Alexis")
        self.assertFalse(bien_1["blackliste"])
        self.assertEqual(
            bien_1["photos_leboncoin"],
            ["https://example.test/photo-1.jpg"],
        )
        self.assertEqual(bien_2["note"], "")
        self.assertTrue(bien_2["blackliste"])
        self.assertEqual(bien_2["statut"], "blackliste")

    def test_biens_returns_401_when_yanport_session_is_missing(self):
        self.login("alexis")

        with self.TestSessionLocal() as db:
            yanport_session = db.query(YanportSession).first()
            db.delete(yanport_session)
            db.commit()

        response = self.client.get("/biens", params={"zip_code": "62670"})

        self.assertEqual(response.status_code, 401)
        self.assertIn("Session Yanport introuvable", response.json()["detail"])

    def test_biens_propagates_expired_yanport_session(self):
        def expired_fetch_properties(access_token, zip_code=None, ville=None):
            raise HTTPException(
                status_code=401,
                detail="Session Yanport expiree. Merci de vous reconnecter.",
            )

        self.set_fake_fetch_properties(expired_fetch_properties)
        self.login("alexis")

        response = self.client.get("/biens", params={"zip_code": "62670"})

        self.assertEqual(response.status_code, 401)
        self.assertIn("Session Yanport expiree", response.json()["detail"])
