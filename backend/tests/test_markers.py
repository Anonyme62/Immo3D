from tests.support import BackendApiTestCase


class CustomMarkersApiTests(BackendApiTestCase):
    def setUp(self):
        super().setUp()

        self.set_fake_yanport_login(
            lambda username, password: {
                "token": f"token-{username}",
                "username": username,
                "email": f"{username}@example.com",
            }
        )

    def test_markers_are_isolated_per_user(self):
        self.login("alice")
        create_response = self.client.post(
            "/markers",
            json={"lat": 50.45, "lon": 2.79, "note": "Visite mercredi"},
            headers=self.auth_headers(),
        )
        self.assertEqual(create_response.status_code, 200)
        marker_id = create_response.json()["id"]

        self.logout()
        self.login("bob")

        bob_list = self.client.get("/markers")
        self.assertEqual(bob_list.status_code, 200)
        self.assertEqual(bob_list.json(), [])

        delete_response = self.client.delete(
            f"/markers/{marker_id}",
            headers=self.auth_headers(),
        )
        self.assertEqual(delete_response.status_code, 200)

        self.logout()
        self.login("alice")

        alice_list = self.client.get("/markers")
        self.assertEqual(alice_list.status_code, 200)
        self.assertEqual(len(alice_list.json()), 1)

    def test_marker_can_be_updated_and_deleted(self):
        self.login("charlie")

        create_response = self.client.post(
            "/markers",
            json={"lat": 50.45, "lon": 2.79, "note": "Visite mercredi"},
            headers=self.auth_headers(),
        )
        self.assertEqual(create_response.status_code, 200)
        marker_id = create_response.json()["id"]

        update_response = self.client.patch(
            f"/markers/{marker_id}",
            json={"note": "Visite reportee jeudi"},
            headers=self.auth_headers(),
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(update_response.json()["note"], "Visite reportee jeudi")

        delete_response = self.client.delete(
            f"/markers/{marker_id}",
            headers=self.auth_headers(),
        )
        self.assertEqual(delete_response.status_code, 200)

        list_response = self.client.get("/markers")
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.json(), [])

    def test_marker_accepts_remote_photo_urls(self):
        self.login("charlie")
        create_response = self.client.post(
            "/markers",
            json={
                "lat": 50.45,
                "lon": 2.79,
                "note": "Repere URL",
                "photos": ["https://cdn.example.com/photos/marker-1.jpg"],
            },
            headers=self.auth_headers(),
        )
        self.assertEqual(create_response.status_code, 200)
        self.assertEqual(
            create_response.json()["photos"],
            ["https://cdn.example.com/photos/marker-1.jpg"],
        )

    def test_marker_rejects_data_url_photos(self):
        self.login("charlie")
        create_response = self.client.post(
            "/markers",
            json={
                "lat": 50.45,
                "lon": 2.79,
                "note": "Repere data url",
                "photos": ["data:image/webp;base64,AAAA"],
            },
            headers=self.auth_headers(),
        )
        self.assertEqual(create_response.status_code, 400)
        self.assertEqual(
            create_response.json()["detail"],
            "Format photo non supporte. Utilise une URL distante.",
        )
