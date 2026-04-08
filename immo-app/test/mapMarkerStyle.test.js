import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLabelGroupAssignments,
  buildMarkerEntityId,
  getMarkerLabelOffset,
  getMarkerVisualState,
} from "../src/utils/mapMarkerStyle.js";

test("buildMarkerEntityId creates stable unique ids per index", () => {
  assert.equal(buildMarkerEntityId("123", 0), "bien-marker-123-0");
  assert.equal(buildMarkerEntityId("123", 1), "bien-marker-123-1");
});

test("getMarkerVisualState highlights only the selected bien", () => {
  const selectedBien = { id: "A", anciennete: 120 };
  const otherBien = { id: "B", anciennete: 120 };

  const selectedState = getMarkerVisualState(selectedBien, "A");
  const otherState = getMarkerVisualState(otherBien, "A");

  assert.equal(selectedState.isSelected, true);
  assert.equal(selectedState.color, "dodgerblue");
  assert.equal(otherState.isSelected, false);
  assert.equal(otherState.color, "red");
});

test("getMarkerVisualState keeps ageing colors for non selected biens", () => {
  assert.equal(
    getMarkerVisualState({ id: "1", anciennete: 3 }, "X").color,
    "green"
  );
  assert.equal(
    getMarkerVisualState({ id: "2", anciennete: 20 }, "X").color,
    "orange"
  );
  assert.equal(
    getMarkerVisualState({ id: "3", anciennete: 45 }, "X").color,
    "red"
  );
});

test("buildLabelGroupAssignments groups same coordinates together", () => {
  const assignments = buildLabelGroupAssignments([
    { id: "A", lat: 50.1, lon: 2.1, adresse: "1 rue test" },
    { id: "B", lat: 50.1, lon: 2.1, adresse: "2 rue test" },
    { id: "C", lat: 50.2, lon: 2.2, adresse: "ailleurs" },
  ]);

  assert.deepEqual(assignments.get("A"), { index: 0, total: 2 });
  assert.deepEqual(assignments.get("B"), { index: 1, total: 2 });
  assert.deepEqual(assignments.get("C"), { index: 0, total: 1 });
});

test("buildLabelGroupAssignments groups same address together", () => {
  const assignments = buildLabelGroupAssignments([
    { id: "A", lat: 50.1, lon: 2.1, adresse: "10 rue des Platanes" },
    { id: "B", lat: 50.1005, lon: 2.1005, adresse: "10 rue des Platanes" },
  ]);

  assert.deepEqual(assignments.get("A"), { index: 0, total: 2 });
  assert.deepEqual(assignments.get("B"), { index: 1, total: 2 });
});

test("getMarkerLabelOffset spreads the first labels around the marker", () => {
  assert.deepEqual(getMarkerLabelOffset(0), { x: -42, y: -4 });
  assert.deepEqual(getMarkerLabelOffset(1), { x: 0, y: -30 });
  assert.deepEqual(getMarkerLabelOffset(2), { x: 42, y: -4 });
  assert.deepEqual(getMarkerLabelOffset(3), { x: 0, y: 24 });
});
