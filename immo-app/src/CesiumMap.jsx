import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import {
  getPostcodeFromCoordinates,
  getStreetSuggestions,
} from "./api";
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
const GOOGLE_TILESET_PREMIUM_SSE = 6;
const GOOGLE_TILESET_FAST_PHASE_MS = 420;
const GOOGLE_TILESET_ULTRA_PHASE_MS = 2600;
const GOOGLE_WARMUP_START_DELAY_MS = 220;
const SATELLITE_WARMUP_MAX_BLOCK_MS = 6500;
const SATELLITE_LOAD_WATCHDOG_MS = 15000;
const DESKTOP_RESOLUTION_SCALE = 1.22;
const DESKTOP_ULTRA_RESOLUTION_SCALE = 1.35;
const DESKTOP_MOVING_RESOLUTION_SCALE = 1.02;
const MOBILE_RESOLUTION_SCALE = 1;
const MOBILE_MOVING_RESOLUTION_SCALE = 0.84;
const IOS_RESOLUTION_SCALE = 0.82;
const DESKTOP_MSAA_SAMPLES = 4;
const DESKTOP_ULTRA_MSAA_SAMPLES = 8;
const DESKTOP_MOVING_MSAA_SAMPLES = 2;
const MOBILE_MSAA_SAMPLES = 2;
const MOBILE_MOVING_MSAA_SAMPLES = 1;
const IOS_MSAA_SAMPLES = 1;
const MOBILE_GOOGLE_TILESET_FAST_SSE = 16;
const MOBILE_GOOGLE_TILESET_PREMIUM_SSE = 9.5;
const MOBILE_GOOGLE_TILESET_MOVING_SSE = 20;
const MOBILE_GOOGLE_TILESET_IDLE_SSE = 8.5;
const DESKTOP_GOOGLE_TILESET_MOVING_SSE = 13;
const DESKTOP_GOOGLE_TILESET_IDLE_SSE = 6;
const DESKTOP_GOOGLE_TILESET_ULTRA_SSE = 3.4;
const MOBILE_GLOBE_SSE_MOVING = 2.2;
const MOBILE_GLOBE_SSE_IDLE = 1.55;
const DESKTOP_GLOBE_SSE_MOVING = 1.45;
const DESKTOP_GLOBE_SSE_IDLE = 1.05;
const DESKTOP_GLOBE_SSE_ULTRA = 0.9;
const DESKTOP_QUALITY_RESTORE_DELAY_MS = 120;
const DESKTOP_QUALITY_ULTRA_DELAY_MS = 780;
const DESKTOP_GOOGLE_OSM_ALPHA = 0.9;
const MOBILE_QUALITY_RESTORE_DELAY_MS = 180;
const MOBILE_GOOGLE_OSM_ALPHA = 0.78;
const MOBILE_QUALITY_ULTRA_DELAY_MS = 980;
const MOBILE_ULTRA_RESOLUTION_SCALE = 1.08;
const MOBILE_GOOGLE_TILESET_ULTRA_SSE = 6.9;
const MOBILE_GLOBE_SSE_ULTRA = 1.24;
const SATELLITE_MOVE_RECOVERY_DELAY_MS = 1600;
const ADAPTIVE_QUALITY_SAMPLE_WINDOW_MS = 1450;
const ADAPTIVE_QUALITY_DROP_FRAME_MS = 34;
const ADAPTIVE_QUALITY_DROP_STREAK_LIMIT = 7;
const ADAPTIVE_QUALITY_RAISE_FPS_MOBILE = 52;
const ADAPTIVE_QUALITY_RAISE_FPS_DESKTOP = 57;
const GOOGLE_TILESET_DESKTOP_CACHE_BYTES = 805_306_368; // 768 MB
const GOOGLE_TILESET_DESKTOP_CACHE_OVERFLOW_BYTES = 402_653_184; // +384 MB
const GOOGLE_TILESET_MOBILE_CACHE_BYTES = 603_979_776; // 576 MB
const GOOGLE_TILESET_MOBILE_CACHE_OVERFLOW_BYTES = 268_435_456; // +256 MB
const GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION = 0.55;
const GOOGLE_TILESET_LOAD_DESIRED_LOD_IMMEDIATELY = false;
const OSM_IMAGERY_MAX_LEVEL = 20;
const GLOBE_TILE_CACHE_SIZE_DESKTOP = 2600;
const GLOBE_TILE_CACHE_SIZE_MOBILE = 1400;
const GLOBE_TILE_CACHE_SIZE_IOS = 650;
const GLOBE_LOADING_DESCENDANT_LIMIT_DESKTOP = 1200;
const GLOBE_LOADING_DESCENDANT_LIMIT_MOBILE = 600;
const GLOBE_LOADING_DESCENDANT_LIMIT_IOS = 220;
const SATELLITE_CLAMP_TIMEOUT_MS = 900;
const SATELLITE_CLAMP_MAX_POSITIONS = 260;
const PLAN_PAN_SPEED_MULTIPLIER = 0.605; // additional -20% from 0.756
const MOBILE_TOUCH_PAN_SENSITIVITY_MULTIPLIER = 3; // +200% on mobile touch pan
// Preserve the "dezoomed" feel while strongly damping pan close to the ground.
const MOBILE_NEAR_ZOOM_PAN_BRAKE_START_MULTIPLIER = 6;
const MOBILE_NEAR_ZOOM_PAN_BRAKE_MIN_FACTOR = 0.28;
const MOBILE_NEAR_ZOOM_PAN_BRAKE_CURVE = 1.35;
const SATELLITE_MIN_GROUND_CLEARANCE_METERS = 40; // hard floor at 40m above ground
const SATELLITE_MARKER_HEIGHT_OFFSET_METERS = 1.7;
const SATELLITE_MARKER_FALLBACK_HEIGHT_METERS = 40;
const SATELLITE_USE_MESH_CLAMP_FOR_MARKERS = false;
const SATELLITE_MARKER_DISABLE_DEPTH_TEST_DISTANCE = Number.POSITIVE_INFINITY;
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
const MARKER_ADDRESS_DEBOUNCE_MS = 260;
const POSTCODE_PATTERN = /\b\d{5}\b/;
const MAP_ZONE_CACHE_STORAGE_KEY = "immo3d_map_zone_cache_v2";
const MAP_ZONE_CACHE_MAX_ENTRIES = 20;
const MAP_ZONE_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SATELLITE_ZONE_LIMIT_PADDING_DEGREES = 0.002;
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

function getPreferredResolutionScale(isMobile, isIOSDevice = false) {
  if (isIOSDevice) return IOS_RESOLUTION_SCALE;
  if (isMobile) return MOBILE_RESOLUTION_SCALE;
  if (typeof window === "undefined") return DESKTOP_RESOLUTION_SCALE;
  const devicePixelRatio = Number(window.devicePixelRatio) || 1;
  const qualityScale = Math.max(
    1.06,
    Math.min(DESKTOP_RESOLUTION_SCALE, devicePixelRatio * 0.9)
  );
  return qualityScale;
}

function getUltraResolutionScale(isIOSDevice = false) {
  if (isIOSDevice) return IOS_RESOLUTION_SCALE;
  if (typeof window === "undefined") return DESKTOP_ULTRA_RESOLUTION_SCALE;
  const devicePixelRatio = Number(window.devicePixelRatio) || 1;
  return Math.max(
    DESKTOP_RESOLUTION_SCALE,
    Math.min(DESKTOP_ULTRA_RESOLUTION_SCALE, devicePixelRatio * 1.02)
  );
}

function canEnableMobileUltraQuality(isIOSDevice = false) {
  if (isIOSDevice) return false;
  if (typeof navigator === "undefined") return true;

  const connectionType = String(navigator.connection?.effectiveType || "").toLowerCase();
  const saveDataEnabled = Boolean(navigator.connection?.saveData);
  const deviceMemoryGb = Number(navigator.deviceMemory || 0);
  const cpuThreads = Number(navigator.hardwareConcurrency || 0);

  if (saveDataEnabled) return false;
  if (connectionType.includes("2g")) return false;
  if (connectionType === "slow-2g") return false;
  if (deviceMemoryGb > 0 && deviceMemoryGb < 4) return false;
  if (cpuThreads > 0 && cpuThreads < 6) return false;

  return true;
}

function tuneImageryLayer(imageryLayer, mode = "satellite") {
  if (!imageryLayer) return;

  if (mode === "satellite") {
    imageryLayer.brightness = 1.04;
    imageryLayer.contrast = 1.1;
    imageryLayer.gamma = 1.02;
    imageryLayer.saturation = 1.08;
    return;
  }

  imageryLayer.brightness = 1;
  imageryLayer.contrast = 1;
  imageryLayer.gamma = 1;
  imageryLayer.saturation = 1;
}

function buildZoneCacheKey(searchZone) {
  const trimmed = String(searchZone || "").trim().toLowerCase();
  if (!trimmed) return "";
  const postcodeMatch = trimmed.match(POSTCODE_PATTERN);
  return postcodeMatch ? `cp:${postcodeMatch[0]}` : `zone:${trimmed}`;
}

function readMapZoneCacheStore() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MAP_ZONE_CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMapZoneCacheStore(nextStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      MAP_ZONE_CACHE_STORAGE_KEY,
      JSON.stringify(nextStore)
    );
  } catch {
    // Ignore storage quota/runtime issues.
  }
}

function compactMapZoneCacheStore(store) {
  const entries = Object.entries(store || {}).filter(([, value]) => {
    const updatedAt = Number(value?.updatedAt) || 0;
    return updatedAt > 0 && Date.now() - updatedAt <= MAP_ZONE_CACHE_TTL_MS;
  });
  entries.sort(
    (a, b) => (Number(b[1]?.updatedAt) || 0) - (Number(a[1]?.updatedAt) || 0)
  );
  return Object.fromEntries(entries.slice(0, MAP_ZONE_CACHE_MAX_ENTRIES));
}

function readZoneCacheEntry(zoneCacheKey) {
  if (!zoneCacheKey) return null;
  const store = compactMapZoneCacheStore(readMapZoneCacheStore());
  writeMapZoneCacheStore(store);
  const entry = store[zoneCacheKey];
  return entry && typeof entry === "object" ? entry : null;
}

function updateZoneCacheEntry(zoneCacheKey, updater) {
  if (!zoneCacheKey) return;
  const store = compactMapZoneCacheStore(readMapZoneCacheStore());
  const previousEntry =
    store[zoneCacheKey] && typeof store[zoneCacheKey] === "object"
      ? store[zoneCacheKey]
      : {};
  const nextEntry = updater(previousEntry) || previousEntry;
  store[zoneCacheKey] = {
    ...nextEntry,
    updatedAt: Date.now(),
  };
  writeMapZoneCacheStore(compactMapZoneCacheStore(store));
}

function captureSerializableCameraState(viewer) {
  const cartographic = viewer?.camera?.positionCartographic;
  if (!cartographic) return null;
  const longitude = Cesium.Math.toDegrees(cartographic.longitude);
  const latitude = Cesium.Math.toDegrees(cartographic.latitude);
  const height = Number(cartographic.height);
  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(height)
  ) {
    return null;
  }
  return {
    longitude,
    latitude,
    height,
    heading: Number(viewer.camera.heading) || 0,
    pitch: Number(viewer.camera.pitch) || Cesium.Math.toRadians(-90),
    roll: Number(viewer.camera.roll) || 0,
  };
}

