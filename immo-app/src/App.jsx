import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  addBlacklist,
  addSetAside,
  addFavorite,
  createBillingCheckoutSession,
  createBillingPortalSession,
  createCustomMarker,
  deleteBienPlacement,
  getBoundary,
  deleteCustomMarker,
  getAuthStatus,
  getHealth,
  getBiens,
  getCustomMarkers,
  loginYanport,
  logoutYanport,
  removeBlacklist,
  removeFavorite,
  removeSetAside,
  saveNote,
  saveBienPlacement,
  syncBillingCheckoutSession,
  updateCustomMarker,
} from "./api";
import AppMenu from "./components/AppMenu";
import BiensSidebar from "./components/BiensSidebar";
import { APP_BUILD_REF, APP_BUILD_VERSION, CESIUM_ION_TOKEN } from "./config";
import LoginScreen from "./components/LoginScreen";
import SelectedBienPanel from "./components/SelectedBienPanel";
import SubscriptionScreen from "./components/SubscriptionScreen";
import {
  TOUCH_NAV_TUNING,
  mergeTouchNavTuning,
} from "./config/touchNavigationTuning";
import { countBienCategories, filterBiens } from "./utils/bienFilters";
import {
  formatPrix,
  formatSurface,
  getBienBadge,
  getSelectedBienPhotos,
} from "./utils/bienFormat";
import { downloadKmlExport } from "./utils/kmlExport";
import { getMapPerfTelemetry } from "./utils/mapPerfTelemetry";

const CesiumMap = lazy(() => import("./CesiumMap"));

function isLikelyIOSDevice() {
  if (typeof navigator === "undefined") return false;
  const userAgent = String(navigator.userAgent || "").toLowerCase();
  const isClassicIOS = /iphone|ipad|ipod/.test(userAgent);
  const isIPadDesktopMode =
    navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1;
  return isClassicIOS || isIPadDesktopMode;
}

function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false;
  const mediaStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iosStandalone = window.navigator?.standalone === true;
  return Boolean(mediaStandalone || iosStandalone);
}

function readSafeAreaBottomInsetPx() {
  if (typeof document === "undefined") return 0;
  const probe = document.createElement("div");
  probe.style.position = "fixed";
  probe.style.left = "0";
  probe.style.bottom = "0";
  probe.style.height = "env(safe-area-inset-bottom, 0px)";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.zIndex = "-1";
  document.body.appendChild(probe);
  const inset = Math.max(0, probe.getBoundingClientRect().height || 0);
  probe.remove();
  return inset;
}

const MOBILE_QUALITY_PROFILE_OPTIONS = ["auto", "high", "ultra", "perf"];
const DESKTOP_QUALITY_PROFILE_OPTIONS = ["auto", "high", "ultra", "perf"];

function normalizeMobileQualityProfile(value) {
  return MOBILE_QUALITY_PROFILE_OPTIONS.includes(value) ? value : "auto";
}

function normalizeDesktopQualityProfile(value) {
  return DESKTOP_QUALITY_PROFILE_OPTIONS.includes(value) ? value : "auto";
}

function getBienPreviewPhoto(bien) {
  const photos = getSelectedBienPhotos(bien);
  return Array.isArray(photos) && photos.length > 0 ? photos[0] : "";
}

const MOBILE_BIEN_CARD_HEIGHT = 134;

