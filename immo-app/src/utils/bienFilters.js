export function filterBiens(
  biens,
  {
    search = "",
    showAllBiens = true,
    showBlacklist = true,
    showSansAdresse = true,
    showNouveaux = true,
  } = {}
) {
  const terme = search.trim().toLowerCase();

  return biens.filter((bien) => {
    const isBlacklisted = !!bien.blackliste;
    const isSansAdresse = !!bien.sans_adresse;
    const anciennete = bien.anciennete;
    const isNouveau =
      anciennete !== null && anciennete !== undefined && anciennete < 7;

    const correspondAuTexte =
      !terme ||
      [bien.prix, bien.adresse, bien.agence, bien.id, bien.note]
        .join(" ")
        .toLowerCase()
        .includes(terme);

    if (!correspondAuTexte) return false;

    if (
      showAllBiens &&
      !isBlacklisted
    ) {
      return true;
    }

    if (showBlacklist && isBlacklisted) {
      return true;
    }

    if (showSansAdresse && isSansAdresse) {
      return true;
    }

    if (showNouveaux && isNouveau) {
      return true;
    }

    return false;
  });
}

export function countBienCategories(biens) {
  return {
    allBiens: biens.filter((bien) => !bien.blackliste).length,
    blacklist: biens.filter((bien) => !!bien.blackliste).length,
    sansAdresse: biens.filter((bien) => !!bien.sans_adresse).length,
    nouveaux: biens.filter(
      (bien) =>
        bien.anciennete !== null &&
        bien.anciennete !== undefined &&
        bien.anciennete < 7
    ).length,
  };
}