function restoreSerializableCameraState(viewer, cameraState) {
  if (!viewer || !cameraState) return false;
  const longitude = Number(cameraState.longitude);
  const latitude = Number(cameraState.latitude);
  const height = Number(cameraState.height);
  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(height)
  ) {
    return false;
  }
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
    orientation: {
      heading: Number(cameraState.heading) || 0,
      pitch: Number(cameraState.pitch) || Cesium.Math.toRadians(-90),
      roll: Number(cameraState.roll) || 0,
    },
  });
  return true;
}

function rectangleFromLonLatPoints(points, paddingDegrees = 0) {
  if (!Array.isArray(points) || points.length === 0) return null;
  let west = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  points.forEach((point) => {
    const lon = Number(point?.lon);
    const lat = Number(point?.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  });

  if (
    !Number.isFinite(west) ||
    !Number.isFinite(east) ||
    !Number.isFinite(south) ||
    !Number.isFinite(north)
  ) {
    return null;
  }

  return Cesium.Rectangle.fromDegrees(
    west - paddingDegrees,
    south - paddingDegrees,
    east + paddingDegrees,
    north + paddingDegrees
  );
}

function serializeRectangleDegrees(rectangle) {
  if (!rectangle) return null;
  const west = Cesium.Math.toDegrees(rectangle.west);
  const south = Cesium.Math.toDegrees(rectangle.south);
  const east = Cesium.Math.toDegrees(rectangle.east);
  const north = Cesium.Math.toDegrees(rectangle.north);
  if (
    !Number.isFinite(west) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(north)
  ) {
    return null;
  }
  return { west, south, east, north };
}

function deserializeRectangleDegrees(serializedRectangle) {
  const west = Number(serializedRectangle?.west);
  const south = Number(serializedRectangle?.south);
  const east = Number(serializedRectangle?.east);
  const north = Number(serializedRectangle?.north);
  if (
    !Number.isFinite(west) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(north)
  ) {
    return null;
  }
  return Cesium.Rectangle.fromDegrees(west, south, east, north);
}

function expandRectangleByDegrees(rectangle, paddingDegrees = 0) {
  if (!rectangle || !Number.isFinite(paddingDegrees) || paddingDegrees <= 0) {
    return rectangle || null;
  }
  const paddingRadians = Cesium.Math.toRadians(paddingDegrees);
  const west = Math.max(-Math.PI, rectangle.west - paddingRadians);
  const east = Math.min(Math.PI, rectangle.east + paddingRadians);
  const south = Math.max(-Cesium.Math.PI_OVER_TWO, rectangle.south - paddingRadians);
  const north = Math.min(Cesium.Math.PI_OVER_TWO, rectangle.north + paddingRadians);
  return new Cesium.Rectangle(west, south, east, north);
}

function isSerializedCameraInsideRectangle(
  serializedCamera,
  rectangle,
  paddingDegrees = 0.35
) {
  if (!serializedCamera || !rectangle) return true;
  const longitude = Number(serializedCamera.longitude);
  const latitude = Number(serializedCamera.latitude);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return false;
  const expandedRectangle = expandRectangleByDegrees(rectangle, paddingDegrees);
  const cartographic = Cesium.Cartographic.fromDegrees(longitude, latitude, 0);
  return Cesium.Rectangle.contains(expandedRectangle, cartographic);
}

function waitForGoogleTilesetReady(tileset) {
  if (!tileset || tileset.tilesLoaded) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let finished = false;

    function handleInitialTilesLoaded() {
      complete(true);
    }

    function complete(didLoad = false) {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeoutId);
      tileset.initialTilesLoaded.removeEventListener(handleInitialTilesLoaded);
      resolve(didLoad);
    }

    const timeoutId = window.setTimeout(
      () => complete(false),
      GOOGLE_TILESET_READY_TIMEOUT_MS
    );

    tileset.initialTilesLoaded.addEventListener(handleInitialTilesLoaded);
  });
}