function App() {
  const noteTimerRef = useRef(null);
  const noteDraftBienIdRef = useRef(null);
  const isBackgroundRefreshingRef = useRef(false);
  const previousVisibleViewRef = useRef(null);
  const DESKTOP_LEFT_WIDTH = 340;
  const DESKTOP_RIGHT_WIDTH = 380;
  const DESKTOP_COLLAPSED_HANDLE = 28;
  const LAST_SEARCH_STORAGE_KEY = "immo3d_last_search_zone";
  const RECENT_SEARCHES_STORAGE_KEY = "immo3d_recent_searches";
  const THEME_STORAGE_KEY = "immo3d_theme_mode";
  const STYLE_STORAGE_KEY = "immo3d_style_mode";
  const HAPTICS_STORAGE_KEY = "immo3d_haptics_enabled";
  const MOBILE_QUALITY_PROFILE_STORAGE_KEY = "immo3d_mobile_quality_profile";
  const DESKTOP_QUALITY_PROFILE_STORAGE_KEY = "immo3d_desktop_quality_profile";
  const FILTERS_BY_ZONE_STORAGE_KEY = "immo3d_filters_by_zone";
  const MAP_MODE_STORAGE_KEY = "immo3d_map_mode";
  const FILTER_STATE_KEYS = [
    "showAllBiens",
    "showFavorites",
    "showSetAside",
    "showProfessionnels",
    "showParticuliers",
    "showBlacklist",
    "showSansAdresse",
    "showNouveaux",
  ];

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
  const [currentUser, setCurrentUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [billingNotice, setBillingNotice] = useState("");
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
  const [notePhotosDraft, setNotePhotosDraft] = useState([]);
  const [noteStatus, setNoteStatus] = useState("");
  const [mapMode, setMapMode] = useState("osm");
  const [syncVersion, setSyncVersion] = useState(0);
  const [focusBienId, setFocusBienId] = useState(null);
  const [focusBienVersion, setFocusBienVersion] = useState(0);
  const [mobilePanel, setMobilePanel] = useState("none");
  const [mobileFiltersOrigin, setMobileFiltersOrigin] = useState("map");
  const [mobileDetailOrigin, setMobileDetailOrigin] = useState("map");
  const [isAppMenuOpen, setIsAppMenuOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [customMarkers, setCustomMarkers] = useState([]);
  const [showBoundary, setShowBoundary] = useState(true);
  const [boundaryGeoJson, setBoundaryGeoJson] = useState(null);
  const [placingBienId, setPlacingBienId] = useState(null);
  const [hapticsEnabled, setHapticsEnabled] = useState(() => {
    const storedValue = localStorage.getItem(HAPTICS_STORAGE_KEY);
    if (storedValue === null) return true;
    return storedValue !== "false";
  });
  const [mobileQualityProfile, setMobileQualityProfile] = useState(() =>
    normalizeMobileQualityProfile(
      localStorage.getItem(MOBILE_QUALITY_PROFILE_STORAGE_KEY)
    )
  );
  const [desktopQualityProfile, setDesktopQualityProfile] = useState(() =>
    normalizeDesktopQualityProfile(
      localStorage.getItem(DESKTOP_QUALITY_PROFILE_STORAGE_KEY)
    )
  );
  const [backendHealthInfo, setBackendHealthInfo] = useState(null);
  const [backendHealthError, setBackendHealthError] = useState("");
  const [mapPerfTelemetry, setMapPerfTelemetry] = useState(() =>
    getMapPerfTelemetry()
  );
  const touchNavTuning = useMemo(
    () => mergeTouchNavTuning(TOUCH_NAV_TUNING),
    []
  );
  const [filtersByZone, setFiltersByZone] = useState(() => {
    const storedValue = localStorage.getItem(FILTERS_BY_ZONE_STORAGE_KEY);
    if (!storedValue) return {};
    try {
      const parsed = JSON.parse(storedValue);
      if (!parsed || typeof parsed !== "object") return {};
      const sanitizedByZone = {};
      Object.entries(parsed).forEach(([zoneKey, filterState]) => {
        const normalizedZoneKey = normalizeZoneKey(zoneKey);
        if (!normalizedZoneKey) return;
        sanitizedByZone[normalizedZoneKey] = sanitizeFilterState(filterState);
      });
      return sanitizedByZone;
    } catch {
      return {};
    }
  });

  const [showAllBiens, setShowAllBiens] = useState(true);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showSetAside, setShowSetAside] = useState(false);
  const [showProfessionnels, setShowProfessionnels] = useState(false);
  const [showParticuliers, setShowParticuliers] = useState(false);
  const [showBlacklist, setShowBlacklist] = useState(true);
  const [showSansAdresse, setShowSansAdresse] = useState(true);
  const [showNouveaux, setShowNouveaux] = useState(true);
  const isIOSDevice = useMemo(() => isLikelyIOSDevice(), []);
  const isStandalonePwa = useMemo(() => isStandaloneDisplayMode(), []);
  const isIOSStandalonePwa = isIOSDevice && isStandalonePwa;
  const canUseGoogle3D = Boolean(CESIUM_ION_TOKEN);
  const mobileViewportHeight = "var(--immo3d-mobile-vh, 100svh)";

  const boundaryQuery = useMemo(
    () => inferBoundaryQuery(activeZoneRecherche, biens),
    [activeZoneRecherche, biens]
  );
  const hasAppAccess = currentUser?.has_app_access ?? true;
  const canUseApp = isLoggedIn && hasAppAccess;
  const visibleView = !authChecked ? "loading" : canUseApp ? "app" : isLoggedIn ? "billing" : "login";

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

  function applyAuthState(data) {
    setIsLoggedIn(!!data?.authenticated);
    setCurrentUser(data?.user ?? null);
  }

  function getDefaultFilterState() {
    return {
      showAllBiens: true,
      showFavorites: false,
      showSetAside: false,
      showProfessionnels: false,
      showParticuliers: false,
      showBlacklist: true,
      showSansAdresse: true,
      showNouveaux: true,
    };
  }

  function normalizeZoneKey(value) {
    return String(value || "").trim().toLowerCase();
  }

  function sanitizeFilterState(nextFilterState) {
    const defaults = getDefaultFilterState();
    const source =
      nextFilterState && typeof nextFilterState === "object" ? nextFilterState : defaults;
    const sanitized = { ...defaults };
    FILTER_STATE_KEYS.forEach((key) => {
      sanitized[key] = Boolean(source[key]);
    });
    const hasAnyEnabledFilter = FILTER_STATE_KEYS.some((key) => sanitized[key]);
    return hasAnyEnabledFilter ? sanitized : defaults;
  }

  function areFilterStatesEqual(a, b) {
    const left = sanitizeFilterState(a);
    const right = sanitizeFilterState(b);
    return FILTER_STATE_KEYS.every((key) => left[key] === right[key]);
  }

  function getCurrentFilterState() {
    return {
      showAllBiens,
      showFavorites,
      showSetAside,
      showProfessionnels,
      showParticuliers,
      showBlacklist,
      showSansAdresse,
      showNouveaux,
    };
  }

  function applyFilterState(nextFilterState) {
    setShowAllBiens(Boolean(nextFilterState.showAllBiens));
    setShowFavorites(Boolean(nextFilterState.showFavorites));
    setShowSetAside(Boolean(nextFilterState.showSetAside));
    setShowProfessionnels(Boolean(nextFilterState.showProfessionnels));
    setShowParticuliers(Boolean(nextFilterState.showParticuliers));
    setShowBlacklist(Boolean(nextFilterState.showBlacklist));
    setShowSansAdresse(Boolean(nextFilterState.showSansAdresse));
    setShowNouveaux(Boolean(nextFilterState.showNouveaux));
  }

  function triggerHapticFeedback(level = "light") {
    if (!hapticsEnabled || typeof window === "undefined") return;
    if (!("navigator" in window) || !window.navigator.vibrate) return;
    if (level === "success") {
      window.navigator.vibrate([12, 40, 16]);
      return;
    }
    window.navigator.vibrate(10);
  }

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem(STYLE_STORAGE_KEY, styleMode);
  }, [styleMode]);

  useEffect(() => {
    localStorage.setItem(HAPTICS_STORAGE_KEY, hapticsEnabled ? "true" : "false");
  }, [hapticsEnabled]);

  useEffect(() => {
    localStorage.setItem(MOBILE_QUALITY_PROFILE_STORAGE_KEY, mobileQualityProfile);
  }, [mobileQualityProfile]);

  useEffect(() => {
    localStorage.setItem(DESKTOP_QUALITY_PROFILE_STORAGE_KEY, desktopQualityProfile);
  }, [desktopQualityProfile]);

  useEffect(() => {
    const safeMode = mapMode === "google3d" && canUseGoogle3D ? "google3d" : "osm";
    localStorage.setItem(MAP_MODE_STORAGE_KEY, safeMode);
  }, [mapMode, canUseGoogle3D]);

  useEffect(() => {
    if (canUseGoogle3D) return;
    if (mapMode !== "google3d") return;
    setMapMode("osm");
  }, [canUseGoogle3D, mapMode]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    if (!isIOSStandalonePwa || typeof window === "undefined") {
      document.documentElement.style.removeProperty("--immo3d-mobile-vh");
      return undefined;
    }

    const syncViewportHeight = () => {
      const safeAreaBottomInsetPx = readSafeAreaBottomInsetPx();
      const viewportHeightPx = Math.round(window.innerHeight + safeAreaBottomInsetPx);
      document.documentElement.style.setProperty("--immo3d-mobile-vh", `${viewportHeightPx}px`);
    };

    syncViewportHeight();
    window.addEventListener("resize", syncViewportHeight);
    window.addEventListener("orientationchange", syncViewportHeight);

    return () => {
      window.removeEventListener("resize", syncViewportHeight);
      window.removeEventListener("orientationchange", syncViewportHeight);
      document.documentElement.style.removeProperty("--immo3d-mobile-vh");
    };
  }, [isIOSStandalonePwa]);

  useEffect(() => {
    localStorage.removeItem("immo3d_touch_nav_tuning");
  }, []);

  useEffect(() => {
    if (!settingsPanelOpen) return undefined;

    let cancelled = false;
    setMapPerfTelemetry(getMapPerfTelemetry());
    setBackendHealthError("");
    getHealth()
      .then((data) => {
        if (cancelled) return;
        setBackendHealthInfo(data || null);
      })
      .catch((error) => {
        if (cancelled) return;
        setBackendHealthError(error?.message || "Impossible de lire /health");
      });

    return () => {
      cancelled = true;
    };
  }, [settingsPanelOpen]);

  useEffect(() => {
    localStorage.setItem(
      FILTERS_BY_ZONE_STORAGE_KEY,
      JSON.stringify(filtersByZone)
    );
  }, [filtersByZone]);

  useEffect(() => {
    const zoneKey = normalizeZoneKey(activeZoneRecherche);
    if (!zoneKey) return;

    const savedFilterState = sanitizeFilterState(
      filtersByZone[zoneKey] || getDefaultFilterState()
    );
    applyFilterState(savedFilterState);
  }, [activeZoneRecherche, filtersByZone]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billingState = params.get("billing");
    const sessionId = params.get("session_id");
    if (!billingState) return;

    let cancelled = false;

    async function handleBillingReturn() {
      if (billingState === "success") {
        setBillingNotice("Paiement confirme. Synchronisation de ton abonnement...");

        if (sessionId) {
          try {
            const authData = await syncBillingCheckoutSession(sessionId);
            if (cancelled) return;

            applyAuthState(authData);
            if (authData?.user?.has_app_access) {
              setBillingNotice("Abonnement actif. Acces debloque.");
              return;
            }
          } catch (error) {
            console.error("Erreur synchronisation retour Stripe :", error);
          }
        }

        if (!cancelled) {
          refreshBillingStatus();
        }
      } else if (billingState === "cancel") {
        setBillingNotice("Paiement annule. Tu peux reprendre plus tard.");
      } else if (billingState === "portal") {
        setBillingNotice("Retour du portail Stripe. Verification de ton abonnement...");
        refreshBillingStatus();
      }
    }

    handleBillingReturn();
    params.delete("billing");
    params.delete("session_id");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState({}, document.title, nextUrl);

    return () => {
      cancelled = true;
    };
  }, []);

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

    const shouldRememberEmail = savedRemember === "true";
    if (!shouldRememberEmail) {
      localStorage.removeItem("yanport_email");
    }

    setLoginEmail(shouldRememberEmail ? savedEmail || "" : "");
    setRememberMe(shouldRememberEmail);
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
    if (visibleView === "loading") {
      previousVisibleViewRef.current = visibleView;
      return;
    }

    if (previousVisibleViewRef.current === null) {
      previousVisibleViewRef.current = visibleView;
      return;
    }

    if (previousVisibleViewRef.current !== visibleView) {
      scrollPageToTop("auto");

      const animationFrame = window.requestAnimationFrame(() => {
        scrollPageToTop("auto");
      });

      const timeout = window.setTimeout(() => {
        scrollPageToTop("auto");
      }, 120);

      previousVisibleViewRef.current = visibleView;
      return () => {
        window.cancelAnimationFrame(animationFrame);
        window.clearTimeout(timeout);
      };
    }

    previousVisibleViewRef.current = visibleView;
  }, [visibleView]);

  useEffect(() => {
    async function chargerReperesPersonnels() {
      if (!canUseApp) {
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
  }, [canUseApp, activeZoneRecherche]);

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
    if (!canUseApp || isBackgroundRefreshingRef.current || loading) return;

    const nextZoneRecherche = activeZoneRecherche.trim();
    if (!nextZoneRecherche) return;

    isBackgroundRefreshingRef.current = true;

    try {
      const data = await getBiens(nextZoneRecherche);
      const nextBiens = Array.isArray(data) ? data : [];
      const currentSelectedBienId = selectedBien?.id ?? null;

      setBiens(nextBiens);

      if (!currentSelectedBienId) {
        return;
      }

      const refreshedSelectedBien =
        nextBiens.find((bien) => bien.id === currentSelectedBienId) || null;

      if (refreshedSelectedBien) {
        setSelectedBien(refreshedSelectedBien);
      }
    } catch (error) {
      console.error("Erreur rafraichissement arriere-plan :", error);

      if (error.status === 401) {
        setIsLoggedIn(false);
        setCurrentUser(null);
        setBiens([]);
        setSelectedBien(null);
        setLoginError("Session expiree. Merci de vous reconnecter.");
      } else if (error.status === 402) {
        try {
          const authData = await getAuthStatus();
          applyAuthState(authData);
        } catch (authError) {
          console.error("Erreur verification abonnement :", authError);
        }
      }
    } finally {
      isBackgroundRefreshingRef.current = false;
    }
  }

  useEffect(() => {
    async function verifierAuth() {
      try {
        const data = await getAuthStatus();
        applyAuthState(data);
      } catch (error) {
        console.error("Erreur auth status :", error);
        setIsLoggedIn(false);
        setCurrentUser(null);
      } finally {
        setAuthChecked(true);
      }
    }

    verifierAuth();
  }, []);

  useEffect(() => {
    if (canUseApp) {
      chargerBiens();
    }
  }, [canUseApp]);

  useEffect(() => {
    if (!canUseApp) return;

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
  }, [
    canUseApp,
    zoneRecherche,
    loading,
    selectedBien?.id,
    selectedBien?.note,
    selectedBien?.note_photos,
    noteDraft,
    notePhotosDraft,
  ]);

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
    const zoneKey = normalizeZoneKey(activeZoneRecherche);
    if (!canUseApp || !zoneKey) return;
    if (biens.length === 0 || biensFiltres.length > 0) return;
    if (search.trim()) return;

    const zoneFilterState = sanitizeFilterState(
      filtersByZone[zoneKey] || getCurrentFilterState()
    );
    if (zoneFilterState.showAllBiens) return;

    const defaultState = getDefaultFilterState();
    if (areFilterStatesEqual(zoneFilterState, defaultState)) return;

    applyFilterState(defaultState);
    setFiltersByZone((previousMap) => {
      const previousState = sanitizeFilterState(previousMap[zoneKey]);
      if (areFilterStatesEqual(previousState, defaultState)) {
        return previousMap;
      }
      return {
        ...previousMap,
        [zoneKey]: defaultState,
      };
    });
  }, [
    canUseApp,
    activeZoneRecherche,
    biens.length,
    biensFiltres.length,
    search,
    filtersByZone,
    showAllBiens,
    showFavorites,
    showSetAside,
    showProfessionnels,
    showParticuliers,
    showBlacklist,
    showSansAdresse,
    showNouveaux,
  ]);

  useEffect(() => {
    if (biensFiltres.length === 0) {
      setSelectedBien(null);
      return;
    }

    if (!selectedBien) return;

    const selectedStillVisible = biensFiltres.find((bien) => bien.id === selectedBien.id);
    if (!selectedStillVisible) {
      setSelectedBien(null);
    } else {
      setSelectedBien(selectedStillVisible);
    }
  }, [biensFiltres, selectedBien]);

  useEffect(() => {
    const selectedBienId = selectedBien?.id ?? null;
    const previousBienId = noteDraftBienIdRef.current;
    const hasChangedBien = selectedBienId !== previousBienId;

    if (!hasChangedBien) return;

    noteDraftBienIdRef.current = selectedBienId;
    setNoteDraft(selectedBien?.note || "");
    setNotePhotosDraft(Array.isArray(selectedBien?.note_photos) ? selectedBien.note_photos : []);
    setNoteStatus("");
  }, [selectedBien]);

  useEffect(() => {
    if (!selectedBien) {
      setPlacingBienId(null);
    }
  }, [selectedBien]);

  useEffect(() => {
    if (!isMobile) {
      setMobilePanel("none");
      setIsAppMenuOpen(false);
      return;
    }

    setIsLeftSidebarCollapsed(false);
    setIsRightPanelCollapsed(false);

    if (!selectedBien && mobilePanel === "detail") {
      setMobilePanel("none");
    }
  }, [isMobile, mobilePanel, selectedBien]);

  async function chargerBiens() {
    if (!canUseApp) return;

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

    } catch (error) {
      console.error("Erreur chargement biens :", error);

      if (error.status === 401) {
        setIsLoggedIn(false);
        setCurrentUser(null);
        setBiens([]);
        setSelectedBien(null);
        setLoginError("Session expiree. Merci de vous reconnecter.");
      } else if (error.status === 402) {
        try {
          const authData = await getAuthStatus();
          applyAuthState(authData);
        } catch (authError) {
          console.error("Erreur verification abonnement :", authError);
        }
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
    setBillingError("");
    setBillingNotice("");

    try {
      const authData = await loginYanport(loginEmail, loginPassword);
      localStorage.setItem("yanport_remember_me", rememberMe ? "true" : "false");
      if (rememberMe) {
        localStorage.setItem("yanport_email", loginEmail.trim());
      } else {
        localStorage.removeItem("yanport_email");
      }
      applyAuthState(authData);
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
    setCurrentUser(null);
    setBiens([]);
    setSelectedBien(null);
    setLoginError("");
    setBillingError("");
    setLoginPassword("");
    setNoteDraft("");
    setCustomMarkers([]);
  }

  async function refreshBillingStatus() {
    setBillingLoading(true);
    setBillingError("");
    setBillingNotice("");

    try {
      const authData = await getAuthStatus();
      applyAuthState(authData);
      if (authData?.user?.has_app_access) {
        setBillingNotice("Abonnement actif. Acces debloque.");
      }
    } catch (error) {
      console.error("Erreur rafraichissement abonnement :", error);
      setBillingError(error.message || "Impossible de verifier l'abonnement.");
    } finally {
      setBillingLoading(false);
    }
  }

  async function ouvrirCheckoutAbonnement() {
    setBillingLoading(true);
    setBillingError("");
    setBillingNotice("");

    try {
      const data = await createBillingCheckoutSession();
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }

      setBillingError("Stripe n'a pas renvoye d'URL de paiement.");
    } catch (error) {
      console.error("Erreur ouverture paiement :", error);
      setBillingError(error.message || "Impossible d'ouvrir la page de paiement.");
    } finally {
      setBillingLoading(false);
    }
  }

  async function ouvrirPortailAbonnement() {
    setBillingLoading(true);
    setBillingError("");
    setBillingNotice("");

    try {
      const data = await createBillingPortalSession();
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }

      setBillingError("Stripe n'a pas renvoye d'URL de portail.");
    } catch (error) {
      console.error("Erreur ouverture portail abonnement :", error);
      setBillingError(error.message || "Impossible d'ouvrir la gestion d'abonnement.");
    } finally {
      setBillingLoading(false);
    }
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

      if (isMobile) {
        // On mobile, return straight to map after blacklisting instead of
        // auto-showing another listing in the detail flow.
        setMobileDetailOrigin("map");
        setMobilePanel("none");
      }
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

    scheduleNoteSave(
      bienId,
      value,
      Array.isArray(notePhotosDraft) ? notePhotosDraft : []
    );
  }

  function scheduleNoteSave(bienId, noteValue, photosValue) {
    const safePhotos = Array.isArray(photosValue) ? photosValue : [];

    if (noteTimerRef.current) {
      clearTimeout(noteTimerRef.current);
    }

    noteTimerRef.current = setTimeout(async () => {
      try {
        await saveNote(bienId, noteValue, safePhotos);
        setNoteStatus("Note enregistree");
      } catch (error) {
        console.error("Erreur sauvegarde note :", error);
        setNoteStatus(error.message || "Erreur d'enregistrement");
      }
    }, 600);
  }

  function handleNotePhotosChange(nextPhotos) {
    if (!selectedBien) return;
    const bienId = selectedBien.id;
    const safePhotos = Array.isArray(nextPhotos) ? nextPhotos : [];

    setNotePhotosDraft(safePhotos);
    setNoteStatus("Enregistrement...");

    setBiens((prevBiens) =>
      prevBiens.map((bien) =>
        bien.id === bienId ? { ...bien, note_photos: safePhotos } : bien
      )
    );

    setSelectedBien((prev) =>
      prev ? { ...prev, note_photos: safePhotos } : prev
    );

    scheduleNoteSave(bienId, noteDraft, safePhotos);
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
    triggerHapticFeedback("light");

    const zoneKey = normalizeZoneKey(activeZoneRecherche || zoneRecherche);
    if (!zoneKey) return;

    setFiltersByZone((previousMap) => {
      const baseState = sanitizeFilterState(
        previousMap[zoneKey] || getCurrentFilterState()
      );
      const nextState = sanitizeFilterState({
        ...baseState,
        [key]: value,
      });
      return {
        ...previousMap,
        [zoneKey]: nextState,
      };
    });
  }

  function toggleMapMode() {
    if (!canUseGoogle3D) return;
    triggerHapticFeedback("light");
    setMapMode((value) => (value === "google3d" ? "osm" : "google3d"));
  }

  function handleExportKml() {
    downloadKmlExport({
      zoneRecherche: activeZoneRecherche || zoneRecherche,
      biens: biensFiltres,
      customMarkers,
    });
  }

  function handleSidebarSelection(bien, origin = "list") {
    setPlacingBienId(null);
    setSelectedBien(bien);
    setMobileDetailOrigin(origin);
    if (bien.lat != null && bien.lon != null) {
      setFocusBienId(bien.id);
      setFocusBienVersion((value) => value + 1);
    } else {
      setFocusBienId(null);
    }
    triggerHapticFeedback("light");

    if (isMobile) {
      setMobilePanel("detail");
    }
  }

  async function handleAddCustomMarker(marker) {
    const created = await createCustomMarker(
      marker.lat,
      marker.lon,
      marker.note,
      activeZoneRecherche,
      marker.address || "",
      marker.photos || []
    );
    setCustomMarkers((prev) => [created, ...prev]);
  }

  async function handleUpdateCustomMarker(markerId, note, address = "", photos = []) {
    const updated = await updateCustomMarker(markerId, note, address, photos);
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

  function openMobileSearchPanel() {
    setMobilePanel((current) => (current === "search" ? "none" : "search"));
    triggerHapticFeedback("light");
  }

  function openMobileFiltersPanel(origin = "map") {
    setMobileFiltersOrigin(origin);
    setMobilePanel((current) =>
      current === "filters" && origin === "map" ? "none" : "filters"
    );
    triggerHapticFeedback("light");
  }

  function closeMobileFiltersPanel() {
    if (mobileFiltersOrigin === "search") {
      setMobilePanel("search");
    } else {
      setMobilePanel("none");
    }
    triggerHapticFeedback("light");
  }

  function closeMobileDetailPanel() {
    setMobilePanel(mobileDetailOrigin === "list" ? "search" : "none");
    triggerHapticFeedback("light");
  }

  function handleToggleHaptics() {
    setHapticsEnabled((currentValue) => {
      const nextValue = !currentValue;
      if (nextValue) {
        window.navigator?.vibrate?.(10);
      }
      return nextValue;
    });
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

  if (!hasAppAccess) {
    return (
      <SubscriptionScreen
        themeMode={themeMode}
        user={currentUser}
        loading={billingLoading}
        error={billingError}
        notice={billingNotice}
        onStartCheckout={ouvrirCheckoutAbonnement}
        onOpenPortal={ouvrirPortailAbonnement}
        onRefreshStatus={refreshBillingStatus}
        onLogout={seDeconnecter}
      />
    );
  }

  return (
      <div
        style={{
          ...getThemeVariables(themeMode, styleMode),
          height: isMobile ? "auto" : "100vh",
          minHeight: mobileViewportHeight,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          fontFamily: "Arial, sans-serif",
          background: "var(--app-bg)",
          color: "var(--text-primary)",
          overflow: isMobile ? "visible" : "hidden",
          paddingBottom: 0,
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
                onOpenSettings={() => setSettingsPanelOpen(true)}
                showBoundary={showBoundary}
                onToggleBoundary={() => setShowBoundary((value) => !value)}
                themeMode={themeMode}
                onToggleTheme={() =>
                  setThemeMode((value) => (value === "dark" ? "light" : "dark"))
                }
                styleMode={styleMode}
                onChangeStyle={setStyleMode}
                hapticsEnabled={hapticsEnabled}
                onToggleHaptics={handleToggleHaptics}
                touchNavTuning={touchNavTuning}
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
              <Suspense fallback={<MapLoadingFallback isMobile={false} />}>
                <CesiumMap
                  biens={biensFiltres}
                  customMarkers={customMarkers}
                  selectedBienId={selectedBien?.id ?? null}
                  setSelectedBien={(bien) => {
                    setPlacingBienId(null);
                    setSelectedBien(bien);
                    triggerHapticFeedback("light");
                  }}
                  onAddCustomMarker={handleAddCustomMarker}
                  onUpdateCustomMarker={handleUpdateCustomMarker}
                  onDeleteCustomMarker={handleDeleteCustomMarker}
                  mapMode={mapMode}
                  canUseGoogle3D={canUseGoogle3D}
                  isIOSDevice={isIOSDevice}
                  isStandalonePwa={isIOSStandalonePwa}
                  onToggleMapMode={toggleMapMode}
                  onSetMapMode={setMapMode}
                  hapticsEnabled={hapticsEnabled}
                  allBiens={biens}
                  searchZone={activeZoneRecherche}
                  touchNavTuning={touchNavTuning}
                  mobileQualityProfile={mobileQualityProfile}
                  desktopQualityProfile={desktopQualityProfile}
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
              </Suspense>
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
                notePhotos={notePhotosDraft}
                noteStatus={noteStatus}
                onNoteChange={handleNoteChange}
                onNotePhotosChange={handleNotePhotosChange}
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
              minHeight: 0,
              position: "relative",
            }}
          >
            <div
              style={{
                position: "relative",
                minHeight: mobileViewportHeight,
                height: mobileViewportHeight,
                overflow: "hidden",
                background: "var(--map-shell-bg)",
              }}
            >
              <Suspense fallback={<MapLoadingFallback isMobile />}>
                <CesiumMap
                  biens={biensFiltres}
                  customMarkers={customMarkers}
                  selectedBienId={selectedBien?.id ?? null}
                  setSelectedBien={(bien) => {
                    setPlacingBienId(null);
                    setSelectedBien(bien);
                    setMobileDetailOrigin("map");
                    triggerHapticFeedback("light");
                    setMobilePanel("detail");
                  }}
                  onAddCustomMarker={handleAddCustomMarker}
                  onUpdateCustomMarker={handleUpdateCustomMarker}
                  onDeleteCustomMarker={handleDeleteCustomMarker}
                  mapMode={mapMode}
                  canUseGoogle3D={canUseGoogle3D}
                  isIOSDevice={isIOSDevice}
                  isStandalonePwa={isIOSStandalonePwa}
                  onToggleMapMode={toggleMapMode}
                  onSetMapMode={setMapMode}
                  hapticsEnabled={hapticsEnabled}
                  allBiens={biens}
                  searchZone={activeZoneRecherche}
                  touchNavTuning={touchNavTuning}
                  mobileQualityProfile={mobileQualityProfile}
                  desktopQualityProfile={desktopQualityProfile}
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
                  isMobileMapExpanded
                  showMobileExpandButton={false}
                  topLeftOverlay={
                    <AppMenu
                      onLogout={seDeconnecter}
                      onExportKml={handleExportKml}
                      onOpenSettings={() => setSettingsPanelOpen(true)}
                      showBoundary={showBoundary}
                      onToggleBoundary={() => setShowBoundary((value) => !value)}
                      themeMode={themeMode}
                      onToggleTheme={() =>
                        setThemeMode((value) => (value === "dark" ? "light" : "dark"))
                      }
                      styleMode={styleMode}
                      onChangeStyle={setStyleMode}
                      hapticsEnabled={hapticsEnabled}
                      onToggleHaptics={handleToggleHaptics}
                      touchNavTuning={touchNavTuning}
                      onMenuOpenChange={setIsAppMenuOpen}
                      isMobile
                    />
                  }
                />
              </Suspense>

              <MobileMapActionButtons
                mobilePanel={mobilePanel}
                disabled={isAppMenuOpen}
                isStandalonePwa={isIOSStandalonePwa}
                onOpenSearch={openMobileSearchPanel}
                onOpenFilters={() => openMobileFiltersPanel("map")}
              />

              <MobileSearchOverlay
                open={mobilePanel === "search"}
                zoneRecherche={zoneRecherche}
                search={search}
                loading={loading}
                syncError={syncError}
                filteredBiens={biensFiltres}
                selectedBienId={selectedBien?.id ?? null}
                onZoneRechercheChange={setZoneRecherche}
                onSearchChange={setSearch}
                onSynchronize={chargerBiens}
                onOpenFilters={() => openMobileFiltersPanel("search")}
                onClose={() => setMobilePanel("none")}
                onSelectBien={(bien) => handleSidebarSelection(bien, "list")}
              />

              <MobileFiltersOverlay
                open={mobilePanel === "filters"}
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
                onFilterChange={handleFilterChange}
                onClose={closeMobileFiltersPanel}
              />

              <MobileDetailOverlay
                open={mobilePanel === "detail" && Boolean(selectedBien)}
                onClose={closeMobileDetailPanel}
              >
                <SelectedBienPanel
                  selectedBien={selectedBien}
                  noteDraft={noteDraft}
                  notePhotos={notePhotosDraft}
                  noteStatus={noteStatus}
                  onNoteChange={handleNoteChange}
                  onNotePhotosChange={handleNotePhotosChange}
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
                />
              </MobileDetailOverlay>
            </div>
          </div>
        )}
      </div>

      <SettingsOverlay
        open={settingsPanelOpen}
        onClose={() => setSettingsPanelOpen(false)}
        onOpenSubscriptionPortal={ouvrirPortailAbonnement}
        mobileQualityProfile={mobileQualityProfile}
        desktopQualityProfile={desktopQualityProfile}
        appBuildVersion={APP_BUILD_VERSION}
        appBuildRef={APP_BUILD_REF}
        backendHealthInfo={backendHealthInfo}
        backendHealthError={backendHealthError}
        mapPerfTelemetry={mapPerfTelemetry}
        onChangeMobileQualityProfile={(nextProfile) =>
          setMobileQualityProfile(normalizeMobileQualityProfile(nextProfile))
        }
        onChangeDesktopQualityProfile={(nextProfile) =>
          setDesktopQualityProfile(normalizeDesktopQualityProfile(nextProfile))
        }
      />
    </div>
  );
}

