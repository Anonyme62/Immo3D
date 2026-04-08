import test from "node:test";
import assert from "node:assert/strict";

import { countBienCategories, filterBiens } from "../src/utils/bienFilters.js";

const sampleBiens = [
  {
    id: "bien-1",
    prix: 120000,
    adresse: "1 rue de Lille",
    agence: "Agence A",
    note: "a rappeler",
    blackliste: false,
    sans_adresse: false,
    anciennete: 2,
  },
  {
    id: "bien-2",
    prix: 250000,
    adresse: "2 rue de Lens",
    agence: "Agence B",
    note: "",
    blackliste: true,
    sans_adresse: false,
    anciennete: 20,
  },
  {
    id: "bien-3",
    prix: 98000,
    adresse: "Adresse non renseignee",
    agence: "Agence C",
    note: "",
    blackliste: false,
    sans_adresse: true,
    anciennete: 200,
  },
];

test("filterBiens excludes blacklisted biens when blacklist filter is off", () => {
  const result = filterBiens(sampleBiens, {
    showAllBiens: true,
    showBlacklist: false,
    showSansAdresse: true,
    showNouveaux: true,
  });

  assert.deepEqual(
    result.map((bien) => bien.id),
    ["bien-1", "bien-3"]
  );
});

test("filterBiens can show only sans adresse biens in the sidebar", () => {
  const result = filterBiens(sampleBiens, {
    showAllBiens: false,
    showBlacklist: false,
    showSansAdresse: true,
    showNouveaux: false,
  });

  assert.deepEqual(
    result.map((bien) => bien.id),
    ["bien-3"]
  );
});

test("filterBiens can show only blacklisted biens", () => {
  const result = filterBiens(sampleBiens, {
    showAllBiens: false,
    showBlacklist: true,
    showSansAdresse: false,
    showNouveaux: false,
  });

  assert.deepEqual(
    result.map((bien) => bien.id),
    ["bien-2"]
  );
});

test("filterBiens matches textual search across core fields", () => {
  const result = filterBiens(sampleBiens, {
    search: "rappeler",
  });

  assert.deepEqual(
    result.map((bien) => bien.id),
    ["bien-1"]
  );
});

test("countBienCategories returns expected dashboard counts", () => {
  assert.deepEqual(countBienCategories(sampleBiens), {
    allBiens: 2,
    blacklist: 1,
    sansAdresse: 1,
    nouveaux: 1,
  });
});
