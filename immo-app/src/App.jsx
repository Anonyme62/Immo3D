import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  addBlacklist,
  addSetAside,
  deleteBienPlacement,
  addFavorite,
  createCustomMarker,
  getBoundary,
  deleteCustomMarker,
  getAuthStatus,
  getBiens,
  getCustomMarkers,
  loginYanport,
  logoutYanport,
  removeBlacklist,
  removeFavorite,
  removeSetAside,
  saveNote,
  saveBienPlacement,
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
  const DESKTOP_LEFT_WIDTH = 340;
  const DESKTOP_RIGHT_WIDTH = 380;
  const DESKTOP_COLLAPSED_HANDLE = 28;
  const LAST_SEARCH_STORAGE_KEY = "immo3d_last_search_zone";
  const RECENT_SEARCHES_STORAGE_KEY = "immo3d_recent_searches";
  const THEME_STORAGE_KEY = "immo3d_theme_mode";
  const STYLE_STORAGE_KEY = "immo3d_style_mode";

  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 980);
  const [themeMode, setThemeMode] = useState(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === "dark" ? "dark" : "light";
  });
  const [styleMode, setStyleMode] = useState(() => {
    const savedStyle = localStorage.getItem(STYLE_STORAGE_KEY);
    if (savedStyle === "atlas") return "luxury";
    return ["default", "editorial", "luxury", "heritage", "glass"].includes(savedStyle)
      ? savedStyle
      : "default";
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
  const [activeZoneRecherche, setActiveZoneRecherche] = useState("");
  const [recentSearches, setRecentSearches] = useState([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteStatus, setNoteStatus] = useState("");
  const [mapMode, setMapMode] = useState("osm");
  const [syncVersion, setSyncVersion] = useState(0);
  const [focusBienId, setFocusBienId] = useState(null);
  const [focusBienVersion, setFocusBienVersion] = useState(0);
  const [mobilePanel, setMobilePanel] = useState("search");
  const [isMapExpandedMobile, setIsMapExpandedMobile] = useState(false);
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [customMarkers, setCustomMarkers] = useState([]);
  const [showBoundary, setShowBoundary] = useState(true);
  const [boundaryGeoJson, setBoundaryGeoJson] = useState(null);
  const [placingBienId, setPlacingBienId] = useState(null);

  const [showAllBiens, setShowAllBiens] = useState(true);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showSetAside, setShowSetAside] = useState(false);
  const [showProfessionnels, setShowProfessionnels] = useState(false);
  const [showParticuliers, setShowParticuliers] = useState(false);
  const [showBlacklist, setShowBlacklist] = useState(true);
  const [showSansAdresse, setShowSansAdresse] = useState(true);
  const [showNouveaux, setShowNouveaux] = useState(true);

  const boundaryQuery = useMemo(
    () => inferBoundaryQuery(activeZoneRecherche, biens),
    [activeZoneRecherche, biens]
  );

  function scrollPageToTop(behavior = "auto") {
    window.scrollTo({ top: 0, left: 0, behavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  function rememberSearchZone(nextZone) {
    const trimmedZone = nextZone.trim();
    if (!trimmedZone) return;

    setRecentSearches((previous) => {
      const nextRecentSearches = [
        trimmedZone,
        ...previous.filter((value) => value !== trimmedZone),
      ].slice(0, 3);

      localStorage.setItem(
        RECENT_SEARCHES_STORAGE_KEY,
        JSON.stringify(nextRecentSearches)
      );
      return nextRecentSearches;
    });
  }

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem(STYLE_STORAGE_KEY, styleMode);
  }, [styleMode]);

  useEffect(() => {
    const savedEmail = localStorage.getItem("yanport_email");
    const savedRemember = localStorage.getItem("yanport_remember_me");
    const savedSearchZone = localStorage.getItem(LAST_SEARCH_STORAGE_KEY);
    const savedRecentSearches = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);

    let parsedRecentSearches = [];
    if (savedRecentSearches) {
      try {
        parsedRecentSearches = JSON.parse(savedRecentSearches);
      } catch {
        parsedRecentSearches = [];
      }
    }

    setLoginEmail(savedEmail || "");
    setRememberMe(savedRemember === "true");
    setLoginPassword("");
    setZoneRecherche(savedSearchZone || "");
    setActiveZoneRecherche(savedSearchZone || "");
    setRecentSearches(Array.isArray(parsedRecentSearches) ? parsedRecentSearches : []);
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
        const data = await getCustomMarkers(activeZoneRecherche);
        setCustomMarkers(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Erreur chargement reperes perso :", error);
      }
    }

    chargerReperesPersonnels();
  }, [isLoggedIn, activeZoneRecherche]);

  useEffect(() => {
    let cancelled = false;

    async function chargerBordure() {
      if (!showBoundary || !boundaryQuery.trim()) {
        setBoundaryGeoJson(null);
        return;
      }

      try {
        const data = await getBoundary(boundaryQuery);
        if (!cancelled) {
          setBoundaryGeoJson(data?.found ? data.geojson || null : null);
        }
      } catch (error) {
        console.error("Erreur chargement bordure :", error);
        if (!cancelled) {
          setBoundaryGeoJson(null);
        }
      }
    }

    chargerBordure();
    return () => {
      cancelled = true;
    };
  }, [showBoundary, boundaryQuery]);

  async function refreshBiensInBackground() {
    if (!isLoggedIn || isBackgroundRefreshingRef.current || loading) return;

    const nextZoneRecherche = activeZoneRecherche.trim();
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
      showFavorites,
      showSetAside,
      showProfessionnels,
      showParticuliers,
      showBlacklist,
      showSansAdresse,
      showNouveaux,
      selectedBienId: selectedBien?.id ?? null,
    });
  }, [biens, search, showAllBiens, showFavorites, showSetAside, showProfessionnels, showParticuliers, showBlacklist, showSansAdresse, showNouveaux, selectedBien?.id]);

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
    if (!selectedBien) {
      setPlacingBienId(null);
    }
  }, [selectedBien]);

  useEffect(() => {
    if (!isMobile) {
      setMobilePanel("search");
      setIsMapExpandedMobile(false);
      return;
    }

    setIsLeftSidebarCollapsed(false);
    setIsRightPanelCollapsed(false);

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
      setActiveZoneRecherche(nextZoneRecherche);
      localStorage.setItem(LAST_SEARCH_STORAGE_KEY, nextZoneRecherche);
      rememberSearchZone(nextZoneRecherche);

      setFocusBienId(null);
      setPlacingBienId(null);

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

  async function ajouterFavori() {
    if (!selectedBien) return;

    try {
      await addFavorite(selectedBien.id);

      setBiens((prevBiens) =>
        prevBiens.map((bien) =>
          bien.id === selectedBien.id ? { ...bien, favorite: true } : bien
        )
      );

      setSelectedBien((prev) => (prev ? { ...prev, favorite: true } : prev));
    } catch (error) {
      console.error("Erreur ajout favori :", error);
      alert(error.message || "Erreur lors de l'ajout aux favoris");
    }
  }

  async function retirerFavori() {
    if (!selectedBien) return;

    try {
      await removeFavorite(selectedBien.id);

      setBiens((prevBiens) =>
        prevBiens.map((bien) =>
          bien.id === selectedBien.id ? { ...bien, favorite: false } : bien
        )
      );

      setSelectedBien((prev) => (prev ? { ...prev, favorite: false } : prev));
    } catch (error) {
      console.error("Erreur retrait favori :", error);
      alert(error.message || "Erreur lors du retrait des favoris");
    }
  }

  async function ajouterDeCote() {
    if (!selectedBien) return;

    try {
      await addSetAside(selectedBien.id);

      setBiens((prevBiens) =>
        prevBiens.map((bien) =>
          bien.id === selectedBien.id ? { ...bien, de_cote: true } : bien
        )
      );

      setSelectedBien((prev) => (prev ? { ...prev, de_cote: true } : prev));
    } catch (error) {
      console.error("Erreur ajout mettre de cote :", error);
      alert(error.message || "Erreur lors du rangement de ce bien");
    }
  }

  async function retirerDeCote() {
    if (!selectedBien) return;

    try {
      await removeSetAside(selectedBien.id);

      setBiens((prevBiens) =>
        prevBiens.map((bien) =>
          bien.id === selectedBien.id ? { ...bien, de_cote: false } : bien
        )
      );

      setSelectedBien((prev) => (prev ? { ...prev, de_cote: false } : prev));
    } catch (error) {
      console.error("Erreur retrait mettre de cote :", error);
      alert(error.message || "Erreur lors du retrait de ce bien");
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
      showFavorites: setShowFavorites,
      showSetAside: setShowSetAside,
      showProfessionnels: setShowProfessionnels,
      showParticuliers: setShowParticuliers,
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
      zoneRecherche: activeZoneRecherche || zoneRecherche,
      biens: biensFiltres,
      customMarkers,
    });
  }

  function handleSidebarSelection(bien) {
    setPlacingBienId(null);
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
    const created = await createCustomMarker(
      marker.lat,
      marker.lon,
      marker.note,
      activeZoneRecherche
    );
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

  function startPlacingSelectedBien() {
    if (!selectedBien) return;
    const canPlaceMarker =
      selectedBien.sans_adresse || selectedBien.placed_manually;
    if (!canPlaceMarker) return;

    setPlacingBienId((currentValue) =>
      currentValue === selectedBien.id ? null : selectedBien.id
    );
  }

  async function handlePlaceBienOnMap(bienId, lat, lon) {
    const savedPlacement = await saveBienPlacement(bienId, lat, lon);

    setBiens((prevBiens) =>
      prevBiens.map((bien) =>
        bien.id === bienId
          ? {
              ...bien,
              lat: savedPlacement.lat,
              lon: savedPlacement.lon,
              adresse: savedPlacement.manual_address || bien.adresse || "",
              sans_adresse: false,
              placed_manually: true,
            }
          : bien
      )
    );

    setSelectedBien((prev) =>
      prev && prev.id === bienId
        ? {
            ...prev,
            lat: savedPlacement.lat,
            lon: savedPlacement.lon,
            adresse: savedPlacement.manual_address || prev.adresse || "",
            sans_adresse: false,
            placed_manually: true,
          }
        : prev
    );

    setPlacingBienId(null);
    setFocusBienId(bienId);
    setFocusBienVersion((value) => value + 1);
  }

  async function handleRemovePlacedBienMarker() {
    if (!selectedBien?.placed_manually) return;

    await deleteBienPlacement(selectedBien.id);

    setBiens((prevBiens) =>
      prevBiens.map((bien) =>
        bien.id === selectedBien.id
          ? {
              ...bien,
              lat: null,
              lon: null,
              adresse: "",
              sans_adresse: true,
              placed_manually: false,
            }
          : bien
      )
    );

    setSelectedBien((prev) =>
      prev
        ? {
            ...prev,
            lat: null,
            lon: null,
            adresse: "",
            sans_adresse: true,
            placed_manually: false,
          }
        : prev
    );

    setPlacingBienId(null);
    setFocusBienId(null);
  }

  function handleMapFocusHandled() {
    setFocusBienId(null);
  }

  if (!authChecked) {
    return (
      <div
        style={{
          ...getThemeVariables(themeMode, styleMode),
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
          ...getThemeVariables(themeMode, styleMode),
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
        <DesktopSidePanel
          side="left"
          width={DESKTOP_LEFT_WIDTH}
          collapsedWidth={DESKTOP_COLLAPSED_HANDLE}
          collapsed={isLeftSidebarCollapsed}
          onToggle={() => setIsLeftSidebarCollapsed((value) => !value)}
        >
          <BiensSidebar
            desktopHeader={
              <AppMenu
                onLogout={seDeconnecter}
                onExportKml={handleExportKml}
                showBoundary={showBoundary}
                onToggleBoundary={() => setShowBoundary((value) => !value)}
                themeMode={themeMode}
                onToggleTheme={() =>
                  setThemeMode((value) => (value === "dark" ? "light" : "dark"))
                }
                styleMode={styleMode}
                onChangeStyle={setStyleMode}
                compact
              />
            }
            zoneRecherche={zoneRecherche}
            recentSearches={recentSearches}
            search={search}
            loading={loading}
            syncError={syncError}
            filteredBiens={biensFiltres}
            selectedBienId={selectedBien?.id ?? null}
            counts={counts}
            filterState={{
              showAllBiens,
              showFavorites,
              showSetAside,
              showProfessionnels,
              showParticuliers,
              showBlacklist,
              showSansAdresse,
              showNouveaux,
            }}
            onZoneRechercheChange={setZoneRecherche}
            onSelectRecentSearch={setZoneRecherche}
            onSearchChange={setSearch}
            onSynchronize={chargerBiens}
            onFilterChange={handleFilterChange}
            onSelectBien={handleSidebarSelection}
            isMobile={false}
          />
        </DesktopSidePanel>
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
                  setPlacingBienId(null);
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
                onFocusHandled={handleMapFocusHandled}
                mobilePanel="desktop"
                placingBienId={placingBienId}
                boundaryGeoJson={boundaryGeoJson}
                placingBienLabel={
                  biens.find((bien) => bien.id === placingBienId)?.id || placingBienId
                }
                onPlaceBien={handlePlaceBienOnMap}
              />
            </div>

            <DesktopSidePanel
              side="right"
              width={DESKTOP_RIGHT_WIDTH}
              collapsedWidth={DESKTOP_COLLAPSED_HANDLE}
              collapsed={isRightPanelCollapsed}
              onToggle={() => setIsRightPanelCollapsed((value) => !value)}
            >
              <SelectedBienPanel
                selectedBien={selectedBien}
                noteDraft={noteDraft}
                noteStatus={noteStatus}
                onNoteChange={handleNoteChange}
                onAddBlacklist={blacklisterBien}
                onRemoveBlacklist={retirerBlacklist}
                onAddFavorite={ajouterFavori}
                onRemoveFavorite={retirerFavori}
                onAddSetAside={ajouterDeCote}
                onRemoveSetAside={retirerDeCote}
                onStartPlacingBien={startPlacingSelectedBien}
                onRemovePlacedBienMarker={handleRemovePlacedBienMarker}
                isPlacingBien={placingBienId === selectedBien?.id}
                isMobile={false}
              />
            </DesktopSidePanel>
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
                setPlacingBienId(null);
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
              onFocusHandled={handleMapFocusHandled}
              mobilePanel={mobilePanel}
              placingBienId={placingBienId}
              boundaryGeoJson={boundaryGeoJson}
              placingBienLabel={
                biens.find((bien) => bien.id === placingBienId)?.id || placingBienId
              }
              onPlaceBien={handlePlaceBienOnMap}
              isMobileMapExpanded={isMapExpandedMobile}
              onToggleMobileMapExpanded={() =>
                setIsMapExpandedMobile((value) => !value)
              }
              topLeftOverlay={
                <AppMenu
                  onLogout={seDeconnecter}
                  onExportKml={handleExportKml}
                  showBoundary={showBoundary}
                  onToggleBoundary={() => setShowBoundary((value) => !value)}
                  themeMode={themeMode}
                  onToggleTheme={() =>
                    setThemeMode((value) => (value === "dark" ? "light" : "dark"))
                  }
                  styleMode={styleMode}
                  onChangeStyle={setStyleMode}
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
                    <div style={{ fontWeight: 700 }}>
                      {activeZoneRecherche || zoneRecherche || "Aucune zone"}
                    </div>
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
                      {selectedBien.adresse || ""}
                    </div>
                  </div>
                ) : null}
              </div>

              <div style={{ minHeight: 0, paddingBottom: 10 }}>
                {mobilePanel === "search" ? (
                  <BiensSidebar
                    zoneRecherche={zoneRecherche}
                    recentSearches={recentSearches}
                    search={search}
                    loading={loading}
                    syncError={syncError}
                    filteredBiens={biensFiltres}
                    selectedBienId={selectedBien?.id ?? null}
                    counts={counts}
                    filterState={{
                      showAllBiens,
                      showFavorites,
                      showSetAside,
                      showProfessionnels,
                      showParticuliers,
                      showBlacklist,
                      showSansAdresse,
                      showNouveaux,
                    }}
                    onZoneRechercheChange={setZoneRecherche}
                    onSelectRecentSearch={setZoneRecherche}
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
                    recentSearches={recentSearches}
                    search={search}
                    loading={loading}
                    syncError={syncError}
                    filteredBiens={biensFiltres}
                    selectedBienId={selectedBien?.id ?? null}
                    counts={counts}
                    filterState={{
                      showAllBiens,
                      showFavorites,
                      showSetAside,
                      showProfessionnels,
                      showParticuliers,
                      showBlacklist,
                      showSansAdresse,
                      showNouveaux,
                    }}
                    onZoneRechercheChange={setZoneRecherche}
                    onSelectRecentSearch={setZoneRecherche}
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
                    onAddFavorite={ajouterFavori}
                    onRemoveFavorite={retirerFavori}
                    onAddSetAside={ajouterDeCote}
                    onRemoveSetAside={retirerDeCote}
                    onStartPlacingBien={startPlacingSelectedBien}
                    onRemovePlacedBienMarker={handleRemovePlacedBienMarker}
                    isPlacingBien={placingBienId === selectedBien?.id}
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

function DesktopSidePanel({
  side,
  width,
  collapsedWidth,
  collapsed,
  onToggle,
  children,
}) {
  const isLeft = side === "left";
  const panelWidth = collapsed ? 0 : width;
  const hiddenOffset = width;

  return (
    <div
      style={{
        width: panelWidth,
        minWidth: panelWidth,
        maxWidth: panelWidth,
        height: "100%",
        position: "relative",
        overflow: "visible",
        transition: "width 220ms ease, min-width 220ms ease, max-width 220ms ease",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          [isLeft ? "left" : "right"]: 0,
          width,
          height: "100%",
          transform: collapsed
            ? `translateX(${isLeft ? -hiddenOffset : hiddenOffset}px)`
            : "translateX(0)",
          transition: "transform 220ms ease",
          pointerEvents: collapsed ? "none" : "auto",
        }}
      >
        {children}
      </div>

      <button
        onClick={onToggle}
        title={collapsed ? "Ouvrir le panneau" : "Masquer le panneau"}
        aria-label={collapsed ? "Ouvrir le panneau" : "Masquer le panneau"}
        style={{
          position: "absolute",
          top: "50%",
          ...(isLeft
            ? { [collapsed ? "left" : "right"]: collapsed ? 0 : -collapsedWidth }
            : { [collapsed ? "right" : "left"]: collapsed ? 0 : -collapsedWidth }),
          transform: "translateY(-50%)",
          width: collapsedWidth,
          height: 84,
          border: "1px solid var(--border-color)",
          borderRadius: isLeft ? "0 16px 16px 0" : "16px 0 0 16px",
          background: "var(--panel-bg)",
          color: "var(--text-primary)",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
          cursor: "pointer",
          zIndex: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
        }}
      >
        <ChevronIcon direction={isLeft ? (collapsed ? "right" : "left") : collapsed ? "left" : "right"} />
      </button>
    </div>
  );
}

function ChevronIcon({ direction }) {
  const rotation = {
    left: "rotate(180 12 12)",
    right: "none",
  };

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M9 6L15 12L9 18"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={rotation[direction]}
      />
    </svg>
  );
}

function inferBoundaryQuery(zoneRecherche, biens) {
  const trimmedZone = (zoneRecherche || "").trim();
  if (!trimmedZone) return "";

  if (!/^\d{5}$/.test(trimmedZone)) {
    return trimmedZone;
  }

  const cityCounts = new Map();

  biens.forEach((bien) => {
    const address = (bien.adresse || "").trim();
    if (!address) return;

    const match = address.match(/\b\d{5}\s+(.+)$/);
    if (!match) return;

    const city = match[1].trim();
    if (!city) return;

    cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
  });

  let mostLikelyCity = "";
  let highestCount = 0;

  cityCounts.forEach((count, city) => {
    if (count > highestCount) {
      highestCount = count;
      mostLikelyCity = city;
    }
  });

  return mostLikelyCity || trimmedZone;
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

function getThemeVariables(themeMode, styleMode = "default") {
  if (themeMode === "dark") {
    if (styleMode === "editorial") {
      return {
        "--app-bg": "#0b0908",
        "--map-shell-bg": "#080706",
        "--panel-bg": "#14110f",
        "--panel-subtle": "#1d1815",
        "--panel-muted-bg": "#161311",
        "--border-color": "#312923",
        "--border-soft": "#221c18",
        "--text-primary": "#f6f1e7",
        "--text-secondary": "#ddd1be",
        "--text-muted": "#a89780",
        "--input-bg": "#171311",
        "--overlay-bg": "rgba(20, 17, 15, 0.94)",
        "--control-bg": "rgba(20, 17, 15, 0.94)",
        "--control-border": "#443930",
        "--control-shadow": "0 10px 30px rgba(0,0,0,0.42)",
        "--scrollbar-track": "#0e0b09",
        "--scrollbar-thumb": "#443930",
      };
    }

    if (styleMode === "luxury") {
      return {
        "--app-bg": "#0a0908",
        "--map-shell-bg": "#080706",
        "--panel-bg": "#13110f",
        "--panel-subtle": "#1a1713",
        "--panel-muted-bg": "#171411",
        "--border-color": "#2f281f",
        "--border-soft": "#211c16",
        "--text-primary": "#f4e8d0",
        "--text-secondary": "#d0bea0",
        "--text-muted": "#9f8b68",
        "--input-bg": "#191613",
        "--overlay-bg": "rgba(19, 17, 15, 0.94)",
        "--control-bg": "rgba(21, 19, 17, 0.94)",
        "--control-border": "#4a3c25",
        "--control-shadow": "0 12px 32px rgba(0,0,0,0.42)",
        "--scrollbar-track": "#100e0c",
        "--scrollbar-thumb": "#4a3c25",
      };
    }

    if (styleMode === "heritage") {
      return {
        "--app-bg": "#121212",
        "--map-shell-bg": "#14110f",
        "--panel-bg": "#161311",
        "--panel-subtle": "#1e1915",
        "--panel-muted-bg": "#1a1613",
        "--border-color": "#322a22",
        "--border-soft": "#241e19",
        "--text-primary": "#f8ead7",
        "--text-secondary": "#d3c0a5",
        "--text-muted": "#a69072",
        "--input-bg": "#221d19",
        "--overlay-bg": "rgba(22, 19, 17, 0.95)",
        "--control-bg": "rgba(26, 22, 19, 0.95)",
        "--control-border": "#5a472c",
        "--control-shadow": "0 12px 32px rgba(0,0,0,0.42)",
        "--scrollbar-track": "#13100d",
        "--scrollbar-thumb": "#5a472c",
      };
    }

    if (styleMode === "glass") {
      return {
        "--app-bg": "#eef6ff",
        "--map-shell-bg": "#dce8d3",
        "--panel-bg": "rgba(255,255,255,0.38)",
        "--panel-subtle": "rgba(255,255,255,0.46)",
        "--panel-muted-bg": "rgba(255,255,255,0.34)",
        "--border-color": "rgba(255,255,255,0.72)",
        "--border-soft": "rgba(255,255,255,0.54)",
        "--text-primary": "#0f172a",
        "--text-secondary": "#52627c",
        "--text-muted": "#5f6e86",
        "--input-bg": "rgba(255,255,255,0.48)",
        "--overlay-bg": "rgba(255,255,255,0.36)",
        "--control-bg": "rgba(255,255,255,0.42)",
        "--control-border": "rgba(255,255,255,0.76)",
        "--control-shadow": "0 14px 30px rgba(68, 97, 133, 0.16)",
        "--scrollbar-track": "#eaf1f8",
        "--scrollbar-thumb": "#bdd0e8",
      };
    }

    if (styleMode === "atlas") {
      return {
        "--app-bg": "#060914",
        "--map-shell-bg": "#040712",
        "--panel-bg": "#0c1220",
        "--panel-subtle": "#151e31",
        "--panel-muted-bg": "#101827",
        "--border-color": "#243149",
        "--border-soft": "#182235",
        "--text-primary": "#eef4ff",
        "--text-secondary": "#ced8ea",
        "--text-muted": "#92a2bb",
        "--input-bg": "#11192a",
        "--overlay-bg": "rgba(12, 18, 32, 0.94)",
        "--control-bg": "rgba(12, 18, 32, 0.94)",
        "--control-border": "#31415f",
        "--control-shadow": "0 12px 32px rgba(0,0,0,0.42)",
        "--scrollbar-track": "#09101c",
        "--scrollbar-thumb": "#31415f",
      };
    }

    return {
      "--app-bg": "#050608",
      "--map-shell-bg": "#030406",
      "--panel-bg": "#0b0c0f",
      "--panel-subtle": "#14161b",
      "--panel-muted-bg": "#101216",
      "--border-color": "#22252c",
      "--border-soft": "#17191e",
      "--text-primary": "#f3f4f6",
      "--text-secondary": "#d1d5db",
      "--text-muted": "#8b93a1",
      "--input-bg": "#0f1115",
      "--overlay-bg": "rgba(10, 11, 14, 0.94)",
      "--control-bg": "rgba(11, 12, 15, 0.94)",
      "--control-border": "#2a2f38",
      "--control-shadow": "0 10px 30px rgba(0,0,0,0.42)",
      "--scrollbar-track": "#090a0d",
      "--scrollbar-thumb": "#2a2f38",
    };
  }

  if (styleMode === "editorial") {
    return {
      "--app-bg": "#f3eee4",
      "--map-shell-bg": "#e5dccb",
      "--panel-bg": "#fbf7ef",
      "--panel-subtle": "#f3ebdd",
      "--panel-muted-bg": "#f7f1e7",
      "--border-color": "#d9ccb9",
      "--border-soft": "#ece3d3",
      "--text-primary": "#1c1712",
      "--text-secondary": "#4e4439",
      "--text-muted": "#8e806e",
      "--input-bg": "#faf6ee",
      "--overlay-bg": "rgba(251, 247, 239, 0.96)",
      "--control-bg": "rgba(248, 243, 234, 0.96)",
      "--control-border": "rgba(124, 104, 80, 0.22)",
      "--control-shadow": "0 12px 28px rgba(92, 72, 40, 0.14)",
      "--scrollbar-track": "#eee6d9",
      "--scrollbar-thumb": "#cdbfa9",
    };
  }

  if (styleMode === "luxury") {
    return {
      "--app-bg": "#181411",
      "--map-shell-bg": "#d9cfb1",
      "--panel-bg": "#13110f",
      "--panel-subtle": "#1a1713",
      "--panel-muted-bg": "#171411",
      "--border-color": "#3b3227",
      "--border-soft": "#2a241c",
      "--text-primary": "#f3e7ce",
      "--text-secondary": "#cfbd9d",
      "--text-muted": "#8f7b59",
      "--input-bg": "#191613",
      "--overlay-bg": "rgba(19, 17, 15, 0.94)",
      "--control-bg": "rgba(21, 19, 17, 0.94)",
      "--control-border": "#4a3c25",
      "--control-shadow": "0 12px 28px rgba(0,0,0,0.28)",
      "--scrollbar-track": "#100e0c",
      "--scrollbar-thumb": "#4a3c25",
    };
  }

  if (styleMode === "heritage") {
    return {
      "--app-bg": "#171311",
      "--map-shell-bg": "#201b16",
      "--panel-bg": "#191512",
      "--panel-subtle": "#211b16",
      "--panel-muted-bg": "#1e1915",
      "--border-color": "#332920",
      "--border-soft": "#2b241d",
      "--text-primary": "#f8ead7",
      "--text-secondary": "#d1bea4",
      "--text-muted": "#8f7b63",
      "--input-bg": "#221d19",
      "--overlay-bg": "rgba(25, 21, 18, 0.95)",
      "--control-bg": "rgba(26, 22, 19, 0.95)",
      "--control-border": "#5a472c",
      "--control-shadow": "0 12px 28px rgba(0,0,0,0.3)",
      "--scrollbar-track": "#15110e",
      "--scrollbar-thumb": "#5a472c",
    };
  }

  if (styleMode === "glass") {
    return {
      "--app-bg": "#eef6ff",
      "--map-shell-bg": "#eef2d9",
      "--panel-bg": "rgba(255,255,255,0.32)",
      "--panel-subtle": "rgba(255,255,255,0.42)",
      "--panel-muted-bg": "rgba(255,255,255,0.34)",
      "--border-color": "rgba(255,255,255,0.78)",
      "--border-soft": "rgba(255,255,255,0.54)",
      "--text-primary": "#0f172a",
      "--text-secondary": "#52627c",
      "--text-muted": "#5f6e86",
      "--input-bg": "rgba(255,255,255,0.46)",
      "--overlay-bg": "rgba(255,255,255,0.30)",
      "--control-bg": "rgba(255,255,255,0.4)",
      "--control-border": "rgba(255,255,255,0.84)",
      "--control-shadow": "0 12px 28px rgba(84, 114, 150, 0.14)",
      "--scrollbar-track": "#eef4fa",
      "--scrollbar-thumb": "#c6d8ea",
    };
  }

  if (styleMode === "atlas") {
    return {
      "--app-bg": "#dfe8ef",
      "--map-shell-bg": "#d4e1d3",
      "--panel-bg": "rgba(255,255,255,0.74)",
      "--panel-subtle": "rgba(255,255,255,0.54)",
      "--panel-muted-bg": "rgba(255,255,255,0.48)",
      "--border-color": "rgba(126, 148, 176, 0.28)",
      "--border-soft": "rgba(255,255,255,0.45)",
      "--text-primary": "#111827",
      "--text-secondary": "#4f6174",
      "--text-muted": "#728297",
      "--input-bg": "rgba(255,255,255,0.72)",
      "--overlay-bg": "rgba(255,255,255,0.72)",
      "--control-bg": "rgba(255,255,255,0.82)",
      "--control-border": "rgba(126, 148, 176, 0.28)",
      "--control-shadow": "0 14px 30px rgba(61, 89, 122, 0.14)",
      "--scrollbar-track": "#eef4f8",
      "--scrollbar-thumb": "#c0cfdd",
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
    "--control-bg": "rgba(255,255,255,0.96)",
    "--control-border": "rgba(0,0,0,0.16)",
    "--control-shadow": "0 10px 30px rgba(17, 24, 39, 0.12)",
    "--scrollbar-track": "#f3f4f6",
    "--scrollbar-thumb": "#cbd5e1",
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
