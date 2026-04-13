import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { CESIUM_ION_TOKEN } from "./config";
import { TOUCH_NAV_TUNING } from "./config/touchNavigationTuning";
import { formatMarkerPrix } from "./utils/bienFormat";
import {
  buildAddressAnchorAssignments,
  buildCoordinateStackAssignments,
  buildLabelGroupAssignments,
  buildMarkerEntityId,
  compareMarkerRenderOrder,
  getMarkerLabelOffset,
  getMarkerVisualState,
} from "./utils/mapMarkerStyle";

const GOOGLE_TILES_ASSET_ID = 2275207;

if (!CESIUM_ION_TOKEN) {
  console.warn(
    "VITE_CESIUM_ION_TOKEN est absent. La vue Google 3D restera indisponible tant que le token n'est pas configure."
  );
}

Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN;

const GOOGLE_TILESET_READY_TIMEOUT_MS = 1400;
const GOOGLE_TILESET_SWITCH_TIMEOUT_MS = 4800;
const GOOGLE_TILESET_FAST_SSE = 56;
const GOOGLE_TILESET_PREMIUM_SSE = 14;
const GOOGLE_TILESET_FAST_PHASE_MS = 900;
const PLAN_PAN_SPEED_MULTIPLIER = 0.605; // additional -20% from 0.756
const SATELLITE_MIN_GROUND_CLEARANCE_METERS = 40; // hard floor at 40m above ground
const SATELLITE_MARKER_HEIGHT_OFFSET_METERS = 4;
const SATELLITE_MARKER_FALLBACK_HEIGHT_METERS = 40;
const GOOGLE_EARTH_TOUCH_PROFILE = {
  google3dOrbitGainMultiplier: 1.28,
};
const TOUCH_PAN_INERTIA = {
  velocitySmoothing: 0.28,
  minStartSpeedPxPerMs: 0.016,
  minStopSpeedPxPerMs: 0.0022,
  minStartWorldSpeedMetersPerMs: 0.08,
  minStopWorldSpeedMetersPerMs: 0.012,
  dampingPerFrame: 0.935,
  maxDurationMs: 1200,
};
const MAX_MARKER_PHOTOS = 8;
const MAX_MARKER_PHOTO_DATA_URL_LENGTH = 1_100_000;
const MARKER_PHOTO_MAX_DIMENSION_STEPS = [1920, 1600, 1280, 1024, 800, 640];
const MARKER_PHOTO_QUALITY_STEPS = [0.86, 0.78, 0.7, 0.62, 0.54, 0.46];
let markerPhotoMimeTypeCache = null;
const MARKER_LABEL_SCALE_BY_DISTANCE = new Cesium.NearFarScalar(
  1200,
  1.06,
  30000,
  0.42
);
const MARKER_LABEL_OFFSET_SCALE_BY_DISTANCE = new Cesium.NearFarScalar(
  1200,
  1,
  30000,
  0.58
);

function captureCamera(viewer) {
  return {
    destination: Cesium.Cartesian3.clone(viewer.camera.position),
    heading: viewer.camera.heading,
    pitch: viewer.camera.pitch,
    roll: viewer.camera.roll,
  };
}

function restoreCamera(viewer, cameraState) {
  if (!cameraState) return;

  viewer.camera.setView({
    destination: cameraState.destination,
    orientation: {
      heading: cameraState.heading,
      pitch: cameraState.pitch,
      roll: cameraState.roll,
    },
  });
}

function refreshViewer(viewer) {
  if (!viewer || viewer.isDestroyed()) return;

  const cameraState = captureCamera(viewer);
  viewer.resize();
  restoreCamera(viewer, cameraState);
  viewer.scene.requestRender();
}

function resolveMode(mapMode) {
  return mapMode === "google3d" && CESIUM_ION_TOKEN ? "google3d" : "osm";
}

function waitForGoogleTilesetReady(tileset) {
  if (!tileset || tileset.tilesLoaded) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let finished = false;

    function complete() {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeoutId);
      tileset.initialTilesLoaded.removeEventListener(complete);
      resolve();
    }

    const timeoutId = window.setTimeout(
      complete,
      GOOGLE_TILESET_READY_TIMEOUT_MS
    );

    tileset.initialTilesLoaded.addEventListener(complete);
  });
}

function createTimeoutError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function withPromiseTimeout(promise, timeoutMs, message, code) {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(createTimeoutError(message, code));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

function truncateMarkerNote(note) {
  const trimmedNote = (note || "").trim();
  if (!trimmedNote) return "";
  return trimmedNote.length <= 10 ? trimmedNote : `${trimmedNote.slice(0, 10)}...`;
}

function extractBoundaryLines(geometry) {
  if (!geometry || !geometry.type || !geometry.coordinates) return [];

  if (geometry.type === "Polygon") {
    return geometry.coordinates.filter(
      (ring) => Array.isArray(ring) && ring.length >= 2
    );
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flatMap((polygon) =>
      Array.isArray(polygon)
        ? polygon.filter((ring) => Array.isArray(ring) && ring.length >= 2)
        : []
    );
  }

  return [];
}

function optimizeTouchNavigation(
  viewer,
  tuning = TOUCH_NAV_TUNING,
  mapMode = "osm"
) {
  const controller = viewer.scene.screenSpaceCameraController;
  const resolvedMode = resolveMode(mapMode);
  const satelliteMinimumZoomDistance =
    getSatelliteMinimumZoomDistance(tuning);

  controller.enableInputs = true;
  controller.inertiaSpin = tuning.controller.inertiaSpin;
  controller.inertiaTranslate = tuning.controller.inertiaTranslate;
  controller.inertiaZoom =
    resolvedMode === "google3d" ? 0 : tuning.controller.inertiaZoom;
  controller.maximumMovementRatio = tuning.controller.maximumMovementRatio;
  controller.bounceAnimationTime =
    resolvedMode === "google3d" ? 0 : tuning.controller.bounceAnimationTime;
  controller.enableCollisionDetection = resolvedMode !== "google3d";
  controller.zoomFactor = tuning.controller.zoomFactor;
  controller.minimumZoomDistance =
    resolvedMode === "google3d"
      ? satelliteMinimumZoomDistance
      : tuning.zoomLimits.planMinHeight;
  controller.maximumZoomDistance = Number.POSITIVE_INFINITY;
  controller.enableLook = false;
  controller.enableTilt = false;
  controller.enableRotate = false;
  controller.enableTranslate = true;
  controller.enableZoom = true;
  controller.lookEventTypes = [];
  controller.tiltEventTypes = [];
  controller.rotateEventTypes = [];
  controller.zoomEventTypes = [
    Cesium.CameraEventType.WHEEL,
    Cesium.CameraEventType.PINCH,
  ];
  controller.translateEventTypes = Cesium.CameraEventType.LEFT_DRAG;
  controller.maximumTiltAngle = undefined;
}

function getSatelliteMinimumZoomDistance() {
  return SATELLITE_MIN_GROUND_CLEARANCE_METERS;
}

function getSurfaceHeight(scene, cartographic) {
  if (!scene || !cartographic) return null;

  if (scene.sampleHeightSupported) {
    try {
      const sampledHeight = scene.sampleHeight(cartographic);
      if (Number.isFinite(sampledHeight)) {
        return sampledHeight;
      }
    } catch {
      // Fallback below
    }
  }

  const globeHeight = scene.globe?.getHeight(cartographic);
  return Number.isFinite(globeHeight) ? globeHeight : null;
}

function getTouchAngle(touches) {
  const firstTouch = touches[0];
  const secondTouch = touches[1];
  if (!firstTouch || !secondTouch) return 0;
  return Math.atan2(
    secondTouch.clientY - firstTouch.clientY,
    secondTouch.clientX - firstTouch.clientX
  );
}

function getTouchMidpoint(touches, canvasRect) {
  const firstTouch = touches[0];
  const secondTouch = touches[1];
  if (!firstTouch || !secondTouch) return null;

  return new Cesium.Cartesian2(
    (firstTouch.clientX + secondTouch.clientX) / 2 - canvasRect.left,
    (firstTouch.clientY + secondTouch.clientY) / 2 - canvasRect.top
  );
}

function getTouchDistance(touches) {
  const firstTouch = touches[0];
  const secondTouch = touches[1];
  if (!firstTouch || !secondTouch) return 0;
  return Math.hypot(
    secondTouch.clientX - firstTouch.clientX,
    secondTouch.clientY - firstTouch.clientY
  );
}

function normalizeAngleDelta(delta) {
  if (delta > Math.PI) return delta - Math.PI * 2;
  if (delta < -Math.PI) return delta + Math.PI * 2;
  return delta;
}

function hasTouchInput() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  return (
    "ontouchstart" in window ||
    (navigator.maxTouchPoints || 0) > 0 ||
    (navigator.msMaxTouchPoints || 0) > 0
  );
}

function getModeKey(resolvedMode) {
  return resolvedMode === "google3d" ? "google3d" : "osm";
}

function getCameraHeight(viewer) {
  if (!viewer?.camera?.positionWC) return null;
  const cartographic = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC);
  if (!cartographic || !Number.isFinite(cartographic.height)) return null;
  return cartographic.height;
}

function getModePanConfig(tuning, resolvedMode) {
  // Keep the same navigation feel in satellite as in plan.
  return tuning.pan.plan;
}

function getModeMinZoomHeight(tuning, resolvedMode) {
  // Use plan zoom baseline for pan-speed calculation in both modes.
  return tuning.zoomLimits.planMinHeight;
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Impossible de charger cette photo."));
    image.src = dataUrl;
  });
}

function getSupportedMarkerPhotoMimeTypes() {
  if (markerPhotoMimeTypeCache) {
    return markerPhotoMimeTypeCache;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;

  const mimeTypes = ["image/jpeg"];
  try {
    const webpDataUrl = canvas.toDataURL("image/webp", 0.8);
    if (webpDataUrl.startsWith("data:image/webp")) {
      mimeTypes.unshift("image/webp");
    }
  } catch {
    // Ignore unsupported encoder types.
  }

  markerPhotoMimeTypeCache = mimeTypes;
  return mimeTypes;
}

function tryCompressMarkerPhoto(imageElement) {
  const sourceWidth = Math.max(1, imageElement.naturalWidth || imageElement.width || 1);
  const sourceHeight = Math.max(1, imageElement.naturalHeight || imageElement.height || 1);
  const preferredMimeTypes = getSupportedMarkerPhotoMimeTypes();

  for (const maxDimension of MARKER_PHOTO_MAX_DIMENSION_STEPS) {
    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      break;
    }

    context.drawImage(imageElement, 0, 0, width, height);

    for (const mimeType of preferredMimeTypes) {
      for (const quality of MARKER_PHOTO_QUALITY_STEPS) {
        const compressedDataUrl = canvas.toDataURL(mimeType, quality);
        if (compressedDataUrl.length <= MAX_MARKER_PHOTO_DATA_URL_LENGTH) {
          return compressedDataUrl;
        }
      }
    }
  }

  return null;
}

