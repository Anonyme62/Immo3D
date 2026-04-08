export function formatPrix(prix) {
  if (prix === null || prix === undefined || prix === "") return "N/A";
  return `${Number(prix).toLocaleString("fr-FR")} EUR`;
}

export function formatSurface(surface) {
  if (surface === null || surface === undefined || surface === "") return "N/A";
  return `${surface} m2`;
}

export function getBienBadge(bien) {
  if (bien.blackliste) {
    return {
      label: "blackliste",
      style: {
        background: "#fee2e2",
        color: "#991b1b",
        border: "1px solid #fecaca",
      },
    };
  }

  if (bien.sans_adresse) {
    return {
      label: "sans adresse",
      style: {
        background: "#fef3c7",
        color: "#92400e",
        border: "1px solid #fde68a",
      },
    };
  }

  if (bien.statut === "nouveau") {
    return {
      label: "nouveau",
      style: {
        background: "#dcfce7",
        color: "#166534",
        border: "1px solid #bbf7d0",
      },
    };
  }

  return {
    label: "actif",
    style: {
      background: "#f3f4f6",
      color: "#374151",
      border: "1px solid #e5e7eb",
    },
  };
}

export function getAnnonceLinks(selectedBien) {
  if (!selectedBien) return [];

  return Object.entries(selectedBien)
    .filter(([key, value]) => {
      if (!value || typeof value !== "string") return false;

      const keyLower = key.toLowerCase();
      const valueLower = value.toLowerCase();
      const ressembleAUnLien =
        valueLower.startsWith("http://") || valueLower.startsWith("https://");
      const estUnChampAnnonce =
        keyLower.includes("lien") ||
        keyLower.includes("url") ||
        keyLower.includes("annonce") ||
        keyLower.includes("portail") ||
        keyLower.includes("site") ||
        keyLower.includes("leboncoin") ||
        keyLower.includes("yanport") ||
        keyLower.includes("bienici") ||
        keyLower.includes("paruvendu") ||
        keyLower.includes("seloger") ||
        keyLower.includes("logicimmo") ||
        keyLower.includes("figaro");

      return ressembleAUnLien && estUnChampAnnonce;
    })
    .map(([key, value]) => {
      const keyLower = key.toLowerCase();
      const labels = {
        lien_yanport: "Yanport",
        url_yanport: "Yanport",
        lien_leboncoin: "Leboncoin",
        url_leboncoin: "Leboncoin",
        lien_bienici: "Bien'ici",
        url_bienici: "Bien'ici",
        lien_paruvendu: "ParuVendu",
        url_paruvendu: "ParuVendu",
        lien_seloger: "SeLoger",
        url_seloger: "SeLoger",
        lien_logicimmo: "Logic-Immo",
        url_logicimmo: "Logic-Immo",
        lien_figaro: "Figaro Immo",
        url_figaro: "Figaro Immo",
        lien_annonce: "Annonce",
      };

      return {
        key,
        url: value,
        label:
          labels[keyLower] ||
          key
            .replace(/^lien_/i, "")
            .replace(/^url_/i, "")
            .replace(/_/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase()),
      };
    })
    .filter((link) => !(link.key === "lien_annonce" && selectedBien?.lien_leboncoin))
    .sort((a, b) => {
      const order = {
        lien_yanport: 1,
        url_yanport: 1,
        lien_leboncoin: 2,
        url_leboncoin: 2,
        lien_bienici: 3,
        url_bienici: 3,
        lien_seloger: 4,
        url_seloger: 4,
        lien_paruvendu: 5,
        url_paruvendu: 5,
        lien_logicimmo: 6,
        url_logicimmo: 6,
        lien_figaro: 7,
        url_figaro: 7,
        lien_annonce: 99,
      };

      return (order[a.key.toLowerCase()] ?? 50) - (order[b.key.toLowerCase()] ?? 50);
    });
}

export function getSelectedBienPhotos(selectedBien) {
  if (!selectedBien) return [];

  const photosLeboncoin = Array.isArray(selectedBien?.photos_leboncoin)
    ? selectedBien.photos_leboncoin
    : [];

  if (photosLeboncoin.length > 0) {
    return photosLeboncoin.filter(
      (photo) => typeof photo === "string" && photo.trim() !== ""
    );
  }

  if (
    selectedBien?.lien_leboncoin &&
    Array.isArray(selectedBien?.photos)
  ) {
    return selectedBien.photos.filter(
      (photo) => typeof photo === "string" && photo.trim() !== ""
    );
  }

  return [];
}
