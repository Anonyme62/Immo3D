import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  addBlacklist,
  createCustomMarker,
  deleteCustomMarker,
  getAuthStatus,
  getBiens,
  getCustomMarkers,
  loginYanport,
  logoutYanport,
  removeBlacklist,
  saveNote,
  updateCustomMarker,
} from "./api";
import AppMenu from "./components/AppMenu";
import BiensSidebar from "./components/BiensSidebar";
import CesiumMap from "./CesiumMap";
import { CESIUM_ION_TOKEN } from "./config";
import LoginScreen from "./components/LoginScreen";
import SelectedBienPanel from "./components/SelectedBienPanel";
import { countBienCategories, filterBiens } from "./utils/bienFilters";
import { downloadKmlExport } from "./utils/kmlExport";

function App() {
  const noteTimerRef = useRef(null);
  const isBackgroundRefreshingRef = useRef(false);
  const LAST_SEARCH_STORAGE_KEY = "immo3d_last_search_zone";
  const THEME_STORAGE_KEY = "immo3d_theme_mode";

  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 980);
  const [themeMode, setThemeMode] = useState(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === "dark" ? "dark" : "light";
  });
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const [biens, setBiens] = useState([]);
  const [selectedBien, setSelectedBien] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [search, setSearch] = useState("");
  const [zoneRecherche, setZoneRecherche] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [noteStatus, setNoteStatus] = useState("");
  const [mapMode, setMapMode] = useState("osm");
  const [syncVersion, setSyncVersion] = useState(0);
  const [focusBienId, setFocusBienId] = useState(null);
  const [focusBienVersion, setFocusBienVersion] = useState(0);
  const [mobilePanel, setMobilePanel] = useState("search");
  const [isMapExpandedMobile, setIsMapExpandedMobile] = useState(false);
  const [customMarkers, setCustomMarkers] = useState([]);

  const [showAllBiens, setShowAllBiens] = useState(true);
  const [showBlacklist, setShowBlacklist] = useState(true);
  const [showSansAdresse, setShowSansAdresse] = useState(true);
  const [showNouveaux, setShowNouveaux] = useState(true);

  function scrollPageToTop(behavior = "auto") {
    window.scrollTo({ top: 0, left: 0, behavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    const savedEmail = localStorage.getItem("yanport_email");
    const savedRemember = localStorage.getItem("yanport_remember_me");
    const savedSearchZone = localStorage.getItem(LAST_SEARCH_STORAGE_KEY);

    setLoginEmail(savedEmail || "");
    setRememberMe(savedRemember === "true");
    setLoginPassword("");
    setZoneRecherche(savedSearchZone || "");
  }, []);

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    scrollPageToTop("auto");
  }, []);

  useEffect(() => {
    function forceTop() {
      scrollPageToTop("auto");
      window.requestAnimationFrame(() => {
        scrollPageToTop("auto");
        window.requestAnimationFrame(() => {
          scrollPageToTop("auto");
        });
      });
    }

    function handlePageShow() {
      forceTop();
    }

    function handleLoad() {
      forceTop();
    }

    const timeoutOne = window.setTimeout(forceTop, 0);
    const timeoutTwo = window.setTimeout(forceTop, 120);
    const timeoutThree = window.setTimeout(forceTop, 320);
    const timeoutFour = window.setTimeout(forceTop, 700);
    const timeoutFive = window.setTimeout(forceTop, 1200);
    const interval = window.setInterval(forceTop, 180);

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("load", handleLoad);

    const stopInterval = window.setTimeout(() => {
      window.clearInterval(interval);
    }, 1600);

    return () => {
      window.clearTimeout(timeoutOne);
      window.clearTimeout(timeoutTwo);
      window.clearTimeout(timeoutThree);
      window.clearTimeout(timeoutFour);
      window.clearTimeout(timeoutFive);
      window.clearTimeout(stopInterval);
      window.clearInterval(interval);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("load", handleLoad);
    };
  }, []);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 980);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    async function chargerReperesPersonnels() {
      if (!isLoggedIn) {
        setCustomMarkers([]);
        return;
      }

      try {
        const data = await getCustomMarkers();
        setCustomMarkers(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Erreur chargement reperes perso :", error);
      }
    }

    chargerReperesPersonnels();
  }, [isLoggedIn]);

  async function refreshBiensInBackground() {
    if (!isLoggedIn || isBackgroundRefreshingRef.current || loading) return;

    const nextZoneRecherche = zoneRecherche.trim();
    if (!nextZoneRecherche) return;

    isBackgroundRefreshingRef.current = true;

    try {
      const data = await getBiens(nextZoneRecherche);
      const nextBiens = Array.isArray(data) ? data : [];
      const currentSelectedBienId = selectedBien?.id ?? null;
      const isEditingCurrentNote =
        currentSelectedBienId !== null &&
        noteDraft !== (selectedBien?.note || "");

      setBiens(nextBiens);

      if (!currentSelectedBienId) {
        return;
      }

      const refreshedSelectedBien =
        nextBiens.find((bien) => bien.id === currentSelectedBienId) || null;

      if (refreshedSelectedBien) {
        setSelectedBien(refreshedSelectedBien);
        if (!isEditingCurrentNote) {
          setNoteDraft(refreshedSelectedBien.note || "");
        }
      }
    } catch (error) {
      console.error("Erreur rafraichissement arriere-plan :", error);

      if (error.status === 401) {
        setIsLoggedIn(false);
        setBiens([]);
        setSelectedBien(null);
        setLoginError("Session expiree. Merci de vous reconnecter.");
      }
    } finally {
      isBackgroundRefreshingRef.current = false;
    }
  }

  useEffect(() => {
    async function verifierAuth() {
      try {
        const data = await getAuthStatus();
        setIsLoggedIn(!!data?.authenticated);
      } catch (error) {
        console.error("Erreur auth status :", error);
        setIsLoggedIn(false);
      } finally {
        setAuthChecked(true);
      }
    }

    verifierAuth();
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      chargerBiens();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;

    function handleAppVisible() {
      if (document.visibilityState === "visible") {
        refreshBiensInBackground();
      }
    }

    function handleWindowFocus() {
      refreshBiensInBackground();
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshBiensInBackground();
      }
    }, 10000);

    document.addEventListener("visibilitychange", handleAppVisible);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleAppVisible);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [isLoggedIn, zoneRecherche, loading, selectedBien?.id, selectedBien?.note, noteDraft]);

  useEffect(() => {
    return () => {
      if (noteTimerRef.current) {
        clearTimeout(noteTimerRef.current);
      }
    };
  }, []);

  const biensFiltres = useMemo(() => {
    return filterBiens(biens, {
      search,
      showAllBiens,
      showBlacklist,
      showSansAdresse,
      showNouveaux,
      selectedBienId: selectedBien?.id ?? null,
    });
  }, [biens, search, showAllBiens, showBlacklist, showSansAdresse, showNouveaux, selectedBien?.id]);

  const counts = useMemo(() => countBienCategories(biens), [biens]);

  useEffect(() => {
    if (biensFiltres.length === 0) {
      setSelectedBien(null);
      return;
    }

    if (!selectedBien) {
      setSelectedBien(biensFiltres[0]);
      return;
    }

    const selectedStillVisible = biensFiltres.find((bien) => bien.id === selectedBien.id);
    if (!selectedStillVisible) {
      setSelectedBien(biensFiltres[0]);
    } else {
      setSelectedBien(selectedStillVisible);
    }
  }, [biensFiltres, selectedBien]);

  useEffect(() => {
    setNoteDraft(selectedBien?.note || "");
    setNoteStatus("");
  }, [selectedBien]);

  useEffect(() => {
    if (!isMobile) {
      setMobilePanel("search");
      setIsMapExpandedMobile(false);
      return;
    }

    if (!selectedBien && mobilePanel === "detail") {
      setMobilePanel("list");
    }
  }, [isMobile, mobilePanel, selectedBien]);

  async function chargerBiens() {
    if (!isLoggedIn) return;

    const nextZoneRecherche = zoneRecherche.trim();
    if (!nextZoneRecherche) {
      setSyncError("Renseigne une ville ou un code postal avant la synchronisation.");
      setBiens([]);
      setSelectedBien(null);
      return;
    }

    setLoading(true);
    setSyncError("");

    try {
      const data = await getBiens(nextZoneRecherche);
      setBiens(Array.isArray(data) ? data : []);
      setSelectedBien(null);
      setSyncError("");
      setSyncVersion((value) => value + 1);
      localStorage.setItem(LAST_SEARCH_STORAGE_KEY, nextZoneRecherche);

      setFocusBienId(null);

      if (isMobile) {
        setMobilePanel("list");
      }
    } catch (error) {
      console.error("Erreur chargement biens :", error);

      if (error.status === 401) {
        setIsLoggedIn(false);
        setBiens([]);
        setSelectedBien(null);
        setLoginError("Session expiree. Merci de vous reconnecter.");
      } else {
        setBiens([]);
        setSelectedBien(null);
        setSyncError(error.message || "Impossible de charger les biens.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function seConnecter() {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError("Renseigne ton identifiant Yanport et ton mot de passe.");
      return;
    }

    setLoginLoading(true);
    setLoginError("");

    try {
      await loginYanport(loginEmail, loginPassword);
      localStorage.setItem("yanport_email", loginEmail);
      localStorage.setItem("yanport_remember_me", rememberMe ? "true" : "false");
      setIsLoggedIn(true);
      setLoginPassword("");
      setLoginError("");
      setSyncError("");
    } catch (error) {
      console.error("Erreur login :", error);
      setLoginError(error.message || "Erreur inconnue");
    } finally {
      setLoginLoading(false);
    }
  }

  async function seDeconnecter() {
    try {
      await logoutYanport();
    } catch (error) {
      console.error("Erreur logout :", error);
    }

    if (noteTimerRef.current) {
      clearTimeout(noteTimerRef.current);
      noteTimerRef.current = null;
    }

    setIsLoggedIn(false);
    setBiens([]);
    setSelectedBien(null);
    setLoginError("");
    setLoginPassword("");
    setNoteDraft("");
    setCustomMarkers([]);
  }

  async function blacklisterBien() {
    if (!selectedBien) return;

    try {
      await addBlacklist(selectedBien.id, selectedBien.surface, selectedBien.prix);

      setBiens((prevBiens) =>
        prevBiens.map((bien) =>
          bien.id === selectedBien.id
            ? { ...bien, blackliste: true, statut: "blackliste" }
            : bien
        )
      );

      setSelectedBien((prev) =>
        prev ? { ...prev, blackliste: true, statut: "blackliste" } : prev
      );
    } catch (error) {
      console.error("Erreur blacklist :", error);
      alert(error.message || "Erreur lors de l'ajout a la blacklist");
    }
  }

  async function retirerBlacklist() {
    if (!selectedBien) return;

    try {
      await removeBlacklist(selectedBien.id);

      setBiens((prevBiens) =>
        prevBiens.map((bien) => {
          if (bien.id !== selectedBien.id) return bien;
          const nouveauStatut = bien.anciennete < 7 ? "nouveau" : "actif";
          return { ...bien, blackliste: false, statut: nouveauStatut };
        })
      );

      setSelectedBien((prev) => {
        if (!prev) return prev;
        const nouveauStatut = prev.anciennete < 7 ? "nouveau" : "actif";
        return { ...prev, blackliste: false, statut: nouveauStatut };
      });
    } catch (error) {
      console.error("Erreur suppression blacklist :", error);
      alert(error.message || "Erreur lors du retrait de la blacklist");
    }
  }

  function handleNoteChange(value) {
    if (!selectedBien) return;

    const bienId = selectedBien.id;
    setNoteDraft(value);
    setNoteStatus("Enregistrement...");

    setBiens((prevBiens) =>
      prevBiens.map((bien) => (bien.id === bienId ? { ...bien, note: value } : bien))
    );

    setSelectedBien((prev) => (prev ? { ...prev, note: value } : prev));

    if (noteTimerRef.current) {
      clearTimeout(noteTimerRef.current);
    }

    noteTimerRef.current = setTimeout(async () => {
      try {
        await saveNote(bienId, value);
        setNoteStatus("Note enregistree");
      } catch (error) {
        console.error("Erreur sauvegarde note :", error);
        setNoteStatus(error.message || "Erreur d'enregistrement");
      }
    }, 600);
  }

  function handleFilterChange(key, value) {
    const setters = {
      showAllBiens: setShowAllBiens,
      showBlacklist: setShowBlacklist,
      showSansAdresse: setShowSansAdresse,
      showNouveaux: setShowNouveaux,
    };

    setters[key]?.(value);
  }

  function toggleMapMode() {
    if (!CESIUM_ION_TOKEN) return;
    setMapMode((value) => (value === "google3d" ? "osm" : "google3d"));
  }

  function handleExportKml() {
    downloadKmlExport({
      zoneRecherche,
      biens: biensFiltres,
      customMarkers,
    });
  }

  function handleSidebarSelection(bien) {
    setSelectedBien(bien);
    if (bien.lat != null && bien.lon != null) {
      setFocusBienId(bien.id);
      setFocusBienVersion((value) => value + 1);
    } else {
      setFocusBienId(null);
    }

    if (isMobile) {
      setMobilePanel("detail");
    }
  }

  async function handleAddCustomMarker(marker) {
    const created = await createCustomMarker(marker.lat, marker.lon, marker.note);
    setCustomMarkers((prev) => [created, ...prev]);
  }

  async function handleUpdateCustomMarker(markerId, note) {
    const updated = await updateCustomMarker(markerId, note);
    setCustomMarkers((prev) =>
      prev.map((marker) => (marker.id === markerId ? updated : marker))
    );
  }

  async function handleDeleteCustomMarker(markerId) {
    await deleteCustomMarker(markerId);
    setCustomMarkers((prev) => prev.filter((marker) => marker.id !== markerId));
  }

  if (!authChecked) {
    return (
      <div
        style={{
          ...getThemeVariables(themeMode),
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--app-bg)",
          color: "var(--text-primary)",
          fontFamily: "Arial, sans-serif",
        }}
      >
        Verification de la session...
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <LoginScreen
        themeMode={themeMode}
        loginEmail={loginEmail}
        loginPassword={loginPassword}
        loginError={loginError}
        loginLoading={loginLoading}
        rememberMe={rememberMe}
        onEmailChange={setLoginEmail}
        onPasswordChange={setLoginPassword}
        onRememberMeChange={setRememberMe}
        onSubmit={seConnecter}
      />
    );
  }

  return (
      <div
        style={{
          ...getThemeVariables(themeMode),
          height: isMobile ? "auto" : "100vh",
          minHeight: "100svh",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          fontFamily: "Arial, sans-serif",
          background: "var(--app-bg)",
          color: "var(--text-primary)",
          overflow: isMobile ? "visible" : "hidden",
          paddingBottom: isMobile && !isMapExpandedMobile ? 86 : 0,
          boxSizing: "border-box",
        }}
      >
      {!isMobile ? (
        <BiensSidebar
          desktopHeader={
            <AppMenu
              onLogout={seDeconnecter}
              onExportKml={handleExportKml}
              themeMode={themeMode}
              onToggleTheme={() =>
                setThemeMode((value) => (value === "dark" ? "light" : "dark"))
              }
              compact
            />
          }
          zoneRecherche={zoneRecherche}
          search={search}
          loading={loading}
          syncError={syncError}
          filteredBiens={biensFiltres}
          selectedBienId={selectedBien?.id ?? null}
          counts={counts}
          filterState={{
            showAllBiens,
            showBlacklist,
            showSansAdresse,
            showNouveaux,
          }}
          onZoneRechercheChange={setZoneRecherche}
          onSearchChange={setSearch}
          onSynchronize={chargerBiens}
          onFilterChange={handleFilterChange}
          onSelectBien={handleSidebarSelection}
          isMobile={false}
        />
      ) : null}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {!isMobile ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "row",
              minHeight: 0,
            }}
          >
            <div
              style={{
                flex: 1,
                position: "relative",
                minHeight: 0,
                overflow: "hidden",
                background: "var(--map-shell-bg)",
              }}
            >
              <CesiumMap
                biens={biensFiltres}
                customMarkers={customMarkers}
                selectedBienId={selectedBien?.id ?? null}
                setSelectedBien={(bien) => {
                  setSelectedBien(bien);
                }}
                onAddCustomMarker={handleAddCustomMarker}
                onUpdateCustomMarker={handleUpdateCustomMarker}
                onDeleteCustomMarker={handleDeleteCustomMarker}
                mapMode={mapMode}
                canUseGoogle3D={Boolean(CESIUM_ION_TOKEN)}
              onToggleMapMode={toggleMapMode}
              isMobile={false}
              syncVersion={syncVersion}
              focusBienId={focusBienId}
              focusBienVersion={focusBienVersion}
              mobilePanel="desktop"
              />
            </div>

            <SelectedBienPanel
              selectedBien={selectedBien}
              noteDraft={noteDraft}
              noteStatus={noteStatus}
              onNoteChange={handleNoteChange}
              onAddBlacklist={blacklisterBien}
              onRemoveBlacklist={retirerBlacklist}
              isMobile={false}
            />
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: "block",
              minHeight: 0,
            }}
          >
          <div
            style={{
              position: "relative",
              minHeight: "100svh",
              height: "100svh",
              overflow: "hidden",
              background: "var(--map-shell-bg)",
              ...(isMapExpandedMobile
                ? {
                    position: "fixed",
                    inset: 0,
                    zIndex: 50,
                  }
                : {}),
            }}
          >
            <CesiumMap
              biens={biensFiltres}
              customMarkers={customMarkers}
              selectedBienId={selectedBien?.id ?? null}
              setSelectedBien={(bien) => {
                setSelectedBien(bien);
                setMobilePanel("detail");
              }}
              onAddCustomMarker={handleAddCustomMarker}
              onUpdateCustomMarker={handleUpdateCustomMarker}
              onDeleteCustomMarker={handleDeleteCustomMarker}
              mapMode={mapMode}
              canUseGoogle3D={Boolean(CESIUM_ION_TOKEN)}
              onToggleMapMode={toggleMapMode}
              isMobile
              syncVersion={syncVersion}
              focusBienId={focusBienId}
              focusBienVersion={focusBienVersion}
              mobilePanel={mobilePanel}
              isMobileMapExpanded={isMapExpandedMobile}
              onToggleMobileMapExpanded={() =>
                setIsMapExpandedMobile((value) => !value)
              }
              topLeftOverlay={
                <AppMenu
                  onLogout={seDeconnecter}
                  onExportKml={handleExportKml}
                  themeMode={themeMode}
                  onToggleTheme={() =>
                    setThemeMode((value) => (value === "dark" ? "light" : "dark"))
                  }
                  isMobile
                />
              }
            />
          </div>

          {!isMapExpandedMobile ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                minHeight: "calc(100svh - 140px)",
                background: "var(--panel-bg)",
                borderTop: "1px solid var(--border-color)",
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                marginTop: -10,
                position: "relative",
                zIndex: 1,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "12px 14px 6px 14px",
                  borderBottom: "1px solid var(--border-soft)",
                  background: "var(--panel-bg)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Zone active</div>
                    <div style={{ fontWeight: 700 }}>{zoneRecherche || "Aucune zone"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Resultats</div>
                    <div style={{ fontWeight: 700 }}>{biensFiltres.length} biens</div>
                  </div>
                </div>

                {selectedBien ? (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "10px 12px",
                      background: "var(--panel-subtle)",
                      border: "1px solid var(--border-color)",
                      borderRadius: 14,
                    }}
                  >
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Bien selectionne</div>
                    <div
                      style={{
                        fontWeight: 700,
                        marginTop: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {selectedBien.adresse || "Adresse non renseignee"}
                    </div>
                  </div>
                ) : null}
              </div>

              <div style={{ minHeight: 0, paddingBottom: 10 }}>
                {mobilePanel === "search" ? (
                  <BiensSidebar
                    zoneRecherche={zoneRecherche}
                    search={search}
                    loading={loading}
                    syncError={syncError}
                    filteredBiens={biensFiltres}
                    selectedBienId={selectedBien?.id ?? null}
                    counts={counts}
                    filterState={{
                      showAllBiens,
                      showBlacklist,
                      showSansAdresse,
                      showNouveaux,
                    }}
                    onZoneRechercheChange={setZoneRecherche}
                    onSearchChange={setSearch}
                    onSynchronize={chargerBiens}
                    onFilterChange={handleFilterChange}
                    onSelectBien={handleSidebarSelection}
                    isMobile
                    mobileMode="search"
                  />
                ) : mobilePanel === "list" ? (
                  <BiensSidebar
                    zoneRecherche={zoneRecherche}
                    search={search}
                    loading={loading}
                    syncError={syncError}
                    filteredBiens={biensFiltres}
                    selectedBienId={selectedBien?.id ?? null}
                    counts={counts}
                    filterState={{
                      showAllBiens,
                      showBlacklist,
                      showSansAdresse,
                      showNouveaux,
                    }}
                    onZoneRechercheChange={setZoneRecherche}
                    onSearchChange={setSearch}
                    onSynchronize={chargerBiens}
                    onFilterChange={handleFilterChange}
                    onSelectBien={handleSidebarSelection}
                    isMobile
                    mobileMode="list"
                  />
                ) : (
                  <SelectedBienPanel
                    selectedBien={selectedBien}
                    noteDraft={noteDraft}
                    noteStatus={noteStatus}
                    onNoteChange={handleNoteChange}
                    onAddBlacklist={blacklisterBien}
                    onRemoveBlacklist={retirerBlacklist}
                    isMobile
                    onBackToList={() => setMobilePanel("list")}
                  />
                )}
              </div>
            </div>
          ) : null}
        </div>
        )}
      </div>

      {isMobile && !isMapExpandedMobile ? (
      <MobileBottomNav
          themeMode={themeMode}
          mobilePanel={mobilePanel}
          hasSelection={Boolean(selectedBien)}
          onChangePanel={setMobilePanel}
        />
      ) : null}
    </div>
  );
}

