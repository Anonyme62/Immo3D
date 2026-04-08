import test from "node:test";
import assert from "node:assert/strict";

import { buildKmlDocument } from "../src/utils/kmlExport.js";

test("buildKmlDocument exports geolocated biens and custom markers", () => {
  const content = buildKmlDocument({
    zoneRecherche: "62670",
    biens: [
      {
        id: "bien-1",
        prix: 128000,
        adresse: "73 Rue Alphonse Decatoire",
        agence: "Cheztoit",
        lat: 50.4,
        lon: 2.75,
        anciennete: 12,
        statut: "actif",
        note: "Relancer demain",
      },
      {
        id: "bien-2",
        prix: 98000,
        adresse: "",
        lat: null,
        lon: null,
      },
    ],
    customMarkers: [
      {
        id: "marker-1",
        lat: 50.41,
        lon: 2.76,
        note: "Visite mercredi",
      },
    ],
  });

  assert.match(content, /<name>62670<\/name>/);
  assert.match(content, /73 Rue Alphonse Decatoire/);
  assert.match(content, /<coordinates>2.75,50.4,0<\/coordinates>/);
  assert.match(content, /Visite mercredi/);
  assert.match(content, /<coordinates>2.76,50.41,0<\/coordinates>/);
  assert.ok(!content.includes("bien-2"));
});

test("buildKmlDocument escapes XML-sensitive characters", () => {
  const content = buildKmlDocument({
    zoneRecherche: "Loos & Gohelle",
    biens: [
      {
        id: "bien-3",
        prix: 250000,
        adresse: '1 <Rue> "Test"',
        agence: "A & B",
        lat: 50.5,
        lon: 2.8,
      },
    ],
  });

  assert.match(content, /Loos &amp; Gohelle/);
  assert.match(content, /1 &lt;Rue&gt; &quot;Test&quot;/);
  assert.match(content, /A &amp; B/);
});