function computeEffectivePanSpeed({
  tuning,
  resolvedMode,
  currentHeight,
  syncHeight,
  isSatellite3D = false,
}) {
  const modePanConfig = getModePanConfig(tuning, resolvedMode);
  const speedAtSync = Math.max(0.05, Number(modePanConfig.syncSpeed) || 10);
  const reductionPercent = Cesium.Math.clamp(
    Number(modePanConfig.zoomReductionPercent) || 0,
    0,
    100
  );
  const minZoomHeight = Math.max(
    0.01,
    Number(getModeMinZoomHeight(tuning, resolvedMode)) || 0.01
  );
  const safeSyncHeight = Math.max(minZoomHeight + 0.01, syncHeight);
  const zoomProgress = Cesium.Math.clamp(
    (safeSyncHeight - currentHeight) / (safeSyncHeight - minZoomHeight),
    0,
    1
  );
  const baseMinFactor = Math.max(0, 1 - reductionPercent / 100);

  // Satellite (2D + 3D):
  // keep the same speed at sync and at max zoom, but interpolate continuously
  // between both to avoid abrupt thresholds in the middle zoom range.
  if (resolvedMode === "google3d") {
    // At max zoom, reduce satellite pan speed by an additional 60%.
    const satelliteMinFactor = Cesium.Math.clamp(
      baseMinFactor * 0.25 * 0.4,
      0,
      1
    );
    const smoothFactor = Cesium.Math.lerp(1, satelliteMinFactor, zoomProgress);
    return speedAtSync * smoothFactor;
  }

  const baseFactor = Cesium.Math.lerp(1, baseMinFactor, zoomProgress);
  return speedAtSync * baseFactor;
}