export default App;

function mobileTabButtonStyle(active) {
  return {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 999,
    border: active ? "1px solid #111827" : "1px solid #e5e7eb",
    background: active ? "#111827" : "#ffffff",
    color: active ? "#ffffff" : "#111827",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  };
}

function MobileBottomNav({ mobilePanel, hasSelection, onChangePanel, themeMode }) {
  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: 10,
        background:
          themeMode === "dark" ? "rgba(17, 24, 39, 0.94)" : "rgba(255,255,255,0.96)",
        border: "1px solid var(--border-color)",
        borderRadius: 22,
        boxShadow: "0 10px 30px rgba(17, 24, 39, 0.12)",
        padding: 8,
        display: "flex",
        gap: 8,
        zIndex: 20,
        backdropFilter: "blur(10px)",
      }}
    >
      <button
        onClick={() => onChangePanel("search")}
        style={mobileNavButtonStyle(mobilePanel === "search", themeMode)}
      >
        <span style={mobileNavLabelStyle()}>Recherche</span>
        <span style={mobileNavHintStyle()}>zone et filtres</span>
      </button>

      <button
        onClick={() => onChangePanel("list")}
        style={mobileNavButtonStyle(mobilePanel === "list", themeMode)}
      >
        <span style={mobileNavLabelStyle()}>Liste</span>
        <span style={mobileNavHintStyle()}>annonces</span>
      </button>

      <button
        onClick={() => onChangePanel(hasSelection ? "detail" : "list")}
        style={mobileNavButtonStyle(mobilePanel === "detail", themeMode)}
      >
        <span style={mobileNavLabelStyle()}>Bien</span>
        <span style={mobileNavHintStyle()}>{hasSelection ? "detail" : "selection"}</span>
      </button>
    </div>
  );
}