function buildSatelliteFailureMessage(error) {
  const code = String(error?.code || "");
  const rawMessage = String(error?.message || "").toLowerCase();

  if (code === "GOOGLE_TILESET_TIMEOUT") {
    return "Vue satellite indisponible: chargement trop long. Retour en vue plan.";
  }

  if (
    rawMessage.includes("401") ||
    rawMessage.includes("403") ||
    rawMessage.includes("unauthorized") ||
    rawMessage.includes("forbidden")
  ) {
    return "Vue satellite indisponible: token Cesium non autorise pour ce domaine.";
  }

  if (
    rawMessage.includes("network") ||
    rawMessage.includes("failed to fetch") ||
    rawMessage.includes("connection") ||
    rawMessage.includes("dns")
  ) {
    return "Vue satellite indisponible: acces reseau aux tuiles Google 3D bloque.";
  }

  return "Vue satellite indisponible pour le moment. Retour en vue plan.";
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

function optimizeDesktopNavigation(
  viewer,
  tuning = TOUCH_NAV_TUNING,
  mapMode = "osm"
) {
  const controller = viewer.scene.screenSpaceCameraController;
  const resolvedMode = resolveMode(mapMode);
  const satelliteMinimumZoomDistance = getSatelliteMinimumZoomDistance(tuning);

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
  controller.enableRotate = true;
  controller.enableTranslate = true;
  controller.enableZoom = true;
  controller.lookEventTypes = [];
  controller.tiltEventTypes = [];
  controller.rotateEventTypes = Cesium.CameraEventType.LEFT_DRAG;
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
  const nearZoomBrakeStartHeight =
    minZoomHeight * MOBILE_NEAR_ZOOM_PAN_BRAKE_START_MULTIPLIER;
  const nearZoomProgress = Cesium.Math.clamp(
    (nearZoomBrakeStartHeight - currentHeight) /
      Math.max(0.01, nearZoomBrakeStartHeight - minZoomHeight),
    0,
    1
  );
  const nearZoomBrakeFactor = Cesium.Math.lerp(
    1,
    MOBILE_NEAR_ZOOM_PAN_BRAKE_MIN_FACTOR,
    Math.pow(nearZoomProgress, MOBILE_NEAR_ZOOM_PAN_BRAKE_CURVE)
  );

  const baseFactor = Cesium.Math.lerp(1, baseMinFactor, zoomProgress);
  return speedAtSync * baseFactor * nearZoomBrakeFactor;
}

export default function CesiumMap({
  biens,
  allBiens = [],
  searchZone = "",
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
  isIOSDevice = false,
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
  const satelliteWarmupPromiseRef = useRef(null);
  const satelliteWarmupBlockTimeoutRef = useRef(null);
  const worldTerrainProviderRef = useRef(null);
  const ellipsoidTerrainProviderRef = useRef(
    new Cesium.EllipsoidTerrainProvider()
  );
  const osmImageryLayerRef = useRef(null);
  const boundaryDataSourceRef = useRef(null);
  const placementGhostDataSourceRef = useRef(null);
  const placementGhostEntityRef = useRef(null);
  const entitiesRef = useRef([]);
  const markerDataByIdRef = useRef(new Map());
  const modeRef = useRef(null);
  const modeTransitionTimeoutRef = useRef(null);
  const googleQualityTimeoutRef = useRef(null);
  const googleUltraQualityTimeoutRef = useRef(null);
  const desktopQualityRestoreTimeoutRef = useRef(null);
  const desktopUltraRestoreTimeoutRef = useRef(null);
  const mobileQualityRestoreTimeoutRef = useRef(null);
  const mobileUltraRestoreTimeoutRef = useRef(null);
  const qualityRecoverySafetyTimeoutRef = useRef(null);
  const satelliteLoadWatchdogTimeoutRef = useRef(null);
  const adaptiveQualityStateRef = useRef({
    isMoving: false,
    isUltraActive: false,
    lastFrameAt: 0,
    sampleStartAt: 0,
    sampleFrameCount: 0,
    sampleFrameMsTotal: 0,
    dropFrameStreak: 0,
  });
  const appBootTimestampRef = useRef(Date.now());
  const tiltToggleBaseRangeRef = useRef(null);
  const activeZoneCacheKeyRef = useRef(buildZoneCacheKey(searchZone));
  const satelliteViewLimitRectangleRef = useRef(null);
  const zoneCameraRestoreDoneRef = useRef(false);
  const hasInitialFlyRef = useRef(false);
  const mapModeRef = useRef(canUseGoogle3D ? mapMode : "osm");
  const componentMountedRef = useRef(true);
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
  const [markerAddressPostcode, setMarkerAddressPostcode] = useState("");
  const [markerAddressCandidates, setMarkerAddressCandidates] = useState([]);
  const [markerAddressLoading, setMarkerAddressLoading] = useState(false);
  const [markerDraftPhotos, setMarkerDraftPhotos] = useState([]);
  const [markerError, setMarkerError] = useState("");
  const [markerSaving, setMarkerSaving] = useState(false);
  const [markerEditorOpen, setMarkerEditorOpen] = useState(false);
  const [markerEditorMode, setMarkerEditorMode] = useState("map");
  const [isAwaitingMarkerPlacement, setIsAwaitingMarkerPlacement] = useState(false);
  const [stackedMarkerOptions, setStackedMarkerOptions] = useState([]);
  const [tilesReadyVersion, setTilesReadyVersion] = useState(0);
  const [isSatelliteReady, setIsSatelliteReady] = useState(false);
  const [isSatelliteWarmupBlockExpired, setIsSatelliteWarmupBlockExpired] =
    useState(false);
  const [satelliteIssueMessage, setSatelliteIssueMessage] = useState("");
  const [modeTransition, setModeTransition] = useState({
    active: false,
    target: null,
  });
  const isSatelliteReadyRef = useRef(false);

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
    mapModeRef.current = canUseGoogle3D ? mapMode : "osm";
  }, [mapMode, canUseGoogle3D]);

  useEffect(() => {
    isSatelliteReadyRef.current = isSatelliteReady;
  }, [isSatelliteReady]);

  useEffect(() => {
    touchNavTuningRef.current = touchNavTuning || TOUCH_NAV_TUNING;
  }, [touchNavTuning]);

  useEffect(() => {
    const zoneCacheKey = buildZoneCacheKey(searchZone);
    activeZoneCacheKeyRef.current = zoneCacheKey;
    zoneCameraRestoreDoneRef.current = false;
  }, [searchZone]);

  useEffect(() => {
    const zoneCacheKey = activeZoneCacheKeyRef.current;
    const computedRectangle = getSatelliteViewLimitRectangle();
    if (computedRectangle) {
      satelliteViewLimitRectangleRef.current = computedRectangle;
      const serializedRectangle = serializeRectangleDegrees(computedRectangle);
      if (zoneCacheKey && serializedRectangle) {
        updateZoneCacheEntry(zoneCacheKey, (previousEntry) => ({
          ...previousEntry,
          zoneRectangle: serializedRectangle,
        }));
      }
      return;
    }

    const cachedRectangle = deserializeRectangleDegrees(
      readZoneCacheEntry(zoneCacheKey)?.zoneRectangle
    );
    satelliteViewLimitRectangleRef.current = cachedRectangle;
  }, [boundaryGeoJson, biens, searchZone]);

  useEffect(() => {
    isTiltedRef.current = isTilted;
  }, [isTilted]);

  useEffect(() => {
    isAwaitingMarkerPlacementRef.current = isAwaitingMarkerPlacement;
    if (!isAwaitingMarkerPlacement) {
      hidePlacementGhost();
    }
  }, [isAwaitingMarkerPlacement]);

  useEffect(() => {
    selectedCustomMarkerIdRef.current = selectedCustomMarkerId;
  }, [selectedCustomMarkerId]);

  useEffect(() => {
    markerEditorOpenRef.current = markerEditorOpen;
  }, [markerEditorOpen]);

  useEffect(() => {
    return () => {
      componentMountedRef.current = false;
      if (modeTransitionTimeoutRef.current) {
        window.clearTimeout(modeTransitionTimeoutRef.current);
      }
      if (satelliteWarmupBlockTimeoutRef.current) {
        window.clearTimeout(satelliteWarmupBlockTimeoutRef.current);
      }
      if (googleQualityTimeoutRef.current) {
        window.clearTimeout(googleQualityTimeoutRef.current);
      }
      if (googleUltraQualityTimeoutRef.current) {
        window.clearTimeout(googleUltraQualityTimeoutRef.current);
      }
      if (desktopQualityRestoreTimeoutRef.current) {
        window.clearTimeout(desktopQualityRestoreTimeoutRef.current);
      }
      if (desktopUltraRestoreTimeoutRef.current) {
        window.clearTimeout(desktopUltraRestoreTimeoutRef.current);
      }
      if (mobileQualityRestoreTimeoutRef.current) {
        window.clearTimeout(mobileQualityRestoreTimeoutRef.current);
      }
      if (mobileUltraRestoreTimeoutRef.current) {
        window.clearTimeout(mobileUltraRestoreTimeoutRef.current);
      }
      if (qualityRecoverySafetyTimeoutRef.current) {
        window.clearTimeout(qualityRecoverySafetyTimeoutRef.current);
      }
      if (satelliteLoadWatchdogTimeoutRef.current) {
        window.clearTimeout(satelliteLoadWatchdogTimeoutRef.current);
      }
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  function clearQualityRecoverySafetyTimeout() {
    if (!qualityRecoverySafetyTimeoutRef.current) return;
    window.clearTimeout(qualityRecoverySafetyTimeoutRef.current);
    qualityRecoverySafetyTimeoutRef.current = null;
  }

  function clearSatelliteLoadWatchdogTimeout() {
    if (!satelliteLoadWatchdogTimeoutRef.current) return;
    window.clearTimeout(satelliteLoadWatchdogTimeoutRef.current);
    satelliteLoadWatchdogTimeoutRef.current = null;
  }

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

  function setSatelliteReadySafely(nextReadyValue) {
    if (!componentMountedRef.current) return;
    setIsSatelliteReady((previousValue) => {
      if (previousValue === nextReadyValue) {
        return previousValue;
      }
      return nextReadyValue;
    });
  }

  function setSatelliteWarmupBlockExpiredSafely(nextValue) {
    if (!componentMountedRef.current) return;
    setIsSatelliteWarmupBlockExpired((previousValue) => {
      if (previousValue === nextValue) {
        return previousValue;
      }
      return nextValue;
    });
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

  function extractPostcode(value) {
    const match = String(value || "").match(POSTCODE_PATTERN);
    return match ? match[0] : "";
  }

  function getDefaultPostcodeFromBiens() {
    const sourceBiens = Array.isArray(allBiens) && allBiens.length > 0 ? allBiens : biens;
    const postcodeSet = new Set();

    sourceBiens.forEach((bien) => {
      const address = String(bien.adresse || "").trim();
      if (!address) return;
      const postcode = extractPostcode(address);
      if (postcode) postcodeSet.add(postcode);
    });

    if (postcodeSet.size === 1) {
      return [...postcodeSet][0];
    }
    return "";
  }

  async function resolveMarkerAddressPostcode() {
    const fromSearchZone = extractPostcode(searchZone);
    if (fromSearchZone) return fromSearchZone;

    const fromDraftAddress = extractPostcode(markerDraftAddress);
    if (fromDraftAddress) return fromDraftAddress;

    if (selectedCustomMarker?.address) {
      const fromMarkerAddress = extractPostcode(selectedCustomMarker.address);
      if (fromMarkerAddress) return fromMarkerAddress;
    }

    if (pendingMarkerPosition?.lat != null && pendingMarkerPosition?.lon != null) {
      try {
        const data = await getPostcodeFromCoordinates(
          pendingMarkerPosition.lat,
          pendingMarkerPosition.lon
        );
        const fromCoordinates = extractPostcode(data?.postcode);
        if (fromCoordinates) return fromCoordinates;
      } catch (error) {
        console.warn("Impossible de recuperer le code postal du repere :", error);
      }
    }

    return getDefaultPostcodeFromBiens();
  }

  function closeMarkerEditor(clearPending = true) {
    if (clearPending) {
      setPendingMarkerPosition(null);
    }
    setSelectedCustomMarkerId(null);
    setMarkerDraftNote("");
    setMarkerDraftAddress("");
    setMarkerAddressPostcode("");
    setMarkerAddressCandidates([]);
    setMarkerAddressLoading(false);
    setMarkerDraftPhotos([]);
    setMarkerError("");
    setMarkerEditorMode("map");
    setMarkerEditorOpen(false);
    setIsAwaitingMarkerPlacement(false);
    hidePlacementGhost();
  }

function openMarkerEditorAtPosition(position) {
    setPendingMarkerPosition(position);
    setSelectedCustomMarkerId(null);
    setMarkerDraftNote("");
    setMarkerDraftAddress("");
    setMarkerAddressPostcode("");
    setMarkerAddressCandidates([]);
    setMarkerAddressLoading(false);
    setMarkerDraftPhotos([]);
    setMarkerError("");
    setMarkerEditorMode("map");
    setMarkerEditorOpen(true);
    setIsAwaitingMarkerPlacement(false);
  }

  function applyMarkerPlacementPosition(position) {
    setPendingMarkerPosition(position);
    setIsAwaitingMarkerPlacement(false);
    setMarkerEditorMode("map");
    setMarkerEditorOpen(true);
    setMarkerError("");
    hidePlacementGhost();
  }

  function hidePlacementGhost() {
    const ghostEntity = placementGhostEntityRef.current;
    if (!ghostEntity) return;
    ghostEntity.show = false;
  }

  function updatePlacementGhost(positionCartesian) {
    const ghostEntity = placementGhostEntityRef.current;
    if (!ghostEntity) return;
    if (!positionCartesian) {
      ghostEntity.show = false;
      return;
    }
    ghostEntity.position = positionCartesian;
    ghostEntity.show = true;
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

  function getSatelliteViewLimitRectangle() {
    const fallbackPoints = biens
      .filter((bien) => bien.lat != null && bien.lon != null)
      .map((bien) => ({ lon: bien.lon, lat: bien.lat }));
    const fallbackRectangle = rectangleFromLonLatPoints(
      fallbackPoints,
      SATELLITE_ZONE_LIMIT_PADDING_DEGREES
    );
    if (fallbackRectangle) return fallbackRectangle;

    const boundaryLines = extractBoundaryLines(boundaryGeoJson);
    if (boundaryLines.length > 0) {
      const points = boundaryLines.flatMap((ring) =>
        ring.map((point) => ({
          lon: Number(point?.[0]),
          lat: Number(point?.[1]),
        }))
      );
      const boundaryRectangle = rectangleFromLonLatPoints(
        points,
        SATELLITE_ZONE_LIMIT_PADDING_DEGREES
      );
      if (boundaryRectangle) return boundaryRectangle;
    }
    return null;
  }

  function persistCurrentCameraInZoneCache(viewer) {
    const zoneCacheKey = activeZoneCacheKeyRef.current;
    if (!zoneCacheKey) return;
    const cameraState = captureSerializableCameraState(viewer);
    if (!cameraState) return;
    updateZoneCacheEntry(zoneCacheKey, (previousEntry) => ({
      ...previousEntry,
      camera: cameraState,
      lastMode: resolveMode(mapModeRef.current),
    }));
  }

  function restoreCameraFromZoneCache(viewer) {
    const zoneCacheKey = activeZoneCacheKeyRef.current;
    if (!zoneCacheKey) return false;
    const entry = readZoneCacheEntry(zoneCacheKey);
    const cachedCamera = entry?.camera;
    if (!cachedCamera) return false;

    const expectedRectangle = satelliteViewLimitRectangleRef.current || getBiensBounds();
    if (
      expectedRectangle &&
      !isSerializedCameraInsideRectangle(cachedCamera, expectedRectangle)
    ) {
      updateZoneCacheEntry(zoneCacheKey, (previousEntry) => {
        if (!previousEntry || typeof previousEntry !== "object") return {};
        const rest = { ...previousEntry };
        delete rest.camera;
        return rest;
      });
      return false;
    }

    const restored = restoreSerializableCameraState(viewer, cachedCamera);
    if (restored) {
      zoneCameraRestoreDoneRef.current = true;
      viewer.scene.requestRender();
    }
    return restored;
  }

  function clampSatelliteCameraToZoneRectangle(viewer) {
    if (resolveMode(mapModeRef.current) !== "google3d") return;
    const rectangle = satelliteViewLimitRectangleRef.current;
    if (!rectangle) return;

    const cartographic = viewer.camera.positionCartographic;
    if (!cartographic) return;
    const clampedLongitude = Cesium.Math.clamp(
      cartographic.longitude,
      rectangle.west,
      rectangle.east
    );
    const clampedLatitude = Cesium.Math.clamp(
      cartographic.latitude,
      rectangle.south,
      rectangle.north
    );
    const movedLongitude = Math.abs(clampedLongitude - cartographic.longitude);
    const movedLatitude = Math.abs(clampedLatitude - cartographic.latitude);
    if (movedLongitude < 1e-10 && movedLatitude < 1e-10) return;

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromRadians(
        clampedLongitude,
        clampedLatitude,
        cartographic.height
      ),
      orientation: {
        heading: viewer.camera.heading,
        pitch: viewer.camera.pitch,
        roll: viewer.camera.roll,
      },
    });
    viewer.scene.requestRender();
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
    let disposed = false;

    containerRef.current.style.touchAction = "none";
    containerRef.current.style.overscrollBehavior = "none";

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      requestRenderMode: isMobile,
      maximumRenderTimeChange: isMobile ? Number.POSITIVE_INFINITY : 0,
      sceneModePicker: false,
      timeline: false,
      animation: false,
      infoBox: false,
      selectionIndicator: false,
      contextOptions: {
        webgl: {
          antialias: !isIOSDevice,
          powerPreference: isIOSDevice ? "low-power" : "high-performance",
        },
      },
      msaaSamples:
        isIOSDevice ? IOS_MSAA_SAMPLES : isMobile ? MOBILE_MSAA_SAMPLES : DESKTOP_MSAA_SAMPLES,
    });

    viewerRef.current = viewer;
    const creditContainer = viewer.cesiumWidget?.creditContainer;
    if (creditContainer) {
      creditContainer.style.left = "auto";
      creditContainer.style.right = isMobile ? "4px" : "6px";
      creditContainer.style.bottom = isMobile ? "4px" : "6px";
      creditContainer.style.top = "auto";
      creditContainer.style.transformOrigin = "right bottom";
      creditContainer.style.transform = isMobile ? "scale(0.58)" : "scale(0.64)";
      creditContainer.style.opacity = "0.4";
      creditContainer.style.padding = "0 2px";
      creditContainer.style.borderRadius = "6px";
      creditContainer.style.background = "rgba(15, 23, 42, 0.18)";
      creditContainer.style.backdropFilter = "none";
      creditContainer.style.fontSize = "9px";
      creditContainer.style.lineHeight = "1";
      creditContainer.style.zIndex = "5";
    }
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
    const preventContextMenu = (event) => {
      event.preventDefault();
    };
    viewer.container.addEventListener("wheel", preventBrowserZoom, {
      passive: false,
    });
    viewer.container.addEventListener("contextmenu", preventContextMenu);
    viewer.selectedEntity = undefined;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.globe.maximumScreenSpaceError = isIOSDevice
      ? 2.4
      : isMobile
        ? MOBILE_GLOBE_SSE_IDLE
        : 1.05;
    viewer.scene.globe.preloadAncestors = !isIOSDevice;
    viewer.scene.globe.preloadSiblings = !isIOSDevice;
    viewer.scene.globe.tileCacheSize = isIOSDevice
      ? GLOBE_TILE_CACHE_SIZE_IOS
      : isMobile
        ? GLOBE_TILE_CACHE_SIZE_MOBILE
        : GLOBE_TILE_CACHE_SIZE_DESKTOP;
    viewer.scene.globe.loadingDescendantLimit = isIOSDevice
      ? GLOBE_LOADING_DESCENDANT_LIMIT_IOS
      : isMobile
        ? GLOBE_LOADING_DESCENDANT_LIMIT_MOBILE
        : GLOBE_LOADING_DESCENDANT_LIMIT_DESKTOP;
    viewer.scene.globe.showGroundAtmosphere = false;
    viewer.scene.skyAtmosphere.show = !isIOSDevice;
    viewer.scene.skyBox.show = false;
    viewer.scene.fog.enabled = false;
    viewer.scene.highDynamicRange = !isIOSDevice;
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#dbeafe");
    viewer.scene.fxaa = false;
    if (viewer.scene.postProcessStages?.fxaa) {
      viewer.scene.postProcessStages.fxaa.enabled = false;
    }
    viewer.terrainProvider = ellipsoidTerrainProviderRef.current;
    viewer.targetFrameRate = isIOSDevice ? 30 : 60;
    viewer.useBrowserRecommendedResolution = isIOSDevice;
    viewer.resolutionScale = getPreferredResolutionScale(isMobile, isIOSDevice);
    viewer.scene.msaaSamples =
      isIOSDevice ? IOS_MSAA_SAMPLES : isMobile ? MOBILE_MSAA_SAMPLES : DESKTOP_MSAA_SAMPLES;
    if (isMobile) {
      optimizeTouchNavigation(
        viewer,
        touchNavTuningRef.current,
        mapModeRef.current
      );
    } else {
      optimizeDesktopNavigation(
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
    const enforceSatelliteZoneLimit = () => {
      clampSatelliteCameraToZoneRectangle(viewer);
    };
    const saveCameraStateOnMoveEnd = () => {
      persistCurrentCameraInZoneCache(viewer);
    };
    if (isMobile) {
      viewer.scene.postRender.addEventListener(enforceSatelliteZoomFloor);
    }
    viewer.scene.postRender.addEventListener(enforceSatelliteZoneLimit);
    viewer.camera.moveEnd.addEventListener(saveCameraStateOnMoveEnd);
    viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );
    viewer.imageryLayers.removeAll();
    osmImageryLayerRef.current = viewer.imageryLayers.addImageryProvider(
      new Cesium.OpenStreetMapImageryProvider({
        url: "https://tile.openstreetmap.org/",
        maximumLevel: OSM_IMAGERY_MAX_LEVEL,
        enablePickFeatures: false,
      })
    );
    tuneImageryLayer(osmImageryLayerRef.current, "plan");
    modeRef.current = "osm";

    const ghostDataSource = new Cesium.CustomDataSource("note-placement-ghost");
    viewer.dataSources.add(ghostDataSource);
    placementGhostDataSourceRef.current = ghostDataSource;
    placementGhostEntityRef.current = ghostDataSource.entities.add({
      position: undefined,
      point: {
        pixelSize: 13,
        color: Cesium.Color.WHITE.withAlpha(0.42),
        outlineColor: Cesium.Color.WHITE.withAlpha(0.9),
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.NONE,
      },
      show: false,
    });

    if (canUseGoogle3D && CESIUM_ION_TOKEN) {
      Cesium.createWorldTerrainAsync({
        requestVertexNormals: !isMobile,
        requestWaterMask: !isMobile,
      })
        .then((terrainProvider) => {
          if (disposed || viewer.isDestroyed()) return;
          worldTerrainProviderRef.current = terrainProvider;
          if (modeRef.current === "google3d") {
            viewer.terrainProvider = terrainProvider;
            viewer.scene.globe.maximumScreenSpaceError = isIOSDevice
              ? 2.1
              : isMobile
                ? MOBILE_GLOBE_SSE_IDLE
                : 0.85;
          }
          viewer.scene.requestRender();
        })
        .catch((error) => {
          console.warn(
            "Impossible de charger Cesium World Terrain, terrain ellipsoidal conserve.",
            error
          );
        });
    }

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

      if (isAwaitingMarkerPlacementRef.current) {
        const cartesian = getClickPosition(viewer.scene, click.position);
        if (!cartesian) return;

        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const position = {
          lat: Cesium.Math.toDegrees(cartographic.latitude),
          lon: Cesium.Math.toDegrees(cartographic.longitude),
        };
        applyMarkerPlacementPosition(position);
        triggerHapticFeedback("light");
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

      if (isMobile) {
        return;
      }

      openMarkerEditorAtPosition(position);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction((click) => {
      if (isMobile || !click?.position) return;
      if (placingBienIdRef.current) return;

      const cartesian = getClickPosition(viewer.scene, click.position);
      if (!cartesian) return;

      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const position = {
        lat: Cesium.Math.toDegrees(cartographic.latitude),
        lon: Cesium.Math.toDegrees(cartographic.longitude),
      };

      if (isAwaitingMarkerPlacementRef.current) {
        applyMarkerPlacementPosition(position);
        triggerHapticFeedback("light");
        return;
      }

      setStackedMarkerOptions([]);
      setMarkerError("");
      setSelectedCustomMarkerId(null);
      openMarkerEditorAtPosition(position);
      triggerHapticFeedback("light");
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    handler.setInputAction((movement) => {
      if (isMobile || !isAwaitingMarkerPlacementRef.current) {
        hidePlacementGhost();
        return;
      }

      const pointerPosition = movement?.endPosition;
      if (!pointerPosition) {
        hidePlacementGhost();
        return;
      }

      const cartesian = getClickPosition(viewer.scene, pointerPosition);
      updatePlacementGhost(cartesian || null);
      viewer.scene.requestRender();
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    const touchCanvas = viewer.scene.canvas;
    const enableCustomTouchGestures = isMobile && hasTouchInput();
    const screenSpaceController = viewer.scene.screenSpaceCameraController;

    if (enableCustomTouchGestures) {
      // Custom touch pan is handled below. Disable Cesium one-finger translate
      // to avoid duplicate movement and inconsistent sensitivity by mode.
      screenSpaceController.translateEventTypes = [];
      screenSpaceController.inertiaTranslate = 0;
    }

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

    const moveCameraForTouchPan = (deltaX, deltaY, moveScale) => {
      const rightAmount = -deltaX * moveScale;
      const upAmount = deltaY * moveScale;
      viewer.camera.moveRight(rightAmount);
      viewer.camera.moveUp(upAmount);
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
      });
      const basePanFactor = Cesium.Math.clamp(effectiveSpeed / 10, 0.01, 8);

      // Keep identical pan tuning in plan and satellite to avoid jumpy terrain-pick deltas.
      const moveScale = Cesium.Math.clamp(
        basePanFactor *
          PLAN_PAN_SPEED_MULTIPLIER *
          MOBILE_TOUCH_PAN_SENSITIVITY_MULTIPLIER,
        0.02,
        12
      );
      moveCameraForTouchPan(deltaX, deltaY, moveScale);
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

    const startPanInertia = () => {
      const state = touchPanInertiaRef.current;
      stopPanInertia();

      const initialPixelSpeed = Math.hypot(state.velocityX, state.velocityY);
      if (initialPixelSpeed < TOUCH_PAN_INERTIA.minStartSpeedPxPerMs) {
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

        if (elapsed >= TOUCH_PAN_INERTIA.maxDurationMs) {
          resetPanInertia();
          return;
        }

        const tuning = touchNavTuningRef.current;
        const currentMode = resolveMode(mapModeRef.current);
        const speed = Math.hypot(state.velocityX, state.velocityY);
        if (speed < TOUCH_PAN_INERTIA.minStopSpeedPxPerMs) {
          resetPanInertia();
          return;
        }
        const deltaX = state.velocityX * frameDeltaMs;
        const deltaY = state.velocityY * frameDeltaMs;
        applyPanInertiaDelta(deltaX, deltaY, currentMode, tuning);

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

    const startLongPressTimer = () => {
      // Marker creation on mobile is now exclusively done through the "+" button.
    };

    const handleTouchStart = (event) => {
      event.preventDefault();
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
      event.preventDefault();
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
        });
        const basePanFactor = Cesium.Math.clamp(effectiveSpeed / 10, 0.01, 8);
        touchPanInertiaRef.current.worldVelocity = 0;
        mobileTouchPanRef.current.lastSurface = null;
        const moveScale = Cesium.Math.clamp(
          basePanFactor *
            PLAN_PAN_SPEED_MULTIPLIER *
            MOBILE_TOUCH_PAN_SENSITIVITY_MULTIPLIER,
          0.02,
          12
        );
        moveCameraForTouchPan(deltaX, deltaY, moveScale);
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
      event.preventDefault();
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
        passive: false,
      });
      touchCanvas.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
      touchCanvas.addEventListener("touchend", handleTouchEnd, {
        passive: false,
      });
      touchCanvas.addEventListener("touchcancel", handleTouchEnd, {
        passive: false,
      });
    }

    return () => {
      disposed = true;
      viewer.container.removeEventListener("wheel", preventBrowserZoom);
      viewer.container.removeEventListener("contextmenu", preventContextMenu);
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
      viewer.scene.postRender.removeEventListener(enforceSatelliteZoneLimit);
      viewer.camera.moveEnd.removeEventListener(saveCameraStateOnMoveEnd);

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
      satelliteWarmupPromiseRef.current = null;
      worldTerrainProviderRef.current = null;
      osmImageryLayerRef.current = null;
      boundaryDataSourceRef.current = null;
      placementGhostEntityRef.current = null;
      placementGhostDataSourceRef.current = null;
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
    let warmupTimerId = null;

    if (canUseGoogle3D && CESIUM_ION_TOKEN) {
      setSatelliteReadySafely(Boolean(tilesetRef.current));
      setSatelliteWarmupBlockExpiredSafely(false);
    } else {
      setSatelliteReadySafely(false);
      setSatelliteWarmupBlockExpiredSafely(false);
    }

    const clearGoogleQualityTimeout = () => {
      if (googleQualityTimeoutRef.current) {
        window.clearTimeout(googleQualityTimeoutRef.current);
        googleQualityTimeoutRef.current = null;
      }
      if (googleUltraQualityTimeoutRef.current) {
        window.clearTimeout(googleUltraQualityTimeoutRef.current);
        googleUltraQualityTimeoutRef.current = null;
      }
    };

    const clearMobileQualityRestoreTimeout = () => {
      if (mobileQualityRestoreTimeoutRef.current) {
        window.clearTimeout(mobileQualityRestoreTimeoutRef.current);
        mobileQualityRestoreTimeoutRef.current = null;
      }
    };

    const clearMobileUltraRestoreTimeout = () => {
      if (mobileUltraRestoreTimeoutRef.current) {
        window.clearTimeout(mobileUltraRestoreTimeoutRef.current);
        mobileUltraRestoreTimeoutRef.current = null;
      }
    };

    const resetAdaptiveQualityStats = () => {
      adaptiveQualityStateRef.current.lastFrameAt = 0;
      adaptiveQualityStateRef.current.sampleStartAt = 0;
      adaptiveQualityStateRef.current.sampleFrameCount = 0;
      adaptiveQualityStateRef.current.sampleFrameMsTotal = 0;
      adaptiveQualityStateRef.current.dropFrameStreak = 0;
    };

    const scheduleQualityRecoverySafety = () => {
      clearQualityRecoverySafetyTimeout();
      qualityRecoverySafetyTimeoutRef.current = window.setTimeout(() => {
        if (cancelled) return;
        if (isMobile && !isIOSDevice) {
          clearMobileQualityRestoreTimeout();
          clearMobileUltraRestoreTimeout();
          applyMobileIdleQuality();
          return;
        }
        if (!isMobile) {
          clearDesktopQualityRestoreTimeouts();
          applyDesktopIdleQuality();
          if (modeRef.current === "google3d") {
            desktopUltraRestoreTimeoutRef.current = window.setTimeout(() => {
              if (cancelled) return;
              applyDesktopUltraQuality();
            }, DESKTOP_QUALITY_ULTRA_DELAY_MS);
          }
        }
      }, SATELLITE_MOVE_RECOVERY_DELAY_MS);
    };

    const startSatelliteLoadWatchdog = () => {
      clearSatelliteLoadWatchdogTimeout();
      satelliteLoadWatchdogTimeoutRef.current = window.setTimeout(() => {
        if (cancelled) return;
        if (modeRef.current !== "google3d") return;
        if (isSatelliteReadyRef.current) return;
        if (tilesetRef.current?.tilesLoaded) return;

        const timeoutError = createTimeoutError(
          "Le flux satellite n'a pas charge de tuiles initiales a temps.",
          "GOOGLE_TILESET_WATCHDOG_TIMEOUT"
        );
        console.warn("Watchdog satellite:", timeoutError);
        setSatelliteIssueMessage(buildSatelliteFailureMessage(timeoutError));
        setSatelliteReadySafely(false);
        enableOsm();
        onSetMapModeRef.current?.("osm");
      }, SATELLITE_LOAD_WATCHDOG_MS);
    };

    const clearDesktopQualityRestoreTimeouts = () => {
      if (desktopQualityRestoreTimeoutRef.current) {
        window.clearTimeout(desktopQualityRestoreTimeoutRef.current);
        desktopQualityRestoreTimeoutRef.current = null;
      }
      if (desktopUltraRestoreTimeoutRef.current) {
        window.clearTimeout(desktopUltraRestoreTimeoutRef.current);
        desktopUltraRestoreTimeoutRef.current = null;
      }
    };

    const allowMobileUltraQuality = canEnableMobileUltraQuality(isIOSDevice);

    const applyDesktopMovingQuality = (tileset = tilesetRef.current) => {
      if (isMobile) return;

      adaptiveQualityStateRef.current.isUltraActive = false;
      viewer.scene.msaaSamples = DESKTOP_MOVING_MSAA_SAMPLES;
      viewer.resolutionScale = DESKTOP_MOVING_RESOLUTION_SCALE;
      viewer.scene.globe.maximumScreenSpaceError = DESKTOP_GLOBE_SSE_MOVING;

      if (tileset && modeRef.current === "google3d") {
        tileset.maximumScreenSpaceError = DESKTOP_GOOGLE_TILESET_MOVING_SSE;
        tileset.dynamicScreenSpaceError = true;
        tileset.foveatedScreenSpaceError = true;
        tileset.cullRequestsWhileMoving = false;
      }

      if (osmImageryLayerRef.current && modeRef.current === "google3d") {
        osmImageryLayerRef.current.alpha = DESKTOP_GOOGLE_OSM_ALPHA;
      }

      viewer.scene.requestRender();
    };

    const applyDesktopIdleQuality = (tileset = tilesetRef.current) => {
      if (isMobile) return;

      adaptiveQualityStateRef.current.isUltraActive = false;
      viewer.scene.msaaSamples = DESKTOP_MSAA_SAMPLES;
      viewer.resolutionScale = getPreferredResolutionScale(false, isIOSDevice);
      viewer.scene.globe.maximumScreenSpaceError = DESKTOP_GLOBE_SSE_IDLE;

      if (tileset && modeRef.current === "google3d") {
        tileset.maximumScreenSpaceError = DESKTOP_GOOGLE_TILESET_IDLE_SSE;
        tileset.dynamicScreenSpaceError = false;
        tileset.foveatedScreenSpaceError = false;
        tileset.cullRequestsWhileMoving = false;
      }

      if (osmImageryLayerRef.current && modeRef.current === "google3d") {
        osmImageryLayerRef.current.alpha = DESKTOP_GOOGLE_OSM_ALPHA;
      }

      viewer.scene.requestRender();
    };

    const applyDesktopUltraQuality = (tileset = tilesetRef.current) => {
      if (isMobile) return;

      adaptiveQualityStateRef.current.isUltraActive = true;
      viewer.scene.globe.maximumScreenSpaceError = DESKTOP_GLOBE_SSE_ULTRA;
      if (tileset && modeRef.current === "google3d") {
        tileset.maximumScreenSpaceError = DESKTOP_GOOGLE_TILESET_ULTRA_SSE;
        tileset.dynamicScreenSpaceError = false;
        tileset.foveatedScreenSpaceError = false;
        tileset.cullRequestsWhileMoving = false;
      }

      applyUltraViewerQuality();
    };

    const applyMobileMovingQuality = (tileset = tilesetRef.current) => {
      if (!isMobile || isIOSDevice) return;

      adaptiveQualityStateRef.current.isUltraActive = false;
      viewer.scene.msaaSamples = MOBILE_MOVING_MSAA_SAMPLES;
      viewer.resolutionScale = MOBILE_MOVING_RESOLUTION_SCALE;
      viewer.scene.globe.maximumScreenSpaceError = MOBILE_GLOBE_SSE_MOVING;

      if (tileset && modeRef.current === "google3d") {
        tileset.maximumScreenSpaceError = MOBILE_GOOGLE_TILESET_MOVING_SSE;
        tileset.dynamicScreenSpaceError = true;
        tileset.foveatedScreenSpaceError = true;
        tileset.cullRequestsWhileMoving = false;
      }

      if (osmImageryLayerRef.current && modeRef.current === "google3d") {
        osmImageryLayerRef.current.alpha = MOBILE_GOOGLE_OSM_ALPHA;
      }

      viewer.scene.requestRender();
    };

    const applyMobileIdleQuality = (tileset = tilesetRef.current) => {
      if (!isMobile || isIOSDevice) return;

      adaptiveQualityStateRef.current.isUltraActive = false;
      viewer.scene.msaaSamples = MOBILE_MSAA_SAMPLES;
      viewer.resolutionScale = MOBILE_RESOLUTION_SCALE;
      viewer.scene.globe.maximumScreenSpaceError = MOBILE_GLOBE_SSE_IDLE;

      if (tileset && modeRef.current === "google3d") {
        tileset.maximumScreenSpaceError = MOBILE_GOOGLE_TILESET_IDLE_SSE;
        tileset.dynamicScreenSpaceError = false;
        tileset.foveatedScreenSpaceError = false;
        tileset.cullRequestsWhileMoving = false;
      }

      if (osmImageryLayerRef.current && modeRef.current === "google3d") {
        osmImageryLayerRef.current.alpha = MOBILE_GOOGLE_OSM_ALPHA;
      }

      viewer.scene.requestRender();
    };

    const applyMobileUltraQuality = (tileset = tilesetRef.current) => {
      if (!isMobile || isIOSDevice || !allowMobileUltraQuality) return;

      adaptiveQualityStateRef.current.isUltraActive = true;
      viewer.scene.msaaSamples = MOBILE_MSAA_SAMPLES;
      if (typeof window === "undefined") {
        viewer.resolutionScale = MOBILE_ULTRA_RESOLUTION_SCALE;
      } else {
        const devicePixelRatio = Number(window.devicePixelRatio) || 1;
        viewer.resolutionScale = Math.max(
          MOBILE_RESOLUTION_SCALE,
          Math.min(MOBILE_ULTRA_RESOLUTION_SCALE, devicePixelRatio * 0.86)
        );
      }
      viewer.scene.globe.maximumScreenSpaceError = MOBILE_GLOBE_SSE_ULTRA;

      if (tileset && modeRef.current === "google3d") {
        tileset.maximumScreenSpaceError = MOBILE_GOOGLE_TILESET_ULTRA_SSE;
        tileset.dynamicScreenSpaceError = false;
        tileset.foveatedScreenSpaceError = false;
        tileset.cullRequestsWhileMoving = false;
      }

      if (osmImageryLayerRef.current && modeRef.current === "google3d") {
        osmImageryLayerRef.current.alpha = MOBILE_GOOGLE_OSM_ALPHA;
      }

      viewer.scene.requestRender();
    };

    const applyBalancedViewerQuality = () => {
      if (isMobile) {
        applyMobileIdleQuality();
        return;
      }
      applyDesktopIdleQuality();
    };

    const applyUltraViewerQuality = () => {
      if (isMobile) return;
      viewer.scene.msaaSamples = DESKTOP_ULTRA_MSAA_SAMPLES;
      viewer.resolutionScale = getUltraResolutionScale(isIOSDevice);
      viewer.scene.requestRender();
    };

    const applyFastThenPremiumGoogleQuality = (tileset) => {
      if (!tileset) return;
      clearGoogleQualityTimeout();
      if (isMobile && !isIOSDevice) {
        clearMobileQualityRestoreTimeout();
        applyMobileMovingQuality(tileset);
        tileset.maximumScreenSpaceError = MOBILE_GOOGLE_TILESET_FAST_SSE;
        tileset.dynamicScreenSpaceError = true;
        tileset.foveatedScreenSpaceError = true;
        tileset.cullRequestsWhileMoving = false;
        viewer.scene.requestRender();
        googleQualityTimeoutRef.current = window.setTimeout(() => {
          if (cancelled || !tilesetRef.current) return;
          tilesetRef.current.maximumScreenSpaceError = MOBILE_GOOGLE_TILESET_PREMIUM_SSE;
          applyMobileIdleQuality(tilesetRef.current);
        }, GOOGLE_TILESET_FAST_PHASE_MS);
        return;
      }

      clearDesktopQualityRestoreTimeouts();
      applyDesktopMovingQuality(tileset);
      tileset.maximumScreenSpaceError = DESKTOP_GOOGLE_TILESET_MOVING_SSE;
      tileset.dynamicScreenSpaceError = true;
      tileset.foveatedScreenSpaceError = true;
      tileset.cullRequestsWhileMoving = false;
      viewer.scene.requestRender();
      googleQualityTimeoutRef.current = window.setTimeout(() => {
        if (cancelled || !tilesetRef.current) return;
        applyDesktopIdleQuality(tilesetRef.current);
      }, GOOGLE_TILESET_FAST_PHASE_MS);

      // Defer ultra quality a bit so initial view and mode switch stay responsive.
      const sinceBootMs = Date.now() - appBootTimestampRef.current;
      const ultraDelayMs = Math.max(900, GOOGLE_TILESET_ULTRA_PHASE_MS - sinceBootMs);
      googleUltraQualityTimeoutRef.current = window.setTimeout(() => {
        if (cancelled || !tilesetRef.current || modeRef.current !== "google3d") return;
        applyDesktopUltraQuality(tilesetRef.current);
      }, ultraDelayMs);
    };

    const handleAdaptiveFrameQuality = () => {
      if (cancelled) return;
      if (modeRef.current !== "google3d") {
        adaptiveQualityStateRef.current.isUltraActive = false;
        resetAdaptiveQualityStats();
        return;
      }
      if (!isSatelliteReadyRef.current && !tilesetRef.current?.tilesLoaded) {
        resetAdaptiveQualityStats();
        return;
      }
      if (adaptiveQualityStateRef.current.isMoving) {
        resetAdaptiveQualityStats();
        return;
      }

      const now = performance.now();
      if (!adaptiveQualityStateRef.current.lastFrameAt) {
        adaptiveQualityStateRef.current.lastFrameAt = now;
        adaptiveQualityStateRef.current.sampleStartAt = now;
        return;
      }

      const frameDeltaMs = now - adaptiveQualityStateRef.current.lastFrameAt;
      adaptiveQualityStateRef.current.lastFrameAt = now;
      if (!Number.isFinite(frameDeltaMs) || frameDeltaMs <= 0) return;

      adaptiveQualityStateRef.current.sampleFrameCount += 1;
      adaptiveQualityStateRef.current.sampleFrameMsTotal += frameDeltaMs;

      if (adaptiveQualityStateRef.current.isUltraActive) {
        if (frameDeltaMs > ADAPTIVE_QUALITY_DROP_FRAME_MS) {
          adaptiveQualityStateRef.current.dropFrameStreak += 1;
        } else {
          adaptiveQualityStateRef.current.dropFrameStreak = Math.max(
            0,
            adaptiveQualityStateRef.current.dropFrameStreak - 1
          );
        }

        if (
          adaptiveQualityStateRef.current.dropFrameStreak >=
          ADAPTIVE_QUALITY_DROP_STREAK_LIMIT
        ) {
          adaptiveQualityStateRef.current.dropFrameStreak = 0;
          if (isMobile && !isIOSDevice) {
            clearMobileUltraRestoreTimeout();
            applyMobileIdleQuality();
          } else if (!isMobile) {
            applyDesktopIdleQuality();
          }
          resetAdaptiveQualityStats();
          return;
        }
      }

      if (
        now - adaptiveQualityStateRef.current.sampleStartAt <
        ADAPTIVE_QUALITY_SAMPLE_WINDOW_MS
      ) {
        return;
      }

      const frameCount = adaptiveQualityStateRef.current.sampleFrameCount;
      const totalFrameMs = adaptiveQualityStateRef.current.sampleFrameMsTotal;
      resetAdaptiveQualityStats();
      adaptiveQualityStateRef.current.lastFrameAt = now;
      adaptiveQualityStateRef.current.sampleStartAt = now;
      if (!frameCount || !totalFrameMs) return;

      const avgFrameMs = totalFrameMs / frameCount;
      const avgFps = avgFrameMs > 0 ? 1000 / avgFrameMs : 0;
      if (!Number.isFinite(avgFps) || avgFps <= 0) return;
      if (adaptiveQualityStateRef.current.isUltraActive) return;

      if (isMobile && !isIOSDevice) {
        if (allowMobileUltraQuality && avgFps >= ADAPTIVE_QUALITY_RAISE_FPS_MOBILE) {
          applyMobileUltraQuality();
        }
        return;
      }

      if (!isMobile && avgFps >= ADAPTIVE_QUALITY_RAISE_FPS_DESKTOP) {
        applyDesktopUltraQuality();
      }
    };

    async function ensureGoogleTileset() {
      if (tilesetRef.current) {
        setSatelliteReadySafely(true);
        return tilesetRef.current;
      }

      if (!tilesetPromiseRef.current) {
        tilesetPromiseRef.current = Cesium.Cesium3DTileset.fromIonAssetId(
          GOOGLE_TILES_ASSET_ID,
          {
            showCreditsOnScreen: true,
            preloadWhenHidden: true,
            preloadFlightDestinations: true,
            skipLevelOfDetail: false,
            dynamicScreenSpaceError: isMobile && !isIOSDevice,
            cullRequestsWhileMoving: false,
            cullWithChildrenBounds: true,
            preferLeaves: true,
            foveatedScreenSpaceError: isMobile && !isIOSDevice,
            progressiveResolutionHeightFraction:
              GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION,
            immediatelyLoadDesiredLevelOfDetail:
              GOOGLE_TILESET_LOAD_DESIRED_LOD_IMMEDIATELY,
            cacheBytes: isMobile
              ? GOOGLE_TILESET_MOBILE_CACHE_BYTES
              : GOOGLE_TILESET_DESKTOP_CACHE_BYTES,
            maximumCacheOverflowBytes: isMobile
              ? GOOGLE_TILESET_MOBILE_CACHE_OVERFLOW_BYTES
              : GOOGLE_TILESET_DESKTOP_CACHE_OVERFLOW_BYTES,
            maximumScreenSpaceError:
              isMobile && !isIOSDevice
                ? MOBILE_GOOGLE_TILESET_PREMIUM_SSE
                : GOOGLE_TILESET_PREMIUM_SSE,
          }
        )
          .then((tileset) => {
            tileset.preloadWhenHidden = true;
            tileset.preloadFlightDestinations = true;
            tileset.skipLevelOfDetail = false;
            tileset.dynamicScreenSpaceError = isMobile && !isIOSDevice;
            tileset.cullRequestsWhileMoving = false;
            tileset.preferLeaves = true;
            tileset.foveatedScreenSpaceError = isMobile && !isIOSDevice;
            tileset.progressiveResolutionHeightFraction =
              GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION;
            tileset.immediatelyLoadDesiredLevelOfDetail =
              GOOGLE_TILESET_LOAD_DESIRED_LOD_IMMEDIATELY;
            tileset.cacheBytes = isMobile
              ? GOOGLE_TILESET_MOBILE_CACHE_BYTES
              : GOOGLE_TILESET_DESKTOP_CACHE_BYTES;
            tileset.maximumCacheOverflowBytes = isMobile
              ? GOOGLE_TILESET_MOBILE_CACHE_OVERFLOW_BYTES
              : GOOGLE_TILESET_DESKTOP_CACHE_OVERFLOW_BYTES;
            tileset.maximumScreenSpaceError =
              isMobile && !isIOSDevice
                ? MOBILE_GOOGLE_TILESET_PREMIUM_SSE
                : GOOGLE_TILESET_PREMIUM_SSE;
            tilesetRef.current = tileset;
            setSatelliteReadySafely(Boolean(tileset.tilesLoaded));
            if (!viewer.scene.primitives.contains(tileset)) {
              viewer.scene.primitives.add(tileset);
            }
            tileset.show = false;
            viewer.scene.requestRender();
            if (tileset.tilesLoaded) {
              setSatelliteReadySafely(true);
            }
            return tileset;
          })
          .catch((error) => {
            tilesetPromiseRef.current = null;
            throw error;
          });
      }

      return tilesetPromiseRef.current;
    }

    async function warmupGoogleUntilReady() {
      if (!canUseGoogle3D || !CESIUM_ION_TOKEN) return;
      if (tilesetRef.current) {
        setSatelliteReadySafely(true);
        setSatelliteWarmupBlockExpiredSafely(false);
        return;
      }

      if (!satelliteWarmupPromiseRef.current) {
        if (satelliteWarmupBlockTimeoutRef.current) {
          window.clearTimeout(satelliteWarmupBlockTimeoutRef.current);
          satelliteWarmupBlockTimeoutRef.current = null;
        }
        setSatelliteWarmupBlockExpiredSafely(false);
        satelliteWarmupBlockTimeoutRef.current = window.setTimeout(() => {
          if (cancelled) return;
          setSatelliteWarmupBlockExpiredSafely(true);
          satelliteWarmupBlockTimeoutRef.current = null;
        }, SATELLITE_WARMUP_MAX_BLOCK_MS);

        satelliteWarmupPromiseRef.current = ensureGoogleTileset()
          .then((tileset) => {
            return waitForGoogleTilesetReady(tileset).then((didLoad) => {
              if (didLoad || tileset.tilesLoaded) {
                setSatelliteReadySafely(true);
                setTilesReadyVersion((value) => value + 1);
                viewer.scene.requestRender();
              }
              return tileset;
            });
          })
          .catch((error) => {
            setSatelliteReadySafely(false);
            // If warmup fails quickly (network/token), allow manual retry
            // instead of keeping the toggle stuck on "Satellite...".
            setSatelliteWarmupBlockExpiredSafely(true);
            throw error;
          })
          .finally(() => {
            if (satelliteWarmupBlockTimeoutRef.current) {
              window.clearTimeout(satelliteWarmupBlockTimeoutRef.current);
              satelliteWarmupBlockTimeoutRef.current = null;
            }
            if (!tilesetRef.current) {
              setSatelliteWarmupBlockExpiredSafely(true);
            }
            satelliteWarmupPromiseRef.current = null;
          });
      }

      return satelliteWarmupPromiseRef.current;
    }

    function enableOsm() {
      clearSatelliteLoadWatchdogTimeout();
      clearGoogleQualityTimeout();
      clearDesktopQualityRestoreTimeouts();
      clearMobileQualityRestoreTimeout();
      clearMobileUltraRestoreTimeout();
      clearQualityRecoverySafetyTimeout();
      adaptiveQualityStateRef.current.isUltraActive = false;
      adaptiveQualityStateRef.current.isMoving = false;
      resetAdaptiveQualityStats();
      applyBalancedViewerQuality();
      viewer.terrainProvider = ellipsoidTerrainProviderRef.current;
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

      setIsTilted(false);
      tiltToggleBaseRangeRef.current = null;
      modeRef.current = "osm";
      setSatelliteReadySafely(false);
      setTilesReadyVersion((value) => value + 1);
    }

    async function enableGoogle() {
      const tileset = await withPromiseTimeout(
        ensureGoogleTileset(),
        GOOGLE_TILESET_SWITCH_TIMEOUT_MS,
        "Le chargement initial de la vue satellite 3D est trop long.",
        "GOOGLE_TILESET_TIMEOUT"
      );
      if (cancelled) return;

      viewer.scene.globe.show = true;
      viewer.scene.skyBox.show = false;
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#dbeafe");

      if (osmImageryLayerRef.current) {
        osmImageryLayerRef.current.show = true;
        osmImageryLayerRef.current.alpha =
          isMobile
            ? MOBILE_GOOGLE_OSM_ALPHA
            : DESKTOP_GOOGLE_OSM_ALPHA;
      }
      if (worldTerrainProviderRef.current) {
        viewer.terrainProvider = worldTerrainProviderRef.current;
      }

      tileset.show = true;
      applyFastThenPremiumGoogleQuality(tileset);
      viewer.scene.requestRender();

      modeRef.current = "google3d";
      startSatelliteLoadWatchdog();
      const zoneCacheKey = activeZoneCacheKeyRef.current;
      if (zoneCacheKey) {
        updateZoneCacheEntry(zoneCacheKey, (previousEntry) => ({
          ...previousEntry,
          google3dWarmAt: Date.now(),
        }));
      }
      setTilesReadyVersion((value) => value + 1);

      // Do not block the mode switch on initial tile loading. When tiles become
      // ready, trigger one more refresh so markers can settle on detailed mesh.
      waitForGoogleTilesetReady(tileset).then((didLoad) => {
        if (cancelled) return;
        if ((didLoad || tileset.tilesLoaded) && modeRef.current === "google3d") {
          clearSatelliteLoadWatchdogTimeout();
          setSatelliteIssueMessage("");
          setSatelliteReadySafely(true);
          if (isMobile && !isIOSDevice) {
            applyMobileIdleQuality(tileset);
          }
          setTilesReadyVersion((value) => value + 1);
          viewer.scene.requestRender();
        }
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
          setSatelliteReadySafely(false);
          if (attempt >= maxAttempts) {
            throw lastError;
          }
        }
      }
    }

    async function applyMode() {
      const requestedMode = canUseGoogle3D ? resolveMode(mapMode) : "osm";
      if (!canUseGoogle3D && mapMode === "google3d") {
        onSetMapModeRef.current?.("osm");
      }
      if (modeRef.current === requestedMode) return;

      const cameraState = captureCamera(viewer);
      if (requestedMode !== "google3d") {
        cameraState.pitch = Cesium.Math.toRadians(-90);
        cameraState.roll = 0;
        setIsTilted(false);
        tiltToggleBaseRangeRef.current = null;
      } else {
        setSatelliteIssueMessage("");
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
        setSatelliteIssueMessage(buildSatelliteFailureMessage(error));
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

    const handleDesktopMoveStart = () => {
      if (isMobile) return;
      adaptiveQualityStateRef.current.isMoving = true;
      clearMobileUltraRestoreTimeout();
      clearDesktopQualityRestoreTimeouts();
      applyDesktopMovingQuality();
      scheduleQualityRecoverySafety();
    };

    const handleDesktopMoveEnd = () => {
      if (isMobile) return;
      adaptiveQualityStateRef.current.isMoving = false;
      clearQualityRecoverySafetyTimeout();
      clearDesktopQualityRestoreTimeouts();

      desktopQualityRestoreTimeoutRef.current = window.setTimeout(() => {
        if (cancelled) return;
        applyDesktopIdleQuality();

        if (modeRef.current !== "google3d") return;
        desktopUltraRestoreTimeoutRef.current = window.setTimeout(() => {
          if (cancelled) return;
          applyDesktopUltraQuality();
        }, DESKTOP_QUALITY_ULTRA_DELAY_MS);
      }, DESKTOP_QUALITY_RESTORE_DELAY_MS);
    };

    const handleMobileMoveStart = () => {
      if (!isMobile || isIOSDevice) return;
      adaptiveQualityStateRef.current.isMoving = true;
      clearMobileUltraRestoreTimeout();
      clearMobileQualityRestoreTimeout();
      applyMobileMovingQuality();
      scheduleQualityRecoverySafety();
    };

    const handleMobileMoveEnd = () => {
      if (!isMobile || isIOSDevice) return;
      adaptiveQualityStateRef.current.isMoving = false;
      clearQualityRecoverySafetyTimeout();
      clearMobileQualityRestoreTimeout();
      clearMobileUltraRestoreTimeout();
      mobileQualityRestoreTimeoutRef.current = window.setTimeout(() => {
        if (cancelled) return;
        applyMobileIdleQuality();
        if (!allowMobileUltraQuality || modeRef.current !== "google3d") return;
        mobileUltraRestoreTimeoutRef.current = window.setTimeout(() => {
          if (cancelled) return;
          if (adaptiveQualityStateRef.current.isMoving) return;
          if (modeRef.current !== "google3d") return;
          applyMobileUltraQuality();
        }, MOBILE_QUALITY_ULTRA_DELAY_MS);
      }, MOBILE_QUALITY_RESTORE_DELAY_MS);
    };

    if (isMobile && !isIOSDevice) {
      viewer.camera.moveStart.addEventListener(handleMobileMoveStart);
      viewer.camera.moveEnd.addEventListener(handleMobileMoveEnd);
      applyMobileIdleQuality();
    } else if (!isMobile) {
      viewer.camera.moveStart.addEventListener(handleDesktopMoveStart);
      viewer.camera.moveEnd.addEventListener(handleDesktopMoveEnd);
      applyDesktopIdleQuality();
    }

    viewer.scene.postRender.addEventListener(handleAdaptiveFrameQuality);

    // Warm up Google tiles in the background after first paint so reload stays snappy.
    if (canUseGoogle3D && CESIUM_ION_TOKEN) {
      warmupTimerId = window.setTimeout(() => {
        if (cancelled) return;
        warmupGoogleUntilReady().catch((error) => {
          console.error("Erreur prechargement Google 3D :", error);
        });
      }, GOOGLE_WARMUP_START_DELAY_MS);
    }

    applyMode();

    return () => {
      cancelled = true;
      clearGoogleQualityTimeout();
      clearDesktopQualityRestoreTimeouts();
      clearMobileQualityRestoreTimeout();
      clearMobileUltraRestoreTimeout();
      clearQualityRecoverySafetyTimeout();
      clearSatelliteLoadWatchdogTimeout();
      adaptiveQualityStateRef.current.isMoving = false;
      adaptiveQualityStateRef.current.isUltraActive = false;
      resetAdaptiveQualityStats();
      if (!viewer.isDestroyed()) {
        viewer.scene.postRender.removeEventListener(handleAdaptiveFrameQuality);
      }
      if (modeTransitionTimeoutRef.current) {
        window.clearTimeout(modeTransitionTimeoutRef.current);
        modeTransitionTimeoutRef.current = null;
      }
      if (warmupTimerId) {
        window.clearTimeout(warmupTimerId);
      }
      if (satelliteWarmupBlockTimeoutRef.current) {
        window.clearTimeout(satelliteWarmupBlockTimeoutRef.current);
        satelliteWarmupBlockTimeoutRef.current = null;
      }
      if (isMobile && !isIOSDevice && !viewer.isDestroyed()) {
        viewer.camera.moveStart.removeEventListener(handleMobileMoveStart);
        viewer.camera.moveEnd.removeEventListener(handleMobileMoveEnd);
      } else if (!isMobile && !viewer.isDestroyed()) {
        viewer.camera.moveStart.removeEventListener(handleDesktopMoveStart);
        viewer.camera.moveEnd.removeEventListener(handleDesktopMoveEnd);
      }
      setModeTransition({
        active: false,
        target: null,
      });
    };
  }, [mapMode, canUseGoogle3D]);

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

      // In satellite mode, place markers above the current globe surface immediately
      // so they remain visible before high-detail 3D tiles finish loading.
      if (!isOsmMode) {
        finalBienPositions = biensAvecCoordonnees.map((bien) =>
          buildFallbackSatellitePosition(bien.lon, bien.lat)
        );
        finalCustomPositions = customMarkers.map((marker) =>
          buildFallbackSatellitePosition(marker.lon, marker.lat)
        );
      }

      if (
        !isOsmMode &&
        SATELLITE_USE_MESH_CLAMP_FOR_MARKERS &&
        tilesetRef.current?.tilesLoaded
      ) {
        try {
          if (rawBienPositions.length > 0) {
            const sampleBienPositions = rawBienPositions.slice(
              0,
              SATELLITE_CLAMP_MAX_POSITIONS
            );
            const clampedBiens = await withPromiseTimeout(
              viewer.scene.clampToHeightMostDetailed(sampleBienPositions),
              SATELLITE_CLAMP_TIMEOUT_MS,
              "CLAMP_TIMEOUT_BIENS",
              "CLAMP_TIMEOUT_BIENS"
            );
            if (!cancelled && Array.isArray(clampedBiens)) {
              clampedBiens.forEach((position, index) => {
                const elevated = elevateCartesianPosition(position);
                if (elevated) {
                  finalBienPositions[index] = elevated;
                  return;
                }
                const bien = biensAvecCoordonnees[index];
                finalBienPositions[index] = buildFallbackSatellitePosition(
                  bien.lon,
                  bien.lat
                );
              });
            }
          }

          if (rawCustomPositions.length > 0) {
            const sampleCustomPositions = rawCustomPositions.slice(
              0,
              SATELLITE_CLAMP_MAX_POSITIONS
            );
            const clampedCustomMarkers = await withPromiseTimeout(
              viewer.scene.clampToHeightMostDetailed(sampleCustomPositions),
              SATELLITE_CLAMP_TIMEOUT_MS,
              "CLAMP_TIMEOUT_CUSTOM",
              "CLAMP_TIMEOUT_CUSTOM"
            );
            if (!cancelled && Array.isArray(clampedCustomMarkers)) {
              clampedCustomMarkers.forEach((position, index) => {
                const elevated = elevateCartesianPosition(position);
                if (elevated) {
                  finalCustomPositions[index] = elevated;
                  return;
                }
                const marker = customMarkers[index];
                finalCustomPositions[index] = buildFallbackSatellitePosition(
                  marker.lon,
                  marker.lat
                );
              });
            }
          }
        } catch (error) {
          if (
            error?.code !== "CLAMP_TIMEOUT_BIENS" &&
            error?.code !== "CLAMP_TIMEOUT_CUSTOM"
          ) {
            console.error("Erreur clamp reperes satellite :", error);
          }
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
            disableDepthTestDistance: isOsmMode
              ? 0
              : SATELLITE_MARKER_DISABLE_DEPTH_TEST_DISTANCE,
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
            disableDepthTestDistance: isOsmMode
              ? 0
              : SATELLITE_MARKER_DISABLE_DEPTH_TEST_DISTANCE,
          },
        });

        entity.bienData = bien;
        entity.showPointByPriority = shouldShowPoint;
        entity.stackBienIds = (stackByBienId.get(bien.id) || [bien]).map((item) => item.id);
        entitiesRef.current.push(entity);
        markerDataByIdRef.current.set(bien.id, bien);
      });

      customMarkers.forEach((marker, markerIndex) => {
        const entity = viewer.entities.add({
          id: marker.id,
          position: finalCustomPositions[markerIndex] || rawCustomPositions[markerIndex],
          point: {
            pixelSize: 12,
            color: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            heightReference: isOsmMode
              ? Cesium.HeightReference.CLAMP_TO_GROUND
              : Cesium.HeightReference.NONE,
            disableDepthTestDistance: isOsmMode
              ? 0
              : SATELLITE_MARKER_DISABLE_DEPTH_TEST_DISTANCE,
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
            disableDepthTestDistance: isOsmMode
              ? 0
              : SATELLITE_MARKER_DISABLE_DEPTH_TEST_DISTANCE,
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

    if (!zoneCameraRestoreDoneRef.current) {
      zoneCameraRestoreDoneRef.current = true;
      if (restoreCameraFromZoneCache(viewer)) {
        rememberSyncPanHeightForCurrentMode(viewer);
        return () => {
          if (captureTimeoutId) {
            window.clearTimeout(captureTimeoutId);
          }
        };
      }
    }

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
    if (!viewer) return;

    if (isMobile) {
      optimizeTouchNavigation(viewer, touchNavTuningRef.current, mapMode);
      const resolvedMode = resolveMode(mapMode);
      const modeKey = getModeKey(resolvedMode);
      if (!Number.isFinite(syncPanHeightRef.current[modeKey])) {
        rememberSyncPanHeightForMode(viewer, resolvedMode);
      }
    } else {
      optimizeDesktopNavigation(viewer, touchNavTuningRef.current, mapMode);
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
      setMarkerAddressPostcode(extractPostcode(selectedCustomMarker.address || ""));
      setMarkerDraftPhotos(Array.isArray(selectedCustomMarker.photos) ? selectedCustomMarker.photos : []);
    } else if (!pendingMarkerPosition) {
      setMarkerDraftNote("");
      setMarkerDraftAddress("");
      setMarkerAddressPostcode("");
      setMarkerAddressCandidates([]);
      setMarkerDraftPhotos([]);
    }
  }, [selectedCustomMarker, pendingMarkerPosition]);

  useEffect(() => {
    if (markerEditorMode !== "address") {
      setMarkerAddressLoading(false);
      setMarkerAddressCandidates([]);
      return;
    }

    const query = markerDraftAddress.trim();
    if (!markerAddressPostcode || query.length < 2) {
      setMarkerAddressLoading(false);
      setMarkerAddressCandidates([]);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setMarkerAddressLoading(true);
      try {
        const response = await getStreetSuggestions(
          markerAddressPostcode,
          query,
          12
        );
        if (cancelled) return;
        const streets = Array.isArray(response?.streets) ? response.streets : [];
        setMarkerAddressCandidates(
          streets.map((street) => ({
            key: normalizeAddressValue(street.label),
            label: street.label,
            lat: street.lat,
            lon: street.lon,
          }))
        );
      } catch (error) {
        if (cancelled) return;
        console.error("Erreur suggestions d'adresses :", error);
        setMarkerAddressCandidates([]);
      } finally {
        if (!cancelled) {
          setMarkerAddressLoading(false);
        }
      }
    }, MARKER_ADDRESS_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [markerEditorMode, markerDraftAddress, markerAddressPostcode]);

  async function submitCustomMarker() {
    const note = markerDraftNote.trim();
    if (!note) {
      setMarkerError("Renseigne une note pour ce repere.");
      return;
    }

    setMarkerSaving(true);
    setMarkerError("");

    try {
      let targetPosition = pendingMarkerPosition;
      let targetAddress = markerDraftAddress.trim();

      if (markerEditorMode === "address") {
        if (!markerAddressPostcode) {
          setMarkerError("Code postal introuvable. Place un repere ou lance une recherche par code postal.");
          setMarkerSaving(false);
          return;
        }

        let selectedAddressCandidate = markerAddressCandidates.find(
          (candidate) => normalizeAddressValue(candidate.label) === normalizeAddressValue(targetAddress)
        );

        if (!selectedAddressCandidate && targetAddress.length >= 2) {
          const fallbackResponse = await getStreetSuggestions(
            markerAddressPostcode,
            targetAddress,
            6
          );
          const fallbackCandidates = Array.isArray(fallbackResponse?.streets)
            ? fallbackResponse.streets
            : [];
          selectedAddressCandidate =
            fallbackCandidates.find(
              (candidate) =>
                normalizeAddressValue(candidate.label) === normalizeAddressValue(targetAddress)
            ) || fallbackCandidates[0];
        }

        if (!selectedAddressCandidate) {
          setMarkerError("Choisis une rue proposee pour ce code postal.");
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
    setMarkerError("");
    hidePlacementGhost();
    triggerHapticFeedback("light");
  }

  async function handleStartAddressMarkerPlacement() {
    setMarkerEditorMode("address");
    setIsAwaitingMarkerPlacement(false);
    setMarkerAddressCandidates([]);
    setMarkerAddressLoading(false);
    setMarkerError("");
    hidePlacementGhost();

    const resolvedPostcode = await resolveMarkerAddressPostcode();
    if (!resolvedPostcode) {
      setMarkerAddressPostcode("");
      setMarkerError("Impossible de trouver un code postal. Lance d'abord une recherche par code postal ou place un repere.");
      markerAddressInputRef.current?.focus();
      return;
    }

    setMarkerAddressPostcode(resolvedPostcode);
    markerAddressInputRef.current?.focus();
  }

  function selectStackedMarkerOption(bien) {
    if (isMobile) {
      setStackedMarkerOptions([]);
    }
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
    const minimumTopDownRange = currentMode === "google3d" ? 160 : 850;
    let topDownRange;

    if (!isTilted) {
      // Entering 3D: lock a base range so repeated 2D<->3D toggles don't drift upward.
      topDownRange = Math.max(cameraHeight, minimumTopDownRange);
      tiltToggleBaseRangeRef.current = topDownRange;
    } else {
      // Returning to 2D: reuse the same base range captured when we entered 3D.
      const stableRange = Number(tiltToggleBaseRangeRef.current);
      topDownRange = Math.max(
        Number.isFinite(stableRange) ? stableRange : cameraHeight,
        minimumTopDownRange
      );
    }

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
  const desktopPlusBottom = canTiltCurrentView ? 148 : 84;
  const modeTransitionLabel =
    modeTransition.target === "google3d"
      ? "Passage a la vue satellite..."
      : "Passage a la vue plan...";
  const isSatelliteTogglePending =
    isMobile &&
    canUseGoogle3D &&
    currentResolvedMode !== "google3d" &&
    !isSatelliteReady &&
    !isSatelliteWarmupBlockExpired;
  const isMapModeToggleDisabled =
    !canUseGoogle3D || isMapModeTransitioning;
  const mapModeButtonLabel =
    currentResolvedMode === "google3d"
      ? "Vue plan"
      : isSatelliteTogglePending
        ? "Satellite..."
        : "Vue satellite";
  const mapModeButtonTitle = satelliteIssueMessage
    ? satelliteIssueMessage
    : !canUseGoogle3D
      ? "Ajoute un token Cesium ion pour activer Google 3D"
      : currentResolvedMode === "google3d"
        ? "Passer a la vue plan"
        : isSatelliteTogglePending
          ? "Vue satellite en cours de chargement..."
          : !isSatelliteReady
            ? "Prechargement long detecte. Premier basculement possible mais peut prendre quelques secondes."
          : "Passer a la vue satellite";

  function handleToggleMapMode() {
    if (!canUseGoogle3D) return;
    if (isMapModeTransitioning) return;
    if (currentResolvedMode !== "google3d") {
      setSatelliteIssueMessage("");
    }
    onToggleMapMode?.();
  }

  function handleStartMarkerCreation() {
    setStackedMarkerOptions([]);
    setSelectedCustomMarkerId(null);
    setPendingMarkerPosition(null);
    setMarkerDraftNote("");
    setMarkerDraftAddress("");
    setMarkerDraftPhotos([]);
    setMarkerAddressPostcode("");
    setMarkerAddressCandidates([]);
    setMarkerAddressLoading(false);
    setMarkerError("");
    setMarkerEditorOpen(false);
    handleStartMapMarkerPlacement();
  }

  return (
    <div
      onContextMenu={(event) => event.preventDefault()}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
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

      {satelliteIssueMessage ? (
        <div
          style={{
            position: "absolute",
            top: isMobile ? 64 : 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 8,
            maxWidth: "min(92vw, 640px)",
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(248, 113, 113, 0.46)",
            background: "rgba(127, 29, 29, 0.9)",
            color: "#fee2e2",
            fontSize: 13,
            fontWeight: 600,
            textAlign: "center",
            boxShadow: "0 12px 26px rgba(127, 29, 29, 0.32)",
            pointerEvents: "none",
          }}
        >
          {satelliteIssueMessage}
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
        <>
          <button
            onClick={handleStartMarkerCreation}
            style={desktopMapButtonStyle(desktopPlusBottom, true, true)}
            title="Ajouter une note"
          >
            +
          </button>
          <button
            onClick={handleToggleMapMode}
            disabled={isMapModeToggleDisabled}
            style={desktopMapButtonStyle(
              20,
              !isMapModeToggleDisabled
            )}
            title={mapModeButtonTitle}
          >
            {mapModeButtonLabel}
          </button>
        </>
      ) : null}

      {stackedMarkerOptions.length > 1 ? (
        <div style={stackedMarkerPopupContainerStyle()}>
          <div style={stackedMarkerPopupStyle()}>
            <div style={stackedMarkerPopupHeaderStyle()}>
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>
                  Plusieurs annonces ici
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                  {stackedMarkerOptions.length} annonces a cette adresse
                </div>
              </div>
              <button
                onClick={() => setStackedMarkerOptions([])}
                style={stackedMarkerCloseButtonStyle()}
                title="Fermer"
                aria-label="Fermer"
              >
                x
              </button>
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
              <div style={markerPlacementStatusStyle(Boolean(pendingMarkerPosition))}>
                <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.25 }}>
                  {pendingMarkerPosition
                    ? "Position carte selectionnee"
                    : "Position carte non selectionnee"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.3 }}>
                  {pendingMarkerPosition
                    ? "Enregistre pour creer le repere a cette position."
                    : "Clique sur + puis sur la carte pour choisir la position."}
                </div>
              </div>
              <button
                onClick={handleStartAddressMarkerPlacement}
                style={markerModeButtonStyle(markerEditorMode === "address")}
              >
                Renseigner une adresse
              </button>
            </div>

            {markerEditorMode === "address" ? (
              <div style={{ marginBottom: 10 }}>
                <div style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 6 }}>
                  Code postal cible : {markerAddressPostcode || "non trouve"}
                </div>
                <input
                  ref={markerAddressInputRef}
                  list="marker-address-candidates"
                  value={markerDraftAddress}
                  onChange={(event) => setMarkerDraftAddress(event.target.value)}
                  placeholder="Saisis une rue de ce code postal"
                  style={markerInputStyle()}
                />
                <datalist id="marker-address-candidates">
                  {markerAddressCandidates.map((candidate) => (
                    <option key={candidate.key} value={candidate.label} />
                  ))}
                </datalist>
                {markerAddressLoading ? (
                  <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 6 }}>
                    Recherche des rues...
                  </div>
                ) : null}
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
          <button
            onClick={handleStartMarkerCreation}
            style={mobileFloatingCircleButtonStyle(false)}
            title="Ajouter une note"
          >
            +
          </button>

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
            disabled={isMapModeToggleDisabled}
            style={mobileFloatingPillButtonStyle(
              isMapModeToggleDisabled
            )}
            title={mapModeButtonTitle}
          >
            {mapModeButtonLabel}
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

function stackedMarkerPopupHeaderStyle() {
  return {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  };
}

function stackedMarkerCloseButtonStyle() {
  return {
    width: 30,
    minWidth: 30,
    height: 30,
    borderRadius: 10,
    border: "1px solid var(--border-color)",
    background: "var(--panel-muted-bg)",
    color: "var(--text-primary)",
    fontWeight: 700,
    cursor: "pointer",
    lineHeight: 1,
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

function markerPlacementStatusStyle(hasPosition) {
  return {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    border: hasPosition ? "1px solid #16a34a" : "1px solid var(--border-color)",
    background: hasPosition ? "rgba(22, 163, 74, 0.10)" : "var(--panel-muted-bg)",
    color: "var(--text-primary)",
    padding: "8px 10px",
    display: "grid",
    alignContent: "center",
    gap: 2,
    boxSizing: "border-box",
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
