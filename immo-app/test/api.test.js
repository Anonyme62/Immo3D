import test from "node:test";
import assert from "node:assert/strict";

import { buildBiensQuery } from "../src/utils/biensQuery.js";

test("buildBiensQuery uses zip_code for five-digit inputs", () => {
  assert.equal(buildBiensQuery("62670"), "zip_code=62670");
});

test("buildBiensQuery uses ville for non zip values", () => {
  assert.equal(
    buildBiensQuery("Mazingarbe"),
    "ville=Mazingarbe"
  );
});

test("buildBiensQuery ignores empty values safely", () => {
  assert.equal(buildBiensQuery("   "), "");
  assert.equal(buildBiensQuery(""), "");
  assert.equal(buildBiensQuery(undefined), "");
});
