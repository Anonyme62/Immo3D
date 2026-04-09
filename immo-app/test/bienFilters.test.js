import test from "node:test";
import assert from "node:assert/strict";

import { countBienCategories, filterBiens } from "../src/utils/bienFilters.js";

const sampleBiens = [
  {
    id: "bien-1",
    prix: 120000,
    adresse: "1 rue de Lille",
    agence: "Agence A",
    annonceur_type: "professionnel",
    note: "a rappeler",
    blackliste: false,
    favorite: true,
    de_cote: false,
    sans_adresse: false,
    anciennete: 2,
  },
  {
    id: "bien-2",
    prix: 250000,
    adresse: "2 rue de Lens",
    agence: "Agence B",
    annonceur_type: "professionnel",
    note: "",
    blackliste: true,
    favorite: false,
    de_cote: false,
    sans_adresse: false,
    anciennete: 20,
  },
  {
    id: "bien-3",
    prix: 98000,
    adresse: "Adresse non renseignee",
    agence: "",
    annonceur_type: "particulier",
    note: "",
    blackliste: false,
    favorite: false,
    de_cote: true,
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

test("filterBiens can show only favorite biens", () => {
  const result = filterBiens(sampleBiens, {
    showAllBiens: false,
    showFavorites: true,
    showBlacklist: false,
    showSansAdresse: false,
    showNouveaux: false,
  });

  assert.deepEqual(
    result.map((bien) => bien.id),
    ["bien-1"]
  );
});

test("filterBiens can show only set aside biens", () => {
  const result = filterBiens(sampleBiens, {
    showAllBiens: false,
    showFavorites: false,
    showSetAside: true,
    showBlacklist: false,
    showSansAdresse: false,
    showNouveaux: false,
  });

  assert.deepEqual(
    result.map((bien) => bien.id),
    ["bien-3"]
  );
});

test("filterBiens can show only professional biens", () => {
  const result = filterBiens(sampleBiens, {
    showAllBiens: false,
    showProfessionnels: true,
    showBlacklist: false,
    showSansAdresse: false,
    showNouveaux: false,
  });

  assert.deepEqual(
    result.map((bien) => bien.id),
    ["bien-1", "bien-2"]
  );
});

test("filterBiens can show only private biens", () => {
  const result = filterBiens(sampleBiens, {
    showAllBiens: false,
    showParticuliers: true,
    showBlacklist: false,
    showSansAdresse: false,
    showNouveaux: false,
  });

  assert.deepEqual(
    result.map((bien) => bien.id),
    ["bien-3"]
  );
});

test("filterBiens makes professional and private filters override other category filters", () => {
  const result = filterBiens(sampleBiens, {
    showAllBiens: false,
    showParticuliers: true,
    showSansAdresse: true,
    showNouveaux: true,
    showBlacklist: true,
  });

  assert.deepEqual(
    result.map((bien) => bien.id),
    ["bien-3"]
  );
});

test("filterBiens trusts annonceur_type before agence fallback", () => {
  const result = filterBiens(
    [
      {
        id: "bien-4",
        prix: 150000,
        adresse: "7 rue du Bourbonnais",
        agence: "iad France Stessie LEBAS",
        annonceur_type: "particulier",
        note: "",
        blackliste: false,
        favorite: false,
        de_cote: false,
        sans_adresse: false,
        anciennete: 30,
      },
    ],
    {
      showAllBiens: false,
      showParticuliers: true,
      showBlacklist: false,
      showSansAdresse: false,
      showNouveaux: false,
    }
  );

  assert.deepEqual(
    result.map((bien) => bien.id),
    ["bien-4"]
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
    favorites: 1,
    setAside: 1,
    professionnels: 2,
    particuliers: 1,
    blacklist: 1,
    sansAdresse: 1,
    nouveaux: 1,
  });
});