function MapLoadingFallback({ isMobile = false }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: isMobile ? "var(--immo3d-mobile-vh, 100svh)" : 0,
        display: "grid",
        placeItems: "center",
        background: "var(--map-shell-bg)",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderRadius: 999,
          border: "1px solid var(--border-color)",
          background: "var(--panel-bg)",
          color: "var(--text-primary)",
          fontWeight: 700,
          boxShadow: "0 12px 30px rgba(0,0,0,0.16)",
        }}
      >
        <LoadingSpinner size={16} />
        <span>Chargement de la carte...</span>
      </div>
    </div>
  );
}

function LoadingSpinner({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block", color: "currentColor" }}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <animateTransform
          attributeName="transform"
          attributeType="XML"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="0.8s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
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

function MobileMapActionButtons({
  mobilePanel,
  onOpenSearch,
  onOpenFilters,
  disabled = false,
  isStandalonePwa = false,
}) {
  if (disabled) return null;
  const topOffset = isStandalonePwa
    ? "calc(env(safe-area-inset-top, 0px) + 8px)"
    : 14;

  return (
    <div
      style={{
        position: "absolute",
        top: topOffset,
        right: 14,
        zIndex: 12,
        display: "flex",
        gap: 10,
      }}
    >
      <button
        onClick={onOpenSearch}
        style={mobileTopActionButtonStyle(mobilePanel === "search")}
        title="Recherche"
        aria-label="Recherche"
      >
        <SearchIcon />
      </button>
      <button
        onClick={onOpenFilters}
        style={mobileTopActionButtonStyle(mobilePanel === "filters")}
        title="Filtres"
        aria-label="Filtres"
      >
        <FilterLinesIcon />
      </button>
    </div>
  );
}

function MobileSearchOverlay({
  open,
  zoneRecherche,
  search,
  loading,
  syncError,
  filteredBiens,
  selectedBienId,
  onZoneRechercheChange,
  onSearchChange,
  onSynchronize,
  onOpenFilters,
  onClose,
  onSelectBien,
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 15,
        pointerEvents: open ? "auto" : "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15, 23, 42, 0.26)",
          opacity: open ? 1 : 0,
          transition: "opacity 170ms ease",
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: "absolute",
          top: 64,
          left: 12,
          right: 12,
          bottom: 12,
          borderRadius: 22,
          border: "1px solid var(--border-color)",
          background: "var(--panel-bg)",
          boxShadow: "0 24px 50px rgba(15, 23, 42, 0.28)",
          backdropFilter: "blur(12px)",
          overflow: "hidden",
          transform: open ? "translateY(0)" : "translateY(22px)",
          opacity: open ? 1 : 0,
          transition: "transform 220ms ease, opacity 220ms ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "12px 14px",
            borderBottom: "1px solid var(--border-soft)",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 15 }}>Recherche</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onOpenFilters}
              style={mobileOverlayIconButtonStyle()}
              title="Ouvrir les filtres"
            >
              <FilterLinesIcon />
            </button>
            <button onClick={onClose} style={mobileOverlayIconButtonStyle()} title="Fermer">
              <CloseIcon />
            </button>
          </div>
        </div>

        <div style={{ padding: "12px 14px 8px 14px", borderBottom: "1px solid var(--border-soft)" }}>
          <input
            value={zoneRecherche}
            onChange={(event) => onZoneRechercheChange(event.target.value)}
            placeholder="Code postal ou ville (ex: 62750)"
            onKeyDown={(event) => {
              if (event.key === "Enter") onSynchronize();
            }}
            style={mobileOverlayInputStyle()}
          />
          <button onClick={onSynchronize} style={mobileOverlaySyncButtonStyle()}>
            {loading ? "Chargement..." : "Synchroniser Yanport"}
          </button>
          <div style={{ marginTop: 8, fontWeight: 700, fontSize: 13 }}>
            Resultat: {filteredBiens.length} biens
          </div>
          {syncError ? (
            <div style={{ marginTop: 8, color: "#991b1b", fontSize: 13 }}>{syncError}</div>
          ) : null}
        </div>

        <div style={{ padding: "10px 14px 8px 14px" }}>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Rechercher par : agence, adresse, prix..."
            style={mobileOverlayInputStyle()}
          />
        </div>

        <div style={{ padding: "0 14px 14px 14px", overflowY: "auto", flex: 1 }}>
          {filteredBiens.map((bien) => {
            const isSelected = selectedBienId === bien.id;
            const badge = getBienBadge(bien);
            const previewPhoto = getBienPreviewPhoto(bien);
            const publicationText =
              bien.anciennete !== null && bien.anciennete !== undefined
                ? `Publie il y a ${bien.anciennete} jours`
                : "Publication inconnue";
            return (
              <button
                key={bien.id}
                onClick={() => onSelectBien(bien)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  marginBottom: 10,
                  height: MOBILE_BIEN_CARD_HEIGHT,
                  borderRadius: 16,
                  border: isSelected
                    ? "1px solid var(--text-primary)"
                    : "1px solid var(--border-color)",
                  background: "var(--panel-bg)",
                  padding: 12,
                  cursor: "pointer",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "stretch", height: "100%" }}>
                  <div
                    style={{
                      width: "48%",
                      minWidth: "48%",
                      height: "100%",
                      borderRadius: 12,
                      border: "1px solid var(--border-color)",
                      background: "var(--panel-muted-bg)",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {previewPhoto ? (
                      <img
                        src={previewPhoto}
                        alt="Apercu bien"
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--text-muted)", padding: 8 }}>
                        Pas de photo
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        ...badge.style,
                        padding: "4px 8px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 700,
                        alignSelf: "flex-start",
                      }}
                    >
                      {badge.label}
                    </span>
                    <strong style={{ fontSize: 14 }}>{formatPrix(bien.prix)}</strong>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {bien.agence || "Agence inconnue"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {formatSurface(bien.surface)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {publicationText}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MobileFiltersOverlay({ open, counts, filterState, onFilterChange, onClose }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 15,
        pointerEvents: open ? "auto" : "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15, 23, 42, 0.26)",
          opacity: open ? 1 : 0,
          transition: "opacity 170ms ease",
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: "absolute",
          top: 64,
          left: 12,
          right: 12,
          maxHeight: "calc(var(--immo3d-mobile-vh, 100svh) - 76px)",
          borderRadius: 22,
          border: "1px solid var(--border-color)",
          background: "var(--panel-bg)",
          boxShadow: "0 24px 50px rgba(15, 23, 42, 0.28)",
          overflowY: "auto",
          transform: open ? "translateY(0)" : "translateY(22px)",
          opacity: open ? 1 : 0,
          transition: "transform 220ms ease, opacity 220ms ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "12px 14px",
            borderBottom: "1px solid var(--border-soft)",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 15 }}>Filtres</div>
          <button onClick={onClose} style={mobileOverlayIconButtonStyle()} title="Fermer">
            <CloseIcon />
          </button>
        </div>

        <div style={{ padding: 14, display: "grid", gap: 10 }}>
          <div
            style={{
              fontSize: 12,
              fontStyle: "italic",
              color: "var(--text-muted)",
              marginBottom: 2,
            }}
          >
            * Les biens blacklistes ne sont affiches que si le filtre est coche.
          </div>
          <MobileFilterRow
            label={`Tous les biens (${counts.allBiens})`}
            checked={filterState.showAllBiens}
            onChange={(checked) => onFilterChange("showAllBiens", checked)}
          />
          <MobileFilterRow
            label={`Favoris (${counts.favorites})`}
            checked={filterState.showFavorites}
            onChange={(checked) => onFilterChange("showFavorites", checked)}
          />
          <MobileFilterRow
            label={`Nouveaux < 7 jours (${counts.nouveaux})`}
            checked={filterState.showNouveaux}
            onChange={(checked) => onFilterChange("showNouveaux", checked)}
          />
          <MobileFilterRow
            label={`Sans adresses (${counts.sansAdresse})`}
            checked={filterState.showSansAdresse}
            onChange={(checked) => onFilterChange("showSansAdresse", checked)}
          />
          <MobileFilterRow
            label={`Professionnels (${counts.professionnels})`}
            checked={filterState.showProfessionnels}
            onChange={(checked) => onFilterChange("showProfessionnels", checked)}
          />
          <MobileFilterRow
            label={`Particuliers (${counts.particuliers})`}
            checked={filterState.showParticuliers}
            onChange={(checked) => onFilterChange("showParticuliers", checked)}
          />
          <MobileFilterRow
            label={`Mettre de cote (${counts.setAside})`}
            checked={filterState.showSetAside}
            onChange={(checked) => onFilterChange("showSetAside", checked)}
          />
          <MobileFilterRow
            label={`Afficher les blacklistes (${counts.blacklist})`}
            checked={filterState.showBlacklist}
            onChange={(checked) => onFilterChange("showBlacklist", checked)}
          />
        </div>
      </div>
    </div>
  );
}

function MobileFilterRow({ label, checked, onChange }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        border: "1px solid var(--border-color)",
        borderRadius: 14,
        padding: "10px 12px",
        background: "var(--panel-muted-bg)",
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: 14 }}>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function MobileDetailOverlay({ open, onClose, children }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 16,
        pointerEvents: open ? "auto" : "none",
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15, 23, 42, 0.26)",
          opacity: open ? 1 : 0,
          transition: "opacity 170ms ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 64,
          left: 12,
          right: 12,
          bottom: 12,
          borderRadius: 22,
          border: "1px solid var(--border-color)",
          background: "var(--panel-bg)",
          boxShadow: "0 24px 50px rgba(15, 23, 42, 0.28)",
          backdropFilter: "blur(12px)",
          overflow: "hidden",
          transform: open ? "translateY(0)" : "translateY(22px)",
          opacity: open ? 1 : 0,
          transition: "transform 220ms ease, opacity 220ms ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "12px 14px",
            borderBottom: "1px solid var(--border-soft)",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 15 }}>Fiche du bien</div>
          <button onClick={onClose} style={mobileOverlayIconButtonStyle()} title="Fermer">
            <CloseIcon />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

function SettingsOverlay({
  open,
  onClose,
  onOpenSubscriptionPortal,
  mobileQualityProfile = "auto",
  desktopQualityProfile = "auto",
  appBuildVersion = "dev",
  appBuildRef = "local",
  backendHealthInfo = null,
  backendHealthError = "",
  mapPerfTelemetry = null,
  onChangeMobileQualityProfile,
  onChangeDesktopQualityProfile,
}) {
  const normalizedMobileQualityProfile = normalizeMobileQualityProfile(mobileQualityProfile);
  const normalizedDesktopQualityProfile = normalizeDesktopQualityProfile(desktopQualityProfile);
  const modeSwitchStats = mapPerfTelemetry?.modeSwitch || null;
  const markerRefineStats = mapPerfTelemetry?.markerRefine || null;
  const satelliteReadyStats = mapPerfTelemetry?.satelliteReady || null;
  const backendBuildVersion = backendHealthInfo?.build_version || "n/a";
  const backendBuildRef = backendHealthInfo?.build_ref || "n/a";
  const backendStatus = backendHealthInfo?.status || "n/a";
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 170,
        pointerEvents: open ? "auto" : "none",
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15, 23, 42, 0.3)",
          opacity: open ? 1 : 0,
          transition: "opacity 170ms ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: open ? "translate(-50%, -50%)" : "translate(-50%, -45%)",
          width: "min(92vw, 420px)",
          maxHeight: "calc(100vh - 28px)",
          overflowY: "auto",
          borderRadius: 20,
          border: "1px solid var(--border-color)",
          background: "var(--panel-bg)",
          boxShadow: "0 26px 56px rgba(15, 23, 42, 0.3)",
          padding: 16,
          opacity: open ? 1 : 0,
          transition: "transform 220ms ease, opacity 220ms ease",
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
          <div style={{ fontWeight: 800, fontSize: 16 }}>Parametres</div>
          <button onClick={onClose} style={mobileOverlayIconButtonStyle()} title="Fermer">
            <CloseIcon />
          </button>
        </div>

        <div
          style={{
            marginTop: 12,
            border: "1px solid var(--border-color)",
            borderRadius: 16,
            padding: 12,
            background: "var(--panel-muted-bg)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Qualite mobile</div>
          <div
            style={{
              color: "var(--text-secondary)",
              fontSize: 13,
              lineHeight: 1.45,
              marginBottom: 10,
            }}
          >
            Auto recommande. Haute ameliore les details. Tres haute maximise le rendu satellite.
            Perf favorise la fluidite.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {[
              { value: "auto", label: "Auto" },
              { value: "high", label: "Haute" },
              { value: "ultra", label: "Tres haute" },
              { value: "perf", label: "Perf" },
            ].map((option) => {
              const active = normalizedMobileQualityProfile === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => onChangeMobileQualityProfile?.(option.value)}
                  style={{
                    height: 38,
                    borderRadius: 11,
                    border: active
                      ? "1px solid var(--text-primary)"
                      : "1px solid var(--border-color)",
                    background: active ? "var(--text-primary)" : "var(--panel-bg)",
                    color: active ? "var(--panel-bg)" : "var(--text-primary)",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            border: "1px solid var(--border-color)",
            borderRadius: 16,
            padding: 12,
            background: "var(--panel-muted-bg)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Qualite desktop</div>
          <div
            style={{
              color: "var(--text-secondary)",
              fontSize: 13,
              lineHeight: 1.45,
              marginBottom: 10,
            }}
          >
            Auto est equilibre. Haute et Tres haute poussent les details 3D sur PC.
            Perf reduit la charge GPU pour les machines modestes.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {[
              { value: "auto", label: "Auto" },
              { value: "high", label: "Haute" },
              { value: "ultra", label: "Tres haute" },
              { value: "perf", label: "Perf" },
            ].map((option) => {
              const active = normalizedDesktopQualityProfile === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => onChangeDesktopQualityProfile?.(option.value)}
                  style={{
                    height: 38,
                    borderRadius: 11,
                    border: active
                      ? "1px solid var(--text-primary)"
                      : "1px solid var(--border-color)",
                    background: active ? "var(--text-primary)" : "var(--panel-bg)",
                    color: active ? "var(--panel-bg)" : "var(--text-primary)",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            border: "1px solid var(--border-color)",
            borderRadius: 16,
            padding: 12,
            background: "var(--panel-muted-bg)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Build & diagnostic</div>
          <div style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.5 }}>
            Front: v{appBuildVersion} ({appBuildRef})
            <br />
            Back: {backendStatus} - v{backendBuildVersion} ({backendBuildRef})
            {backendHealthError ? (
              <>
                <br />
                /health: {backendHealthError}
              </>
            ) : null}
            {modeSwitchStats ? (
              <>
                <br />
                Switch vue: {modeSwitchStats.success || 0}/{modeSwitchStats.total || 0} reussis
                (moyenne {modeSwitchStats.avgDurationMs ?? "-"} ms)
              </>
            ) : null}
            {satelliteReadyStats ? (
              <>
                <br />
                Satellite ready: premier {satelliteReadyStats.firstReadyMs ?? "-"} ms, dernier{" "}
                {satelliteReadyStats.lastReadyMs ?? "-"} ms
              </>
            ) : null}
            {markerRefineStats ? (
              <>
                <br />
                Raffinage reperes: {markerRefineStats.runs || 0} runs, moyenne{" "}
                {markerRefineStats.avgDurationMs ?? "-"} ms
              </>
            ) : null}
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            border: "1px solid var(--border-color)",
            borderRadius: 16,
            padding: 12,
            background: "var(--panel-muted-bg)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Abonnement</div>
          <div style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.45 }}>
            Preparation de l'espace abonnement. Tu peux deja ouvrir Stripe pour gerer ton abonnement.
          </div>
          <button
            onClick={() => {
              onOpenSubscriptionPortal?.();
            }}
            style={{
              marginTop: 10,
              width: "100%",
              height: 40,
              borderRadius: 12,
              border: "1px solid var(--border-color)",
              background: "var(--panel-bg)",
              color: "var(--text-primary)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Gerer mon abonnement
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20L16.7 16.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FilterLinesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 5H21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="15.5" cy="5" r="3.3" fill="currentColor" />
      <circle cx="15.5" cy="5" r="1.25" fill="var(--panel-bg, #ffffff)" />

      <path d="M3 12H21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="8" cy="12" r="3.3" fill="currentColor" />
      <circle cx="8" cy="12" r="1.25" fill="var(--panel-bg, #ffffff)" />

      <path d="M3 19H21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="17" cy="19" r="3.3" fill="currentColor" />
      <circle cx="17" cy="19" r="1.25" fill="var(--panel-bg, #ffffff)" />
    </svg>
  );
}

function mobileInfoChipStyle(tone = "neutral") {
  const palette = {
    neutral: {
      background: "var(--panel-subtle)",
      color: "var(--text-primary)",
      border: "1px solid var(--border-color)",
    },
    success: {
      background: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    },
    warning: {
      background: "#fef3c7",
      color: "#92400e",
      border: "1px solid #fde68a",
    },
  };
  const selected = palette[tone] || palette.neutral;
  return {
    ...selected,
    padding: "3px 7px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1.2,
  };
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
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

function mobileTopActionButtonStyle(active) {
  return {
    width: 42,
    minWidth: 42,
    height: 42,
    borderRadius: 13,
    border: "1px solid var(--control-border)",
    background: active ? "var(--text-primary)" : "var(--control-bg)",
    color: active ? "var(--panel-bg)" : "var(--text-primary)",
    boxShadow: "var(--control-shadow)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
    backdropFilter: "blur(10px)",
  };
}

function mobileOverlayIconButtonStyle() {
  return {
    width: 34,
    minWidth: 34,
    height: 34,
    borderRadius: 10,
    border: "1px solid var(--border-color)",
    background: "var(--panel-muted-bg)",
    color: "var(--text-primary)",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };
}

function mobileOverlayInputStyle() {
  return {
    width: "100%",
    height: 42,
    borderRadius: 12,
    border: "1px solid var(--border-color)",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
    padding: "0 12px",
    boxSizing: "border-box",
    fontSize: 14,
    outline: "none",
  };
}

function mobileOverlaySyncButtonStyle() {
  return {
    marginTop: 8,
    width: "100%",
    height: 42,
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
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
