import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAddressAnchorAssignments,
  buildCoordinateStackAssignments,
  buildLabelGroupAssignments,
  buildMarkerEntityId,
  compareMarkerRenderOrder,
  getMarkerLabelOffset,
  getMarkerRenderPriority,
  getMarkerVisualState,
} from "../src/utils/mapMarkerStyle.js";

test("buildMarkerEntityId creates stable unique ids per index", () => {
  assert.equal(buildMarkerEntityId("123", 0), "bien-marker-123-0");
  assert.equal(buildMarkerEntityId("123", 1), "bien-marker-123-1");
});

test("getMarkerVisualState keeps marker colors and size stable even when selected", () => {
  const selectedBien = { id: "A", anciennete: 3 };
  const otherBien = { id: "B", anciennete: 120 };

  const selectedState = getMarkerVisualState(selectedBien, "A");
  const otherState = getMarkerVisualState(otherBien, "A");

  assert.equal(selectedState.isSelected, false);
  assert.equal(selectedState.color, "green");
  assert.equal(selectedState.outlineWidth, 2);
  assert.equal(selectedState.pixelSize, 14);
  assert.equal(otherState.isSelected, false);
  assert.equal(otherState.color, "red");
});

test("getMarkerVisualState keeps ageing colors for non selected biens", () => {
  const green = getMarkerVisualState({ id: "1", anciennete: 3 }, "X");
  const orange = getMarkerVisualState({ id: "2", anciennete: 20 }, "X");
  const red = getMarkerVisualState({ id: "3", anciennete: 45 }, "X");

  assert.equal(green.color, "green");
  assert.equal(orange.color, "orange");
  assert.equal(red.color, "red");
  assert.equal(green.pixelSize > orange.pixelSize, true);
  assert.equal(orange.pixelSize > red.pixelSize, true);
});

test("getMarkerRenderPriority keeps green markers above orange and red ones", () => {
  assert.equal(getMarkerRenderPriority({ id: "r", anciennete: 40 }, null), 1);
  assert.equal(getMarkerRenderPriority({ id: "o", anciennete: 10 }, null), 2);
  assert.equal(getMarkerRenderPriority({ id: "g", anciennete: 3 }, null), 3);
  assert.equal(getMarkerRenderPriority({ id: "s", anciennete: 200 }, "s"), 1);
});

test("compareMarkerRenderOrder enforces red -> orange -> green -> selected", () => {
  const red = { id: "red", anciennete: 40 };
  const orange = { id: "orange", anciennete: 15 };
  const green = { id: "green", anciennete: 2 };
  const selected = { id: "sel", anciennete: 2 };

  assert.equal(compareMarkerRenderOrder(red, orange, null) < 0, true);
  assert.equal(compareMarkerRenderOrder(orange, green, null) < 0, true);
  assert.equal(compareMarkerRenderOrder(orange, selected, "sel") < 0, true);
  assert.equal(compareMarkerRenderOrder(green, selected, "sel") < 0, true);
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

test("buildLabelGroupAssignments preserves incoming priority order within shared addresses", () => {
  const assignments = buildLabelGroupAssignments([
    { id: "green", lat: 50.1, lon: 2.1, adresse: "10 rue des Platanes" },
    { id: "orange", lat: 50.1005, lon: 2.1005, adresse: "10 rue des Platanes" },
    { id: "red", lat: 50.101, lon: 2.101, adresse: "10 rue des Platanes" },
  ]);

  assert.deepEqual(assignments.get("green"), { index: 0, total: 3 });
  assert.deepEqual(assignments.get("orange"), { index: 1, total: 3 });
  assert.deepEqual(assignments.get("red"), { index: 2, total: 3 });
});

test("buildAddressAnchorAssignments snaps same-address markers to green anchor", () => {
  const assignments = buildAddressAnchorAssignments([
    {
      id: "red",
      lat: 50.100001,
      lon: 2.100001,
      anciennete: 80,
      adresse: "2 Rue Alphonse Decatoire, Mazingarbe",
    },
    {
      id: "orange",
      lat: 50.10001,
      lon: 2.10001,
      anciennete: 12,
      adresse: "2 Rue Alphonse Decatoire, Mazingarbe",
    },
    {
      id: "green",
      lat: 50.09999,
      lon: 2.100005,
      anciennete: 2,
      adresse: "2 Rue Alphonse Decatoire, Mazingarbe",
    },
  ]);

  assert.equal(assignments.get("green"), "green");
  assert.equal(assignments.get("orange"), "green");
  assert.equal(assignments.get("red"), "green");
});

test("buildCoordinateStackAssignments keeps green above orange and red at same coordinate", () => {
  const assignments = buildCoordinateStackAssignments([
    { id: "red", lat: 50.1, lon: 2.1, anciennete: 40 },
    { id: "orange", lat: 50.1, lon: 2.1, anciennete: 18 },
    { id: "green", lat: 50.1, lon: 2.1, anciennete: 2 },
  ]);

  assert.deepEqual(assignments.get("green"), { index: 0, total: 3 });
  assert.deepEqual(assignments.get("orange"), { index: 1, total: 3 });
  assert.deepEqual(assignments.get("red"), { index: 2, total: 3 });
});

test("buildCoordinateStackAssignments also stacks same-address markers by priority", () => {
  const assignments = buildCoordinateStackAssignments([
    {
      id: "red",
      lat: 50.100001,
      lon: 2.100001,
      anciennete: 80,
      adresse: "2 Rue Alphonse Decatoire, Mazingarbe",
    },
    {
      id: "orange",
      lat: 50.10001,
      lon: 2.10001,
      anciennete: 12,
      adresse: "2 Rue Alphonse Decatoire, Mazingarbe",
    },
    {
      id: "green",
      lat: 50.09999,
      lon: 2.100005,
      anciennete: 2,
      adresse: "2 Rue Alphonse Decatoire, Mazingarbe",
    },
  ]);

  assert.deepEqual(assignments.get("green"), { index: 0, total: 3 });
  assert.deepEqual(assignments.get("orange"), { index: 1, total: 3 });
  assert.deepEqual(assignments.get("red"), { index: 2, total: 3 });
});

test("getMarkerLabelOffset spreads the first labels around the marker", () => {
  assert.deepEqual(getMarkerLabelOffset(0), { x: 0, y: -20 });
  assert.deepEqual(getMarkerLabelOffset(1), { x: -20, y: -8 });
  assert.deepEqual(getMarkerLabelOffset(2), { x: 20, y: -8 });
  assert.deepEqual(getMarkerLabelOffset(3), { x: 0, y: 14 });
});
