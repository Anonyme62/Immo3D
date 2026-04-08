from tests.support import BackendApiTestCase


class NotesAndBlacklistTests(BackendApiTestCase):
    def setUp(self):
        super().setUp()

        def fake_yanport_login(username, password):
            return {
                "username": username,
                "email": f"{username}@example.com",
                "token": f"token-{username}",
            }

        self.set_fake_yanport_login(fake_yanport_login)

    def test_notes_are_isolated_per_user(self):
        self.login("alexis")
        create_note_user_1 = self.client.post(
            "/notes",
            json={"bien_id": "bien-123", "note": "Note Alexis"},
        )
        self.assertEqual(create_note_user_1.status_code, 200)
        self.client.post("/auth/logout")

        self.login("marine")
        note_for_user_2_before_create = self.client.get("/notes/bien-123")
        self.assertEqual(note_for_user_2_before_create.status_code, 200)
        self.assertIsNone(note_for_user_2_before_create.json())

        create_note_user_2 = self.client.post(
            "/notes",
            json={"bien_id": "bien-123", "note": "Note Marine"},
        )
        self.assertEqual(create_note_user_2.status_code, 200)
        self.assertEqual(create_note_user_2.json()["note"], "Note Marine")
        self.client.post("/auth/logout")

        self.login("alexis")
        note_for_user_1_after_user_2 = self.client.get("/notes/bien-123")
        self.assertEqual(note_for_user_1_after_user_2.status_code, 200)
        self.assertEqual(note_for_user_1_after_user_2.json()["note"], "Note Alexis")

    def test_blacklist_is_isolated_and_can_be_removed(self):
        self.login("alexis")
        add_blacklist_user_1 = self.client.post(
            "/blacklist",
            json={"bien_id": "bien-999", "surface": 90, "prix": 175000},
        )
        self.assertEqual(add_blacklist_user_1.status_code, 200)
        self.assertEqual(add_blacklist_user_1.json()["bien_id"], "bien-999")
        self.client.post("/auth/logout")

        self.login("marine")
        blacklist_user_2_before_create = self.client.get("/blacklist/bien-999")
        self.assertEqual(blacklist_user_2_before_create.status_code, 200)
        self.assertIsNone(blacklist_user_2_before_create.json())

        add_blacklist_user_2 = self.client.post(
            "/blacklist",
            json={"bien_id": "bien-999", "surface": 101, "prix": 223000},
        )
        self.assertEqual(add_blacklist_user_2.status_code, 200)
        self.assertEqual(add_blacklist_user_2.json()["prix"], 223000)
        self.client.post("/auth/logout")

        self.login("alexis")
        blacklist_user_1 = self.client.get("/blacklist/bien-999")
        self.assertEqual(blacklist_user_1.status_code, 200)
        self.assertEqual(blacklist_user_1.json()["prix"], 175000)

        remove_blacklist_user_1 = self.client.delete("/blacklist/bien-999")
        self.assertEqual(remove_blacklist_user_1.status_code, 200)

        blacklist_user_1_after_delete = self.client.get("/blacklist/bien-999")
        self.assertEqual(blacklist_user_1_after_delete.status_code, 200)
        self.assertIsNone(blacklist_user_1_after_delete.json())
