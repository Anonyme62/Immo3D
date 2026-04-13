export function filterBiens(
  biens,
  {
    search = "",
    showAllBiens = true,
    showFavorites = false,
    showSetAside = false,
    showProfessionnels = false,
    showParticuliers = false,
    showBlacklist = true,
    showSansAdresse = true,
    showNouveaux = true,
  } = {}
) {
  const terme = search.trim().toLowerCase();

  return biens.filter((bien) => {
    const isBlacklisted = !!bien.blackliste;
    const isFavorite = !!bien.favorite;
    const isSetAside = !!bien.de_cote;
    const annonceurType = String(bien.annonceur_type || "").trim().toLowerCase();
    const isProfessionnel =
      annonceurType === "professionnel" ||
      (annonceurType === "" && !!String(bien.agence || "").trim());
    const isParticulier =
      annonceurType === "particulier" ||
      (annonceurType === "" && !String(bien.agence || "").trim());
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

    if (showProfessionnels || showParticuliers) {
      if (isBlacklisted) return false;
      return (
        (showProfessionnels && isProfessionnel) ||
        (showParticuliers && isParticulier)
      );
    }

    if (showAllBiens && !isBlacklisted) {
      return true;
    }

    if (showFavorites && isFavorite) {
      return true;
    }

    if (showSetAside && isSetAside) {
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
    favorites: biens.filter((bien) => !!bien.favorite).length,
    setAside: biens.filter((bien) => !!bien.de_cote).length,
    professionnels: biens.filter((bien) => {
      if (bien.blackliste) return false;
      const annonceurType = String(bien.annonceur_type || "").trim().toLowerCase();
      return (
        annonceurType === "professionnel" ||
        (annonceurType === "" && !!String(bien.agence || "").trim())
      );
    }).length,
    particuliers: biens.filter((bien) => {
      if (bien.blackliste) return false;
      const annonceurType = String(bien.annonceur_type || "").trim().toLowerCase();
      return (
        annonceurType === "particulier" ||
        (annonceurType === "" && !String(bien.agence || "").trim())
      );
    }).length,
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