function mobileNavButtonStyle(active, themeMode) {
  return {
    flex: 1,
    border: active ? "1px solid var(--text-primary)" : "1px solid transparent",
    background: active
      ? "var(--text-primary)"
      : themeMode === "dark"
        ? "rgba(255,255,255,0.02)"
        : "transparent",
    color: active ? "var(--panel-bg)" : "var(--text-primary)",
    borderRadius: 16,
    padding: "10px 8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    cursor: "pointer",
    minWidth: 0,
  };
}

function getThemeVariables(themeMode) {
  if (themeMode === "dark") {
    return {
      "--app-bg": "#0b1220",
      "--map-shell-bg": "#09101c",
      "--panel-bg": "#111827",
      "--panel-subtle": "#182233",
      "--panel-muted-bg": "#0f172a",
      "--border-color": "#243042",
      "--border-soft": "#1b2535",
      "--text-primary": "#f3f4f6",
      "--text-secondary": "#d1d5db",
      "--text-muted": "#94a3b8",
      "--input-bg": "#0f172a",
      "--overlay-bg": "rgba(17, 24, 39, 0.94)",
    };
  }

  return {
    "--app-bg": "#f5f5f5",
    "--map-shell-bg": "#d9d9d9",
    "--panel-bg": "#ffffff",
    "--panel-subtle": "#f9fafb",
    "--panel-muted-bg": "#ffffff",
    "--border-color": "#e5e7eb",
    "--border-soft": "#f3f4f6",
    "--text-primary": "#111827",
    "--text-secondary": "#374151",
    "--text-muted": "#6b7280",
    "--input-bg": "#ffffff",
    "--overlay-bg": "rgba(255,255,255,0.96)",
  };
}

function mobileNavLabelStyle() {
  return {
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.1,
  };
}

function mobileNavHintStyle() {
  return {
    fontSize: 11,
    opacity: 0.72,
    lineHeight: 1.1,
  };
}
