import { useEffect, useRef, useState } from "react";
import { formatPrix, formatSurface, getBienBadge } from "../utils/bienFormat";

export default function BiensSidebar({
  desktopHeader = null,
  zoneRecherche,
  recentSearches = [],
  search,
  loading,
  syncError,
  filteredBiens,
  selectedBienId,
  counts,
  filterState,
  onZoneRechercheChange,
  onSelectRecentSearch,
  onSearchChange,
  onSynchronize,
  onFilterChange,
  onSelectBien,
  isMobile = false,
  mobileMode = "full",
}) {
  const itemRefs = useRef(new Map());
  const zoneInputRef = useRef(null);
  const [zoneInputFocused, setZoneInputFocused] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const showControls = !isMobile || mobileMode === "search";
  const showResults = !isMobile || mobileMode === "list";
  const showRecentSearches = showControls && zoneInputFocused && recentSearches.length > 0;
  const showFilters = isMobile || filtersExpanded;

  function handleRecentSearchSelection(recentSearch) {
    onSelectRecentSearch(recentSearch);
    setZoneInputFocused(false);

    window.requestAnimationFrame(() => {
      zoneInputRef.current?.blur();
    });
  }

  useEffect(() => {
    if (isMobile || !showResults || !selectedBienId) return;

    const node = itemRefs.current.get(selectedBienId);
    if (node) {
      node.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [isMobile, selectedBienId, showResults]);

  return (
    <div
      style={{
        width: isMobile ? "100%" : 340,
        height: isMobile ? "auto" : "100%",
        background: "var(--panel-bg)",
        borderRight: isMobile ? "none" : "1px solid var(--border-color)",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        boxSizing: "border-box",
        overflowY: showControls && !showResults ? "auto" : "hidden",
      }}
    >
      {!isMobile && desktopHeader ? (
        <div
          style={{
            padding: "16px 20px 12px 20px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
          }}
        >
          {desktopHeader}
        </div>
      ) : null}

      {showControls ? (
        <>
          <div style={{ padding: isMobile ? 14 : 20, borderBottom: "1px solid #e5e7eb" }}>
            {isMobile ? (
              <div style={{ marginBottom: 12, color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.5 }}>
                Regle ta recherche, ajuste les filtres, puis ouvre la liste pour consulter les biens.
              </div>
            ) : null}

            <input
              ref={zoneInputRef}
              value={zoneRecherche}
              onChange={(event) => onZoneRechercheChange(event.target.value)}
              onFocus={() => setZoneInputFocused(true)}
              onBlur={() => window.setTimeout(() => setZoneInputFocused(false), 120)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSynchronize();
              }}
              placeholder="Ville ou code postal (ex : Mazingarbe ou 62670)"
              style={topInputStyle(isMobile)}
            />

            {showRecentSearches ? (
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {recentSearches.map((recentSearch) => (
                  <button
                    key={recentSearch}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleRecentSearchSelection(recentSearch)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 999,
                      border: "1px solid var(--border-color)",
                      background: "var(--panel-muted-bg)",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {recentSearch}
                  </button>
                ))}
              </div>
            ) : null}
            <button onClick={onSynchronize} style={syncButtonStyle(isMobile)}>
              {loading ? "Chargement..." : "Synchroniser Yanport"}
            </button>

            {syncError ? (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "#fee2e2",
                  color: "#991b1b",
                  fontSize: 13,
                  lineHeight: 1.45,
                }}
              >
                {syncError}
              </div>
            ) : null}
          </div>

          <div style={{ padding: isMobile ? "14px 14px 6px 14px" : "16px 20px 8px 20px" }}>
            <button
              type="button"
              onClick={() => setFiltersExpanded((value) => !value)}
              style={{ ...filtersToggleStyle(), display: isMobile ? "none" : "flex" }}
            >
              <span style={{ fontWeight: 700 }}>Filtres</span>
              <span
                style={{
                  fontSize: 18,
                  lineHeight: 1,
                  transform: filtersExpanded ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 180ms ease",
                }}
              >
                ›
              </span>
            </button>

            {showFilters ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr",
                  gap: isMobile ? 10 : 0,
                  marginTop: 12,
                }}
              >
                <FilterRow
                  label={`Tous les biens (${counts.allBiens})`}
                  checked={filterState.showAllBiens}
                  onChange={(checked) => onFilterChange("showAllBiens", checked)}
                  isMobile={isMobile}
                />
                <FilterRow
                  label={`Favoris (${counts.favorites})`}
                  checked={filterState.showFavorites}
                  onChange={(checked) => onFilterChange("showFavorites", checked)}
                  isMobile={isMobile}
                />
                <FilterRow
                  label={`Mettre de cote (${counts.setAside})`}
                  checked={filterState.showSetAside}
                  onChange={(checked) => onFilterChange("showSetAside", checked)}
                  isMobile={isMobile}
                />
                <FilterRow
                  label={`Nouveaux < 7 jours (${counts.nouveaux})`}
                  checked={filterState.showNouveaux}
                  onChange={(checked) => onFilterChange("showNouveaux", checked)}
                  isMobile={isMobile}
                />
                <FilterRow
                  label={`Sans adresses (${counts.sansAdresse})`}
                  checked={filterState.showSansAdresse}
                  onChange={(checked) => onFilterChange("showSansAdresse", checked)}
                  isMobile={isMobile}
                />
                <FilterRow
                  label={`Afficher les blacklistes (${counts.blacklist})`}
                  checked={filterState.showBlacklist}
                  onChange={(checked) => onFilterChange("showBlacklist", checked)}
                  compact
                  isMobile={isMobile}
                />
                <FilterRow
                  label={`Professionnels (${counts.professionnels})`}
                  checked={filterState.showProfessionnels}
                  onChange={(checked) => onFilterChange("showProfessionnels", checked)}
                  isMobile={isMobile}
                />
                <FilterRow
                  label={`Particuliers (${counts.particuliers})`}
                  checked={filterState.showParticuliers}
                  onChange={(checked) => onFilterChange("showParticuliers", checked)}
                  isMobile={isMobile}
                />
              </div>
            ) : null}
          </div>

          {isMobile ? (
            <div style={{ padding: "6px 14px 14px 14px" }}>
              <div
                style={{
                  background: "#f9fafb",
                  border: "1px solid var(--border-color)",
                  borderRadius: 18,
                  padding: 14,
                  color: "var(--text-secondary)",
                  lineHeight: 1.55,
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                  {filteredBiens.length} biens visibles
                </div>
                <div>Utilise l'onglet Liste pour parcourir les annonces et l'onglet Bien pour les details.</div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {showResults ? (
        <>
          <div
            style={{
              padding: isMobile ? "10px 14px 0 14px" : "12px 20px 0 20px",
            }}
          >
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Filtrer : agence, adresse, prix..."
              style={topInputStyle(isMobile)}
            />
          </div>

          <div
            style={{
              padding: isMobile ? "10px 14px 6px 14px" : "12px 20px 8px 20px",
              fontWeight: 700,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Biens ({filteredBiens.length})</span>
            {isMobile ? (
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                Touchez une carte
              </span>
            ) : null}
          </div>

          <div
            style={{
              padding: isMobile ? "0 14px 14px 14px" : "0 16px 16px 16px",
              overflowY: "auto",
              flex: 1,
              minHeight: 0,
              paddingBottom: isMobile ? 28 : 16,
            }}
          >
            {filteredBiens.length === 0 ? (
              <div
                style={{
                  background: "var(--panel-bg)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 16,
                  padding: 16,
                  color: "var(--text-muted)",
                }}
              >
                Aucun bien trouve
              </div>
            ) : (
              filteredBiens.map((bien) => {
                const badge = getBienBadge(bien);
                const isSelected = selectedBienId === bien.id;

                return (
                  <div
                    key={bien.id}
                    ref={(node) => {
                      if (node) {
                        itemRefs.current.set(bien.id, node);
                      } else {
                        itemRefs.current.delete(bien.id);
                      }
                    }}
                    onClick={() => onSelectBien(bien)}
                    style={{
                      background: isSelected ? "var(--panel-subtle)" : "var(--panel-bg)",
                      border: isSelected ? "1px solid var(--text-primary)" : "1px solid var(--border-color)",
                      borderRadius: 18,
                      padding: isMobile ? 14 : 16,
                      marginBottom: 12,
                      cursor: "pointer",
                      boxShadow: isSelected ? "0 4px 18px rgba(0,0,0,0.06)" : "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 10,
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{formatPrix(bien.prix)}</div>

                      <div
                        style={{ display: "flex", alignItems: "center", gap: 8 }}
                      >
                        {bien.favorite ? (
                          <span style={{ fontSize: 18, lineHeight: 1 }} title="Favori">
                            ★
                          </span>
                        ) : null}
                        <span
                          style={{
                            ...badge.style,
                            padding: "6px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {badge.label}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        color: "var(--text-secondary)",
                        fontSize: 14,
                        lineHeight: 1.45,
                      }}
                    >
                      {bien.adresse || ""}
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        color: "var(--text-muted)",
                        fontSize: 13,
                      }}
                    >
                      {formatSurface(bien.surface)} <span style={{ margin: "0 8px" }}>•</span>
                      {bien.anciennete !== null && bien.anciennete !== undefined
                        ? `${bien.anciennete} jours`
                        : "? jours"}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function FilterRow({ label, checked, onChange, compact = false }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px",
        border: "1px solid var(--border-color)",
        background: "var(--panel-muted-bg)",
        borderRadius: 14,
        marginBottom: compact ? 4 : 10,
        cursor: "pointer",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1.35, color: "var(--text-primary)" }}>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ width: 18, height: 18, flexShrink: 0 }}
      />
    </label>
  );
}

function filtersToggleStyle() {
  return {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid var(--border-color)",
    background: "var(--panel-muted-bg)",
    color: "var(--text-primary)",
    cursor: "pointer",
  };
}

function topInputStyle(isMobile) {
  return {
    width: "100%",
    marginTop: 0,
    padding: isMobile ? "13px 14px" : "12px 14px",
    borderRadius: 14,
    border: "1px solid var(--border-color)",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
    outline: "none",
    fontSize: 14,
    boxSizing: "border-box",
  };
}

function syncButtonStyle(isMobile) {
  return {
    width: "100%",
    marginTop: 12,
    padding: isMobile ? "15px 16px" : "14px 16px",
    borderRadius: 16,
    border: "none",
    background: "#111111",
    color: "white",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  };
}
