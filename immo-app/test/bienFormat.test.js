import test from "node:test";
import assert from "node:assert/strict";

import { getSelectedBienPhotos } from "../src/utils/bienFormat.js";

test("getSelectedBienPhotos keeps only Leboncoin photos", () => {
  const photos = getSelectedBienPhotos({
    photos_leboncoin: ["https://img1", "", null, "https://img2"],
    photos: ["https://other-source"],
  });

  assert.deepEqual(photos, ["https://img1", "https://img2"]);
});

test("getSelectedBienPhotos returns empty when Leboncoin photos are absent", () => {
  const photos = getSelectedBienPhotos({
    photos: ["https://other-source"],
  });

  assert.deepEqual(photos, []);
});

test("getSelectedBienPhotos falls back to legacy photos only when Leboncoin link exists", () => {
  const photos = getSelectedBienPhotos({
    lien_leboncoin: "https://www.leboncoin.fr/test",
    photos: ["https://img-legacy-1", "", "https://img-legacy-2"],
  });

  assert.deepEqual(photos, ["https://img-legacy-1", "https://img-legacy-2"]);
});