export default function CesiumMap({
  biens,
  allBiens = [],
  customMarkers = [],
  selectedBienId,
  setSelectedBien,
  onAddCustomMarker,
  onUpdateCustomMarker,
  onDeleteCustomMarker,
  mapMode,
  canUseGoogle3D,
  onToggleMapMode,
  onSetMapMode,
  hapticsEnabled = true,
  touchNavTuning = TOUCH_NAV_TUNING,
  isMobile = false,
  syncVersion = 0,
  focusBienId = null,
  focusBienVersion = 0,
  onFocusHandled,
  placingBienId = null,
  placingBienLabel = "",
  onPlaceBien,
  boundaryGeoJson = null,
  mobilePanel = "desktop",
  isMobileMapExpanded = false,
  showMobileExpandButton = true,
  onToggleMobileMapExpanded,
  topLeftOverlay = null,
}) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const onSelectBienRef = useRef(setSelectedBien);
  const onAddCustomMarkerRef = useRef(onAddCustomMarker);
  const onUpdateCustomMarkerRef = useRef(onUpdateCustomMarker);
  const onDeleteCustomMarkerRef = useRef(onDeleteCustomMarker);
  const onPlaceBienRef = useRef(onPlaceBien);
  const onFocusHandledRef = useRef(onFocusHandled);
  const onSetMapModeRef = useRef(onSetMapMode);
  const selectedBienIdRef = useRef(selectedBienId);
  const placingBienIdRef = useRef(placingBienId);
  const markerTextareaRef = useRef(null);
  const markerAddressInputRef = useRef(null);
  const tilesetRef = useRef(null);
  const tilesetPromiseRef = useRef(null);
  const osmImageryLayerRef = useRef(null);
  const boundaryDataSourceRef = useRef(null);
  const entitiesRef = useRef([]);
  const markerDataByIdRef = useRef(new Map());
  const modeRef = useRef(null);
  const modeTransitionTimeoutRef = useRef(null);
  const googleQualityTimeoutRef = useRef(null);
  const hasInitialFlyRef = useRef(false);
  const mapModeRef = useRef(mapMode);
  const touchNavTuningRef = useRef(touchNavTuning || TOUCH_NAV_TUNING);
  const isTiltedRef = useRef(false);
  const ignoreNextClickRef = useRef(false);
  const longPressTimerRef = useRef(null);
  const longPressStartRef = useRef({ x: 0, y: 0, active: false });
  const markerStackByBienIdRef = useRef(new Map());
  const isAwaitingMarkerPlacementRef = useRef(false);
  const selectedCustomMarkerIdRef = useRef(null);
  const markerEditorOpenRef = useRef(false);
  const mobileTouchRotateRef = useRef({
    active: false,
    lastAngle: 0,
    lastDistance: 0,
    pivot: null,
    range: 0,
    heading: 0,
    pitch: Cesium.Math.toRadians(-60),
    usingLookAt: false,
  });
  const mobileTouchPanRef = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    lastTimestamp: 0,
    lastSurface: null,
  });
  const touchPanInertiaRef = useRef({
    rafId: null,
    velocityX: 0,
    velocityY: 0,
    worldVelocity: 0,
    worldDirection: new Cesium.Cartesian3(),
  });
  const syncPanHeightRef = useRef({
    osm: null,
    google3d: null,
  });
  const [isTilted, setIsTilted] = useState(false);
  const [selectedCustomMarkerId, setSelectedCustomMarkerId] = useState(null);
  const [pendingMarkerPosition, setPendingMarkerPosition] = useState(null);
  const [markerDraftNote, setMarkerDraftNote] = useState("");
  const [markerDraftAddress, setMarkerDraftAddress] = useState("");
  const [markerDraftPhotos, setMarkerDraftPhotos] = useState([]);
  const [markerError, setMarkerError] = useState("");
  const [markerSaving, setMarkerSaving] = useState(false);
  const [markerEditorOpen, setMarkerEditorOpen] = useState(false);
  const [markerEditorMode, setMarkerEditorMode] = useState("map");
  const [isAwaitingMarkerPlacement, setIsAwaitingMarkerPlacement] = useState(false);
  const [stackedMarkerOptions, setStackedMarkerOptions] = useState([]);
  const [tilesReadyVersion, setTilesReadyVersion] = useState(0);
  const [modeTransition, setModeTransition] = useState({
    active: false,
    target: null,
  });

  useEffect(() => {
    onSelectBienRef.current = setSelectedBien;
  }, [setSelectedBien]);

  useEffect(() => {
    onAddCustomMarkerRef.current = onAddCustomMarker;
  }, [onAddCustomMarker]);

  useEffect(() => {
    onUpdateCustomMarkerRef.current = onUpdateCustomMarker;
  }, [onUpdateCustomMarker]);

  useEffect(() => {
    onDeleteCustomMarkerRef.current = onDeleteCustomMarker;
  }, [onDeleteCustomMarker]);

  useEffect(() => {
    onPlaceBienRef.current = onPlaceBien;
  }, [onPlaceBien]);

  useEffect(() => {
    onFocusHandledRef.current = onFocusHandled;
  }, [onFocusHandled]);

  useEffect(() => {
    onSetMapModeRef.current = onSetMapMode;
  }, [onSetMapMode]);

  useEffect(() => {
    selectedBienIdRef.current = selectedBienId;
  }, [selectedBienId]);

  useEffect(() => {
    placingBienIdRef.current = placingBienId;
  }, [placingBienId]);

  useEffect(() => {
    mapModeRef.current = mapMode;
  }, [mapMode]);

  useEffect(() => {
    touchNavTuningRef.current = touchNavTuning || TOUCH_NAV_TUNING;
  }, [touchNavTuning]);

  useEffect(() => {
    isTiltedRef.current = isTilted;
  }, [isTilted]);

  useEffect(() => {
    isAwaitingMarkerPlacementRef.current = isAwaitingMarkerPlacement;
  }, [isAwaitingMarkerPlacement]);

  useEffect(() => {
    selectedCustomMarkerIdRef.current = selectedCustomMarkerId;
  }, [selectedCustomMarkerId]);

  useEffect(() => {
    markerEditorOpenRef.current = markerEditorOpen;
  }, [markerEditorOpen]);

  useEffect(() => {
    return () => {
      if (modeTransitionTimeoutRef.current) {
        window.clearTimeout(modeTransitionTimeoutRef.current);
      }
      if (googleQualityTimeoutRef.current) {
        window.clearTimeout(googleQualityTimeoutRef.current);
      }
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  function startModeTransition(targetMode) {
    if (modeTransitionTimeoutRef.current) {
      window.clearTimeout(modeTransitionTimeoutRef.current);
      modeTransitionTimeoutRef.current = null;
    }

    setModeTransition({
      active: true,
      target: targetMode,
    });
  }

  function finishModeTransition() {
    if (modeTransitionTimeoutRef.current) {
      window.clearTimeout(modeTransitionTimeoutRef.current);
    }

    modeTransitionTimeoutRef.current = window.setTimeout(() => {
      setModeTransition({
        active: false,
        target: null,
      });
      modeTransitionTimeoutRef.current = null;
    }, 180);
  }

  function applyEntityVisualState(entity) {
    const bien = entity.bienData;
    if (!bien) return;

    const markerState = getMarkerVisualState(bien, selectedBienId);
    const shouldShowPoint = entity.showPointByPriority !== false;
    const isSelected = selectedBienId === bien.id;
    entity.show = true;
    entity.point.show = shouldShowPoint;
    entity.label.show = true;
    entity.point.pixelSize = markerState.pixelSize;
    entity.point.color = Cesium.Color[markerState.color.toUpperCase()];
    entity.point.outlineColor = Cesium.Color.WHITE;
    entity.point.outlineWidth =
      isSelected && shouldShowPoint ? 5 : markerState.outlineWidth;
    entity.label.font = markerState.font;
  }

  function triggerHapticFeedback(level = "light") {
    if (!hapticsEnabled || typeof window === "undefined") return;
    if (!window.navigator?.vibrate) return;
    if (level === "success") {
      window.navigator.vibrate([10, 32, 14]);
      return;
    }
    window.navigator.vibrate(10);
  }

  function normalizeAddressValue(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getMarkerAddressCandidates() {
    const sourceBiens = Array.isArray(allBiens) && allBiens.length > 0 ? allBiens : biens;
    const uniqueCandidates = new Map();

    sourceBiens.forEach((bien) => {
      if (bien.lat == null || bien.lon == null) return;
      const address = String(bien.adresse || "").trim();
      if (!address) return;
      const normalizedAddress = normalizeAddressValue(address);
      if (!normalizedAddress) return;
      if (!uniqueCandidates.has(normalizedAddress)) {
        uniqueCandidates.set(normalizedAddress, {
          label: address,
          lat: bien.lat,
          lon: bien.lon,
        });
      }
    });

    return [...uniqueCandidates.entries()].map(([key, candidate]) => ({
      key,
      ...candidate,
    }));
  }

  function closeMarkerEditor(clearPending = true) {
    if (clearPending) {
      setPendingMarkerPosition(null);
    }
    setSelectedCustomMarkerId(null);
    setMarkerDraftNote("");
    setMarkerDraftAddress("");
    setMarkerDraftPhotos([]);
    setMarkerError("");
    setMarkerEditorMode("map");
    setMarkerEditorOpen(false);
    setIsAwaitingMarkerPlacement(false);
  }

  function openMarkerEditorAtPosition(position) {
    setPendingMarkerPosition(position);
    setSelectedCustomMarkerId(null);
    setMarkerDraftNote("");
    setMarkerDraftAddress("");
    setMarkerDraftPhotos([]);
    setMarkerError("");
    setMarkerEditorMode("map");
    setMarkerEditorOpen(true);
    setIsAwaitingMarkerPlacement(false);
  }

  function convertFileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const originalDataUrl = String(reader.result || "");
          if (originalDataUrl.length <= MAX_MARKER_PHOTO_DATA_URL_LENGTH) {
            resolve(originalDataUrl);
            return;
          }

          const imageElement = await loadImageFromDataUrl(originalDataUrl);
          const compressedDataUrl = tryCompressMarkerPhoto(imageElement);
          if (compressedDataUrl) {
            resolve(compressedDataUrl);
            return;
          }

          reject(
            new Error(
              "Photo trop volumineuse. Essaie une photo plus legere ou recadree."
            )
          );
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Impossible de lire cette photo."));
      reader.readAsDataURL(file);
    });
  }

  function getReferenceBien() {
    return (
      biens.find((bien) => bien.id === selectedBienId && bien.lat != null && bien.lon != null) ||
      biens.find((bien) => bien.lat != null && bien.lon != null) ||
      null
    );
  }

function getClickPosition(scene, clickPosition) {
  const ray = scene.camera.getPickRay(clickPosition);
  const globePosition = ray ? scene.globe.pick(ray, scene) : null;
  return globePosition || scene.camera.pickEllipsoid(clickPosition, scene.globe.ellipsoid);
}

function orbitCameraAroundPivot(camera, pivot, angleDelta) {
  if (!camera || !pivot || !Number.isFinite(angleDelta) || angleDelta === 0) return;

  const upAxis = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(
    pivot,
    new Cesium.Cartesian3()
  );
  const rotationQuaternion = Cesium.Quaternion.fromAxisAngle(
    upAxis,
    -angleDelta,
    new Cesium.Quaternion()
  );
  const rotationMatrix = Cesium.Matrix3.fromQuaternion(
    rotationQuaternion,
    new Cesium.Matrix3()
  );

  const offset = Cesium.Cartesian3.subtract(
    camera.positionWC,
    pivot,
    new Cesium.Cartesian3()
  );
  const rotatedOffset = Cesium.Matrix3.multiplyByVector(
    rotationMatrix,
    offset,
    new Cesium.Cartesian3()
  );
  const newPosition = Cesium.Cartesian3.add(
    pivot,
    rotatedOffset,
    new Cesium.Cartesian3()
  );

  const newDirection = Cesium.Matrix3.multiplyByVector(
    rotationMatrix,
    camera.directionWC,
    new Cesium.Cartesian3()
  );
  const newUp = Cesium.Matrix3.multiplyByVector(
    rotationMatrix,
    camera.upWC,
    new Cesium.Cartesian3()
  );

  camera.setView({
    destination: newPosition,
    orientation: {
      direction: Cesium.Cartesian3.normalize(newDirection, newDirection),
      up: Cesium.Cartesian3.normalize(newUp, newUp),
    },
  });
}

function getEntityScreenPosition(scene, entity) {
  if (!entity?.position) return null;

  const position = entity.position.getValue(Cesium.JulianDate.now());
  if (!position) return null;

  return Cesium.SceneTransforms.wgs84ToWindowCoordinates(scene, position);
}

function getEntityPointDistanceSquared(scene, entity, clickPosition) {
  const screenPosition = getEntityScreenPosition(scene, entity);
  if (!screenPosition) {
    return Number.POSITIVE_INFINITY;
  }

  const deltaX = screenPosition.x - clickPosition.x;
  const deltaY = screenPosition.y - clickPosition.y;
  return deltaX * deltaX + deltaY * deltaY;
}

function findPickedInteractiveData(
  viewer,
  clickPosition,
  _selectedBienId,
  isMobile
) {
  if (!viewer?.scene || !clickPosition) {
    return { customMarker: null, bien: null, bienEntity: null };
  }

  const directPickedEntity = viewer.scene.pick(clickPosition)?.id;
  if (directPickedEntity?.customMarkerData) {
    return {
      customMarker: directPickedEntity.customMarkerData,
      bien: null,
      bienEntity: null,
    };
  }
  if (directPickedEntity?.bienData) {
    return {
      customMarker: null,
      bien: directPickedEntity.bienData,
      bienEntity: directPickedEntity,
    };
  }

  // Keep the pick set intentionally small so dense zones don't hijack
  // "empty map" clicks that should open the note-creation panel.
  const pickedObjects = viewer.scene.drillPick(clickPosition, 4) || [];
  let customMarker = null;
  let bien = null;
  let bienEntity = null;

  pickedObjects.forEach((pickedObject) => {
    const entity = pickedObject?.id;
    if (!entity) return;

    // Existing note markers must remain reliably clickable in all zones.
    // If Cesium reports a marker under the cursor, trust that direct pick.
    if (!customMarker && entity.customMarkerData) {
      customMarker = entity.customMarkerData;
    }

    if (!bien && entity.bienData) {
      bien = entity.bienData;
      bienEntity = entity;
    }
  });

  return { customMarker, bien, bienEntity };
}

  const selectedCustomMarker =
    customMarkers.find((marker) => marker.id === selectedCustomMarkerId) || null;

  const markerRenderKey = JSON.stringify(
    biens.map((bien) => [
      bien.id,
      bien.lat,
      bien.lon,
      bien.prix,
      bien.anciennete,
      bien.blackliste ? 1 : 0,
      bien.sans_adresse ? 1 : 0,
      bien.adresse || "",
      bien.statut || "",
    ])
  );

  function rememberSyncPanHeightForMode(viewer, resolvedMode) {
    const height = getCameraHeight(viewer);
    if (!Number.isFinite(height)) return;
    const modeKey = getModeKey(resolvedMode);
    syncPanHeightRef.current[modeKey] = height;
  }

  function rememberSyncPanHeightForCurrentMode(viewer) {
    rememberSyncPanHeightForMode(viewer, resolveMode(mapModeRef.current));
  }

  function getBiensBounds() {
    const biensAvecCoordonnees = biens.filter(
      (bien) => bien.lat != null && bien.lon != null
    );

    if (biensAvecCoordonnees.length === 0) {
      return null;
    }

    let west = Number.POSITIVE_INFINITY;
    let east = Number.NEGATIVE_INFINITY;
    let south = Number.POSITIVE_INFINITY;
    let north = Number.NEGATIVE_INFINITY;

    biensAvecCoordonnees.forEach((bien) => {
      west = Math.min(west, bien.lon);
      east = Math.max(east, bien.lon);
      south = Math.min(south, bien.lat);
      north = Math.max(north, bien.lat);
    });

    const lonPadding = Math.max((east - west) * 0.25, 0.01);
    const latPadding = Math.max((north - south) * 0.25, 0.01);

    return Cesium.Rectangle.fromDegrees(
      west - lonPadding,
      south - latPadding,
      east + lonPadding,
      north + latPadding
    );
  }

  function focusOnBien(viewer, bien, duration = 1, onComplete = null) {
    if (!viewer || !bien || bien.lat == null || bien.lon == null) return;

    const currentMode = resolveMode(mapModeRef.current);
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        bien.lon,
        bien.lat,
        currentMode === "google3d" ? 260 : 1100
      ),
      orientation: {
        heading: viewer.camera.heading,
        pitch:
          currentMode === "google3d"
            ? Cesium.Math.toRadians(-48)
            : Cesium.Math.toRadians(-90),
        roll: 0,
      },
      duration,
      complete: typeof onComplete === "function" ? onComplete : undefined,
    });
  }

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    containerRef.current.style.touchAction = "none";
    containerRef.current.style.overscrollBehavior = "none";

    const viewer = new Cesium.Viewer(containerRef.current, {
        baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      requestRenderMode: false,
      sceneModePicker: false,
      timeline: false,
      animation: false,
      infoBox: false,
      selectionIndicator: false,
    });

    viewerRef.current = viewer;
    viewer.container.style.touchAction = "none";
    viewer.scene.canvas.style.touchAction = "none";
    viewer.scene.canvas.style.webkitUserSelect = "none";
    viewer.scene.canvas.style.userSelect = "none";
    viewer.scene.canvas.style.webkitTapHighlightColor = "transparent";
    const preventBrowserZoom = (event) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    };
    viewer.container.addEventListener("wheel", preventBrowserZoom, {
      passive: false,
    });
    viewer.selectedEntity = undefined;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.skyBox.show = false;
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#dbeafe");
    viewer.targetFrameRate = 60;
    viewer.useBrowserRecommendedResolution = false;
    viewer.resolutionScale = 1;
    if (isMobile) {
      optimizeTouchNavigation(
        viewer,
        touchNavTuningRef.current,
        mapModeRef.current
      );
    }

    const enforceSatelliteZoomFloor = () => {
      if (resolveMode(mapModeRef.current) !== "google3d") return;
      const minimumGroundClearance = getSatelliteMinimumZoomDistance();
      const cartographic = viewer.camera.positionCartographic;
      if (!cartographic || !Number.isFinite(cartographic.height)) return;
      const surfaceHeight = getSurfaceHeight(viewer.scene, cartographic);
      const minimumZoomHeight = Number.isFinite(surfaceHeight)
        ? surfaceHeight + minimumGroundClearance
        : minimumGroundClearance;
      if (cartographic.height >= minimumZoomHeight - 0.01) return;

      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromRadians(
          cartographic.longitude,
          cartographic.latitude,
          minimumZoomHeight
        ),
        orientation: {
          heading: viewer.camera.heading,
          pitch: viewer.camera.pitch,
          roll: viewer.camera.roll,
        },
      });
    };
    if (isMobile) {
      viewer.scene.postRender.addEventListener(enforceSatelliteZoomFloor);
    }
    viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );
    viewer.imageryLayers.removeAll();
    osmImageryLayerRef.current = viewer.imageryLayers.addImageryProvider(
      new Cesium.OpenStreetMapImageryProvider({
        url: "https://tile.openstreetmap.org/",
      })
    );
    modeRef.current = "osm";

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click) => {
      if (ignoreNextClickRef.current) {
        ignoreNextClickRef.current = false;
        return;
      }

      viewer.selectedEntity = undefined;
      setMarkerError("");
      setStackedMarkerOptions([]);

      // Placement mode must always win over marker selection.
      if (placingBienIdRef.current) {
        const cartesian = getClickPosition(viewer.scene, click.position);
        if (!cartesian) return;

        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        onPlaceBienRef.current?.(
          placingBienIdRef.current,
          Cesium.Math.toDegrees(cartographic.latitude),
          Cesium.Math.toDegrees(cartographic.longitude)
        );
        setPendingMarkerPosition(null);
        setSelectedCustomMarkerId(null);
        return;
      }

      const pickedInteractive = findPickedInteractiveData(
        viewer,
        click.position,
        selectedBienIdRef.current,
        isMobile
      );

      if (pickedInteractive.customMarker) {
        const marker = pickedInteractive.customMarker;
        setPendingMarkerPosition({
          lat: marker.lat,
          lon: marker.lon,
        });
        setSelectedCustomMarkerId(marker.id);
        setMarkerDraftNote(marker.note || "");
        setMarkerDraftAddress(marker.address || "");
        setMarkerDraftPhotos(Array.isArray(marker.photos) ? marker.photos : []);
        setMarkerEditorOpen(true);
        setIsAwaitingMarkerPlacement(false);
        triggerHapticFeedback("light");
        return;
      }

      if (pickedInteractive.bien) {
        const selectedStack = markerStackByBienIdRef.current.get(pickedInteractive.bien.id) || [];
        if (selectedStack.length > 1) {
          setStackedMarkerOptions(selectedStack);
          triggerHapticFeedback("light");
          return;
        }

        setPendingMarkerPosition(null);
        setSelectedCustomMarkerId(null);
        onSelectBienRef.current?.(pickedInteractive.bien);
        triggerHapticFeedback("light");
        return;
      }

      const cartesian = getClickPosition(viewer.scene, click.position);
      if (!cartesian) return;

      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const position = {
        lat: Cesium.Math.toDegrees(cartographic.latitude),
        lon: Cesium.Math.toDegrees(cartographic.longitude),
      };

      if (isAwaitingMarkerPlacementRef.current) {
        openMarkerEditorAtPosition(position);
        triggerHapticFeedback("light");
        return;
      }

      if (isMobile) {
        return;
      }

      openMarkerEditorAtPosition(position);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    const touchCanvas = viewer.scene.canvas;
    const enableCustomTouchGestures = isMobile && hasTouchInput();

    const stopPanInertia = () => {
      const state = touchPanInertiaRef.current;
      if (state.rafId !== null) {
        window.cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }
    };

    const resetPanInertia = () => {
      stopPanInertia();
      touchPanInertiaRef.current.velocityX = 0;
      touchPanInertiaRef.current.velocityY = 0;
      touchPanInertiaRef.current.worldVelocity = 0;
      touchPanInertiaRef.current.worldDirection = new Cesium.Cartesian3();
    };

    const moveCameraForTouchPan = (deltaX, deltaY, moveScale, resolvedMode) => {
      const rightAmount = -deltaX * moveScale;
      const upAmount = deltaY * moveScale;

      if (resolvedMode !== "google3d") {
        viewer.camera.moveRight(rightAmount);
        viewer.camera.moveUp(upAmount);
        viewer.scene.requestRender();
        return;
      }

      const camera = viewer.camera;
      const surfaceNormal = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(
        camera.positionWC,
        new Cesium.Cartesian3()
      );

      const toSurfaceTangent = (axis) => {
        const verticalComponent = Cesium.Cartesian3.multiplyByScalar(
          surfaceNormal,
          Cesium.Cartesian3.dot(axis, surfaceNormal),
          new Cesium.Cartesian3()
        );
        const tangent = Cesium.Cartesian3.subtract(
          axis,
          verticalComponent,
          new Cesium.Cartesian3()
        );
        const magnitude = Cesium.Cartesian3.magnitude(tangent);
        if (magnitude < 1e-6) return null;
        return Cesium.Cartesian3.divideByScalar(tangent, magnitude, tangent);
      };

      const panRightAxis = toSurfaceTangent(camera.rightWC);
      const panUpAxis = toSurfaceTangent(camera.upWC);

      if (panRightAxis) {
        camera.move(panRightAxis, rightAmount);
      }
      if (panUpAxis) {
        camera.move(panUpAxis, upAmount);
      }
      viewer.scene.requestRender();
    };

    const applyPanInertiaDelta = (deltaX, deltaY, resolvedMode, tuning) => {
      const modeKey = getModeKey(resolvedMode);
      const cameraHeight = getCameraHeight(viewer) || 1200;
      const syncHeight =
        syncPanHeightRef.current[modeKey] &&
        Number.isFinite(syncPanHeightRef.current[modeKey])
          ? syncPanHeightRef.current[modeKey]
          : cameraHeight;
      const effectiveSpeed = computeEffectivePanSpeed({
        tuning,
        resolvedMode,
        currentHeight: cameraHeight,
        syncHeight,
        isSatellite3D: isTiltedRef.current,
      });
      const basePanFactor = Cesium.Math.clamp(effectiveSpeed / 10, 0.01, 8);

      // Keep identical pan tuning in plan and satellite to avoid jumpy terrain-pick deltas.
      const moveScale = Cesium.Math.clamp(
        basePanFactor * PLAN_PAN_SPEED_MULTIPLIER,
        0.02,
        12
      );
      moveCameraForTouchPan(deltaX, deltaY, moveScale, resolvedMode);
    };

    const updatePanVelocity = (deltaX, deltaY, deltaTimeMs) => {
      if (!Number.isFinite(deltaTimeMs) || deltaTimeMs <= 0 || deltaTimeMs > 80) {
        return;
      }

      const smoothing = TOUCH_PAN_INERTIA.velocitySmoothing;
      const instantVelocityX = deltaX / deltaTimeMs;
      const instantVelocityY = deltaY / deltaTimeMs;
      const state = touchPanInertiaRef.current;

      state.velocityX =
        state.velocityX * (1 - smoothing) + instantVelocityX * smoothing;
      state.velocityY =
        state.velocityY * (1 - smoothing) + instantVelocityY * smoothing;
    };

    const updatePanWorldVelocity = (direction, movedDistance, deltaTimeMs) => {
      if (!direction || !Number.isFinite(movedDistance) || movedDistance <= 0) return;
      if (!Number.isFinite(deltaTimeMs) || deltaTimeMs <= 0 || deltaTimeMs > 80) return;

      const state = touchPanInertiaRef.current;
      const smoothing = TOUCH_PAN_INERTIA.velocitySmoothing;
      const instantWorldVelocity = movedDistance / deltaTimeMs;

      state.worldVelocity =
        state.worldVelocity * (1 - smoothing) + instantWorldVelocity * smoothing;
      state.worldDirection = Cesium.Cartesian3.clone(
        direction,
        state.worldDirection || new Cesium.Cartesian3()
      );
    };

    const startPanInertia = () => {
      const state = touchPanInertiaRef.current;
      stopPanInertia();

      const resolvedMode = resolveMode(mapModeRef.current);
      const useWorldInertia =
        resolvedMode === "google3d" &&
        state.worldVelocity >= TOUCH_PAN_INERTIA.minStartWorldSpeedMetersPerMs &&
        Cesium.Cartesian3.magnitude(state.worldDirection || new Cesium.Cartesian3()) > 0;

      const initialPixelSpeed = Math.hypot(state.velocityX, state.velocityY);
      if (!useWorldInertia && initialPixelSpeed < TOUCH_PAN_INERTIA.minStartSpeedPxPerMs) {
        resetPanInertia();
        return;
      }

      const startedAt = performance.now();
      let lastFrameAt = startedAt;

      const step = (now) => {
        const elapsed = now - startedAt;
        const frameDeltaMs = Math.min(34, Math.max(8, now - lastFrameAt || 16.67));
        lastFrameAt = now;

        const decay = Math.pow(
          TOUCH_PAN_INERTIA.dampingPerFrame,
          frameDeltaMs / 16.67
        );
        state.velocityX *= decay;
        state.velocityY *= decay;
        state.worldVelocity *= decay;

        if (elapsed >= TOUCH_PAN_INERTIA.maxDurationMs) {
          resetPanInertia();
          return;
        }

        const tuning = touchNavTuningRef.current;
        const currentMode = resolveMode(mapModeRef.current);

        if (
          useWorldInertia &&
          currentMode === "google3d" &&
          state.worldVelocity >= TOUCH_PAN_INERTIA.minStopWorldSpeedMetersPerMs
        ) {
          const moveDistance = state.worldVelocity * frameDeltaMs;
          const moveDirection = Cesium.Cartesian3.normalize(
            state.worldDirection,
            new Cesium.Cartesian3()
          );
          viewer.camera.move(moveDirection, moveDistance);
          viewer.scene.requestRender();
        } else {
          const speed = Math.hypot(state.velocityX, state.velocityY);
          if (speed < TOUCH_PAN_INERTIA.minStopSpeedPxPerMs) {
            resetPanInertia();
            return;
          }
          const deltaX = state.velocityX * frameDeltaMs;
          const deltaY = state.velocityY * frameDeltaMs;
          applyPanInertiaDelta(deltaX, deltaY, currentMode, tuning);
        }

        state.rafId = window.requestAnimationFrame(step);
      };

      state.rafId = window.requestAnimationFrame(step);
    };

    const clearLongPressTimer = () => {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      longPressStartRef.current.active = false;
    };

    const startLongPressTimer = (touch) => {
      if (
        !isMobile ||
        selectedCustomMarkerIdRef.current ||
        markerEditorOpenRef.current ||
        placingBienIdRef.current
      ) {
        return;
      }

      const canvasRect = touchCanvas.getBoundingClientRect();
      const clickPosition = new Cesium.Cartesian2(
        touch.clientX - canvasRect.left,
        touch.clientY - canvasRect.top
      );
      const pickedInteractive = findPickedInteractiveData(
        viewer,
        clickPosition,
        selectedBienIdRef.current,
        true
      );

      if (pickedInteractive.customMarker || pickedInteractive.bien) {
        return;
      }

      clearLongPressTimer();
      longPressStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        active: true,
      };
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        longPressStartRef.current.active = false;
        const latestRect = touchCanvas.getBoundingClientRect();
        const longPressPoint = new Cesium.Cartesian2(
          touch.clientX - latestRect.left,
          touch.clientY - latestRect.top
        );
        const cartesian = getClickPosition(viewer.scene, longPressPoint);
        if (!cartesian) return;

        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const markerPosition = {
          lat: Cesium.Math.toDegrees(cartographic.latitude),
          lon: Cesium.Math.toDegrees(cartographic.longitude),
        };
        openMarkerEditorAtPosition(markerPosition);
        ignoreNextClickRef.current = true;
        triggerHapticFeedback("success");
      }, 1000);
    };

    const handleTouchStart = (event) => {
      const tuning = touchNavTuningRef.current;
      if (event.touches.length === 1) {
        resetPanInertia();
        const firstTouch = event.touches[0];
        const canvasRect = touchCanvas.getBoundingClientRect();
        const firstTouchPosition = new Cesium.Cartesian2(
          firstTouch.clientX - canvasRect.left,
          firstTouch.clientY - canvasRect.top
        );
        mobileTouchPanRef.current.active = true;
        mobileTouchPanRef.current.lastX = firstTouch.clientX;
        mobileTouchPanRef.current.lastY = firstTouch.clientY;
        mobileTouchPanRef.current.lastTimestamp = performance.now();
        mobileTouchPanRef.current.lastSurface = getClickPosition(
          viewer.scene,
          firstTouchPosition
        );
        mobileTouchRotateRef.current.active = false;
        startLongPressTimer(firstTouch);
        return;
      }

      if (event.touches.length !== 2) {
        mobileTouchRotateRef.current.active = false;
        mobileTouchPanRef.current.active = false;
        mobileTouchPanRef.current.lastSurface = null;
        clearLongPressTimer();
        return;
      }

      clearLongPressTimer();
      resetPanInertia();
      mobileTouchPanRef.current.active = false;
      mobileTouchPanRef.current.lastSurface = null;
      mobileTouchRotateRef.current.lastAngle = getTouchAngle(event.touches);
      mobileTouchRotateRef.current.lastDistance = getTouchDistance(event.touches);
      const resolvedMode = resolveMode(mapModeRef.current);
      const canRotateWithTwoFingers =
        resolvedMode === "google3d" || tuning.rotate.enableInPlan;
      mobileTouchRotateRef.current.active = canRotateWithTwoFingers;
      if (!canRotateWithTwoFingers) {
        mobileTouchRotateRef.current.usingLookAt = false;
        mobileTouchRotateRef.current.pivot = null;
        mobileTouchRotateRef.current.range = 0;
        return;
      }
      const canvasRect = touchCanvas.getBoundingClientRect();
      const centerPoint = new Cesium.Cartesian2(
        canvasRect.width / 2,
        canvasRect.height / 2
      );
      const midpoint = getTouchMidpoint(event.touches, canvasRect);
      const pivot =
        getClickPosition(viewer.scene, centerPoint) ||
        (midpoint ? getClickPosition(viewer.scene, midpoint) : null);
      mobileTouchRotateRef.current.pivot = pivot;
      mobileTouchRotateRef.current.usingLookAt = false;
      mobileTouchRotateRef.current.heading = viewer.camera.heading;
      mobileTouchRotateRef.current.pitch = viewer.camera.pitch;
      mobileTouchRotateRef.current.range = pivot
        ? Cesium.Math.clamp(
            Cesium.Cartesian3.distance(viewer.camera.positionWC, pivot) *
              tuning.rotate.initialRangeFactor,
            tuning.rotate.initialRangeMin,
            tuning.rotate.initialRangeMax
          )
        : 0;
    };

    const handleTouchMove = (event) => {
      const tuning = touchNavTuningRef.current;
      if (event.touches.length === 1) {
        const firstTouch = event.touches[0];

        if (!mobileTouchPanRef.current.active) {
          const canvasRect = touchCanvas.getBoundingClientRect();
          const firstTouchPosition = new Cesium.Cartesian2(
            firstTouch.clientX - canvasRect.left,
            firstTouch.clientY - canvasRect.top
          );
          mobileTouchPanRef.current.active = true;
          mobileTouchPanRef.current.lastX = firstTouch.clientX;
          mobileTouchPanRef.current.lastY = firstTouch.clientY;
          mobileTouchPanRef.current.lastTimestamp = performance.now();
          mobileTouchPanRef.current.lastSurface = getClickPosition(
            viewer.scene,
            firstTouchPosition
          );
          return;
        }

        const deltaX = firstTouch.clientX - mobileTouchPanRef.current.lastX;
        const deltaY = firstTouch.clientY - mobileTouchPanRef.current.lastY;
        const now = performance.now();
        const deltaTimeMs = now - (mobileTouchPanRef.current.lastTimestamp || now);
        mobileTouchPanRef.current.lastX = firstTouch.clientX;
        mobileTouchPanRef.current.lastY = firstTouch.clientY;
        mobileTouchPanRef.current.lastTimestamp = now;

        if (longPressStartRef.current.active) {
          const movedX = Math.abs(firstTouch.clientX - longPressStartRef.current.x);
          const movedY = Math.abs(firstTouch.clientY - longPressStartRef.current.y);
          if (movedX > 10 || movedY > 10) {
            clearLongPressTimer();
          }
        }

        if (
          Math.abs(deltaX) < tuning.pan.minPixelDelta &&
          Math.abs(deltaY) < tuning.pan.minPixelDelta
        ) {
          return;
        }

        const resolvedMode = resolveMode(mapModeRef.current);
        updatePanVelocity(deltaX, deltaY, deltaTimeMs);
        const modeKey = getModeKey(resolvedMode);
        const cameraHeight = getCameraHeight(viewer) || 1200;
        const syncHeight =
          syncPanHeightRef.current[modeKey] && Number.isFinite(syncPanHeightRef.current[modeKey])
            ? syncPanHeightRef.current[modeKey]
            : cameraHeight;
        const effectiveSpeed = computeEffectivePanSpeed({
          tuning,
          resolvedMode,
          currentHeight: cameraHeight,
          syncHeight,
          isSatellite3D: isTiltedRef.current,
        });
        const basePanFactor = Cesium.Math.clamp(effectiveSpeed / 10, 0.01, 8);
        touchPanInertiaRef.current.worldVelocity = 0;
        mobileTouchPanRef.current.lastSurface = null;
        const moveScale = Cesium.Math.clamp(
          basePanFactor * PLAN_PAN_SPEED_MULTIPLIER,
          0.02,
          12
        );
        moveCameraForTouchPan(deltaX, deltaY, moveScale, resolvedMode);
        return;
      }

      if (event.touches.length !== 2) {
        mobileTouchRotateRef.current.active = false;
        mobileTouchPanRef.current.active = false;
        mobileTouchPanRef.current.lastSurface = null;
        clearLongPressTimer();
        return;
      }

      clearLongPressTimer();
      const resolvedMode = resolveMode(mapModeRef.current);
      const canRotateWithTwoFingers =
        resolvedMode === "google3d" || tuning.rotate.enableInPlan;
      if (!canRotateWithTwoFingers) {
        mobileTouchRotateRef.current.active = false;
        mobileTouchRotateRef.current.usingLookAt = false;
        return;
      }
      const currentAngle = getTouchAngle(event.touches);
      if (!mobileTouchRotateRef.current.active) {
        mobileTouchRotateRef.current.active = true;
        mobileTouchRotateRef.current.lastAngle = currentAngle;
        mobileTouchRotateRef.current.lastDistance = getTouchDistance(event.touches);
        mobileTouchRotateRef.current.heading = viewer.camera.heading;
        mobileTouchRotateRef.current.pitch = viewer.camera.pitch;
        return;
      }

      const currentDistance = getTouchDistance(event.touches);
      const distanceDelta =
        currentDistance - (mobileTouchRotateRef.current.lastDistance || currentDistance);
      const isPinchDominant =
        Math.abs(distanceDelta) > tuning.rotate.pinchDominantThresholdPx;
      mobileTouchRotateRef.current.lastDistance = currentDistance;

      if (isPinchDominant) {
        mobileTouchRotateRef.current.lastAngle = currentAngle;
        return;
      }

      const angleDelta = normalizeAngleDelta(
        currentAngle - mobileTouchRotateRef.current.lastAngle
      );
      mobileTouchRotateRef.current.lastAngle = currentAngle;

      if (Math.abs(angleDelta) < tuning.rotate.minAngleDeltaRad) {
        return;
      }

      const canvasRect = touchCanvas.getBoundingClientRect();
      const centerPoint = new Cesium.Cartesian2(
        canvasRect.width / 2,
        canvasRect.height / 2
      );
      const livePivot = getClickPosition(viewer.scene, centerPoint);
      if (livePivot) {
        mobileTouchRotateRef.current.pivot = livePivot;
      }

      if (mobileTouchRotateRef.current.pivot) {
        orbitCameraAroundPivot(
          viewer.camera,
          mobileTouchRotateRef.current.pivot,
          angleDelta *
            tuning.rotate.orbitGain *
            GOOGLE_EARTH_TOUCH_PROFILE.google3dOrbitGainMultiplier
        );
        viewer.scene.requestRender();
        return;
      }

      const lockedPitch =
        resolvedMode === "google3d"
          ? isTiltedRef.current
            ? Cesium.Math.toRadians(-60)
            : Cesium.Math.toRadians(-90)
          : Cesium.Math.toRadians(-90);

      viewer.camera.setView({
        orientation: {
          heading: viewer.camera.heading - angleDelta,
          pitch: lockedPitch,
          roll: 0,
        },
      });
      viewer.scene.requestRender();
    };

    const handleTouchEnd = (event) => {
      if (event.touches.length < 2) {
        if (mobileTouchRotateRef.current.usingLookAt) {
          viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        }
        mobileTouchRotateRef.current.active = false;
        mobileTouchRotateRef.current.lastDistance = 0;
        mobileTouchRotateRef.current.usingLookAt = false;
        mobileTouchRotateRef.current.pivot = null;
        mobileTouchRotateRef.current.range = 0;
      }
      if (event.touches.length !== 1) {
        if (event.touches.length === 0) {
          startPanInertia();
        } else {
          resetPanInertia();
        }
        mobileTouchPanRef.current.active = false;
        mobileTouchPanRef.current.lastTimestamp = 0;
        mobileTouchPanRef.current.lastSurface = null;
        clearLongPressTimer();
      } else {
        resetPanInertia();
        const firstTouch = event.touches[0];
        const canvasRect = touchCanvas.getBoundingClientRect();
        const firstTouchPosition = new Cesium.Cartesian2(
          firstTouch.clientX - canvasRect.left,
          firstTouch.clientY - canvasRect.top
        );
        mobileTouchPanRef.current.active = true;
        mobileTouchPanRef.current.lastX = firstTouch.clientX;
        mobileTouchPanRef.current.lastY = firstTouch.clientY;
        mobileTouchPanRef.current.lastTimestamp = performance.now();
        mobileTouchPanRef.current.lastSurface = getClickPosition(
          viewer.scene,
          firstTouchPosition
        );
        startLongPressTimer(firstTouch);
      }
    };

    if (enableCustomTouchGestures) {
      touchCanvas.addEventListener("touchstart", handleTouchStart, {
        passive: true,
      });
      touchCanvas.addEventListener("touchmove", handleTouchMove, {
        passive: true,
      });
      touchCanvas.addEventListener("touchend", handleTouchEnd, {
        passive: true,
      });
      touchCanvas.addEventListener("touchcancel", handleTouchEnd, {
        passive: true,
      });
    }

    return () => {
      viewer.container.removeEventListener("wheel", preventBrowserZoom);
      if (enableCustomTouchGestures) {
        touchCanvas.removeEventListener("touchstart", handleTouchStart);
        touchCanvas.removeEventListener("touchmove", handleTouchMove);
        touchCanvas.removeEventListener("touchend", handleTouchEnd);
        touchCanvas.removeEventListener("touchcancel", handleTouchEnd);
        resetPanInertia();
        clearLongPressTimer();
      }
      if (isMobile) {
        viewer.scene.postRender.removeEventListener(enforceSatelliteZoomFloor);
      }

      if (!handler.isDestroyed()) {
        handler.destroy();
      }

      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }

      viewerRef.current = null;
      entitiesRef.current = [];
      tilesetRef.current = null;
      tilesetPromiseRef.current = null;
      osmImageryLayerRef.current = null;
      boundaryDataSourceRef.current = null;
      modeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    function renderBoundary() {
      if (boundaryDataSourceRef.current) {
        viewer.dataSources.remove(boundaryDataSourceRef.current, true);
        boundaryDataSourceRef.current = null;
      }

      if (!boundaryGeoJson) {
        viewer.scene.requestRender();
        return;
      }

      try {
        const rings = extractBoundaryLines(boundaryGeoJson);
        if (rings.length === 0) {
          viewer.scene.requestRender();
          return;
        }

        const dataSource = new Cesium.CustomDataSource("boundary");
        rings.forEach((ring) => {
          const flattenedDegrees = ring.flatMap((point) => [point[0], point[1]]);
          dataSource.entities.add({
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray(flattenedDegrees),
              width: 4,
              material: Cesium.Color.fromCssColorString("#ef4444"),
              depthFailMaterial: Cesium.Color.fromCssColorString("#ef4444"),
              clampToGround: true,
            },
          });
        });

        boundaryDataSourceRef.current = dataSource;
        viewer.dataSources.add(dataSource);
        viewer.scene.requestRender();
      } catch (error) {
        console.error("Erreur affichage bordure :", error);
      }
    }

    renderBoundary();
  }, [boundaryGeoJson]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    let cancelled = false;

    const clearGoogleQualityTimeout = () => {
      if (googleQualityTimeoutRef.current) {
        window.clearTimeout(googleQualityTimeoutRef.current);
        googleQualityTimeoutRef.current = null;
      }
    };

    const applyFastThenPremiumGoogleQuality = (tileset) => {
      if (!tileset) return;
      clearGoogleQualityTimeout();
      tileset.maximumScreenSpaceError = GOOGLE_TILESET_FAST_SSE;
      viewer.scene.requestRender();
      googleQualityTimeoutRef.current = window.setTimeout(() => {
        if (cancelled || !tilesetRef.current) return;
        tilesetRef.current.maximumScreenSpaceError = GOOGLE_TILESET_PREMIUM_SSE;
        viewer.scene.requestRender();
      }, GOOGLE_TILESET_FAST_PHASE_MS);
    };

    async function ensureGoogleTileset() {
      if (tilesetRef.current) {
        return tilesetRef.current;
      }

      if (!tilesetPromiseRef.current) {
        tilesetPromiseRef.current = Cesium.Cesium3DTileset.fromIonAssetId(
          GOOGLE_TILES_ASSET_ID,
          {
            showCreditsOnScreen: true,
            preloadWhenHidden: true,
            preloadFlightDestinations: true,
            skipLevelOfDetail: true,
            dynamicScreenSpaceError: true,
            cullWithChildrenBounds: true,
            maximumScreenSpaceError: GOOGLE_TILESET_PREMIUM_SSE,
          }
        )
          .then((tileset) => {
            tileset.preloadWhenHidden = true;
            tileset.preloadFlightDestinations = true;
            tileset.skipLevelOfDetail = true;
            tileset.dynamicScreenSpaceError = true;
            tileset.maximumScreenSpaceError = GOOGLE_TILESET_PREMIUM_SSE;
            tilesetRef.current = tileset;
            if (!viewer.scene.primitives.contains(tileset)) {
              viewer.scene.primitives.add(tileset);
            }
            tileset.show = false;
            viewer.scene.requestRender();
            return tileset;
          })
          .catch((error) => {
            tilesetPromiseRef.current = null;
            throw error;
          });
      }

      return tilesetPromiseRef.current;
    }

    function enableOsm() {
      clearGoogleQualityTimeout();
      if (tilesetRef.current) {
        tilesetRef.current.show = false;
      }

      viewer.scene.globe.show = true;
      viewer.scene.skyBox.show = false;
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#dbeafe");

      if (osmImageryLayerRef.current) {
        osmImageryLayerRef.current.show = true;
        osmImageryLayerRef.current.alpha = 1;
      }

      modeRef.current = "osm";
      setTilesReadyVersion((value) => value + 1);
    }

    async function enableGoogle() {
      const tileset = await withPromiseTimeout(
        ensureGoogleTileset(),
        GOOGLE_TILESET_SWITCH_TIMEOUT_MS,
        "Le chargement initial de la vue satellite est trop long.",
        "GOOGLE_TILESET_TIMEOUT"
      );
      if (cancelled) return;

      viewer.scene.globe.show = true;
      viewer.scene.skyBox.show = false;
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#dbeafe");

      if (osmImageryLayerRef.current) {
        osmImageryLayerRef.current.show = true;
        osmImageryLayerRef.current.alpha = 1;
      }

      tileset.show = true;
      applyFastThenPremiumGoogleQuality(tileset);
      viewer.scene.requestRender();

      modeRef.current = "google3d";
      setTilesReadyVersion((value) => value + 1);

      // Do not block the mode switch on initial tile loading. When tiles become
      // ready, trigger one more refresh so markers can settle on detailed mesh.
      waitForGoogleTilesetReady(tileset).then(() => {
        if (cancelled || modeRef.current !== "google3d") return;
        setTilesReadyVersion((value) => value + 1);
        viewer.scene.requestRender();
      });
    }

    async function enableGoogleWithRetry(maxAttempts = 2) {
      let attempt = 0;
      let lastError = null;

      while (attempt < maxAttempts) {
        attempt += 1;
        try {
          await enableGoogle();
          return;
        } catch (error) {
          lastError = error;
          if (error?.code === "GOOGLE_TILESET_TIMEOUT") {
            throw lastError;
          }
          tilesetPromiseRef.current = null;
          tilesetRef.current = null;
          if (attempt >= maxAttempts) {
            throw lastError;
          }
        }
      }
    }

    async function applyMode() {
      const requestedMode = resolveMode(mapMode);
      if (modeRef.current === requestedMode) return;

      const cameraState = captureCamera(viewer);
      if (requestedMode !== "google3d") {
        cameraState.pitch = Cesium.Math.toRadians(-90);
        cameraState.roll = 0;
        setIsTilted(false);
      }
      startModeTransition(requestedMode);

      try {
        if (requestedMode === "google3d") {
          await enableGoogleWithRetry(2);
        } else {
          enableOsm();
        }
      } catch (error) {
        console.error("Erreur changement de mode carte :", error);
        enableOsm();
        if (requestedMode === "google3d") {
          onSetMapModeRef.current?.("osm");
        }
      } finally {
        if (!cancelled) {
          restoreCamera(viewer, cameraState);
          viewer.scene.requestRender();
          finishModeTransition();
        }
      }
    }

    // Warm up Google tiles in the background so first switch feels instant.
    if (CESIUM_ION_TOKEN) {
      ensureGoogleTileset().catch((error) => {
        console.error("Erreur prechargement Google 3D :", error);
      });
    }

    applyMode();

    return () => {
      cancelled = true;
      clearGoogleQualityTimeout();
    };
  }, [mapMode]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    let cancelled = false;

    async function renderMarkers() {
      const currentSelectedBienId = selectedBienIdRef.current;
      viewer.entities.removeAll();
      entitiesRef.current = [];
      markerDataByIdRef.current = new Map();
      markerStackByBienIdRef.current = new Map();

      const biensAvecCoordonnees = biens
        .filter((bien) => bien.lat != null && bien.lon != null)
        .sort((a, b) => compareMarkerRenderOrder(a, b, currentSelectedBienId));

      const labelGroupAssignments =
        biensAvecCoordonnees.length > 0
          ? buildLabelGroupAssignments(
              [...biensAvecCoordonnees].sort(
                (a, b) => compareMarkerRenderOrder(b, a, currentSelectedBienId)
              )
            )
          : new Map();
      const coordinateStackAssignments =
        biensAvecCoordonnees.length > 0
          ? buildCoordinateStackAssignments(biensAvecCoordonnees, currentSelectedBienId)
          : new Map();
      const addressAnchorAssignments =
        biensAvecCoordonnees.length > 0
          ? buildAddressAnchorAssignments(biensAvecCoordonnees, currentSelectedBienId)
          : new Map();
      const stackGroupsByAnchorId = new Map();

      biensAvecCoordonnees.forEach((bien) => {
        const anchorId = addressAnchorAssignments.get(bien.id) || bien.id;
        if (!stackGroupsByAnchorId.has(anchorId)) {
          stackGroupsByAnchorId.set(anchorId, []);
        }
        stackGroupsByAnchorId.get(anchorId).push(bien);
      });

      const stackByBienId = new Map();
      stackGroupsByAnchorId.forEach((groupBiens) => {
        const orderedGroup = [...groupBiens].sort((a, b) =>
          compareMarkerRenderOrder(b, a, currentSelectedBienId)
        );
        orderedGroup.forEach((bien) => {
          stackByBienId.set(bien.id, orderedGroup);
        });
      });
      markerStackByBienIdRef.current = stackByBienId;
      const isOsmMode = modeRef.current === "osm";
      const rawBienPositions = biensAvecCoordonnees.map((bien) =>
        Cesium.Cartesian3.fromDegrees(bien.lon, bien.lat, 0)
      );
      const rawCustomPositions = customMarkers.map((marker) =>
        Cesium.Cartesian3.fromDegrees(marker.lon, marker.lat, 0)
      );

      const buildFallbackSatellitePosition = (lon, lat) => {
        const cartographic = Cesium.Cartographic.fromDegrees(lon, lat);
        const surfaceHeight = getSurfaceHeight(viewer.scene, cartographic);
        const markerHeight = Number.isFinite(surfaceHeight)
          ? surfaceHeight + SATELLITE_MARKER_HEIGHT_OFFSET_METERS
          : SATELLITE_MARKER_FALLBACK_HEIGHT_METERS;
        return Cesium.Cartesian3.fromRadians(
          cartographic.longitude,
          cartographic.latitude,
          markerHeight
        );
      };
      const elevateCartesianPosition = (position) => {
        if (!position) return null;
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        if (!cartographic) return null;
        return Cesium.Cartesian3.fromRadians(
          cartographic.longitude,
          cartographic.latitude,
          (cartographic.height || 0) + SATELLITE_MARKER_HEIGHT_OFFSET_METERS
        );
      };

      let finalBienPositions = rawBienPositions;
      let finalCustomPositions = rawCustomPositions;

      if (!isOsmMode && tilesetRef.current?.tilesLoaded) {
        try {
          if (rawBienPositions.length > 0) {
            const clampedBiens = await viewer.scene.clampToHeightMostDetailed(
              rawBienPositions
            );
            if (!cancelled && Array.isArray(clampedBiens)) {
              finalBienPositions = clampedBiens.map((position, index) => {
                const elevated = elevateCartesianPosition(position);
                if (elevated) return elevated;
                const bien = biensAvecCoordonnees[index];
                return buildFallbackSatellitePosition(bien.lon, bien.lat);
              });
            }
          }

          if (rawCustomPositions.length > 0) {
            const clampedCustomMarkers = await viewer.scene.clampToHeightMostDetailed(
              rawCustomPositions
            );
            if (!cancelled && Array.isArray(clampedCustomMarkers)) {
              finalCustomPositions = clampedCustomMarkers.map((position, index) => {
                const elevated = elevateCartesianPosition(position);
                if (elevated) return elevated;
                const marker = customMarkers[index];
                return buildFallbackSatellitePosition(marker.lon, marker.lat);
              });
            }
          }
        } catch (error) {
          console.error("Erreur clamp reperes satellite :", error);
          finalBienPositions = biensAvecCoordonnees.map((bien) =>
            buildFallbackSatellitePosition(bien.lon, bien.lat)
          );
          finalCustomPositions = customMarkers.map((marker) =>
            buildFallbackSatellitePosition(marker.lon, marker.lat)
          );
        }
      }

      if (cancelled) return;

      const bienPositionById = new Map();
      biensAvecCoordonnees.forEach((bien, index) => {
        bienPositionById.set(bien.id, finalBienPositions[index] || rawBienPositions[index]);
      });

      biensAvecCoordonnees.forEach((bien, index) => {
        const labelGroup = labelGroupAssignments.get(bien.id) ?? {
          index: 0,
          total: 1,
        };
        const labelOffset =
          labelGroup.total <= 1
            ? { x: 0, y: -20 }
            : getMarkerLabelOffset(labelGroup.index);
        const markerState = getMarkerVisualState(bien, currentSelectedBienId);
        const stackAssignment = coordinateStackAssignments.get(bien.id) ?? {
          index: 0,
          total: 1,
        };
        const basePosition = bienPositionById.get(bien.id) || finalBienPositions[index] || rawBienPositions[index];
        const anchorBienId = addressAnchorAssignments.get(bien.id);
        const pointPosition = anchorBienId
          ? bienPositionById.get(anchorBienId) || basePosition
          : basePosition;
        const shouldShowPoint = stackAssignment.index === 0;
        const isSelected = currentSelectedBienId === bien.id;

        const entity = viewer.entities.add({
          id: buildMarkerEntityId(bien.id, index),
          position: pointPosition,
          point: {
            show: shouldShowPoint,
            pixelSize: markerState.pixelSize,
            color: Cesium.Color[markerState.color.toUpperCase()],
            outlineColor: Cesium.Color.WHITE,
            outlineWidth:
              isSelected && shouldShowPoint ? 5 : markerState.outlineWidth,
            heightReference: isOsmMode
              ? Cesium.HeightReference.CLAMP_TO_GROUND
              : Cesium.HeightReference.NONE,
          },
          label: {
            text: formatMarkerPrix(bien.prix),
            font: markerState.font,
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(labelOffset.x, labelOffset.y),
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            scale: 1.04,
            scaleByDistance: MARKER_LABEL_SCALE_BY_DISTANCE,
            pixelOffsetScaleByDistance: MARKER_LABEL_OFFSET_SCALE_BY_DISTANCE,
            heightReference: isOsmMode
              ? Cesium.HeightReference.CLAMP_TO_GROUND
              : Cesium.HeightReference.NONE,
          },
        });

        entity.bienData = bien;
        entity.showPointByPriority = shouldShowPoint;
        entity.stackBienIds = (stackByBienId.get(bien.id) || [bien]).map((item) => item.id);
        entitiesRef.current.push(entity);
        markerDataByIdRef.current.set(bien.id, bien);
      });

      customMarkers.forEach((marker) => {
        const entity = viewer.entities.add({
          id: marker.id,
          position: finalCustomPositions[customMarkers.indexOf(marker)] || rawCustomPositions[customMarkers.indexOf(marker)],
          point: {
            pixelSize: 12,
            color: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            heightReference: isOsmMode
              ? Cesium.HeightReference.CLAMP_TO_GROUND
              : Cesium.HeightReference.NONE,
          },
          label: {
            text: truncateMarkerNote(marker.note),
            font: "15px sans-serif",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -22),
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            scale: 1.04,
            heightReference: isOsmMode
              ? Cesium.HeightReference.CLAMP_TO_GROUND
              : Cesium.HeightReference.NONE,
          },
        });

        entity.customMarkerData = marker;
      });

      if (!hasInitialFlyRef.current) {
        const initialBien = getReferenceBien();
        if (initialBien) {
          hasInitialFlyRef.current = true;
          focusOnBien(viewer, initialBien, 0.9);
        }
      }

      viewer.scene.requestRender();
    }

    renderMarkers();

    return () => {
      cancelled = true;
    };
  }, [markerRenderKey, customMarkers, tilesReadyVersion]);

  useEffect(() => {
    const nextData = new Map();
    biens.forEach((bien) => {
      nextData.set(bien.id, bien);
    });
    markerDataByIdRef.current = nextData;

    entitiesRef.current.forEach((entity) => {
      const latestBien = nextData.get(entity.bienData?.id);
      if (latestBien) {
        entity.bienData = latestBien;
      }
    });
  }, [biens]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || entitiesRef.current.length === 0) return;

    entitiesRef.current.forEach((entity) => {
      applyEntityVisualState(entity);
    });
    viewer.scene.requestRender();
  }, [selectedBienId]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    let captureTimeoutId = null;

    const scheduleSyncHeightCapture = (delayMs = 1200) => {
      if (captureTimeoutId) {
        window.clearTimeout(captureTimeoutId);
      }
      captureTimeoutId = window.setTimeout(() => {
        rememberSyncPanHeightForCurrentMode(viewer);
      }, delayMs);
    };

    const bounds = getBiensBounds();
    if (bounds) {
      viewer.camera.flyTo({
        destination: bounds,
        duration: 1.1,
        complete: () => rememberSyncPanHeightForCurrentMode(viewer),
      });
      scheduleSyncHeightCapture(1300);
      return () => {
        if (captureTimeoutId) {
          window.clearTimeout(captureTimeoutId);
        }
      };
    }

    const bien = getReferenceBien();
    if (bien) {
      focusOnBien(viewer, bien, 1, () => rememberSyncPanHeightForCurrentMode(viewer));
      scheduleSyncHeightCapture(1300);
    }
    return () => {
      if (captureTimeoutId) {
        window.clearTimeout(captureTimeoutId);
      }
    };
  }, [syncVersion]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !focusBienId || focusBienVersion === 0) return;

    const bien = biens.find((item) => item.id === focusBienId);
    if (!bien || bien.lat == null || bien.lon == null) return;

    focusOnBien(viewer, bien, 0.9);
    onFocusHandledRef.current?.();
  }, [focusBienId, focusBienVersion, biens]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !isMobile) return;

    optimizeTouchNavigation(viewer, touchNavTuningRef.current, mapMode);
    const resolvedMode = resolveMode(mapMode);
    const modeKey = getModeKey(resolvedMode);
    if (!Number.isFinite(syncPanHeightRef.current[modeKey])) {
      rememberSyncPanHeightForMode(viewer, resolvedMode);
    }
    viewer.scene.requestRender();
  }, [isMobile, mapMode, isTilted, touchNavTuning]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || mobilePanel === "desktop") return;

    const refresh = () => {
      refreshViewer(viewer);
      entitiesRef.current.forEach((entity) => {
        applyEntityVisualState(entity);
      });
      viewer.scene.requestRender();
    };

    const timeoutOne = window.setTimeout(refresh, 80);
    const timeoutTwo = window.setTimeout(refresh, 220);

    return () => {
      window.clearTimeout(timeoutOne);
      window.clearTimeout(timeoutTwo);
    };
  }, [mobilePanel]);

  useEffect(() => {
    if (selectedCustomMarker) {
      setMarkerDraftNote(selectedCustomMarker.note || "");
      setMarkerDraftAddress(selectedCustomMarker.address || "");
      setMarkerDraftPhotos(Array.isArray(selectedCustomMarker.photos) ? selectedCustomMarker.photos : []);
    } else if (!pendingMarkerPosition) {
      setMarkerDraftNote("");
      setMarkerDraftAddress("");
      setMarkerDraftPhotos([]);
    }
  }, [selectedCustomMarker, pendingMarkerPosition]);

  async function submitCustomMarker() {
    const note = markerDraftNote.trim();
    if (!note) {
      setMarkerError("Renseigne une note pour ce repere.");
      return;
    }

    setMarkerSaving(true);
    setMarkerError("");

    try {
      const addressCandidates = getMarkerAddressCandidates();
      let targetPosition = pendingMarkerPosition;
      let targetAddress = markerDraftAddress.trim();

      if (markerEditorMode === "address") {
        const selectedAddressCandidate = addressCandidates.find(
          (candidate) =>
            normalizeAddressValue(candidate.label) === normalizeAddressValue(targetAddress)
        );

        if (!selectedAddressCandidate) {
          setMarkerError("Choisis une adresse du code postal actuellement charge.");
          setMarkerSaving(false);
          return;
        }

        targetPosition = {
          lat: selectedAddressCandidate.lat,
          lon: selectedAddressCandidate.lon,
        };
        targetAddress = selectedAddressCandidate.label;
      }

      if (!targetPosition) {
        setMarkerError("Place d'abord un repere sur la carte ou renseigne une adresse.");
        setMarkerSaving(false);
        return;
      }

      if (selectedCustomMarker) {
        await onUpdateCustomMarker?.(
          selectedCustomMarker.id,
          note,
          targetAddress,
          markerDraftPhotos
        );
      } else {
        await onAddCustomMarker?.({
          lat: targetPosition.lat,
          lon: targetPosition.lon,
          note,
          address: targetAddress,
          photos: markerDraftPhotos,
        });
      }

      closeMarkerEditor(true);
      triggerHapticFeedback("success");
    } catch (error) {
      console.error("Erreur sauvegarde repere perso :", error);
      setMarkerError(error.message || "Impossible d'enregistrer ce repere.");
    } finally {
      setMarkerSaving(false);
    }
  }

  async function removeSelectedCustomMarker() {
    if (!selectedCustomMarker) return;

    setMarkerSaving(true);
    setMarkerError("");

    try {
      await onDeleteCustomMarker?.(selectedCustomMarker.id);
      closeMarkerEditor(true);
      triggerHapticFeedback("success");
    } catch (error) {
      console.error("Erreur suppression repere perso :", error);
      setMarkerError(error.message || "Impossible de supprimer ce repere.");
    } finally {
      setMarkerSaving(false);
    }
  }

  async function handleMarkerPhotoInputChange(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setMarkerError("");

    const availableSlots = Math.max(0, MAX_MARKER_PHOTOS - markerDraftPhotos.length);
    if (availableSlots === 0) {
      setMarkerError("Maximum 8 photos atteint pour un repere.");
      event.target.value = "";
      return;
    }

    const filesToProcess = files.slice(0, availableSlots);
    const encodedPhotos = [];
    let photoEncodingError = null;

    try {
      for (const file of filesToProcess) {
        try {
          const encodedPhoto = await convertFileToDataUrl(file);
          encodedPhotos.push(encodedPhoto);
        } catch (error) {
          photoEncodingError = error;
          console.error("Erreur ajout photo repere :", error);
          break;
        }
      }

      if (encodedPhotos.length > 0) {
        setMarkerDraftPhotos((currentPhotos) =>
          [...currentPhotos, ...encodedPhotos].slice(0, MAX_MARKER_PHOTOS)
        );
      }

      if (photoEncodingError) {
        setMarkerError(
          photoEncodingError.message ||
            "Impossible de charger cette photo. Verifie son format."
        );
      }
    } catch (error) {
      console.error("Erreur ajout photo repere :", error);
      setMarkerError("Impossible de charger cette photo.");
    } finally {
      event.target.value = "";
    }
  }

  function handleStartMapMarkerPlacement() {
    setMarkerEditorMode("map");
    setIsAwaitingMarkerPlacement(true);
    setMarkerEditorOpen(false);
    setSelectedCustomMarkerId(null);
    setPendingMarkerPosition(null);
    setMarkerError("");
    triggerHapticFeedback("light");
  }

  function selectStackedMarkerOption(bien) {
    setStackedMarkerOptions([]);
    onSelectBienRef.current?.(bien);
    triggerHapticFeedback("light");
  }

  const toggleTilt = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const selectedBienData = selectedBienId
      ? markerDataByIdRef.current.get(selectedBienId) || null
      : null;
    const canvasCenter = new Cesium.Cartesian2(
      viewer.canvas.clientWidth / 2,
      viewer.canvas.clientHeight / 2
    );
    const focusPosition =
      getClickPosition(viewer.scene, canvasCenter) ||
      (selectedBienData?.lat != null && selectedBienData?.lon != null
        ? Cesium.Cartesian3.fromDegrees(
            selectedBienData.lon,
            selectedBienData.lat,
            0
          )
        : null);

    if (!focusPosition) return;

    const currentMode = resolveMode(mapMode);
    const cameraHeight =
      Cesium.Cartographic.fromCartesian(viewer.camera.positionWC)?.height || 0;
    const topDownRange = Math.max(
      cameraHeight,
      currentMode === "google3d" ? 160 : 850
    );
    const obliqueRange = Math.max(
      topDownRange * (currentMode === "google3d" ? 1.18 : 1.12),
      currentMode === "google3d" ? 220 : 980
    );
    const boundingSphere = new Cesium.BoundingSphere(
      focusPosition,
      currentMode === "google3d" ? 55 : 140
    );
    const nextTiltedValue = !isTilted;

    viewer.camera.flyToBoundingSphere(boundingSphere, {
      offset: new Cesium.HeadingPitchRange(
        viewer.camera.heading,
        nextTiltedValue
          ? Cesium.Math.toRadians(-60)
          : Cesium.Math.toRadians(-90),
        nextTiltedValue ? obliqueRange : topDownRange
      ),
      duration: 0.8,
    });

    setIsTilted(nextTiltedValue);
  };

  const isMapModeTransitioning = modeTransition.active;
  const currentResolvedMode = resolveMode(mapMode);
  const canTiltCurrentView = currentResolvedMode === "google3d";
  const modeTransitionLabel =
    modeTransition.target === "google3d"
      ? "Passage a la vue satellite..."
      : "Passage a la vue plan...";
  const markerAddressCandidates = getMarkerAddressCandidates();

  function handleToggleMapMode() {
    if (isMapModeTransitioning || !canUseGoogle3D) return;
    onToggleMapMode?.();
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 4,
          pointerEvents: "none",
          opacity: isMapModeTransitioning ? 1 : 0,
          transition: "opacity 220ms ease",
          background:
            "linear-gradient(180deg, rgba(8, 15, 28, 0.16) 0%, rgba(8, 15, 28, 0.28) 100%)",
          backdropFilter: isMapModeTransitioning ? "blur(3px)" : "blur(0px)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: isMobile ? 68 : 20,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "10px 14px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.34)",
            background: "rgba(15, 23, 42, 0.72)",
            color: "#f8fafc",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.01em",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.18)",
            opacity: isMapModeTransitioning ? 1 : 0,
            transition: "opacity 180ms ease",
            whiteSpace: "nowrap",
          }}
        >
          {modeTransitionLabel}
        </div>
      </div>

      {topLeftOverlay ? (
        <div
          style={{
            position: "absolute",
            top: isMobile ? 12 : 16,
            left: isMobile ? 12 : 16,
            zIndex: 6,
          }}
        >
          {topLeftOverlay}
        </div>
      ) : null}

      {placingBienId ? (
        <div
          style={{
            position: "absolute",
            top: isMobile ? 64 : 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 7,
            padding: "10px 14px",
            borderRadius: 999,
            border: "1px solid var(--border-color)",
            background: "var(--panel-bg)",
            color: "var(--text-primary)",
            fontWeight: 700,
            boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
            maxWidth: "calc(100% - 32px)",
            textAlign: "center",
          }}
        >
          Clique sur la carte pour placer le bien {placingBienLabel || ""}
        </div>
      ) : null}

      {isAwaitingMarkerPlacement ? (
        <div
          style={{
            position: "absolute",
            top: isMobile ? 64 : 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 7,
            padding: "10px 14px",
            borderRadius: 999,
            border: "1px solid var(--border-color)",
            background: "var(--panel-bg)",
            color: "var(--text-primary)",
            fontWeight: 700,
            boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
            maxWidth: "calc(100% - 32px)",
            textAlign: "center",
          }}
        >
          Clique sur la carte pour placer ton repere note
        </div>
      ) : null}

      {!isMobile ? (
        <button
          onClick={handleToggleMapMode}
          disabled={!canUseGoogle3D || isMapModeTransitioning}
          style={desktopMapButtonStyle(
            20,
            canUseGoogle3D && !isMapModeTransitioning
          )}
          title={
            canUseGoogle3D
              ? mapMode === "google3d"
                ? "Revenir a la vue plan"
                : "Passer a la vue satellite"
              : "Ajoute un token Cesium ion pour activer Google 3D"
          }
        >
          {mapMode === "google3d" ? "Vue plan" : "Vue satellite"}
        </button>
      ) : null}

      {stackedMarkerOptions.length > 1 ? (
        <div style={stackedMarkerPopupContainerStyle()}>
          <div style={stackedMarkerPopupStyle()}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>
              Plusieurs annonces ici
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 10 }}>
              Choisis l'annonce a ouvrir pour cette adresse.
            </div>
            <div style={{ display: "grid", gap: 8, maxHeight: 240, overflowY: "auto" }}>
              {stackedMarkerOptions.map((bien) => (
                <button
                  key={`stack-choice-${bien.id}`}
                  onClick={() => selectStackedMarkerOption(bien)}
                  style={stackedMarkerChoiceButtonStyle()}
                >
                  <span style={{ fontWeight: 700 }}>{formatMarkerPrix(bien.prix)}</span>
                  <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                    {bien.agence || "Agence inconnue"}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStackedMarkerOptions([])}
              style={{ ...markerActionButtonStyle("var(--panel-bg)", "var(--text-primary)", "var(--border-color)"), marginTop: 10 }}
            >
              Fermer
            </button>
          </div>
        </div>
      ) : null}

      {markerEditorOpen ? (
        <div style={markerEditorOverlayStyle()}>
          <div style={markerEditorPopupStyle(isMobile)}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                {selectedCustomMarker ? "Repere perso" : "Nouveau repere"}
              </div>
              <button
                onClick={() => {
                  closeMarkerEditor(true);
                  triggerHapticFeedback("light");
                }}
                style={markerEditorCloseButtonStyle()}
              >
                x
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button
                onClick={handleStartMapMarkerPlacement}
                style={markerModeButtonStyle(markerEditorMode === "map")}
              >
                Placer sur la carte
              </button>
              <button
                onClick={() => {
                  setMarkerEditorMode("address");
                  setIsAwaitingMarkerPlacement(false);
                  markerAddressInputRef.current?.focus();
                }}
                style={markerModeButtonStyle(markerEditorMode === "address")}
              >
                Renseigner une adresse
              </button>
            </div>

            {markerEditorMode === "address" ? (
              <div style={{ marginBottom: 10 }}>
                <input
                  ref={markerAddressInputRef}
                  list="marker-address-candidates"
                  value={markerDraftAddress}
                  onChange={(event) => setMarkerDraftAddress(event.target.value)}
                  placeholder="Adresse du code postal en cours"
                  style={markerInputStyle()}
                />
                <datalist id="marker-address-candidates">
                  {markerAddressCandidates.map((candidate) => (
                    <option key={candidate.key} value={candidate.label} />
                  ))}
                </datalist>
              </div>
            ) : null}

            <textarea
              ref={markerTextareaRef}
              value={markerDraftNote}
              onChange={(event) => setMarkerDraftNote(event.target.value)}
              placeholder="Ex : visite mercredi a 14h"
              style={{
                width: "100%",
                minHeight: 110,
                borderRadius: 12,
                border: "1px solid var(--border-color)",
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                padding: 10,
                fontFamily: "Arial, sans-serif",
                fontSize: 14,
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />

            <div style={{ marginTop: 10 }}>
              <label style={markerPhotoUploadButtonStyle()}>
                Ajouter photo / Prendre photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handleMarkerPhotoInputChange}
                  style={{ display: "none" }}
                />
              </label>
              {markerDraftPhotos.length > 0 ? (
                <div style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 8 }}>
                  {markerDraftPhotos.map((photo, index) => (
                    <div key={`marker-photo-${index}`} style={{ position: "relative" }}>
                      <img
                        src={photo}
                        alt={`Photo repere ${index + 1}`}
                        style={{
                          width: 74,
                          height: 74,
                          borderRadius: 10,
                          objectFit: "cover",
                          border: "1px solid var(--border-color)",
                        }}
                      />
                      <button
                        onClick={() =>
                          setMarkerDraftPhotos((currentPhotos) =>
                            currentPhotos.filter((_, photoIndex) => photoIndex !== index)
                          )
                        }
                        style={markerPhotoRemoveButtonStyle()}
                        title="Retirer"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {markerError ? (
              <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 13 }}>{markerError}</div>
            ) : null}

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                onClick={submitCustomMarker}
                disabled={markerSaving}
                style={markerActionButtonStyle("#111827", "#ffffff")}
              >
                {markerSaving ? "Enregistrement..." : "Enregistrer"}
              </button>
              {selectedCustomMarker ? (
                <button
                  onClick={removeSelectedCustomMarker}
                  disabled={markerSaving}
                  style={markerActionButtonStyle("#ffffff", "#b91c1c", "#fecaca")}
                >
                  Supprimer
                </button>
              ) : (
                <button
                  onClick={() => {
                    closeMarkerEditor(true);
                    triggerHapticFeedback("light");
                  }}
                  disabled={markerSaving}
                  style={markerActionButtonStyle("#ffffff", "#111827", "#e5e7eb")}
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isMobile ? (
        <div style={mobileFloatingControlsStyle()}>
          {canTiltCurrentView ? (
            <button
              onClick={toggleTilt}
              style={mobileFloatingCircleButtonStyle(false)}
              title="Changer l'inclinaison"
            >
              {isTilted ? "2D" : "3D"}
            </button>
          ) : null}

          {showMobileExpandButton && onToggleMobileMapExpanded ? (
            <button
              onClick={onToggleMobileMapExpanded}
              style={mobileFloatingCircleButtonStyle(isMobileMapExpanded)}
              title="Plein ecran"
            >
              <FullscreenIcon expanded={isMobileMapExpanded} />
            </button>
          ) : null}

          <button
            onClick={handleToggleMapMode}
            disabled={!canUseGoogle3D || isMapModeTransitioning}
            style={mobileFloatingPillButtonStyle(
              !canUseGoogle3D || isMapModeTransitioning
            )}
            title={
              canUseGoogle3D
                ? mapMode === "google3d"
                  ? "Revenir a la vue plan"
                  : "Passer a la vue satellite"
                : "Ajoute un token Cesium ion pour activer Google 3D"
            }
          >
            {mapMode === "google3d" ? "Vue plan" : "Vue satellite"}
          </button>
        </div>
      ) : (
        canTiltCurrentView ? (
          <button
            onClick={toggleTilt}
            style={desktopMapButtonStyle(84, true, true)}
            title="Changer l'inclinaison"
          >
            {isTilted ? "2D" : "3D"}
          </button>
        ) : null
      )}
    </div>
  );
}

function FullscreenIcon({ expanded }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ color: "currentColor" }}
    >
      {expanded ? (
        <>
          <path d="M8 4H4V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 4H20V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 16V20H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 20H4V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 9L4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M15 9L20 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M15 15L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M9 15L4 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M4 9V4H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 4H20V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 15V20H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 20H4V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 4L4 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M15 4L20 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M15 20L20 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M9 20L4 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function stackedMarkerPopupContainerStyle() {
  return {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    justifyContent: "center",
    padding: "12px 12px max(12px, env(safe-area-inset-bottom, 0px)) 12px",
    zIndex: 10,
    pointerEvents: "none",
  };
}

function stackedMarkerPopupStyle() {
  return {
    width: "min(420px, 100%)",
    background: "var(--panel-bg)",
    border: "1px solid var(--border-color)",
    borderRadius: 16,
    boxShadow: "0 18px 42px rgba(0,0,0,0.26)",
    padding: 12,
    pointerEvents: "auto",
  };
}

function stackedMarkerChoiceButtonStyle() {
  return {
    width: "100%",
    textAlign: "left",
    display: "grid",
    gap: 4,
    border: "1px solid var(--border-color)",
    borderRadius: 12,
    background: "var(--panel-muted-bg)",
    color: "var(--text-primary)",
    padding: "10px 12px",
    cursor: "pointer",
  };
}

function markerEditorOverlayStyle() {
  return {
    position: "absolute",
    inset: 0,
    zIndex: 12,
    background: "rgba(15, 23, 42, 0.26)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    boxSizing: "border-box",
  };
}

function markerEditorPopupStyle(isMobile) {
  return {
    width: isMobile ? "min(100%, 460px)" : 430,
    maxHeight: "calc(100% - 24px)",
    overflowY: "auto",
    background: "var(--panel-bg)",
    border: "1px solid var(--border-color)",
    borderRadius: 16,
    boxShadow: "0 18px 44px rgba(0,0,0,0.28)",
    padding: 14,
    boxSizing: "border-box",
  };
}

function markerEditorCloseButtonStyle() {
  return {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: "1px solid var(--border-color)",
    background: "var(--panel-muted-bg)",
    color: "var(--text-primary)",
    fontWeight: 700,
    cursor: "pointer",
    lineHeight: 1,
  };
}

function markerModeButtonStyle(active) {
  return {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    border: active ? "1px solid var(--text-primary)" : "1px solid var(--border-color)",
    background: active ? "var(--text-primary)" : "var(--panel-muted-bg)",
    color: active ? "var(--panel-bg)" : "var(--text-primary)",
    fontWeight: 700,
    cursor: "pointer",
    padding: "0 10px",
  };
}

function markerInputStyle() {
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

function markerPhotoUploadButtonStyle() {
  return {
    width: "100%",
    minHeight: 40,
    borderRadius: 12,
    border: "1px dashed var(--border-color)",
    background: "var(--panel-muted-bg)",
    color: "var(--text-primary)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    cursor: "pointer",
    padding: "0 12px",
    boxSizing: "border-box",
  };
}

function markerPhotoRemoveButtonStyle() {
  return {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "1px solid var(--border-color)",
    background: "var(--panel-bg)",
    color: "var(--text-primary)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    lineHeight: 1,
  };
}

function mobileFloatingControlsStyle() {
  return {
    position: "absolute",
    right: 12,
    bottom: "max(10px, env(safe-area-inset-bottom, 0px))",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 8,
    zIndex: 5,
  };
}

function mobileFloatingPillButtonStyle(disabled = false) {
  return {
    minWidth: 132,
    height: 52,
    border: "1px solid var(--control-border)",
    background: "var(--control-bg)",
    color: "var(--text-primary)",
    opacity: disabled ? 0.45 : 1,
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 14,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 16px",
    boxShadow: "var(--control-shadow)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  };
}

function mobileFloatingCircleButtonStyle(active) {
  return {
    width: 52,
    minWidth: 52,
    height: 52,
    border: active ? "1px solid var(--text-primary)" : "1px solid var(--control-border)",
    background: active ? "var(--text-primary)" : "var(--control-bg)",
    color: active ? "var(--panel-bg)" : "var(--text-primary)",
    borderRadius: "50%",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    boxShadow: "var(--control-shadow)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  };
}

function desktopMapButtonStyle(bottom, enabled = true, circular = false) {
  return {
    position: "absolute",
    bottom,
    right: 20,
    minWidth: 52,
    height: 52,
    borderRadius: circular ? "50%" : 999,
    border: "1px solid var(--control-border)",
    background: "var(--control-bg)",
    color: "var(--text-primary)",
    fontWeight: 700,
    fontSize: 14,
    cursor: enabled ? "pointer" : "not-allowed",
    boxShadow: "var(--control-shadow)",
    padding: circular ? "0 12px" : "0 16px",
    opacity: enabled ? 1 : 0.55,
    backdropFilter: "blur(10px)",
  };
}

function markerActionButtonStyle(background, color, borderColor = background) {
  return {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${borderColor}`,
    background,
    color,
    cursor: "pointer",
    fontWeight: 600,
  };
}
