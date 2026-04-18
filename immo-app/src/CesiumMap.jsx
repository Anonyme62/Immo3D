import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import {
  getPostcodeFromCoordinates,
  getStreetSuggestions,
  uploadPhotoAsset,
} from "./api";
import { CESIUM_ION_TOKEN } from "./config";
import { TOUCH_NAV_TUNING } from "./config/touchNavigationTuning";
import {
  formatMarkerPrix,
  formatSurface,
  getBienBadge,
  getSelectedBienPhotos,
} from "./utils/bienFormat";
import {
  buildAddressAnchorAssignments,
  buildCoordinateStackAssignments,
  buildLabelGroupAssignments,
  buildMarkerEntityId,
  compareMarkerRenderOrder,
  getMarkerLabelOffset,
  getMarkerVisualState,
} from "./utils/mapMarkerStyle";
import { getMapPerfTelemetry, recordMapPerfEvent } from "./utils/mapPerfTelemetry";

const GOOGLE_TILES_ASSET_ID = 2275207;

if (!CESIUM_ION_TOKEN) {
  console.warn(
    "VITE_CESIUM_ION_TOKEN est absent. La vue Google 3D restera indisponible tant que le token n'est pas configure."
  );
}

Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN;

const GOOGLE_TILESET_READY_TIMEOUT_MS = 9000;
const GOOGLE_TILESET_SWITCH_TIMEOUT_MS = 4800;
const GOOGLE_TILESET_PREMIUM_SSE = 6;
const GOOGLE_TILESET_FAST_PHASE_MS = 420;
const GOOGLE_TILESET_ULTRA_PHASE_MS = 2600;
const GOOGLE_TILESET_FOVEATED_TIME_DELAY_IDLE_SECONDS = 0.2;
const GOOGLE_TILESET_FOVEATED_TIME_DELAY_MOVING_SECONDS = 0.0;
const GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION_MOVING = 0.3;
const GOOGLE_WARMUP_START_DELAY_MS = 220;
const SATELLITE_PREDICTIVE_WARMUP_DELAY_MS_DESKTOP = 260;
const SATELLITE_PREDICTIVE_WARMUP_DELAY_MS_MOBILE = 760;
const SATELLITE_PREDICTIVE_WARMUP_FRESH_MS = 1000 * 60 * 3;
const SATELLITE_WARMUP_MAX_BLOCK_MS = 6500;
const SATELLITE_LOAD_WATCHDOG_MS = 15000;
const DESKTOP_RESOLUTION_SCALE = 1.22;
const DESKTOP_ULTRA_RESOLUTION_SCALE = 1.35;
const DESKTOP_MOVING_RESOLUTION_SCALE = 1.02;
const MOBILE_RESOLUTION_SCALE = 1;
const MOBILE_MOVING_RESOLUTION_SCALE = 0.84;
const IOS_RESOLUTION_SCALE = 0.30;
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
const DESKTOP_AUTO_MIN_MOVING_VISIBLE_MS = 1150;
const DESKTOP_AUTO_INPUT_INTENT_MS = 1400;
const DESKTOP_AUTO_SETTLE_RECHECK_DELAY_MS = 180;
const DESKTOP_AUTO_SETTLE_POSITION_EPSILON_METERS = 1.8;
const DESKTOP_AUTO_SETTLE_ANGLE_EPSILON_RAD = Cesium.Math.toRadians(0.18);
const MODE_TRANSITION_MIN_VISIBLE_MS = 620;
const MODE_TRANSITION_VISUAL_FADE_OUT_MS = 260;
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
const MOBILE_QUALITY_PROFILE_DEFAULT = "auto";
const MOBILE_QUALITY_PROFILE_VALUES = ["auto", "high", "ultra", "perf"];
const DESKTOP_QUALITY_PROFILE_DEFAULT = "auto";
const DESKTOP_QUALITY_PROFILE_VALUES = ["auto", "high", "ultra", "perf"];
const DESKTOP_QUALITY_PROFILE_CONFIG = {
  auto: {
    // Auto should feel like Google Earth Web while moving: prioritize fluidity,
    // then restore sharper quality once the camera settles.
    movingResolutionScale: 0.86,
    movingGlobeSse: 2.05,
    movingTilesetSse: 22,
    movingMsaa: 1,
    settleResolutionScale: 0.94,
    settleGlobeSse: 1.62,
    settleTilesetSse: 13.6,
    settleMsaa: 1,
    idleResolutionScale: 1.06,
    idleGlobeSse: 1.28,
    idleTilesetSse: 9.2,
    idleMsaa: 2,
    ultraResolutionScaleCap: DESKTOP_ULTRA_RESOLUTION_SCALE,
    ultraGlobeSse: DESKTOP_GLOBE_SSE_ULTRA,
    ultraTilesetSse: DESKTOP_GOOGLE_TILESET_ULTRA_SSE,
    ultraMsaa: DESKTOP_ULTRA_MSAA_SAMPLES,
    fastTilesetSse: 16,
    premiumTilesetSse: 8.4,
    adaptiveRaiseFps: ADAPTIVE_QUALITY_RAISE_FPS_DESKTOP,
    idleRestoreDelayMs: 720,
    settleHoldMs: 900,
    ultraRestoreDelayMs: DESKTOP_QUALITY_ULTRA_DELAY_MS,
  },
  high: {
    movingResolutionScale: 1.08,
    movingGlobeSse: 1.22,
    movingTilesetSse: 8.6,
    movingMsaa: 4,
    idleResolutionScale: 1.34,
    idleGlobeSse: 0.92,
    idleTilesetSse: 4.6,
    idleMsaa: 6,
    ultraResolutionScaleCap: 1.56,
    ultraGlobeSse: 0.74,
    ultraTilesetSse: 3.0,
    ultraMsaa: 8,
    fastTilesetSse: 7.2,
    premiumTilesetSse: 4.2,
    adaptiveRaiseFps: 50,
    idleRestoreDelayMs: 100,
    ultraRestoreDelayMs: 520,
  },
  ultra: {
    movingResolutionScale: 1.16,
    movingGlobeSse: 0.96,
    movingTilesetSse: 6.2,
    movingMsaa: 6,
    idleResolutionScale: 1.52,
    idleGlobeSse: 0.7,
    idleTilesetSse: 3.0,
    idleMsaa: 8,
    ultraResolutionScaleCap: 1.78,
    ultraGlobeSse: 0.56,
    ultraTilesetSse: 2.2,
    ultraMsaa: 8,
    fastTilesetSse: 5.4,
    premiumTilesetSse: 3.2,
    adaptiveRaiseFps: 42,
    idleRestoreDelayMs: 80,
    ultraRestoreDelayMs: 380,
  },
  perf: {
    movingResolutionScale: 0.86,
    movingGlobeSse: 1.95,
    movingTilesetSse: 18,
    movingMsaa: 2,
    idleResolutionScale: 1.0,
    idleGlobeSse: 1.45,
    idleTilesetSse: 9.5,
    idleMsaa: 2,
    ultraResolutionScaleCap: 1.0,
    ultraGlobeSse: 1.45,
    ultraTilesetSse: 9.5,
    ultraMsaa: 2,
    fastTilesetSse: 14,
    premiumTilesetSse: 9.5,
    adaptiveRaiseFps: Number.POSITIVE_INFINITY,
    idleRestoreDelayMs: 120,
    ultraRestoreDelayMs: 1200,
  },
};
const MOBILE_QUALITY_PROFILE_CONFIG = {
  auto: {
    movingResolutionScale: MOBILE_MOVING_RESOLUTION_SCALE,
    movingGlobeSse: MOBILE_GLOBE_SSE_MOVING,
    movingTilesetSse: MOBILE_GOOGLE_TILESET_MOVING_SSE,
    idleResolutionScale: MOBILE_RESOLUTION_SCALE,
    idleGlobeSse: MOBILE_GLOBE_SSE_IDLE,
    idleTilesetSse: MOBILE_GOOGLE_TILESET_IDLE_SSE,
    ultraResolutionScaleCap: MOBILE_ULTRA_RESOLUTION_SCALE,
    ultraGlobeSse: MOBILE_GLOBE_SSE_ULTRA,
    ultraTilesetSse: MOBILE_GOOGLE_TILESET_ULTRA_SSE,
    fastTilesetSse: MOBILE_GOOGLE_TILESET_FAST_SSE,
    premiumTilesetSse: MOBILE_GOOGLE_TILESET_PREMIUM_SSE,
    enableUltra: true,
    adaptiveRaiseFps: ADAPTIVE_QUALITY_RAISE_FPS_MOBILE,
    idleRestoreDelayMs: MOBILE_QUALITY_RESTORE_DELAY_MS,
    ultraRestoreDelayMs: MOBILE_QUALITY_ULTRA_DELAY_MS,
  },
  high: {
    movingResolutionScale: 0.9,
    movingGlobeSse: 1.85,
    movingTilesetSse: 14,
    idleResolutionScale: 1.14,
    idleGlobeSse: 1.2,
    idleTilesetSse: 6.8,
    ultraResolutionScaleCap: 1.24,
    ultraGlobeSse: 0.98,
    ultraTilesetSse: 4.8,
    fastTilesetSse: 11.2,
    premiumTilesetSse: 7.2,
    enableUltra: true,
    adaptiveRaiseFps: 50,
    idleRestoreDelayMs: 130,
    ultraRestoreDelayMs: 620,
  },
  ultra: {
    movingResolutionScale: 1.0,
    movingGlobeSse: 1.3,
    movingTilesetSse: 9.0,
    idleResolutionScale: 1.28,
    idleGlobeSse: 0.86,
    idleTilesetSse: 4.2,
    ultraResolutionScaleCap: 1.48,
    ultraGlobeSse: 0.72,
    ultraTilesetSse: 2.8,
    fastTilesetSse: 7.4,
    premiumTilesetSse: 4.4,
    enableUltra: true,
    adaptiveRaiseFps: 34,
    idleRestoreDelayMs: 100,
    ultraRestoreDelayMs: 420,
  },
  perf: {
    movingResolutionScale: 0.7,
    movingGlobeSse: 3.0,
    movingTilesetSse: 30,
    idleResolutionScale: 0.30,
    idleGlobeSse: 2.25,
    idleTilesetSse: 16,
    ultraResolutionScaleCap: 0.86,
    ultraGlobeSse: 2.25,
    ultraTilesetSse: 16,
    fastTilesetSse: 24,
    premiumTilesetSse: 16,
    enableUltra: false,
    adaptiveRaiseFps: Number.POSITIVE_INFINITY,
    idleRestoreDelayMs: 80,
    ultraRestoreDelayMs: 1200,
  },
};
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
const SATELLITE_CLAMP_TIMEOUT_MS = 1400;
const SATELLITE_CLAMP_MAX_POSITIONS = 260;
const SATELLITE_CLAMP_MAX_POSITIONS_MOBILE = 420;
const PLAN_PAN_SPEED_MULTIPLIER = 0.605; // additional -20% from 0.756
const MOBILE_TOUCH_PAN_SENSITIVITY_MULTIPLIER = 3; // +200% on mobile touch pan
const MOBILE_SATELLITE_PAN_COMPENSATION = 0.38; // match satellite feel to plan
const MOBILE_SURFACE_DRAG_SMOOTHING = 0.86;
const MOBILE_SURFACE_DRAG_MAX_STEP_HEIGHT_RATIO = 0.045;
const MOBILE_SURFACE_DRAG_MIN_STEP_METERS = 1.2;
const MOBILE_SURFACE_DRAG_MAX_STEP_METERS = 220;
// Preserve the "dezoomed" feel while strongly damping pan close to the ground.
const MOBILE_NEAR_ZOOM_PAN_BRAKE_START_MULTIPLIER = 6;
const MOBILE_NEAR_ZOOM_PAN_BRAKE_MIN_FACTOR = 0.28;
const MOBILE_NEAR_ZOOM_PAN_BRAKE_CURVE = 1.35;
const SATELLITE_MIN_GROUND_CLEARANCE_METERS = 40; // hard floor at 40m above ground
const SATELLITE_MARKER_HEIGHT_OFFSET_METERS = 1.7;
const SATELLITE_MARKER_FALLBACK_HEIGHT_METERS = 65;
const SATELLITE_USE_MESH_CLAMP_FOR_MARKERS = true;
const SATELLITE_USE_MESH_CLAMP_FOR_MARKERS_MOBILE = true;
const SATELLITE_MARKER_DISABLE_DEPTH_TEST_DISTANCE = Number.POSITIVE_INFINITY;
const SATELLITE_MARKER_LOD_UPDATE_INTERVAL_MS = 140;
const SATELLITE_MARKER_LOD_SETTLE_DELAY_MS = 260;
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
const MOBILE_BIEN_CARD_HEIGHT = 134;
const FPS_BENCHMARK_STORAGE_KEY = "immo3d_fps_benchmark_v1";
const FPS_BENCHMARK_VERSION = 6;
const FPS_BENCHMARK_ROUTE_VERSION = 10;
const FPS_BENCHMARK_PREPARE_DELAY_MS = 420;
const FPS_BENCHMARK_INTERRUPT_FRAME_GAP_MS = 2000;
const FPS_BENCHMARK_RECORDING_DURATION_MS = 26000;
const FPS_BENCHMARK_RECORDING_MIN_DURATION_MS = 12000;
const FPS_BENCHMARK_RECORDING_MIN_SAMPLE_COUNT = 120;
const FPS_BENCHMARK_RECORDING_MIN_SEGMENT_MS = 320;
const FPS_BENCHMARK_MIN_DISTANCE_METERS = 420;
const FPS_BENCHMARK_MAX_DISTANCE_METERS = 980;
const FPS_BENCHMARK_DISTANCE_HEIGHT_RATIO = 0.92;
const FPS_BENCHMARK_HISTORY_LIMIT = 18;
const FPS_BENCHMARK_SPIKE_SAMPLE_LIMIT = 6;
const FPS_BENCHMARK_MARKER_CLUSTER_RADIUS_METERS = 260;
const FPS_BENCHMARK_MARKER_CONTEXT_RADIUS_METERS = 620;
const FPS_BENCHMARK_MARKER_SEARCH_RADIUS_METERS = 2800;
const FPS_BENCHMARK_SEGMENTS = [
  {
    key: "pan_start",
    label: "pan debut",
    phaseKey: "pan_start",
    phaseLabel: "pan debut",
    benchmarkMoving: true,
    durationMs: 3300,
    fromX: 0,
    fromY: 0,
    toX: 1.2,
    toY: 0.06,
    fromHeightScale: 0.50,
    toHeightScale: 0.50,
  },
  {
    key: "settle_start",
    label: "settle debut",
    phaseKey: "settle",
    phaseLabel: "settle",
    benchmarkMoving: false,
    durationMs: 900,
    fromX: 1.2,
    fromY: 0.06,
    toX: 1.2,
    toY: 0.06,
    fromHeightScale: 0.50,
    toHeightScale: 0.50,
  },
  {
    key: "pan_mid",
    label: "pan suite",
    phaseKey: "pan_mid",
    phaseLabel: "pan suite",
    benchmarkMoving: true,
    durationMs: 3200,
    fromX: 1.2,
    fromY: 0.06,
    toX: 2.45,
    toY: -0.02,
    fromHeightScale: 0.50,
    toHeightScale: 0.50,
  },
  {
    key: "settle_mid",
    label: "settle milieu",
    phaseKey: "settle",
    phaseLabel: "settle",
    benchmarkMoving: false,
    durationMs: 900,
    fromX: 2.45,
    fromY: -0.02,
    toX: 2.45,
    toY: -0.02,
    fromHeightScale: 0.50,
    toHeightScale: 0.50,
  },
  {
    key: "zoom_out",
    label: "dezoom",
    phaseKey: "zoom_out",
    phaseLabel: "dezoom",
    benchmarkMoving: true,
    durationMs: 1800,
    fromX: 2.45,
    fromY: -0.02,
    toX: 2.45,
    toY: -0.02,
    fromHeightScale: 0.50,
    toHeightScale: 1.18,
  },
  {
    key: "settle_zoom_out",
    label: "settle dezoom",
    phaseKey: "settle",
    phaseLabel: "settle",
    benchmarkMoving: false,
    durationMs: 1100,
    fromX: 2.45,
    fromY: -0.02,
    toX: 2.45,
    toY: -0.02,
    fromHeightScale: 1.18,
    toHeightScale: 1.18,
  },
  {
    key: "zoom_in",
    label: "rezoom",
    phaseKey: "zoom_in",
    phaseLabel: "rezoom",
    benchmarkMoving: true,
    durationMs: 1800,
    fromX: 2.45,
    fromY: -0.02,
    toX: 2.45,
    toY: -0.02,
    fromHeightScale: 1.18,
    toHeightScale: 0.64,
  },
  {
    key: "settle_zoom_in",
    label: "settle rezoom",
    phaseKey: "settle",
    phaseLabel: "settle",
    benchmarkMoving: false,
    durationMs: 900,
    fromX: 2.45,
    fromY: -0.02,
    toX: 2.45,
    toY: -0.02,
    fromHeightScale: 0.64,
    toHeightScale: 0.64,
  },
  {
    key: "pan_finish_a",
    label: "fin trajet 1",
    phaseKey: "finish",
    phaseLabel: "fin trajet",
    benchmarkMoving: true,
    durationMs: 3000,
    fromX: 2.45,
    fromY: -0.02,
    toX: 4.2,
    toY: -0.20,
    fromHeightScale: 0.64,
    toHeightScale: 0.58,
  },
  {
    key: "settle_finish_a",
    label: "settle fin 1",
    phaseKey: "settle",
    phaseLabel: "settle",
    benchmarkMoving: false,
    durationMs: 900,
    fromX: 4.2,
    fromY: -0.20,
    toX: 4.2,
    toY: -0.20,
    fromHeightScale: 0.58,
    toHeightScale: 0.58,
  },
  {
    key: "pan_finish_b",
    label: "fin trajet 2",
    phaseKey: "finish",
    phaseLabel: "fin trajet",
    benchmarkMoving: true,
    durationMs: 3000,
    fromX: 4.2,
    fromY: -0.20,
    toX: 6.15,
    toY: -0.50,
    fromHeightScale: 0.58,
    toHeightScale: 0.50,
  },
  {
    key: "settle_final",
    label: "settle final",
    phaseKey: "settle",
    phaseLabel: "settle",
    benchmarkMoving: false,
    durationMs: 2000,
    fromX: 6.15,
    fromY: -0.50,
    toX: 6.15,
    toY: -0.50,
    fromHeightScale: 0.50,
    toHeightScale: 0.50,
  },
];

function buildBenchmarkSegmentTimeline(segments = []) {
  return (Array.isArray(segments) ? segments : []).reduce((timeline, segment, index) => {
    const durationMs = Math.max(1, Math.round(Number(segment?.durationMs) || 0));
    const previousEndMs =
      timeline.length > 0 ? timeline[timeline.length - 1].endMs : 0;
    timeline.push({
      ...segment,
      key: String(segment?.key || `segment_${index + 1}`),
      label: String(segment?.label || `segment ${index + 1}`),
      phaseKey: String(
        segment?.phaseKey || (segment?.benchmarkMoving ? "move" : "settle")
      ),
      phaseLabel: String(
        segment?.phaseLabel || (segment?.benchmarkMoving ? "mouvement" : "pause")
      ),
      benchmarkMoving:
        typeof segment?.benchmarkMoving === "boolean"
          ? Boolean(segment.benchmarkMoving)
          : true,
      durationMs,
      index,
      startMs: previousEndMs,
      endMs: previousEndMs + durationMs,
    });
    return timeline;
  }, []);
}

function getBenchmarkTimelineDuration(segmentTimeline = []) {
  return segmentTimeline[segmentTimeline.length - 1]?.endMs || 0;
}

const FPS_BENCHMARK_SEGMENT_TIMELINE =
  buildBenchmarkSegmentTimeline(FPS_BENCHMARK_SEGMENTS);
const FPS_BENCHMARK_TOTAL_DURATION_MS = getBenchmarkTimelineDuration(
  FPS_BENCHMARK_SEGMENT_TIMELINE
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

function captureQualityCameraSnapshot(viewer) {
  if (!viewer?.camera) return null;
  return {
    position: Cesium.Cartesian3.clone(viewer.camera.position),
    heading: Number(viewer.camera.heading) || 0,
    pitch: Number(viewer.camera.pitch) || Cesium.Math.toRadians(-90),
    roll: Number(viewer.camera.roll) || 0,
  };
}

function getAngleDeltaRadians(a, b) {
  return Math.abs(Cesium.Math.negativePiToPi((Number(a) || 0) - (Number(b) || 0)));
}

function isQualityCameraSnapshotStable(previousSnapshot, nextSnapshot) {
  if (!previousSnapshot?.position || !nextSnapshot?.position) return false;
  const positionDeltaMeters = Cesium.Cartesian3.distance(
    previousSnapshot.position,
    nextSnapshot.position
  );
  if (positionDeltaMeters > DESKTOP_AUTO_SETTLE_POSITION_EPSILON_METERS) return false;
  if (
    getAngleDeltaRadians(previousSnapshot.heading, nextSnapshot.heading) >
    DESKTOP_AUTO_SETTLE_ANGLE_EPSILON_RAD
  ) {
    return false;
  }
  if (
    getAngleDeltaRadians(previousSnapshot.pitch, nextSnapshot.pitch) >
    DESKTOP_AUTO_SETTLE_ANGLE_EPSILON_RAD
  ) {
    return false;
  }
  if (
    getAngleDeltaRadians(previousSnapshot.roll, nextSnapshot.roll) >
    DESKTOP_AUTO_SETTLE_ANGLE_EPSILON_RAD
  ) {
    return false;
  }
  return true;
}

function sanitizeSerializableCameraState(cameraState) {
  if (!isSerializableCameraStateValid(cameraState)) return null;
  return {
    longitude: roundBenchmarkValue(Number(cameraState.longitude), 6),
    latitude: roundBenchmarkValue(Number(cameraState.latitude), 6),
    height: roundBenchmarkValue(Number(cameraState.height), 1),
    heading: roundBenchmarkValue(Number(cameraState.heading) || 0, 5) ?? 0,
    pitch:
      roundBenchmarkValue(
        Number(cameraState.pitch) || Cesium.Math.toRadians(-90),
        5
      ) ?? Cesium.Math.toRadians(-90),
    roll: roundBenchmarkValue(Number(cameraState.roll) || 0, 5) ?? 0,
  };
}

function getSerializableCameraStatePosition(cameraState) {
  if (!isSerializableCameraStateValid(cameraState)) return null;
  return Cesium.Cartesian3.fromDegrees(
    Number(cameraState.longitude),
    Number(cameraState.latitude),
    Number(cameraState.height)
  );
}

function isSerializableCameraStateStable(previousCameraState, nextCameraState) {
  const previousPosition = getSerializableCameraStatePosition(previousCameraState);
  const nextPosition = getSerializableCameraStatePosition(nextCameraState);
  if (!previousPosition || !nextPosition) return false;

  const positionDeltaMeters = Cesium.Cartesian3.distance(
    previousPosition,
    nextPosition
  );
  if (positionDeltaMeters > DESKTOP_AUTO_SETTLE_POSITION_EPSILON_METERS) {
    return false;
  }
  if (
    getAngleDeltaRadians(previousCameraState?.heading, nextCameraState?.heading) >
    DESKTOP_AUTO_SETTLE_ANGLE_EPSILON_RAD
  ) {
    return false;
  }
  if (
    getAngleDeltaRadians(previousCameraState?.pitch, nextCameraState?.pitch) >
    DESKTOP_AUTO_SETTLE_ANGLE_EPSILON_RAD
  ) {
    return false;
  }
  if (
    getAngleDeltaRadians(previousCameraState?.roll, nextCameraState?.roll) >
    DESKTOP_AUTO_SETTLE_ANGLE_EPSILON_RAD
  ) {
    return false;
  }
  return true;
}

function interpolateAngleRadians(startAngle, endAngle, progress) {
  const safeStart = Number(startAngle) || 0;
  const safeEnd = Number(endAngle) || 0;
  const safeProgress = Cesium.Math.clamp(Number(progress) || 0, 0, 1);
  return safeStart + Cesium.Math.negativePiToPi(safeEnd - safeStart) * safeProgress;
}

function interpolateSerializableCameraState(fromCameraState, toCameraState, progress) {
  if (!isSerializableCameraStateValid(fromCameraState)) {
    return sanitizeSerializableCameraState(toCameraState);
  }
  if (!isSerializableCameraStateValid(toCameraState)) {
    return sanitizeSerializableCameraState(fromCameraState);
  }

  const safeProgress = Cesium.Math.clamp(Number(progress) || 0, 0, 1);
  return {
    longitude: Cesium.Math.lerp(
      Number(fromCameraState.longitude),
      Number(toCameraState.longitude),
      safeProgress
    ),
    latitude: Cesium.Math.lerp(
      Number(fromCameraState.latitude),
      Number(toCameraState.latitude),
      safeProgress
    ),
    height: Cesium.Math.lerp(
      Number(fromCameraState.height),
      Number(toCameraState.height),
      safeProgress
    ),
    heading: interpolateAngleRadians(
      fromCameraState.heading,
      toCameraState.heading,
      safeProgress
    ),
    pitch: interpolateAngleRadians(
      fromCameraState.pitch,
      toCameraState.pitch,
      safeProgress
    ),
    roll: interpolateAngleRadians(
      fromCameraState.roll,
      toCameraState.roll,
      safeProgress
    ),
  };
}

function resolveMode(mapMode) {
  return mapMode === "google3d" && CESIUM_ION_TOKEN ? "google3d" : "osm";
}

function normalizeMobileQualityProfile(value) {
  return MOBILE_QUALITY_PROFILE_VALUES.includes(value)
    ? value
    : MOBILE_QUALITY_PROFILE_DEFAULT;
}

function normalizeDesktopQualityProfile(value) {
  return DESKTOP_QUALITY_PROFILE_VALUES.includes(value)
    ? value
    : DESKTOP_QUALITY_PROFILE_DEFAULT;
}

function getSatelliteMarkerLodBudget(
  cameraHeight,
  isMobile,
  isMoving,
  mobileQualityProfile = MOBILE_QUALITY_PROFILE_DEFAULT,
  desktopQualityProfile = DESKTOP_QUALITY_PROFILE_DEFAULT
) {
  const effectiveMobileQualityProfile =
    isMoving && mobileQualityProfile === "auto"
      ? "perf"
      : mobileQualityProfile;
  const effectiveDesktopQualityProfile =
    isMoving && desktopQualityProfile === "auto"
      ? "perf"
      : desktopQualityProfile;
  const profileMultiplier = isMobile
    ? effectiveMobileQualityProfile === "perf"
      ? 0.62
      : effectiveMobileQualityProfile === "high"
        ? 1.22
        : effectiveMobileQualityProfile === "ultra"
          ? 1.62
          : 1
    : effectiveDesktopQualityProfile === "perf"
      ? 0.75
      : effectiveDesktopQualityProfile === "high"
        ? 1.25
      : effectiveDesktopQualityProfile === "ultra"
          ? 1.62
          : 1;
  const applyMultiplier = (budget) => Math.max(0, Math.round(budget * profileMultiplier));
  const applyBudget = (base) => ({
    bienLabelBudget: applyMultiplier(base.bienLabelBudget),
    bienPointBudget: applyMultiplier(base.bienPointBudget),
    customLabelBudget: applyMultiplier(base.customLabelBudget),
    customPointBudget: applyMultiplier(base.customPointBudget),
  });
  if (isMoving) {
    const base = isMobile
      ? { bienLabelBudget: 0, bienPointBudget: 18, customLabelBudget: 0, customPointBudget: 6 }
      : { bienLabelBudget: 0, bienPointBudget: 32, customLabelBudget: 0, customPointBudget: 10 };
    return applyBudget(base);
  }

  if (!Number.isFinite(cameraHeight)) {
    const base = isMobile
      ? { bienLabelBudget: 20, bienPointBudget: 54, customLabelBudget: 10, customPointBudget: 20 }
      : { bienLabelBudget: 34, bienPointBudget: 86, customLabelBudget: 16, customPointBudget: 30 };
    return applyBudget(base);
  }

  if (cameraHeight <= 260) {
    const base = isMobile
      ? { bienLabelBudget: 56, bienPointBudget: 130, customLabelBudget: 24, customPointBudget: 44 }
      : { bienLabelBudget: 96, bienPointBudget: 190, customLabelBudget: 36, customPointBudget: 70 };
    return applyBudget(base);
  }

  if (cameraHeight <= 780) {
    const base = isMobile
      ? { bienLabelBudget: 40, bienPointBudget: 96, customLabelBudget: 18, customPointBudget: 34 }
      : { bienLabelBudget: 72, bienPointBudget: 150, customLabelBudget: 30, customPointBudget: 56 };
    return applyBudget(base);
  }

  if (cameraHeight <= 1800) {
    const base = isMobile
      ? { bienLabelBudget: 30, bienPointBudget: 72, customLabelBudget: 14, customPointBudget: 28 }
      : { bienLabelBudget: 54, bienPointBudget: 120, customLabelBudget: 24, customPointBudget: 46 };
    return applyBudget(base);
  }

  if (cameraHeight <= 4200) {
    const base = isMobile
      ? { bienLabelBudget: 22, bienPointBudget: 54, customLabelBudget: 10, customPointBudget: 22 }
      : { bienLabelBudget: 40, bienPointBudget: 92, customLabelBudget: 18, customPointBudget: 36 };
    return applyBudget(base);
  }

  const base = isMobile
    ? { bienLabelBudget: 14, bienPointBudget: 36, customLabelBudget: 8, customPointBudget: 16 }
    : { bienLabelBudget: 28, bienPointBudget: 72, customLabelBudget: 14, customPointBudget: 28 };
  return applyBudget(base);
}

function getMobileQualityProfile(value, allowUltraFromDevice) {
  const normalized = normalizeMobileQualityProfile(value);
  const baseProfile =
    MOBILE_QUALITY_PROFILE_CONFIG[normalized] ||
    MOBILE_QUALITY_PROFILE_CONFIG[MOBILE_QUALITY_PROFILE_DEFAULT];
  return {
    ...baseProfile,
    enableUltra: Boolean(
      normalized === "ultra" && baseProfile.enableUltra && allowUltraFromDevice
    ),
  };
}

function getDesktopQualityProfile(value) {
  const normalized = normalizeDesktopQualityProfile(value);
  const baseProfile =
    DESKTOP_QUALITY_PROFILE_CONFIG[normalized] ||
    DESKTOP_QUALITY_PROFILE_CONFIG[DESKTOP_QUALITY_PROFILE_DEFAULT];
  return {
    ...baseProfile,
    settleResolutionScale: Number.isFinite(Number(baseProfile.settleResolutionScale))
      ? Number(baseProfile.settleResolutionScale)
      : Number(baseProfile.idleResolutionScale),
    settleGlobeSse: Number.isFinite(Number(baseProfile.settleGlobeSse))
      ? Number(baseProfile.settleGlobeSse)
      : Number(baseProfile.idleGlobeSse),
    settleTilesetSse: Number.isFinite(Number(baseProfile.settleTilesetSse))
      ? Number(baseProfile.settleTilesetSse)
      : Number(baseProfile.idleTilesetSse),
    settleMsaa: Number.isFinite(Number(baseProfile.settleMsaa))
      ? Number(baseProfile.settleMsaa)
      : Number(baseProfile.idleMsaa),
    settleHoldMs: Math.max(0, Number(baseProfile.settleHoldMs) || 0),
    enableUltra: normalized === "ultra",
  };
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

function getDesktopProfileResolutionScale(targetScale, fallbackScale = DESKTOP_RESOLUTION_SCALE) {
  const safeTarget = Number(targetScale);
  if (!Number.isFinite(safeTarget) || safeTarget <= 0) return fallbackScale;
  if (typeof window === "undefined") return safeTarget;
  const devicePixelRatio = Number(window.devicePixelRatio) || 1;
  const hardCap = Math.max(1, devicePixelRatio * 1.25);
  return Math.max(0.72, Math.min(safeTarget, hardCap));
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

function readFpsBenchmarkStore() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(FPS_BENCHMARK_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    if (Number(parsed.version || 0) !== FPS_BENCHMARK_VERSION) return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeFpsBenchmarkStore(nextStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      FPS_BENCHMARK_STORAGE_KEY,
      JSON.stringify({
        version: FPS_BENCHMARK_VERSION,
        ...nextStore,
      })
    );
  } catch {
    // Ignore storage/runtime issues.
  }
}

function isSerializableCameraStateValid(cameraState) {
  return (
    cameraState &&
    Number.isFinite(Number(cameraState.longitude)) &&
    Number.isFinite(Number(cameraState.latitude)) &&
    Number.isFinite(Number(cameraState.height))
  );
}

function getFpsBenchmarkDistanceMeters(cameraState) {
  const height = Number(cameraState?.height);
  if (!Number.isFinite(height)) return FPS_BENCHMARK_MIN_DISTANCE_METERS;
  return Cesium.Math.clamp(
    height * FPS_BENCHMARK_DISTANCE_HEIGHT_RATIO,
    FPS_BENCHMARK_MIN_DISTANCE_METERS,
    FPS_BENCHMARK_MAX_DISTANCE_METERS
  );
}

function getFpsBenchmarkOffsetAt(elapsedMs, distanceMeters) {
  const segmentMeta = getFpsBenchmarkSegmentMetaAt(elapsedMs);
  if (!segmentMeta?.segment) {
    return { x: 0, y: 0, heightScale: 1 };
  }
  const { progress, segment } = segmentMeta;
  return {
    x: Cesium.Math.lerp(segment.fromX, segment.toX, progress) * distanceMeters,
    y: Cesium.Math.lerp(segment.fromY, segment.toY, progress) * distanceMeters,
    heightScale: Cesium.Math.lerp(
      Number.isFinite(Number(segment.fromHeightScale))
        ? Number(segment.fromHeightScale)
        : 1,
      Number.isFinite(Number(segment.toHeightScale))
        ? Number(segment.toHeightScale)
        : 1,
      progress
    ),
  };
}

function getFpsBenchmarkSegmentMetaAt(
  elapsedMs,
  segmentTimeline = FPS_BENCHMARK_SEGMENT_TIMELINE
) {
  if (!Array.isArray(segmentTimeline) || segmentTimeline.length === 0) return null;
  const totalDurationMs = getBenchmarkTimelineDuration(segmentTimeline);
  const clampedElapsedMs = Number.isFinite(elapsedMs)
    ? Cesium.Math.clamp(elapsedMs, 0, totalDurationMs)
    : 0;
  const lastSegment = segmentTimeline[segmentTimeline.length - 1];
  const matchingSegment =
    segmentTimeline.find((segment) => clampedElapsedMs <= segment.endMs) || lastSegment;
  const segmentDurationMs = Math.max(
    1,
    Number(matchingSegment?.durationMs) || 0
  );
  const segmentElapsedMs = Cesium.Math.clamp(
    clampedElapsedMs - Number(matchingSegment?.startMs || 0),
    0,
    segmentDurationMs
  );
  return {
    index: Number(matchingSegment?.index || 0),
    key: String(matchingSegment?.key || ""),
    label: String(matchingSegment?.label || ""),
    phaseKey: String(matchingSegment?.phaseKey || ""),
    phaseLabel: String(matchingSegment?.phaseLabel || ""),
    benchmarkMoving:
      typeof matchingSegment?.benchmarkMoving === "boolean"
        ? Boolean(matchingSegment.benchmarkMoving)
        : true,
    startMs: Math.max(0, Number(matchingSegment?.startMs || 0)),
    endMs: Math.max(0, Number(matchingSegment?.endMs || 0)),
    durationMs: segmentDurationMs,
    elapsedMs: clampedElapsedMs,
    progress: segmentElapsedMs / segmentDurationMs,
    segment: matchingSegment,
  };
}

function rotateBenchmarkOffsetByHeading(offsetX, offsetY, heading) {
  const safeHeading = Number.isFinite(heading) ? heading : 0;
  const cosHeading = Math.cos(safeHeading);
  const sinHeading = Math.sin(safeHeading);
  return {
    east: offsetX * cosHeading - offsetY * sinHeading,
    north: offsetX * sinHeading + offsetY * cosHeading,
  };
}

function percentile(sortedValues, percentileRatio) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) return null;
  const clampedRatio = Cesium.Math.clamp(percentileRatio, 0, 1);
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * clampedRatio) - 1)
  );
  return sortedValues[index];
}

function roundBenchmarkValue(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sanitizeBenchmarkRecordingSample(sample) {
  const cameraState = sanitizeSerializableCameraState(sample);
  if (!cameraState) return null;
  const elapsedMs = Math.max(0, Math.round(Number(sample?.elapsedMs) || 0));
  return {
    elapsedMs,
    ...cameraState,
    benchmarkMoving:
      typeof sample?.benchmarkMoving === "boolean"
        ? Boolean(sample.benchmarkMoving)
        : null,
  };
}

function mergeShortBenchmarkTimeRanges(ranges = [], minimumDurationMs = 0) {
  let mergedRanges = (Array.isArray(ranges) ? ranges : [])
    .map((range) => ({
      startMs: Math.max(0, Number(range?.startMs) || 0),
      endMs: Math.max(0, Number(range?.endMs) || 0),
      benchmarkMoving: Boolean(range?.benchmarkMoving),
    }))
    .filter((range) => range.endMs > range.startMs)
    .sort((left, right) => left.startMs - right.startMs);

  if (mergedRanges.length <= 1) return mergedRanges;

  const minDurationMs = Math.max(0, Number(minimumDurationMs) || 0);
  let changed = true;

  while (changed && mergedRanges.length > 1) {
    changed = false;
    for (let index = 0; index < mergedRanges.length; index += 1) {
      const currentRange = mergedRanges[index];
      const durationMs = currentRange.endMs - currentRange.startMs;
      if (durationMs >= minDurationMs) continue;

      if (
        index > 0 &&
        index < mergedRanges.length - 1 &&
        mergedRanges[index - 1].benchmarkMoving ===
          mergedRanges[index + 1].benchmarkMoving
      ) {
        mergedRanges = [
          ...mergedRanges.slice(0, index - 1),
          {
            startMs: mergedRanges[index - 1].startMs,
            endMs: mergedRanges[index + 1].endMs,
            benchmarkMoving: mergedRanges[index - 1].benchmarkMoving,
          },
          ...mergedRanges.slice(index + 2),
        ];
      } else if (index > 0) {
        mergedRanges = [
          ...mergedRanges.slice(0, index - 1),
          {
            startMs: mergedRanges[index - 1].startMs,
            endMs: currentRange.endMs,
            benchmarkMoving: mergedRanges[index - 1].benchmarkMoving,
          },
          ...mergedRanges.slice(index + 1),
        ];
      } else {
        mergedRanges = [
          {
            startMs: currentRange.startMs,
            endMs: mergedRanges[1].endMs,
            benchmarkMoving: mergedRanges[1].benchmarkMoving,
          },
          ...mergedRanges.slice(2),
        ];
      }
      changed = true;
      break;
    }
  }

  return mergedRanges;
}

function buildRecordedBenchmarkSegmentTimeline(samples = [], durationMs = 0) {
  const safeSamples = (Array.isArray(samples) ? samples : [])
    .map(sanitizeBenchmarkRecordingSample)
    .filter(Boolean)
    .sort((left, right) => left.elapsedMs - right.elapsedMs);
  if (safeSamples.length < 2) return [];

  const totalDurationMs = Math.max(
    1,
    Math.round(
      Number(durationMs) || Number(safeSamples[safeSamples.length - 1]?.elapsedMs) || 0
    )
  );
  let currentMoving =
    typeof safeSamples[1]?.benchmarkMoving === "boolean"
      ? Boolean(safeSamples[1].benchmarkMoving)
      : Boolean(safeSamples[0]?.benchmarkMoving);
  let currentStartMs = 0;
  const rawRanges = [];

  for (let index = 1; index < safeSamples.length; index += 1) {
    const sample = safeSamples[index];
    const sampleMoving =
      typeof sample?.benchmarkMoving === "boolean"
        ? Boolean(sample.benchmarkMoving)
        : currentMoving;
    if (sampleMoving === currentMoving) continue;
    rawRanges.push({
      startMs: currentStartMs,
      endMs: Math.max(currentStartMs + 1, sample.elapsedMs),
      benchmarkMoving: currentMoving,
    });
    currentStartMs = sample.elapsedMs;
    currentMoving = sampleMoving;
  }

  rawRanges.push({
    startMs: currentStartMs,
    endMs: Math.max(currentStartMs + 1, totalDurationMs),
    benchmarkMoving: currentMoving,
  });

  const mergedRanges = mergeShortBenchmarkTimeRanges(
    rawRanges,
    FPS_BENCHMARK_RECORDING_MIN_SEGMENT_MS
  );
  let moveIndex = 0;
  let settleIndex = 0;
  return buildBenchmarkSegmentTimeline(
    mergedRanges.map((range) => {
      const durationMsForRange = Math.max(
        1,
        Math.round(Number(range?.endMs || 0) - Number(range?.startMs || 0))
      );
      if (range.benchmarkMoving) {
        moveIndex += 1;
        return {
          key: `move_${moveIndex}`,
          label: `mouvement ${moveIndex}`,
          phaseKey: "move",
          phaseLabel: "mouvement",
          benchmarkMoving: true,
          durationMs: durationMsForRange,
        };
      }
      settleIndex += 1;
      return {
        key: `settle_${settleIndex}`,
        label: `pause ${settleIndex}`,
        phaseKey: "settle",
        phaseLabel: "pause",
        benchmarkMoving: false,
        durationMs: durationMsForRange,
      };
    })
  );
}

function sanitizeBenchmarkRecording(recording) {
  const safeSamples = (Array.isArray(recording?.samples) ? recording.samples : [])
    .map(sanitizeBenchmarkRecordingSample)
    .filter(Boolean)
    .sort((left, right) => left.elapsedMs - right.elapsedMs);
  const safeDurationMs = Math.max(
    0,
    Math.round(
      Number(recording?.durationMs) || Number(safeSamples[safeSamples.length - 1]?.elapsedMs) || 0
    )
  );
  if (
    safeSamples.length < FPS_BENCHMARK_RECORDING_MIN_SAMPLE_COUNT ||
    safeDurationMs < FPS_BENCHMARK_RECORDING_MIN_DURATION_MS
  ) {
    return null;
  }

  const segmentTimeline =
    Array.isArray(recording?.segmentTimeline) && recording.segmentTimeline.length > 0
      ? buildBenchmarkSegmentTimeline(recording.segmentTimeline)
      : buildRecordedBenchmarkSegmentTimeline(safeSamples, safeDurationMs);
  if (segmentTimeline.length === 0) return null;

  return {
    createdAt: Number(recording?.createdAt) || Date.now(),
    durationMs: safeDurationMs,
    sampleCount: safeSamples.length,
    samples: safeSamples,
    segmentTimeline,
  };
}

function sanitizeBenchmarkMarkerCluster(markerCluster) {
  if (
    !markerCluster ||
    !Number.isFinite(Number(markerCluster.longitude)) ||
    !Number.isFinite(Number(markerCluster.latitude))
  ) {
    return null;
  }
  return {
    longitude: roundBenchmarkValue(Number(markerCluster.longitude), 6),
    latitude: roundBenchmarkValue(Number(markerCluster.latitude), 6),
    markerCount: Math.max(0, Math.round(Number(markerCluster.markerCount) || 0)),
  };
}

function sanitizeFpsBenchmarkScenario(scenario) {
  const recording = sanitizeBenchmarkRecording(scenario?.recording);
  const startCamera =
    sanitizeSerializableCameraState(scenario?.startCamera) ||
    sanitizeSerializableCameraState(recording?.samples?.[0]);
  if (!startCamera) return null;

  return {
    createdAt: Number(scenario?.createdAt) || Date.now(),
    routeVersion: Math.max(
      FPS_BENCHMARK_ROUTE_VERSION,
      Number(scenario?.routeVersion) || 0
    ),
    baseCamera:
      sanitizeSerializableCameraState(scenario?.baseCamera) || startCamera,
    startCamera,
    markerCluster: sanitizeBenchmarkMarkerCluster(scenario?.markerCluster),
    recording,
  };
}

function sanitizeBenchmarkHistoryEntry(entry) {
  if (!entry || !Number.isFinite(Number(entry.avgFps))) return null;
  const runKind =
    String(entry.runKind || "").toLowerCase() === "cold" || Boolean(entry.coldStart)
      ? "cold"
      : "warm";
  return {
    ranAt: String(entry.ranAt || ""),
    avgFps: roundBenchmarkValue(Number(entry.avgFps)),
    minFps: roundBenchmarkValue(Number(entry.minFps)),
    avgFrameMs: roundBenchmarkValue(Number(entry.avgFrameMs)),
    p95FrameMs: roundBenchmarkValue(Number(entry.p95FrameMs)),
    maxFrameMs: roundBenchmarkValue(Number(entry.maxFrameMs)),
    longTaskCount: Math.max(0, Number(entry.longTaskCount || 0)),
    maxLongTaskMs: roundBenchmarkValue(Number(entry.maxLongTaskMs)),
    qualityProfile: String(entry.qualityProfile || ""),
    runKind,
    coldStart: Boolean(entry.coldStart),
    distanceMeters: Math.max(0, Number(entry.distanceMeters || 0)),
    routeKind: String(entry.routeKind || ""),
  };
}

function normalizeBenchmarkHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .map(sanitizeBenchmarkHistoryEntry)
    .filter(Boolean)
    .slice(0, FPS_BENCHMARK_HISTORY_LIMIT);
}

function getBenchmarkSurfaceDistanceMeters(pointA, pointB) {
  if (!pointA || !pointB) return Number.POSITIVE_INFINITY;
  const geodesic = new Cesium.EllipsoidGeodesic(
    Cesium.Cartographic.fromDegrees(pointA.longitude, pointA.latitude),
    Cesium.Cartographic.fromDegrees(pointB.longitude, pointB.latitude)
  );
  return Number.isFinite(geodesic.surfaceDistance)
    ? geodesic.surfaceDistance
    : Number.POSITIVE_INFINITY;
}

function extractBenchmarkMarkerCandidates(entities = []) {
  const nextCandidates = [];
  const seenKeys = new Set();
  entities.forEach((entity) => {
    const cartesian =
      entity?.markerPositionCartesian ||
      entity?.position?.getValue?.(Cesium.JulianDate.now?.());
    if (!cartesian) return;
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    if (!cartographic) return;
    const longitude = Cesium.Math.toDegrees(cartographic.longitude);
    const latitude = Cesium.Math.toDegrees(cartographic.latitude);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
    const key = `${longitude.toFixed(6)}:${latitude.toFixed(6)}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    nextCandidates.push({ longitude, latitude });
  });
  return nextCandidates;
}

function findPreferredBenchmarkMarkerCluster(cameraState, markerCandidates) {
  if (!isSerializableCameraStateValid(cameraState) || markerCandidates.length === 0) {
    return null;
  }

  const nearbyCandidates = markerCandidates.filter(
    (candidate) =>
      getBenchmarkSurfaceDistanceMeters(cameraState, candidate) <=
      FPS_BENCHMARK_MARKER_SEARCH_RADIUS_METERS
  );
  const northernCandidates = nearbyCandidates.filter(
    (candidate) => candidate.latitude >= cameraState.latitude
  );
  const searchPool =
    northernCandidates.length >= 4 ? northernCandidates : nearbyCandidates;
  if (searchPool.length === 0) return null;

  let bestCluster = null;
  searchPool.forEach((candidate) => {
    let nearCount = 0;
    let contextCount = 0;
    let sumLongitude = 0;
    let sumLatitude = 0;

    searchPool.forEach((otherCandidate) => {
      const distanceMeters = getBenchmarkSurfaceDistanceMeters(candidate, otherCandidate);
      if (distanceMeters <= FPS_BENCHMARK_MARKER_CONTEXT_RADIUS_METERS) {
        contextCount += 1;
        sumLongitude += otherCandidate.longitude;
        sumLatitude += otherCandidate.latitude;
      }
      if (distanceMeters <= FPS_BENCHMARK_MARKER_CLUSTER_RADIUS_METERS) {
        nearCount += 1;
      }
    });

    if (contextCount === 0) return;

    const latitudeBias = Math.max(0, candidate.latitude - cameraState.latitude) * 100000;
    const distancePenalty =
      getBenchmarkSurfaceDistanceMeters(cameraState, candidate) /
      FPS_BENCHMARK_MARKER_SEARCH_RADIUS_METERS;
    const score = nearCount * 10 + contextCount * 4 + latitudeBias - distancePenalty * 6;

    if (!bestCluster || score > bestCluster.score) {
      bestCluster = {
        score,
        markerCount: contextCount,
        longitude: sumLongitude / contextCount,
        latitude: sumLatitude / contextCount,
      };
    }
  });

  return bestCluster;
}

function formatMetricSample(values = []) {
  if (!Array.isArray(values) || values.length === 0) return "[]";
  return `[${values.map((value) => `${value}ms`).join(", ")}]`;
}

function buildBenchmarkFrameStats(frameTimesMs = []) {
  const safeFrameTimes = frameTimesMs.filter(
    (value) => Number.isFinite(value) && value > 0
  );
  if (safeFrameTimes.length === 0) return null;
  const sortedFrameTimes = [...safeFrameTimes].sort((left, right) => left - right);
  const totalDurationMs = safeFrameTimes.reduce((sum, value) => sum + value, 0);
  const averageFrameMs = totalDurationMs / safeFrameTimes.length;
  const minFrameMs = sortedFrameTimes[0];
  const maxFrameMs = sortedFrameTimes[sortedFrameTimes.length - 1];
  const p95FrameMs = percentile(sortedFrameTimes, 0.95);

  return {
    sampleCount: safeFrameTimes.length,
    durationMs: Math.round(totalDurationMs),
    avgFps: roundBenchmarkValue(1000 / averageFrameMs),
    minFps: roundBenchmarkValue(1000 / maxFrameMs),
    maxFps: roundBenchmarkValue(1000 / minFrameMs),
    avgFrameMs: roundBenchmarkValue(averageFrameMs),
    p95FrameMs: roundBenchmarkValue(p95FrameMs),
    maxFrameMs: roundBenchmarkValue(maxFrameMs),
  };
}

function buildBenchmarkFrameGroupStats(
  frameSamples = [],
  { keyField, labelField, orderField }
) {
  if (!Array.isArray(frameSamples) || frameSamples.length === 0) return [];
  const groups = [];
  const groupsByKey = new Map();

  frameSamples.forEach((sample) => {
    const key = String(sample?.[keyField] || "");
    if (!key) return;

    if (!groupsByKey.has(key)) {
      const nextGroup = {
        key,
        label: String(sample?.[labelField] || key),
        order: Number.isFinite(Number(sample?.[orderField]))
          ? Number(sample[orderField])
          : groups.length,
        frameTimesMs: [],
      };
      groupsByKey.set(key, nextGroup);
      groups.push(nextGroup);
    }

    groupsByKey.get(key).frameTimesMs.push(Number(sample?.frameMs) || 0);
  });

  return groups
    .sort((left, right) => left.order - right.order)
    .map((group) => {
      const stats = buildBenchmarkFrameStats(group.frameTimesMs);
      return stats
        ? {
            key: group.key,
            label: group.label,
            ...stats,
          }
        : null;
    })
    .filter(Boolean);
}

function buildBenchmarkPerfEventSamples(
  events = [],
  benchmarkStartedAtMs,
  segmentTimeline = FPS_BENCHMARK_SEGMENT_TIMELINE
) {
  if (!Array.isArray(events) || !Number.isFinite(benchmarkStartedAtMs)) return [];
  return events
    .map((event) => {
      const eventAtMs = Date.parse(String(event?.at || ""));
      const elapsedMs = Number.isFinite(eventAtMs)
        ? Math.max(0, eventAtMs - benchmarkStartedAtMs)
        : null;
      const segmentMeta =
        Number.isFinite(elapsedMs) && elapsedMs !== null
          ? getFpsBenchmarkSegmentMetaAt(elapsedMs, segmentTimeline)
          : null;
      const durationMs = roundBenchmarkValue(Number(event?.durationMs) || 0);
      if (!Number.isFinite(durationMs) || durationMs <= 0) return null;

      return {
        at: String(event?.at || ""),
        elapsedMs: roundBenchmarkValue(elapsedMs),
        durationMs,
        segmentKey: segmentMeta?.key || null,
        segmentLabel: segmentMeta?.label || null,
        phaseKey: segmentMeta?.phaseKey || null,
        phaseLabel: segmentMeta?.phaseLabel || null,
        moving:
          typeof event?.moving === "boolean" ? Boolean(event.moving) : null,
        qualityPreset: String(event?.qualityPreset || ""),
        qualityMoving:
          typeof event?.qualityMoving === "boolean"
            ? Boolean(event.qualityMoving)
            : null,
        resolutionScale: roundBenchmarkValue(Number(event?.resolutionScale), 2),
        msaaSamples: Number.isFinite(Number(event?.msaaSamples))
          ? Math.max(0, Number(event.msaaSamples))
          : null,
        globeSse: roundBenchmarkValue(Number(event?.globeSse), 2),
        tilesetSse: roundBenchmarkValue(Number(event?.tilesetSse), 2),
        remainingTiles: Number.isFinite(Number(event?.remainingTiles))
          ? Math.max(0, Math.round(Number(event.remainingTiles)))
          : null,
        peakRemainingTiles: Number.isFinite(Number(event?.peakRemainingTiles))
          ? Math.max(0, Math.round(Number(event.peakRemainingTiles)))
          : null,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.durationMs - left.durationMs)
    .slice(0, FPS_BENCHMARK_SPIKE_SAMPLE_LIMIT);
}

function buildFpsBenchmarkResult(
  frameSamples,
  extra = {},
  segmentTimeline = FPS_BENCHMARK_SEGMENT_TIMELINE
) {
  if (!Array.isArray(frameSamples) || frameSamples.length === 0) return null;
  const safeFrameSamples = frameSamples.filter(
    (sample) => Number.isFinite(Number(sample?.frameMs)) && Number(sample.frameMs) > 0
  );
  if (safeFrameSamples.length === 0) return null;
  const safeSegmentTimeline =
    Array.isArray(segmentTimeline) && segmentTimeline.length > 0
      ? segmentTimeline
      : FPS_BENCHMARK_SEGMENT_TIMELINE;

  const frameStats = buildBenchmarkFrameStats(
    safeFrameSamples.map((sample) => Number(sample.frameMs))
  );
  if (!frameStats) return null;

  const topFrameSpikeEvents = [...safeFrameSamples]
    .sort((left, right) => Number(right.frameMs) - Number(left.frameMs))
    .slice(0, FPS_BENCHMARK_SPIKE_SAMPLE_LIMIT)
    .map((sample) => ({
      frameMs: roundBenchmarkValue(Number(sample.frameMs)),
      elapsedMs: roundBenchmarkValue(Number(sample.elapsedMs)),
      segmentKey: String(sample.segmentKey || ""),
      segmentLabel: String(sample.segmentLabel || ""),
      phaseKey: String(sample.phaseKey || ""),
      phaseLabel: String(sample.phaseLabel || ""),
      benchmarkMoving:
        typeof sample.benchmarkMoving === "boolean"
          ? Boolean(sample.benchmarkMoving)
          : null,
      qualityPreset: String(sample.qualityPreset || ""),
      qualityMoving:
        typeof sample.qualityMoving === "boolean"
          ? Boolean(sample.qualityMoving)
          : null,
      resolutionScale: roundBenchmarkValue(Number(sample.resolutionScale), 2),
      msaaSamples: Number.isFinite(Number(sample.msaaSamples))
        ? Math.max(0, Number(sample.msaaSamples))
        : null,
      globeSse: roundBenchmarkValue(Number(sample.globeSse), 2),
      tilesetSse: roundBenchmarkValue(Number(sample.tilesetSse), 2),
    }));

  return {
    ranAt: new Date().toISOString(),
    ...frameStats,
    topFrameSpikesMs: topFrameSpikeEvents.map((sample) => sample.frameMs),
    topFrameSpikeEvents,
    segmentTimeline: safeSegmentTimeline.map((segment) => ({
      index: segment.index + 1,
      key: segment.key,
      label: segment.label,
      phaseKey: segment.phaseKey,
      phaseLabel: segment.phaseLabel,
      startMs: segment.startMs,
      endMs: segment.endMs,
      durationMs: segment.durationMs,
    })),
    segmentStats: buildBenchmarkFrameGroupStats(safeFrameSamples, {
      keyField: "segmentKey",
      labelField: "segmentLabel",
      orderField: "segmentIndex",
    }),
    phaseStats: buildBenchmarkFrameGroupStats(safeFrameSamples, {
      keyField: "phaseKey",
      labelField: "phaseLabel",
      orderField: "phaseOrder",
    }),
    ...extra,
  };
}

function formatFpsBenchmarkSummary(result) {
  if (!result || !Number.isFinite(result.avgFps)) return "";
  const parts = [
    `avg ${result.avgFps} fps`,
    Number.isFinite(result.minFps) ? `min ${result.minFps} fps` : null,
    Number.isFinite(result.avgFrameMs) ? `avg ${result.avgFrameMs} ms` : null,
    Number.isFinite(result.p95FrameMs) ? `p95 ${result.p95FrameMs} ms` : null,
    Number.isFinite(result.maxFrameMs) ? `max ${result.maxFrameMs} ms` : null,
    Number.isFinite(result.longTaskCount) ? `LT ${result.longTaskCount}` : null,
    Number.isFinite(result.maxLongTaskMs) ? `max LT ${result.maxLongTaskMs} ms` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function formatFpsBenchmarkSummaryDisplay(result) {
  const baseSummary = formatFpsBenchmarkSummary(result);
  if (!baseSummary) return "";
  const normalizedSummary = baseSummary
    .split(" Â· ")
    .join(" | ")
    .split(" · ")
    .join(" | ");
  return `${result.runKind === "cold" ? "cold" : "warm"} | ${normalizedSummary}`;
}

function buildFpsBenchmarkLogPayload(result, history = []) {
  if (!result) return null;
  return {
    latest: result,
    history: normalizeBenchmarkHistory(history),
  };
}

function formatFpsBenchmarkLogText(payload) {
  if (!payload?.latest) return "";
  return JSON.stringify(payload, null, 2);
}

function publishFpsBenchmarkLogs(payload) {
  if (typeof window === "undefined" || !payload?.latest) return;
  window.__IMMO3D_FPS_BENCHMARK_LOGS__ = payload;
  window.__IMMO3D_FPS_BENCHMARK_LOG_TEXT__ = formatFpsBenchmarkLogText(payload);
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

  const initialTilesLoadedEvent = tileset.initialTilesLoaded;
  const loadProgressEvent = tileset.tileLoadProgressEvent;
  const hasInitialTilesEvent =
    initialTilesLoadedEvent &&
    typeof initialTilesLoadedEvent.addEventListener === "function";
  const hasLoadProgressEvent =
    loadProgressEvent && typeof loadProgressEvent.addEventListener === "function";

  if (!hasInitialTilesEvent && !hasLoadProgressEvent) {
    return Promise.resolve(Boolean(tileset.tilesLoaded));
  }

  return new Promise((resolve) => {
    let finished = false;

    function handleInitialTilesLoaded() {
      complete(true);
    }

    function handleTileLoadProgress(remainingTiles = 1) {
      if (remainingTiles > 0 && !tileset.tilesLoaded) return;
      complete(true);
    }

    function complete(didLoad = false) {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeoutId);
      initialTilesLoadedEvent?.removeEventListener?.(handleInitialTilesLoaded);
      loadProgressEvent?.removeEventListener?.(handleTileLoadProgress);
      resolve(didLoad);
    }

    const timeoutId = window.setTimeout(
      () => complete(false),
      GOOGLE_TILESET_READY_TIMEOUT_MS
    );

    if (hasInitialTilesEvent) {
      initialTilesLoadedEvent.addEventListener(handleInitialTilesLoaded);
    }
    if (hasLoadProgressEvent) {
      loadProgressEvent.addEventListener(handleTileLoadProgress);
    }
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
  // Mobile pan is handled by custom touch logic below.
  // Keep Cesium translate disabled to avoid double pan sensitivity.
  controller.enableTranslate = false;
  controller.enableZoom = true;
  controller.lookEventTypes = [];
  controller.tiltEventTypes = [];
  controller.rotateEventTypes = [];
  controller.zoomEventTypes = [
    Cesium.CameraEventType.WHEEL,
    Cesium.CameraEventType.PINCH,
  ];
  controller.translateEventTypes = [];
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

function getModeKey() {
  // Use one shared sync baseline so pan-speed curve stays identical across modes.
  return "shared";
}

function getCameraHeight(viewer) {
  if (!viewer?.camera?.positionWC) return null;
  const cartographic = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC);
  if (!cartographic || !Number.isFinite(cartographic.height)) return null;
  return cartographic.height;
}

function getModePanConfig(tuning) {
  // Keep the same navigation feel in satellite as in plan.
  return tuning.pan.plan;
}

function getModeMinZoomHeight(tuning) {
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

function getBienPreviewPhoto(bien) {
  const photos = getSelectedBienPhotos(bien);
  return Array.isArray(photos) && photos.length > 0 ? photos[0] : "";
}

function getBienStableId(bien) {
  if (!bien || typeof bien !== "object") return "";
  return String(
    bien.id ??
      bien.bien_id ??
      bien.id_bien ??
      bien.lien_yanport ??
      bien.lien_annonce ??
      ""
  );
}

function getStackedOptionBadge(bien) {
  if (bien?.blackliste) {
    return {
      label: "blackliste",
      style: {
        background: "#fee2e2",
        color: "#991b1b",
        border: "1px solid #fecaca",
      },
    };
  }

  if (bien?.de_cote) {
    return {
      label: "de cote",
      style: {
        background: "#fef3c7",
        color: "#92400e",
        border: "1px solid #fde68a",
      },
    };
  }

  if (bien?.favorite) {
    return {
      label: "favori",
      style: {
        background: "#dcfce7",
        color: "#166534",
        border: "1px solid #bbf7d0",
      },
    };
  }

  return getBienBadge(bien);
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
  mobileQualityProfile = MOBILE_QUALITY_PROFILE_DEFAULT,
  desktopQualityProfile = DESKTOP_QUALITY_PROFILE_DEFAULT,
  isMobile = false,
  isIOSDevice = false,
  isStandalonePwa = false,
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
  const modeTransitionVisualTimeoutRef = useRef(null);
  const modeTransitionStartedAtRef = useRef(0);
  const tiltTransitionTimeoutRef = useRef(null);
  const tiltTransitionLockRef = useRef(false);
  const googleQualityTimeoutRef = useRef(null);
  const googleUltraQualityTimeoutRef = useRef(null);
  const desktopQualityRestoreTimeoutRef = useRef(null);
  const desktopIdleFinalizeTimeoutRef = useRef(null);
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
  const tileLoadBurstStateRef = useRef({
    active: false,
    startedAt: 0,
    peakRemainingTiles: 0,
    lastRemainingTiles: 0,
  });
  const appBootTimestampRef = useRef(Date.now());
  const tiltToggleBaseRangeRef = useRef(null);
  const activeZoneCacheKeyRef = useRef(buildZoneCacheKey(searchZone));
  const satelliteViewLimitRectangleRef = useRef(null);
  const zoneCameraRestoreDoneRef = useRef(false);
  const hasInitialFlyRef = useRef(false);
  const mapModeRef = useRef(canUseGoogle3D ? mapMode : "osm");
  const hasRecordedFirstSatelliteReadyRef = useRef(false);
  const componentMountedRef = useRef(true);
  const touchNavTuningRef = useRef(touchNavTuning || TOUCH_NAV_TUNING);
  const mobileQualityProfileRef = useRef(
    normalizeMobileQualityProfile(mobileQualityProfile)
  );
  const desktopQualityProfileRef = useRef(
    normalizeDesktopQualityProfile(desktopQualityProfile)
  );
  const isTiltedRef = useRef(false);
  const ignoreNextClickRef = useRef(false);
  const longPressTimerRef = useRef(null);
  const longPressStartRef = useRef({ x: 0, y: 0, active: false });
  const markerStackByBienIdRef = useRef(new Map());
  const customMarkerEntitiesRef = useRef([]);
  const markerLodRuntimeRef = useRef({
    nextUpdateAt: 0,
    lastSignature: "",
    movingStateApplied: false,
  });
  const markerLodSettleTimeoutRef = useRef(null);
  const fpsBenchmarkRafRef = useRef(null);
  const fpsBenchmarkStartTimeoutRef = useRef(null);
  const fpsBenchmarkRecordingRafRef = useRef(null);
  const fpsBenchmarkRecordingDetachRef = useRef(() => {});
  const fpsBenchmarkRecordingMoveActiveRef = useRef(false);
  const fpsBenchmarkCameraInputsRef = useRef(null);
  const fpsBenchmarkRunCountRef = useRef(0);
  const fpsBenchmarkActiveRef = useRef(false);
  const fpsBenchmarkQualityLockTimeoutRef = useRef(null);
  const fpsBenchmarkQualityLockRef = useRef(false);
  const fpsBenchmarkLastSegmentKeyRef = useRef("");
  const desktopIdleRestoreAttemptRef = useRef(0);
  const desktopPointerNavigationActiveRef = useRef(false);
  const desktopSettleSnapshotRef = useRef(null);
  const desktopMovingVisibleUntilRef = useRef(0);
  const applyFpsBenchmarkMovingQualityRef = useRef(() => {});
  const applyFpsBenchmarkInitialPauseQualityRef = useRef(() => {});
  const releaseFpsBenchmarkMovingQualityRef = useRef(() => {});
  const applyFpsBenchmarkSegmentQualityRef = useRef(() => {});
  const currentQualityTelemetryRef = useRef({
    preset: "",
    moving: null,
    resolutionScale: null,
    msaaSamples: null,
    globeSse: null,
    tilesetSse: null,
  });
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
    shared: null,
  });
  const [isTilted, setIsTilted] = useState(false);
  const [isTiltTransitioning, setIsTiltTransitioning] = useState(false);
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
  const [modeTransitionVisual, setModeTransitionVisual] = useState({
    visible: false,
    fading: false,
    snapshotDataUrl: "",
  });
  const [fpsBenchmarkState, setFpsBenchmarkState] = useState(() => {
    const store = readFpsBenchmarkStore();
    const scenario = sanitizeFpsBenchmarkScenario(store?.scenario);
    return {
      running: false,
      recording: false,
      scenario,
      lastResult:
        store?.lastResult && Number.isFinite(Number(store.lastResult.avgFps))
          ? store.lastResult
          : null,
      history: normalizeBenchmarkHistory(store?.history),
      lastLogText: String(store?.lastLogText || ""),
      message: "",
    };
  });

  useEffect(() => {
    if (!fpsBenchmarkState.lastResult) return;
    publishFpsBenchmarkLogs(
      buildFpsBenchmarkLogPayload(
        fpsBenchmarkState.lastResult,
        fpsBenchmarkState.history
      )
    );
  }, [fpsBenchmarkState.history, fpsBenchmarkState.lastResult]);

  const isSatelliteReadyRef = useRef(false);
  const isTouchNavigationDevice = isMobile && hasTouchInput();

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
    mapModeRef.current = canUseGoogle3D ? resolveMode(mapMode) : "osm";
  }, [mapMode, canUseGoogle3D, tilesReadyVersion]);

  useEffect(() => {
    isSatelliteReadyRef.current = isSatelliteReady;
  }, [isSatelliteReady]);

  useEffect(() => {
    return () => {
      if (fpsBenchmarkRafRef.current) {
        window.cancelAnimationFrame(fpsBenchmarkRafRef.current);
        fpsBenchmarkRafRef.current = null;
      }
      if (fpsBenchmarkStartTimeoutRef.current) {
        window.clearTimeout(fpsBenchmarkStartTimeoutRef.current);
        fpsBenchmarkStartTimeoutRef.current = null;
      }
      const viewer = viewerRef.current;
      if (
        viewer &&
        !viewer.isDestroyed() &&
        fpsBenchmarkCameraInputsRef.current !== null
      ) {
        viewer.scene.screenSpaceCameraController.enableInputs =
          fpsBenchmarkCameraInputsRef.current;
      }
      fpsBenchmarkCameraInputsRef.current = null;
    };
  }, []);

  useEffect(() => {
    touchNavTuningRef.current = touchNavTuning || TOUCH_NAV_TUNING;
  }, [touchNavTuning]);

  useEffect(() => {
    mobileQualityProfileRef.current =
      normalizeMobileQualityProfile(mobileQualityProfile);
  }, [mobileQualityProfile]);

  useEffect(() => {
    desktopQualityProfileRef.current =
      normalizeDesktopQualityProfile(desktopQualityProfile);
  }, [desktopQualityProfile]);

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
    const liveMode =
      modeRef.current === "google3d" || Boolean(tilesetRef.current?.show)
        ? "google3d"
        : canUseGoogle3D
          ? resolveMode(mapModeRef.current)
          : "osm";
    if (liveMode === "google3d") return;
    tiltTransitionLockRef.current = false;
    setIsTiltTransitioning(false);
    if (tiltTransitionTimeoutRef.current) {
      window.clearTimeout(tiltTransitionTimeoutRef.current);
      tiltTransitionTimeoutRef.current = null;
    }
  }, [mapMode, canUseGoogle3D, tilesReadyVersion]);

  useEffect(() => {
    const liveSatelliteActive =
      modeRef.current === "google3d" || Boolean(tilesetRef.current?.show);
    if (!liveSatelliteActive) return;
    if (mapMode !== "google3d") return;
    if (satelliteIssueMessage) {
      setSatelliteIssueMessage("");
    }
    if (mapModeRef.current !== "google3d") {
      mapModeRef.current = "google3d";
    }
  }, [mapMode, canUseGoogle3D, satelliteIssueMessage, tilesReadyVersion]);

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
    if (!stackedMarkerOptions.length) return;

    const latestBiensById = new Map();
    [...(Array.isArray(allBiens) ? allBiens : []), ...(Array.isArray(biens) ? biens : [])].forEach(
      (bien) => {
        const bienId = getBienStableId(bien);
        if (!bienId) return;
        latestBiensById.set(bienId, bien);
      }
    );

    let hasChanged = false;
    const nextOptions = stackedMarkerOptions
      .map((option) => {
        const optionId = getBienStableId(option);
        if (!optionId) return option;
        const latestOption = latestBiensById.get(optionId);
        if (!latestOption) return option;
        if (latestOption !== option) {
          hasChanged = true;
        }
        return latestOption;
      })
      .filter(Boolean);

    if (hasChanged) {
      setStackedMarkerOptions(nextOptions);
    }
  }, [allBiens, biens, stackedMarkerOptions]);

  useEffect(() => {
    markerEditorOpenRef.current = markerEditorOpen;
  }, [markerEditorOpen]);

  useEffect(() => {
    return () => {
      componentMountedRef.current = false;
      if (modeTransitionTimeoutRef.current) {
        window.clearTimeout(modeTransitionTimeoutRef.current);
      }
      if (tiltTransitionTimeoutRef.current) {
        window.clearTimeout(tiltTransitionTimeoutRef.current);
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
      if (desktopIdleFinalizeTimeoutRef.current) {
        window.clearTimeout(desktopIdleFinalizeTimeoutRef.current);
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
      if (modeTransitionVisualTimeoutRef.current) {
        window.clearTimeout(modeTransitionVisualTimeoutRef.current);
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

  function clearModeTransitionVisualTimeout() {
    if (!modeTransitionVisualTimeoutRef.current) return;
    window.clearTimeout(modeTransitionVisualTimeoutRef.current);
    modeTransitionVisualTimeoutRef.current = null;
  }

  function captureTransitionSnapshot() {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return "";
    try {
      viewer.scene.requestRender();
      const canvas = viewer.canvas;
      if (!canvas || typeof canvas.toDataURL !== "function") return "";
      return canvas.toDataURL("image/jpeg", 0.62);
    } catch {
      // CORS-tainted canvases can fail to export; fallback to blur-only overlay.
      return "";
    }
  }

  function startModeTransition(targetMode) {
    if (modeTransitionTimeoutRef.current) {
      window.clearTimeout(modeTransitionTimeoutRef.current);
      modeTransitionTimeoutRef.current = null;
    }
    clearModeTransitionVisualTimeout();
    modeTransitionStartedAtRef.current = Date.now();
    setModeTransitionVisual({
      visible: true,
      fading: false,
      snapshotDataUrl: captureTransitionSnapshot(),
    });

    setModeTransition({
      active: true,
      target: targetMode,
    });
  }

  function finishModeTransition() {
    if (modeTransitionTimeoutRef.current) {
      window.clearTimeout(modeTransitionTimeoutRef.current);
    }
    clearModeTransitionVisualTimeout();
    const elapsedMs = Date.now() - (modeTransitionStartedAtRef.current || 0);
    const delayBeforeFadeMs = Math.max(0, MODE_TRANSITION_MIN_VISIBLE_MS - elapsedMs);
    const startFadeOut = () => {
      setModeTransitionVisual((previous) => {
        if (!previous.visible) return previous;
        return {
          ...previous,
          fading: true,
        };
      });
      modeTransitionVisualTimeoutRef.current = window.setTimeout(() => {
        setModeTransitionVisual({
          visible: false,
          fading: false,
          snapshotDataUrl: "",
        });
        modeTransitionVisualTimeoutRef.current = null;
      }, MODE_TRANSITION_VISUAL_FADE_OUT_MS);
    };
    if (delayBeforeFadeMs > 0) {
      modeTransitionVisualTimeoutRef.current = window.setTimeout(() => {
        startFadeOut();
      }, delayBeforeFadeMs);
    } else {
      startFadeOut();
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
      if (!previousValue && nextReadyValue) {
        const readyDurationMs = Date.now() - appBootTimestampRef.current;
        if (!hasRecordedFirstSatelliteReadyRef.current) {
          recordMapPerfEvent("satellite_ready_first", { durationMs: readyDurationMs });
          hasRecordedFirstSatelliteReadyRef.current = true;
        }
        recordMapPerfEvent("satellite_ready", { durationMs: readyDurationMs });
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

  function setSceneGoogleTilesetsVisibility(viewer, visible, preferredTileset = null) {
    if (!viewer || viewer.isDestroyed()) return;
    const primitives = viewer.scene.primitives;
    for (let index = 0; index < primitives.length; index += 1) {
      const primitive = primitives.get(index);
      if (!(primitive instanceof Cesium.Cesium3DTileset)) continue;
      if (!visible) {
        primitive.show = false;
        continue;
      }
      primitive.show = primitive === preferredTileset;
    }
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

  async function convertFileToStoredMarkerPhoto(file) {
    const dataUrl = await convertFileToDataUrl(file);
    const uploadFile = dataUrlToUploadFile(dataUrl, file?.name || "marker-photo");
    return await uploadPhotoAsset(uploadFile, "marker");
  }

  function dataUrlToUploadFile(dataUrl, originalFileName = "photo") {
    const match = String(dataUrl || "").match(/^data:([^;,]+);base64,(.+)$/);
    if (!match) {
      throw new Error("Format de photo encodee invalide.");
    }

    const mimeType = match[1] || "image/jpeg";
    const base64Body = match[2] || "";
    const binary = window.atob(base64Body);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    const safeName = buildUploadFileName(originalFileName, mimeType);
    return new File([bytes], safeName, { type: mimeType });
  }

  function buildUploadFileName(originalFileName, mimeType) {
    const baseName = String(originalFileName || "photo").trim() || "photo";
    const safeBaseName = baseName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    const extensionByMime = {
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/heic": ".heic",
      "image/heif": ".heif",
      "image/gif": ".gif",
    };
    const normalizedMimeType = String(mimeType || "").toLowerCase();
    const wantedExtension = extensionByMime[normalizedMimeType] || ".jpg";

    if (safeBaseName.toLowerCase().endsWith(wantedExtension)) {
      return safeBaseName;
    }
    return `${safeBaseName}${wantedExtension}`;
  }

  function getReferenceBien() {
    return (
      biens.find((bien) => bien.id === selectedBienId && bien.lat != null && bien.lon != null) ||
      biens.find((bien) => bien.lat != null && bien.lon != null) ||
      null
    );
  }

function getClickPosition(scene, clickPosition) {
  if (scene?.pickPositionSupported) {
    try {
      const pickedPosition = scene.pickPosition(clickPosition);
      if (Cesium.defined(pickedPosition)) {
        return pickedPosition;
      }
    } catch {
      // Fallback below when depth picking is not available for this frame.
    }
  }

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
    const initialMobileQualityProfile = getMobileQualityProfile(
      mobileQualityProfileRef.current,
      canEnableMobileUltraQuality(isIOSDevice)
    );
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
        ? initialMobileQualityProfile.idleGlobeSse
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
    if (isTouchNavigationDevice) {
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
    const saveCameraStateOnMoveEnd = () => {
      if (!isTiltedRef.current && resolveMode(mapModeRef.current) === "google3d") {
        const currentHeight =
          Cesium.Cartographic.fromCartesian(viewer.camera.positionWC)?.height;
        if (Number.isFinite(currentHeight)) {
          tiltToggleBaseRangeRef.current = Math.max(currentHeight, 160);
        }
      }
      persistCurrentCameraInZoneCache(viewer);
    };
    if (isTouchNavigationDevice) {
      viewer.scene.postRender.addEventListener(enforceSatelliteZoomFloor);
    }
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
                ? initialMobileQualityProfile.idleGlobeSse
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
      const isPlacementModeActive =
        Boolean(placingBienIdRef.current) || isAwaitingMarkerPlacementRef.current;
      if (isMobile || !isPlacementModeActive) {
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
    const enableCustomTouchGestures = isTouchNavigationDevice;
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

    const moveCameraForSurfaceDrag = (fromSurface, toSurface) => {
      if (!fromSurface || !toSurface) return false;

      const dragVector = Cesium.Cartesian3.subtract(
        fromSurface,
        toSurface,
        new Cesium.Cartesian3()
      );
      const dragDistance = Cesium.Cartesian3.magnitude(dragVector);
      if (!Number.isFinite(dragDistance) || dragDistance < 0.01) return false;
      const cameraHeight = Math.max(0, getCameraHeight(viewer) || 1200);
      const maxDragStep = Cesium.Math.clamp(
        cameraHeight * MOBILE_SURFACE_DRAG_MAX_STEP_HEIGHT_RATIO,
        MOBILE_SURFACE_DRAG_MIN_STEP_METERS,
        MOBILE_SURFACE_DRAG_MAX_STEP_METERS
      );
      const appliedDistance = Math.min(dragDistance, maxDragStep) * MOBILE_SURFACE_DRAG_SMOOTHING;
      if (!Number.isFinite(appliedDistance) || appliedDistance <= 0) return false;

      viewer.camera.move(
        Cesium.Cartesian3.divideByScalar(
          dragVector,
          dragDistance,
          new Cesium.Cartesian3()
        ),
        appliedDistance
      );
      viewer.scene.requestRender();
      return true;
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

      // In satellite 3D, pan only along ground tangent axes so vertical drag
      // translates on the surface instead of climbing/descending in altitude.
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
      } else {
        camera.moveRight(rightAmount);
      }
      if (panUpAxis) {
        camera.move(panUpAxis, upAmount);
      } else {
        camera.moveUp(upAmount);
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
      });
      const basePanFactor = Cesium.Math.clamp(effectiveSpeed / 10, 0.01, 8);
      const modePanCompensation =
        resolvedMode === "google3d" ? MOBILE_SATELLITE_PAN_COMPENSATION : 1;

      // Keep identical pan tuning in plan and satellite to avoid jumpy terrain-pick deltas.
      const moveScale = Cesium.Math.clamp(
        basePanFactor *
          PLAN_PAN_SPEED_MULTIPLIER *
          MOBILE_TOUCH_PAN_SENSITIVITY_MULTIPLIER *
          modePanCompensation,
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
        const resolvedMode = resolveMode(mapModeRef.current);
        mobileTouchPanRef.current.active = true;
        mobileTouchPanRef.current.lastX = firstTouch.clientX;
        mobileTouchPanRef.current.lastY = firstTouch.clientY;
        mobileTouchPanRef.current.lastTimestamp = performance.now();
        mobileTouchPanRef.current.lastSurface =
          resolvedMode === "google3d"
            ? null
            : getClickPosition(viewer.scene, firstTouchPosition);
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
          const resolvedMode = resolveMode(mapModeRef.current);
          mobileTouchPanRef.current.active = true;
          mobileTouchPanRef.current.lastX = firstTouch.clientX;
          mobileTouchPanRef.current.lastY = firstTouch.clientY;
          mobileTouchPanRef.current.lastTimestamp = performance.now();
          mobileTouchPanRef.current.lastSurface =
            resolvedMode === "google3d"
              ? null
              : getClickPosition(viewer.scene, firstTouchPosition);
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
        const useSurfaceDrag = resolvedMode !== "google3d";
        if (useSurfaceDrag) {
          const canvasRect = touchCanvas.getBoundingClientRect();
          const touchPosition = new Cesium.Cartesian2(
            firstTouch.clientX - canvasRect.left,
            firstTouch.clientY - canvasRect.top
          );
          const previousSurface = mobileTouchPanRef.current.lastSurface;
          const currentSurface = getClickPosition(viewer.scene, touchPosition);

          if (moveCameraForSurfaceDrag(previousSurface, currentSurface)) {
            touchPanInertiaRef.current.worldVelocity = 0;
            mobileTouchPanRef.current.lastSurface = currentSurface;
            return;
          }

          mobileTouchPanRef.current.lastSurface = currentSurface;
        } else {
          mobileTouchPanRef.current.lastSurface = null;
        }
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
        const modePanCompensation =
          resolvedMode === "google3d" ? MOBILE_SATELLITE_PAN_COMPENSATION : 1;
        touchPanInertiaRef.current.worldVelocity = 0;
        const moveScale = Cesium.Math.clamp(
          basePanFactor *
            PLAN_PAN_SPEED_MULTIPLIER *
            MOBILE_TOUCH_PAN_SENSITIVITY_MULTIPLIER *
            modePanCompensation,
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
        const resolvedMode = resolveMode(mapModeRef.current);
        mobileTouchPanRef.current.active = true;
        mobileTouchPanRef.current.lastX = firstTouch.clientX;
        mobileTouchPanRef.current.lastY = firstTouch.clientY;
        mobileTouchPanRef.current.lastTimestamp = performance.now();
        mobileTouchPanRef.current.lastSurface =
          resolvedMode === "google3d"
            ? null
            : getClickPosition(viewer.scene, firstTouchPosition);
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
      if (isTouchNavigationDevice) {
        viewer.scene.postRender.removeEventListener(enforceSatelliteZoomFloor);
      }
      viewer.camera.moveEnd.removeEventListener(saveCameraStateOnMoveEnd);

      if (!handler.isDestroyed()) {
        handler.destroy();
      }

      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }

      viewerRef.current = null;
      entitiesRef.current = [];
      customMarkerEntitiesRef.current = [];
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
    let googleLateReadyTileset = null;
    let googleLateReadyEvent = null;
    let googleLateReadyListener = null;
    let googleLateReadyTimeoutId = null;
    let detachTilesetLoadTelemetry = null;
    let longTaskObserver = null;
    const useTouchNavigation = isMobile && hasTouchInput();

    const resetTileLoadBurstState = () => {
      tileLoadBurstStateRef.current.active = false;
      tileLoadBurstStateRef.current.startedAt = 0;
      tileLoadBurstStateRef.current.peakRemainingTiles = 0;
      tileLoadBurstStateRef.current.lastRemainingTiles = 0;
    };

    const trackTileLoadProgress = (remainingTiles = 0) => {
      if (modeRef.current !== "google3d") return;

      const state = tileLoadBurstStateRef.current;
      const normalizedRemainingTiles = Math.max(
        0,
        Math.round(Number(remainingTiles) || 0)
      );
      state.lastRemainingTiles = normalizedRemainingTiles;

      if (normalizedRemainingTiles > 0) {
        if (!state.active) {
          state.active = true;
          state.startedAt = performance.now();
          state.peakRemainingTiles = normalizedRemainingTiles;
          return;
        }
        state.peakRemainingTiles = Math.max(
          state.peakRemainingTiles,
          normalizedRemainingTiles
        );
        return;
      }

      if (!state.active) return;

      recordMapPerfEvent("tile_load_burst_complete", {
        durationMs: performance.now() - state.startedAt,
        peakRemainingTiles: state.peakRemainingTiles,
        moving: adaptiveQualityStateRef.current.isMoving,
        mode: modeRef.current,
      });
      resetTileLoadBurstState();
    };

    const attachTilesetLoadTelemetry = (tileset) => {
      if (
        !tileset?.tileLoadProgressEvent ||
        typeof tileset.tileLoadProgressEvent.addEventListener !== "function"
      ) {
        return () => {};
      }

      const handleTileLoadProgress = (remainingTiles = 0) => {
        if (cancelled) return;
        trackTileLoadProgress(remainingTiles);
      };

      tileset.tileLoadProgressEvent.addEventListener(handleTileLoadProgress);
      return () => {
        tileset.tileLoadProgressEvent?.removeEventListener?.(
          handleTileLoadProgress
        );
      };
    };

    if (
      typeof PerformanceObserver !== "undefined" &&
      Array.isArray(PerformanceObserver.supportedEntryTypes) &&
      PerformanceObserver.supportedEntryTypes.includes("longtask")
    ) {
      try {
        longTaskObserver = new PerformanceObserver((entryList) => {
          if (cancelled || modeRef.current !== "google3d") return;
          entryList.getEntries().forEach((entry) => {
            const qualitySnapshot = currentQualityTelemetryRef.current || {};
            recordMapPerfEvent("long_task", {
              durationMs: entry.duration,
              moving: adaptiveQualityStateRef.current.isMoving,
              qualityPreset: qualitySnapshot.preset,
              qualityMoving: qualitySnapshot.moving,
              resolutionScale: qualitySnapshot.resolutionScale,
              msaaSamples: qualitySnapshot.msaaSamples,
              globeSse: qualitySnapshot.globeSse,
              tilesetSse: qualitySnapshot.tilesetSse,
              remainingTiles: tileLoadBurstStateRef.current.lastRemainingTiles,
              mode: modeRef.current,
            });
          });
        });
        longTaskObserver.observe({ entryTypes: ["longtask"] });
      } catch {
        longTaskObserver = null;
      }
    }

    const clearGoogleLateReadyListener = () => {
      if (googleLateReadyEvent && googleLateReadyListener) {
        try {
          googleLateReadyEvent.removeEventListener(googleLateReadyListener);
        } catch (error) {
          console.warn("Nettoyage listener satellite ignore (non bloquant):", error);
        }
      }
      googleLateReadyTileset = null;
      googleLateReadyEvent = null;
      googleLateReadyListener = null;
      if (googleLateReadyTimeoutId) {
        window.clearTimeout(googleLateReadyTimeoutId);
        googleLateReadyTimeoutId = null;
      }
    };

    if (canUseGoogle3D && CESIUM_ION_TOKEN) {
      setSatelliteReadySafely(Boolean(tilesetRef.current));
      setSatelliteWarmupBlockExpiredSafely(isMobile);
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
        if (isMobile) {
          clearMobileQualityRestoreTimeout();
          clearMobileUltraRestoreTimeout();
          applyMobileIdleQuality();
          return;
        }
        if (!isMobile) {
          clearDesktopQualityRestoreTimeouts();
          applyDesktopIdleQuality();
          if (selectedDesktopQualityProfile.enableUltra && modeRef.current === "google3d") {
            desktopUltraRestoreTimeoutRef.current = window.setTimeout(() => {
              if (cancelled) return;
              applyDesktopUltraQuality();
            }, selectedDesktopQualityProfile.ultraRestoreDelayMs);
          }
        }
      }, SATELLITE_MOVE_RECOVERY_DELAY_MS);
    };

    const scheduleDesktopIdleRestore = (attemptId, delayMs) => {
      desktopQualityRestoreTimeoutRef.current = window.setTimeout(() => {
        desktopQualityRestoreTimeoutRef.current = null;
        if (cancelled) return;
        if (attemptId !== desktopIdleRestoreAttemptRef.current) return;
        if (adaptiveQualityStateRef.current.isMoving) return;

        if (selectedDesktopQualityProfileId === "auto") {
          const remainingMovingVisibleMs =
            desktopMovingVisibleUntilRef.current - Date.now();
          if (remainingMovingVisibleMs > 0) {
            scheduleDesktopIdleRestore(
              attemptId,
              Math.max(
                DESKTOP_AUTO_SETTLE_RECHECK_DELAY_MS,
                remainingMovingVisibleMs
              )
            );
            return;
          }

          const currentSnapshot = captureQualityCameraSnapshot(viewer);
          const previousSnapshot =
            desktopSettleSnapshotRef.current || currentSnapshot;
          if (!isQualityCameraSnapshotStable(previousSnapshot, currentSnapshot)) {
            desktopSettleSnapshotRef.current = currentSnapshot;
            scheduleDesktopIdleRestore(
              attemptId,
              DESKTOP_AUTO_SETTLE_RECHECK_DELAY_MS
            );
            return;
          }
        }

        const shouldUseDesktopSettleStage =
          selectedDesktopQualityProfileId === "auto" &&
          selectedDesktopQualityProfile.settleHoldMs > 0;
        if (shouldUseDesktopSettleStage) {
          applyDesktopSettleQuality();
          desktopSettleSnapshotRef.current = captureQualityCameraSnapshot(viewer);
          desktopIdleFinalizeTimeoutRef.current = window.setTimeout(() => {
            desktopIdleFinalizeTimeoutRef.current = null;
            if (cancelled) return;
            if (attemptId !== desktopIdleRestoreAttemptRef.current) return;
            if (adaptiveQualityStateRef.current.isMoving) return;

            const currentSnapshot = captureQualityCameraSnapshot(viewer);
            const previousSnapshot =
              desktopSettleSnapshotRef.current || currentSnapshot;
            if (!isQualityCameraSnapshotStable(previousSnapshot, currentSnapshot)) {
              desktopSettleSnapshotRef.current = currentSnapshot;
              scheduleDesktopIdleRestore(
                attemptId,
                DESKTOP_AUTO_SETTLE_RECHECK_DELAY_MS
              );
              return;
            }

            applyDesktopIdleQuality();
            desktopSettleSnapshotRef.current = null;

            if (
              !selectedDesktopQualityProfile.enableUltra ||
              modeRef.current !== "google3d"
            ) {
              return;
            }
            desktopUltraRestoreTimeoutRef.current = window.setTimeout(() => {
              if (cancelled) return;
              if (attemptId !== desktopIdleRestoreAttemptRef.current) return;
              if (adaptiveQualityStateRef.current.isMoving) return;
              applyDesktopUltraQuality();
            }, selectedDesktopQualityProfile.ultraRestoreDelayMs);
          }, selectedDesktopQualityProfile.settleHoldMs);
          return;
        }

        applyDesktopIdleQuality();
        desktopSettleSnapshotRef.current = null;

        if (!selectedDesktopQualityProfile.enableUltra || modeRef.current !== "google3d") {
          return;
        }
        desktopUltraRestoreTimeoutRef.current = window.setTimeout(() => {
          if (cancelled) return;
          if (attemptId !== desktopIdleRestoreAttemptRef.current) return;
          if (adaptiveQualityStateRef.current.isMoving) return;
          applyDesktopUltraQuality();
        }, selectedDesktopQualityProfile.ultraRestoreDelayMs);
      }, Math.max(0, Number(delayMs) || 0));
    };

    const markDesktopNavigationIntent = (
      intentMs = DESKTOP_AUTO_INPUT_INTENT_MS,
      forceMovingQuality = false
    ) => {
      if (useTouchNavigation) return;
      if (fpsBenchmarkActiveRef.current) return;
      if (selectedDesktopQualityProfileId !== "auto") return;

      desktopMovingVisibleUntilRef.current = Math.max(
        desktopMovingVisibleUntilRef.current,
        Date.now() + Math.max(0, Number(intentMs) || 0)
      );

      if (fpsBenchmarkQualityLockRef.current) return;

      if (!forceMovingQuality && currentQualityTelemetryRef.current?.moving === true) {
        return;
      }

      adaptiveQualityStateRef.current.isMoving = true;
      desktopSettleSnapshotRef.current = null;
      clearQualityRecoverySafetyTimeout();
      clearDesktopQualityRestoreTimeouts();
      applyDesktopMovingQuality();
      scheduleQualityRecoverySafety();
    };

    const startSatelliteLoadWatchdog = () => {
      clearSatelliteLoadWatchdogTimeout();
      satelliteLoadWatchdogTimeoutRef.current = window.setTimeout(() => {
        if (cancelled) return;
        if (modeRef.current !== "google3d") return;
        if (isSatelliteReadyRef.current) return;
        if (tilesetRef.current?.tilesLoaded) return;
        // Non-blocking watchdog: keep satellite mode active to avoid false
        // fallbacks on slow networks/devices.
        console.warn(
          "Watchdog satellite: chargement long detecte, on reste en vue satellite."
        );
      }, SATELLITE_LOAD_WATCHDOG_MS);
    };

    const clearDesktopQualityRestoreTimeouts = () => {
      if (desktopQualityRestoreTimeoutRef.current) {
        window.clearTimeout(desktopQualityRestoreTimeoutRef.current);
        desktopQualityRestoreTimeoutRef.current = null;
      }
      if (desktopIdleFinalizeTimeoutRef.current) {
        window.clearTimeout(desktopIdleFinalizeTimeoutRef.current);
        desktopIdleFinalizeTimeoutRef.current = null;
      }
      if (desktopUltraRestoreTimeoutRef.current) {
        window.clearTimeout(desktopUltraRestoreTimeoutRef.current);
        desktopUltraRestoreTimeoutRef.current = null;
      }
      desktopIdleRestoreAttemptRef.current += 1;
      desktopSettleSnapshotRef.current = null;
    };

    const allowMobileUltraFromDevice = canEnableMobileUltraQuality(isIOSDevice);
    const selectedMobileQualityProfile = getMobileQualityProfile(
      mobileQualityProfileRef.current,
      allowMobileUltraFromDevice
    );
    const selectedDesktopQualityProfileId = normalizeDesktopQualityProfile(
      desktopQualityProfileRef.current
    );
    const selectedDesktopQualityProfile = getDesktopQualityProfile(
      desktopQualityProfileRef.current
    );

    const setCurrentQualityTelemetry = ({
      preset,
      moving,
      resolutionScale,
      msaaSamples,
      globeSse,
      tilesetSse,
    }) => {
      currentQualityTelemetryRef.current = {
        preset: String(preset || ""),
        moving: typeof moving === "boolean" ? moving : null,
        resolutionScale: Number.isFinite(Number(resolutionScale))
          ? Number(resolutionScale)
          : null,
        msaaSamples: Number.isFinite(Number(msaaSamples))
          ? Number(msaaSamples)
          : null,
        globeSse: Number.isFinite(Number(globeSse)) ? Number(globeSse) : null,
        tilesetSse: Number.isFinite(Number(tilesetSse))
          ? Number(tilesetSse)
          : null,
      };
    };

    const applyDesktopMovingQuality = (tileset = tilesetRef.current) => {
      if (isMobile) return;

      adaptiveQualityStateRef.current.isUltraActive = false;
      viewer.scene.msaaSamples = selectedDesktopQualityProfile.movingMsaa;
      viewer.resolutionScale = getDesktopProfileResolutionScale(
        selectedDesktopQualityProfile.movingResolutionScale,
        DESKTOP_MOVING_RESOLUTION_SCALE
      );
      viewer.scene.globe.maximumScreenSpaceError =
        selectedDesktopQualityProfile.movingGlobeSse;

      if (tileset && modeRef.current === "google3d") {
        const useAutoMovingCull = selectedDesktopQualityProfileId === "auto";
        tileset.maximumScreenSpaceError = selectedDesktopQualityProfile.movingTilesetSse;
        // In desktop auto, uniform moving LOD was causing expensive whole-view
        // refinement during zoom-out and long pans. Keep movement more fluid by
        // allowing Cesium to bias visible detail toward the center while culling
        // transient requests until the camera settles.
        tileset.dynamicScreenSpaceError = true;
        tileset.foveatedScreenSpaceError = true;
        tileset.cullRequestsWhileMoving = useAutoMovingCull;
        tileset.foveatedTimeDelay =
          useAutoMovingCull
            ? GOOGLE_TILESET_FOVEATED_TIME_DELAY_MOVING_SECONDS
            : GOOGLE_TILESET_FOVEATED_TIME_DELAY_IDLE_SECONDS;
        tileset.progressiveResolutionHeightFraction =
          useAutoMovingCull
            ? GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION_MOVING
            : GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION;
        tileset.preferLeaves = true;
      }

      if (osmImageryLayerRef.current && modeRef.current === "google3d") {
        osmImageryLayerRef.current.alpha = DESKTOP_GOOGLE_OSM_ALPHA;
      }

      setCurrentQualityTelemetry({
        preset: "desktop_moving",
        moving: true,
        resolutionScale: viewer.resolutionScale,
        msaaSamples: viewer.scene.msaaSamples,
        globeSse: selectedDesktopQualityProfile.movingGlobeSse,
        tilesetSse:
          tileset && modeRef.current === "google3d"
            ? selectedDesktopQualityProfile.movingTilesetSse
            : null,
      });

      viewer.scene.requestRender();
    };

    const applyDesktopSettleQuality = (tileset = tilesetRef.current) => {
      if (isMobile) return;

      adaptiveQualityStateRef.current.isUltraActive = false;
      viewer.scene.msaaSamples = selectedDesktopQualityProfile.settleMsaa;
      viewer.resolutionScale = getDesktopProfileResolutionScale(
        selectedDesktopQualityProfile.settleResolutionScale,
        selectedDesktopQualityProfile.movingResolutionScale
      );
      viewer.scene.globe.maximumScreenSpaceError =
        selectedDesktopQualityProfile.settleGlobeSse;

      if (tileset && modeRef.current === "google3d") {
        tileset.maximumScreenSpaceError = selectedDesktopQualityProfile.settleTilesetSse;
        tileset.dynamicScreenSpaceError = true;
        tileset.foveatedScreenSpaceError = true;
        tileset.cullRequestsWhileMoving = false;
        tileset.foveatedTimeDelay = GOOGLE_TILESET_FOVEATED_TIME_DELAY_IDLE_SECONDS;
        tileset.progressiveResolutionHeightFraction =
          GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION;
        tileset.preferLeaves = true;
      }

      if (osmImageryLayerRef.current && modeRef.current === "google3d") {
        osmImageryLayerRef.current.alpha = DESKTOP_GOOGLE_OSM_ALPHA;
      }

      setCurrentQualityTelemetry({
        preset: "desktop_settle",
        moving: false,
        resolutionScale: viewer.resolutionScale,
        msaaSamples: viewer.scene.msaaSamples,
        globeSse: selectedDesktopQualityProfile.settleGlobeSse,
        tilesetSse:
          tileset && modeRef.current === "google3d"
            ? selectedDesktopQualityProfile.settleTilesetSse
            : null,
      });

      viewer.scene.requestRender();
    };

    const applyDesktopIdleQuality = (tileset = tilesetRef.current) => {
      if (isMobile) return;

      adaptiveQualityStateRef.current.isUltraActive = false;
      viewer.scene.msaaSamples = selectedDesktopQualityProfile.idleMsaa;
      viewer.resolutionScale = getDesktopProfileResolutionScale(
        selectedDesktopQualityProfile.idleResolutionScale,
        getPreferredResolutionScale(false, isIOSDevice)
      );
      viewer.scene.globe.maximumScreenSpaceError =
        selectedDesktopQualityProfile.idleGlobeSse;

      if (tileset && modeRef.current === "google3d") {
        tileset.maximumScreenSpaceError = selectedDesktopQualityProfile.idleTilesetSse;
        tileset.dynamicScreenSpaceError = false;
        tileset.foveatedScreenSpaceError = false;
        tileset.cullRequestsWhileMoving = false;
        tileset.foveatedTimeDelay = GOOGLE_TILESET_FOVEATED_TIME_DELAY_IDLE_SECONDS;
        tileset.progressiveResolutionHeightFraction =
          GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION;
        tileset.preferLeaves = true;
      }

      if (osmImageryLayerRef.current && modeRef.current === "google3d") {
        osmImageryLayerRef.current.alpha = DESKTOP_GOOGLE_OSM_ALPHA;
      }

      setCurrentQualityTelemetry({
        preset: "desktop_idle",
        moving: false,
        resolutionScale: viewer.resolutionScale,
        msaaSamples: viewer.scene.msaaSamples,
        globeSse: selectedDesktopQualityProfile.idleGlobeSse,
        tilesetSse:
          tileset && modeRef.current === "google3d"
            ? selectedDesktopQualityProfile.idleTilesetSse
            : null,
      });

      viewer.scene.requestRender();
    };

    const applyDesktopUltraQuality = (tileset = tilesetRef.current) => {
      if (isMobile) return;

      adaptiveQualityStateRef.current.isUltraActive = true;
      viewer.scene.globe.maximumScreenSpaceError =
        selectedDesktopQualityProfile.ultraGlobeSse;
      if (tileset && modeRef.current === "google3d") {
        tileset.maximumScreenSpaceError = selectedDesktopQualityProfile.ultraTilesetSse;
        tileset.dynamicScreenSpaceError = false;
        tileset.foveatedScreenSpaceError = false;
        tileset.cullRequestsWhileMoving = false;
        tileset.foveatedTimeDelay = GOOGLE_TILESET_FOVEATED_TIME_DELAY_IDLE_SECONDS;
        tileset.progressiveResolutionHeightFraction =
          GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION;
        tileset.preferLeaves = true;
      }

      applyUltraViewerQuality();
      setCurrentQualityTelemetry({
        preset: "desktop_ultra",
        moving: false,
        resolutionScale: viewer.resolutionScale,
        msaaSamples: viewer.scene.msaaSamples,
        globeSse: selectedDesktopQualityProfile.ultraGlobeSse,
        tilesetSse:
          tileset && modeRef.current === "google3d"
            ? selectedDesktopQualityProfile.ultraTilesetSse
            : null,
      });
    };

    const applyMobileMovingQuality = (tileset = tilesetRef.current) => {
      if (!isMobile) return;

      adaptiveQualityStateRef.current.isUltraActive = false;
      viewer.scene.msaaSamples = MOBILE_MOVING_MSAA_SAMPLES;
      viewer.resolutionScale = selectedMobileQualityProfile.movingResolutionScale;
      viewer.scene.globe.maximumScreenSpaceError = selectedMobileQualityProfile.movingGlobeSse;

      if (tileset && modeRef.current === "google3d") {
        tileset.maximumScreenSpaceError = selectedMobileQualityProfile.movingTilesetSse;
        tileset.dynamicScreenSpaceError = true;
        tileset.foveatedScreenSpaceError = true;
        tileset.cullRequestsWhileMoving = false;
      }

      if (osmImageryLayerRef.current && modeRef.current === "google3d") {
        osmImageryLayerRef.current.alpha = MOBILE_GOOGLE_OSM_ALPHA;
      }

      setCurrentQualityTelemetry({
        preset: "mobile_moving",
        moving: true,
        resolutionScale: viewer.resolutionScale,
        msaaSamples: viewer.scene.msaaSamples,
        globeSse: selectedMobileQualityProfile.movingGlobeSse,
        tilesetSse:
          tileset && modeRef.current === "google3d"
            ? selectedMobileQualityProfile.movingTilesetSse
            : null,
      });

      viewer.scene.requestRender();
    };

    const applyMobileIdleQuality = (tileset = tilesetRef.current) => {
      if (!isMobile) return;

      adaptiveQualityStateRef.current.isUltraActive = false;
      viewer.scene.msaaSamples = MOBILE_MSAA_SAMPLES;
      viewer.resolutionScale = selectedMobileQualityProfile.idleResolutionScale;
      viewer.scene.globe.maximumScreenSpaceError = selectedMobileQualityProfile.idleGlobeSse;

      if (tileset && modeRef.current === "google3d") {
        tileset.maximumScreenSpaceError = selectedMobileQualityProfile.idleTilesetSse;
        tileset.dynamicScreenSpaceError = false;
        tileset.foveatedScreenSpaceError = false;
        tileset.cullRequestsWhileMoving = false;
      }

      if (osmImageryLayerRef.current && modeRef.current === "google3d") {
        osmImageryLayerRef.current.alpha = MOBILE_GOOGLE_OSM_ALPHA;
      }

      setCurrentQualityTelemetry({
        preset: "mobile_idle",
        moving: false,
        resolutionScale: viewer.resolutionScale,
        msaaSamples: viewer.scene.msaaSamples,
        globeSse: selectedMobileQualityProfile.idleGlobeSse,
        tilesetSse:
          tileset && modeRef.current === "google3d"
            ? selectedMobileQualityProfile.idleTilesetSse
            : null,
      });

      viewer.scene.requestRender();
    };

    const applyMobileUltraQuality = (tileset = tilesetRef.current) => {
      if (!isMobile || !selectedMobileQualityProfile.enableUltra) return;

      adaptiveQualityStateRef.current.isUltraActive = true;
      viewer.scene.msaaSamples = MOBILE_MSAA_SAMPLES;
      if (typeof window === "undefined") {
        viewer.resolutionScale = selectedMobileQualityProfile.ultraResolutionScaleCap;
      } else {
        const devicePixelRatio = Number(window.devicePixelRatio) || 1;
        viewer.resolutionScale = Math.max(
          selectedMobileQualityProfile.idleResolutionScale,
          Math.min(
            selectedMobileQualityProfile.ultraResolutionScaleCap,
            devicePixelRatio * 0.86
          )
        );
      }
      viewer.scene.globe.maximumScreenSpaceError = selectedMobileQualityProfile.ultraGlobeSse;

      if (tileset && modeRef.current === "google3d") {
        tileset.maximumScreenSpaceError = selectedMobileQualityProfile.ultraTilesetSse;
        tileset.dynamicScreenSpaceError = false;
        tileset.foveatedScreenSpaceError = false;
        tileset.cullRequestsWhileMoving = false;
      }

      if (osmImageryLayerRef.current && modeRef.current === "google3d") {
        osmImageryLayerRef.current.alpha = MOBILE_GOOGLE_OSM_ALPHA;
      }

      setCurrentQualityTelemetry({
        preset: "mobile_ultra",
        moving: false,
        resolutionScale: viewer.resolutionScale,
        msaaSamples: viewer.scene.msaaSamples,
        globeSse: selectedMobileQualityProfile.ultraGlobeSse,
        tilesetSse:
          tileset && modeRef.current === "google3d"
            ? selectedMobileQualityProfile.ultraTilesetSse
            : null,
      });

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
      viewer.scene.msaaSamples = selectedDesktopQualityProfile.ultraMsaa;
      viewer.resolutionScale = getDesktopProfileResolutionScale(
        selectedDesktopQualityProfile.ultraResolutionScaleCap,
        getUltraResolutionScale(isIOSDevice)
      );
      viewer.scene.requestRender();
    };

    const applyBenchmarkSegmentQuality = (segmentMeta) => {
      if (!segmentMeta) return;

      const shouldMove =
        typeof segmentMeta.benchmarkMoving === "boolean"
          ? Boolean(segmentMeta.benchmarkMoving)
          : true;

      adaptiveQualityStateRef.current.isMoving = shouldMove;
      clearQualityRecoverySafetyTimeout();
      resetAdaptiveQualityStats();

      if (shouldMove) {
        if (!isMobile && selectedDesktopQualityProfileId === "auto") {
          desktopMovingVisibleUntilRef.current = Math.max(
            desktopMovingVisibleUntilRef.current,
            Date.now() +
              Math.max(
                DESKTOP_AUTO_MIN_MOVING_VISIBLE_MS,
                Number(segmentMeta?.durationMs) || 0
              )
          );
          desktopSettleSnapshotRef.current = null;
        }
        clearDesktopQualityRestoreTimeouts();
        clearMobileQualityRestoreTimeout();
        clearMobileUltraRestoreTimeout();
        if (isMobile) {
          applyMobileMovingQuality();
          return;
        }
        applyDesktopMovingQuality();
        return;
      }

      if (isMobile) {
        clearMobileQualityRestoreTimeout();
        clearMobileUltraRestoreTimeout();
        mobileQualityRestoreTimeoutRef.current = window.setTimeout(() => {
          if (cancelled) return;
          if (adaptiveQualityStateRef.current.isMoving) return;
          applyMobileIdleQuality();
          if (!selectedMobileQualityProfile.enableUltra || modeRef.current !== "google3d") {
            return;
          }
          mobileUltraRestoreTimeoutRef.current = window.setTimeout(() => {
            if (cancelled) return;
            if (adaptiveQualityStateRef.current.isMoving) return;
            if (modeRef.current !== "google3d") return;
            applyMobileUltraQuality();
          }, selectedMobileQualityProfile.ultraRestoreDelayMs);
        }, selectedMobileQualityProfile.idleRestoreDelayMs);
        return;
      }

      clearDesktopQualityRestoreTimeouts();
      const restoreAttemptId = desktopIdleRestoreAttemptRef.current;
      desktopSettleSnapshotRef.current = captureQualityCameraSnapshot(viewer);
      scheduleDesktopIdleRestore(
        restoreAttemptId,
        selectedDesktopQualityProfile.idleRestoreDelayMs
      );
    };

    const applyBenchmarkMovingQualityLock = (durationMs = null) => {
      fpsBenchmarkQualityLockRef.current = true;
      adaptiveQualityStateRef.current.isMoving = true;
      if (!isMobile && selectedDesktopQualityProfileId === "auto") {
        desktopMovingVisibleUntilRef.current = Math.max(
          desktopMovingVisibleUntilRef.current,
          Date.now() +
            Math.max(
              DESKTOP_AUTO_MIN_MOVING_VISIBLE_MS,
              Number(durationMs) || 0
            )
        );
        desktopSettleSnapshotRef.current = null;
      }
      clearQualityRecoverySafetyTimeout();
      clearDesktopQualityRestoreTimeouts();
      clearMobileQualityRestoreTimeout();
      clearMobileUltraRestoreTimeout();
      resetAdaptiveQualityStats();
      if (fpsBenchmarkQualityLockTimeoutRef.current) {
        window.clearTimeout(fpsBenchmarkQualityLockTimeoutRef.current);
        fpsBenchmarkQualityLockTimeoutRef.current = null;
      }
      if (Number.isFinite(durationMs) && durationMs > 0) {
        fpsBenchmarkQualityLockTimeoutRef.current = window.setTimeout(() => {
          fpsBenchmarkQualityLockTimeoutRef.current = null;
          releaseBenchmarkMovingQualityLock();
        }, durationMs);
      }
      if (isMobile) {
        applyMobileMovingQuality();
        return;
      }
      applyDesktopMovingQuality();
    };

    const releaseBenchmarkMovingQualityLock = () => {
      if (!fpsBenchmarkQualityLockRef.current) return;

      fpsBenchmarkQualityLockRef.current = false;
      if (fpsBenchmarkQualityLockTimeoutRef.current) {
        window.clearTimeout(fpsBenchmarkQualityLockTimeoutRef.current);
        fpsBenchmarkQualityLockTimeoutRef.current = null;
      }
      adaptiveQualityStateRef.current.isMoving = false;
      clearQualityRecoverySafetyTimeout();
      resetAdaptiveQualityStats();

      if (modeRef.current !== "google3d") return;

      if (isMobile) {
        clearMobileQualityRestoreTimeout();
        clearMobileUltraRestoreTimeout();
        applyMobileIdleQuality();
        if (!selectedMobileQualityProfile.enableUltra) return;
        mobileUltraRestoreTimeoutRef.current = window.setTimeout(() => {
          if (cancelled) return;
          if (adaptiveQualityStateRef.current.isMoving) return;
          if (modeRef.current !== "google3d") return;
          applyMobileUltraQuality();
        }, selectedMobileQualityProfile.ultraRestoreDelayMs);
        return;
      }

      clearDesktopQualityRestoreTimeouts();
      applyDesktopIdleQuality();
      if (!selectedDesktopQualityProfile.enableUltra) return;
      desktopUltraRestoreTimeoutRef.current = window.setTimeout(() => {
        if (cancelled) return;
        if (adaptiveQualityStateRef.current.isMoving) return;
        if (modeRef.current !== "google3d") return;
        applyDesktopUltraQuality();
      }, selectedDesktopQualityProfile.ultraRestoreDelayMs);
    };

    applyFpsBenchmarkMovingQualityRef.current = applyBenchmarkMovingQualityLock;
    applyFpsBenchmarkInitialPauseQualityRef.current = () => {
      if (isMobile) {
        applyMobileIdleQuality();
        return;
      }
      if (selectedDesktopQualityProfileId === "auto") {
        applyDesktopSettleQuality();
        return;
      }
      applyDesktopIdleQuality();
    };
    releaseFpsBenchmarkMovingQualityRef.current = releaseBenchmarkMovingQualityLock;
    applyFpsBenchmarkSegmentQualityRef.current = applyBenchmarkSegmentQuality;

    const applyFastThenPremiumGoogleQuality = (tileset) => {
      if (!tileset) return;
      clearGoogleQualityTimeout();
      if (isMobile) {
        clearMobileQualityRestoreTimeout();
        applyMobileMovingQuality(tileset);
        tileset.maximumScreenSpaceError = selectedMobileQualityProfile.fastTilesetSse;
        tileset.dynamicScreenSpaceError = true;
        tileset.foveatedScreenSpaceError = true;
        tileset.cullRequestsWhileMoving = false;
        viewer.scene.requestRender();
        googleQualityTimeoutRef.current = window.setTimeout(() => {
          if (cancelled || !tilesetRef.current) return;
          tilesetRef.current.maximumScreenSpaceError =
            selectedMobileQualityProfile.premiumTilesetSse;
          applyMobileIdleQuality(tilesetRef.current);
        }, GOOGLE_TILESET_FAST_PHASE_MS);
        return;
      }

      clearDesktopQualityRestoreTimeouts();
      applyDesktopMovingQuality(tileset);
      tileset.maximumScreenSpaceError = selectedDesktopQualityProfile.fastTilesetSse;
      tileset.dynamicScreenSpaceError = true;
      tileset.foveatedScreenSpaceError = true;
      tileset.cullRequestsWhileMoving = false;
      viewer.scene.requestRender();
      googleQualityTimeoutRef.current = window.setTimeout(() => {
        if (cancelled || !tilesetRef.current) return;
        tilesetRef.current.maximumScreenSpaceError =
          selectedDesktopQualityProfile.premiumTilesetSse;
        applyDesktopIdleQuality(tilesetRef.current);
      }, GOOGLE_TILESET_FAST_PHASE_MS);

      // Defer ultra quality a bit so initial view and mode switch stay responsive.
      const sinceBootMs = Date.now() - appBootTimestampRef.current;
      const ultraDelayMs = Math.max(900, GOOGLE_TILESET_ULTRA_PHASE_MS - sinceBootMs);
      if (selectedDesktopQualityProfile.enableUltra) {
        googleUltraQualityTimeoutRef.current = window.setTimeout(() => {
          if (cancelled || !tilesetRef.current || modeRef.current !== "google3d") return;
          applyDesktopUltraQuality(tilesetRef.current);
        }, ultraDelayMs);
      }
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
          if (isMobile) {
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

      if (isMobile) {
        if (
          selectedMobileQualityProfile.enableUltra &&
          avgFps >= selectedMobileQualityProfile.adaptiveRaiseFps
        ) {
          applyMobileUltraQuality();
        }
        return;
      }

      if (
        !isMobile &&
        selectedDesktopQualityProfile.enableUltra &&
        avgFps >= selectedDesktopQualityProfile.adaptiveRaiseFps
      ) {
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
            foveatedTimeDelay: GOOGLE_TILESET_FOVEATED_TIME_DELAY_IDLE_SECONDS,
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
            maximumScreenSpaceError: isMobile
              ? selectedMobileQualityProfile.premiumTilesetSse
              : selectedDesktopQualityProfile.premiumTilesetSse,
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
            tileset.foveatedTimeDelay =
              GOOGLE_TILESET_FOVEATED_TIME_DELAY_IDLE_SECONDS;
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
            tileset.maximumScreenSpaceError = isMobile
              ? selectedMobileQualityProfile.premiumTilesetSse
              : selectedDesktopQualityProfile.premiumTilesetSse;
            tilesetRef.current = tileset;
            detachTilesetLoadTelemetry?.();
            detachTilesetLoadTelemetry = attachTilesetLoadTelemetry(tileset);
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
                const zoneCacheKey = activeZoneCacheKeyRef.current;
                if (zoneCacheKey) {
                  updateZoneCacheEntry(zoneCacheKey, (previousEntry) => ({
                    ...previousEntry,
                    google3dWarmAt: Date.now(),
                  }));
                }
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
      // Switch mode immediately to prevent late satellite callbacks from running
      // during the OSM transition.
      modeRef.current = "osm";
      clearGoogleLateReadyListener();
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
      setSceneGoogleTilesetsVisibility(viewer, false);

      viewer.scene.globe.show = true;
      viewer.scene.skyBox.show = false;
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#dbeafe");

      if (osmImageryLayerRef.current) {
        osmImageryLayerRef.current.show = true;
        osmImageryLayerRef.current.alpha = 1;
      }

      setIsTilted(false);
      tiltToggleBaseRangeRef.current = null;
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

      setSceneGoogleTilesetsVisibility(viewer, true, tileset);
      tileset.show = true;
      applyFastThenPremiumGoogleQuality(tileset);
      viewer.scene.requestRender();

      modeRef.current = "google3d";
      if (mapModeRef.current !== "google3d") {
        mapModeRef.current = "google3d";
        onSetMapModeRef.current?.("google3d");
      }
      startSatelliteLoadWatchdog();
      const markSatelliteReady = () => {
        clearSatelliteLoadWatchdogTimeout();
        setSatelliteIssueMessage("");
        setSatelliteReadySafely(true);
        finishModeTransition();
        if (isMobile) {
          applyMobileIdleQuality(tileset);
        }
        setTilesReadyVersion((value) => value + 1);
        viewer.scene.requestRender();
      };

      clearGoogleLateReadyListener();
      googleLateReadyTileset = tileset;
      googleLateReadyListener = (remainingTiles = 1) => {
        if (remainingTiles > 0 && !tileset.tilesLoaded) return;
        if (cancelled || modeRef.current !== "google3d") {
          clearGoogleLateReadyListener();
          return;
        }
        clearGoogleLateReadyListener();
        markSatelliteReady();
      };
      googleLateReadyEvent =
        tileset.tileLoadProgressEvent &&
        typeof tileset.tileLoadProgressEvent.addEventListener === "function"
          ? tileset.tileLoadProgressEvent
          : tileset.initialTilesLoaded &&
              typeof tileset.initialTilesLoaded.addEventListener === "function"
            ? tileset.initialTilesLoaded
            : null;
      if (googleLateReadyEvent) {
        googleLateReadyEvent.addEventListener(googleLateReadyListener);
      } else {
        // Some Cesium builds expose no event here; poll tilesLoaded before releasing transition.
        const fallbackReadyStartedAt = Date.now();
        const pollFallbackReady = () => {
          if (cancelled || modeRef.current !== "google3d") return;
          if (tileset.tilesLoaded || Date.now() - fallbackReadyStartedAt >= 4200) {
            markSatelliteReady();
            return;
          }
          window.setTimeout(pollFallbackReady, 170);
        };
        pollFallbackReady();
      }
      googleLateReadyTimeoutId = window.setTimeout(() => {
        clearGoogleLateReadyListener();
      }, SATELLITE_LOAD_WATCHDOG_MS + 4000);

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
          clearGoogleLateReadyListener();
          markSatelliteReady();
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
      const requestedMode = canUseGoogle3D
        ? resolveMode(mapModeRef.current)
        : "osm";
      if (!canUseGoogle3D && mapModeRef.current === "google3d") {
        onSetMapModeRef.current?.("osm");
      }
      if (modeRef.current === requestedMode) {
        finishModeTransition();
        return;
      }
      const modeSwitchStartedAt = performance.now();

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
        recordMapPerfEvent("mode_switch_success", {
          targetMode: requestedMode,
          durationMs: performance.now() - modeSwitchStartedAt,
        });
      } catch (error) {
        console.error("Erreur changement de mode carte :", error);
        const satelliteStillActive =
          modeRef.current === "google3d" || Boolean(tilesetRef.current?.show);
        if (requestedMode === "google3d" && satelliteStillActive) {
          modeRef.current = "google3d";
          mapModeRef.current = "google3d";
          setSatelliteIssueMessage("");
          setSatelliteReadySafely(true);
          recordMapPerfEvent("mode_switch_success", {
            targetMode: "google3d",
            durationMs: performance.now() - modeSwitchStartedAt,
            recovered: true,
          });
        } else {
          recordMapPerfEvent("mode_switch_failure", {
            targetMode: requestedMode,
            durationMs: performance.now() - modeSwitchStartedAt,
            reason: String(error?.message || error?.code || "unknown"),
          });
          setSatelliteIssueMessage(buildSatelliteFailureMessage(error));
          enableOsm();
          if (requestedMode === "google3d") {
            onSetMapModeRef.current?.("osm");
          }
          finishModeTransition();
        }
      } finally {
        if (!cancelled) {
          restoreCamera(viewer, cameraState);
          viewer.scene.requestRender();
          if (requestedMode !== "google3d") {
            finishModeTransition();
          }
        }
      }
    }

    const handleDesktopPointerDown = (event) => {
      if (useTouchNavigation) return;
      if (event?.button === 2) return;
      desktopPointerNavigationActiveRef.current = true;
      markDesktopNavigationIntent(DESKTOP_AUTO_INPUT_INTENT_MS, true);
    };

    const handleDesktopPointerMove = (event) => {
      if (useTouchNavigation) return;
      const buttons = Number(event?.buttons) || 0;
      const isDragging =
        desktopPointerNavigationActiveRef.current || Boolean(buttons & 1) || Boolean(buttons & 4);
      if (!isDragging) return;
      desktopPointerNavigationActiveRef.current = true;
      markDesktopNavigationIntent(DESKTOP_AUTO_MIN_MOVING_VISIBLE_MS, false);
    };

    const handleDesktopPointerUp = () => {
      desktopPointerNavigationActiveRef.current = false;
    };

    const handleDesktopWheelIntent = () => {
      if (useTouchNavigation) return;
      markDesktopNavigationIntent(DESKTOP_AUTO_INPUT_INTENT_MS, true);
    };

    const handleDesktopMoveStart = () => {
      if (useTouchNavigation) return;
      if (fpsBenchmarkActiveRef.current) {
        return;
      }
      if (fpsBenchmarkQualityLockRef.current) {
        return;
      }
      if (selectedDesktopQualityProfileId === "auto") {
        desktopMovingVisibleUntilRef.current = Math.max(
          desktopMovingVisibleUntilRef.current,
          Date.now() + DESKTOP_AUTO_MIN_MOVING_VISIBLE_MS
        );
      } else {
        desktopMovingVisibleUntilRef.current = 0;
      }
      desktopSettleSnapshotRef.current = null;
      adaptiveQualityStateRef.current.isMoving = true;
      clearMobileUltraRestoreTimeout();
      clearDesktopQualityRestoreTimeouts();
      applyDesktopMovingQuality();
      scheduleQualityRecoverySafety();
    };

    const handleDesktopMoveEnd = () => {
      if (useTouchNavigation) return;
      if (fpsBenchmarkActiveRef.current) {
        return;
      }
      if (fpsBenchmarkQualityLockRef.current) {
        return;
      }
      adaptiveQualityStateRef.current.isMoving = false;
      clearQualityRecoverySafetyTimeout();
      clearDesktopQualityRestoreTimeouts();
      const restoreAttemptId = desktopIdleRestoreAttemptRef.current;
      desktopSettleSnapshotRef.current = captureQualityCameraSnapshot(viewer);
      scheduleDesktopIdleRestore(
        restoreAttemptId,
        selectedDesktopQualityProfile.idleRestoreDelayMs
      );
    };

    const handleMobileMoveStart = () => {
      if (!useTouchNavigation) return;
      if (fpsBenchmarkActiveRef.current) {
        return;
      }
      if (fpsBenchmarkQualityLockRef.current) {
        return;
      }
      adaptiveQualityStateRef.current.isMoving = true;
      clearMobileUltraRestoreTimeout();
      clearMobileQualityRestoreTimeout();
      applyMobileMovingQuality();
      scheduleQualityRecoverySafety();
    };

    const handleMobileMoveEnd = () => {
      if (!useTouchNavigation) return;
      if (fpsBenchmarkActiveRef.current) {
        return;
      }
      if (fpsBenchmarkQualityLockRef.current) {
        return;
      }
      adaptiveQualityStateRef.current.isMoving = false;
      clearQualityRecoverySafetyTimeout();
      clearMobileQualityRestoreTimeout();
      clearMobileUltraRestoreTimeout();
      mobileQualityRestoreTimeoutRef.current = window.setTimeout(() => {
        if (cancelled) return;
        applyMobileIdleQuality();
        if (!selectedMobileQualityProfile.enableUltra || modeRef.current !== "google3d") return;
        mobileUltraRestoreTimeoutRef.current = window.setTimeout(() => {
          if (cancelled) return;
          if (adaptiveQualityStateRef.current.isMoving) return;
          if (modeRef.current !== "google3d") return;
          applyMobileUltraQuality();
        }, selectedMobileQualityProfile.ultraRestoreDelayMs);
      }, selectedMobileQualityProfile.idleRestoreDelayMs);
    };

    if (useTouchNavigation) {
      viewer.camera.moveStart.addEventListener(handleMobileMoveStart);
      viewer.camera.moveEnd.addEventListener(handleMobileMoveEnd);
      applyMobileIdleQuality();
    } else {
      viewer.canvas.addEventListener("mousedown", handleDesktopPointerDown, {
        passive: true,
      });
      viewer.canvas.addEventListener("mousemove", handleDesktopPointerMove, {
        passive: true,
      });
      window.addEventListener("mouseup", handleDesktopPointerUp, {
        passive: true,
      });
      viewer.canvas.addEventListener("mouseleave", handleDesktopPointerUp, {
        passive: true,
      });
      viewer.container.addEventListener("wheel", handleDesktopWheelIntent, {
        passive: true,
      });
      viewer.camera.moveStart.addEventListener(handleDesktopMoveStart);
      viewer.camera.moveEnd.addEventListener(handleDesktopMoveEnd);
      applyDesktopIdleQuality();
    }

    viewer.scene.postRender.addEventListener(handleAdaptiveFrameQuality);

    const hasPredictiveZoneContext = Boolean(String(searchZone || "").trim()) || syncVersion > 0;
    const activeZoneKey = activeZoneCacheKeyRef.current;
    const activeZoneEntry = readZoneCacheEntry(activeZoneKey);
    const activeZoneWarmAt = Number(activeZoneEntry?.google3dWarmAt) || 0;
    const hasFreshZoneWarmup =
      activeZoneWarmAt > 0 &&
      Date.now() - activeZoneWarmAt < SATELLITE_PREDICTIVE_WARMUP_FRESH_MS;
    const shouldRunPredictiveWarmup =
      canUseGoogle3D &&
      CESIUM_ION_TOKEN &&
      (mapModeRef.current === "google3d" || hasPredictiveZoneContext || !isMobile) &&
      !hasFreshZoneWarmup;

    if (shouldRunPredictiveWarmup) {
      const warmupDelayMs = isMobile
        ? SATELLITE_PREDICTIVE_WARMUP_DELAY_MS_MOBILE
        : Math.max(GOOGLE_WARMUP_START_DELAY_MS, SATELLITE_PREDICTIVE_WARMUP_DELAY_MS_DESKTOP);
      warmupTimerId = window.setTimeout(() => {
        if (cancelled) return;
        warmupGoogleUntilReady().catch((error) => {
          console.error("Erreur prechargement Google 3D :", error);
        });
      }, warmupDelayMs);
    }

    applyMode();

    return () => {
      cancelled = true;
      detachTilesetLoadTelemetry?.();
      detachTilesetLoadTelemetry = null;
      longTaskObserver?.disconnect?.();
      longTaskObserver = null;
      resetTileLoadBurstState();
      clearGoogleLateReadyListener();
      clearGoogleQualityTimeout();
      clearDesktopQualityRestoreTimeouts();
      clearMobileQualityRestoreTimeout();
      clearMobileUltraRestoreTimeout();
      clearQualityRecoverySafetyTimeout();
      clearSatelliteLoadWatchdogTimeout();
      finishFpsBenchmarkRecording();
      if (fpsBenchmarkQualityLockTimeoutRef.current) {
        window.clearTimeout(fpsBenchmarkQualityLockTimeoutRef.current);
        fpsBenchmarkQualityLockTimeoutRef.current = null;
      }
      fpsBenchmarkActiveRef.current = false;
      adaptiveQualityStateRef.current.isMoving = false;
      adaptiveQualityStateRef.current.isUltraActive = false;
      fpsBenchmarkQualityLockRef.current = false;
      fpsBenchmarkLastSegmentKeyRef.current = "";
      applyFpsBenchmarkMovingQualityRef.current = () => {};
      applyFpsBenchmarkInitialPauseQualityRef.current = () => {};
      releaseFpsBenchmarkMovingQualityRef.current = () => {};
      applyFpsBenchmarkSegmentQualityRef.current = () => {};
      resetAdaptiveQualityStats();
      if (!viewer.isDestroyed()) {
        viewer.scene.postRender.removeEventListener(handleAdaptiveFrameQuality);
      }
      if (modeTransitionTimeoutRef.current) {
        window.clearTimeout(modeTransitionTimeoutRef.current);
        modeTransitionTimeoutRef.current = null;
      }
      clearModeTransitionVisualTimeout();
      if (warmupTimerId) {
        window.clearTimeout(warmupTimerId);
      }
      if (satelliteWarmupBlockTimeoutRef.current) {
        window.clearTimeout(satelliteWarmupBlockTimeoutRef.current);
        satelliteWarmupBlockTimeoutRef.current = null;
      }
      if (useTouchNavigation && !viewer.isDestroyed()) {
        viewer.camera.moveStart.removeEventListener(handleMobileMoveStart);
        viewer.camera.moveEnd.removeEventListener(handleMobileMoveEnd);
      } else if (!viewer.isDestroyed()) {
        viewer.canvas.removeEventListener("mousedown", handleDesktopPointerDown);
        viewer.canvas.removeEventListener("mousemove", handleDesktopPointerMove);
        window.removeEventListener("mouseup", handleDesktopPointerUp);
        viewer.canvas.removeEventListener("mouseleave", handleDesktopPointerUp);
        viewer.container.removeEventListener("wheel", handleDesktopWheelIntent);
        viewer.camera.moveStart.removeEventListener(handleDesktopMoveStart);
        viewer.camera.moveEnd.removeEventListener(handleDesktopMoveEnd);
      }
      setModeTransition({
        active: false,
        target: null,
      });
    };
  }, [
    mapMode,
    canUseGoogle3D,
    mobileQualityProfile,
    desktopQualityProfile,
    searchZone,
    syncVersion,
  ]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    let cancelled = false;

    async function renderMarkers() {
      const currentSelectedBienId = selectedBienIdRef.current;
      viewer.entities.removeAll();
      entitiesRef.current = [];
      customMarkerEntitiesRef.current = [];
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
      const isOsmMode = !(
        modeRef.current === "google3d" || Boolean(tilesetRef.current?.show)
      );
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

      const shouldUseMeshClampForMarkers =
        !isOsmMode &&
        tilesetRef.current?.tilesLoaded &&
        (SATELLITE_USE_MESH_CLAMP_FOR_MARKERS ||
          (isMobile && SATELLITE_USE_MESH_CLAMP_FOR_MARKERS_MOBILE));
      const selectClosestPositionIndexes = (positions, limit) => {
        if (!Array.isArray(positions) || positions.length === 0) return [];
        const safeLimit = Math.max(0, Math.min(limit, positions.length));
        if (safeLimit === 0) return [];
        if (safeLimit >= positions.length) {
          return positions.map((_, index) => index);
        }

        const cameraPosition = viewer.camera?.positionWC;
        if (!cameraPosition) {
          return positions.slice(0, safeLimit).map((_, index) => index);
        }

        return positions
          .map((position, index) => ({
            index,
            distanceSquared: Cesium.Cartesian3.distanceSquared(cameraPosition, position),
          }))
          .sort((left, right) => left.distanceSquared - right.distanceSquared)
          .slice(0, safeLimit)
          .map((entry) => entry.index);
      };
      const buildBienPositionById = (positions) => {
        const bienPositionById = new Map();
        biensAvecCoordonnees.forEach((bien, index) => {
          bienPositionById.set(bien.id, positions[index] || rawBienPositions[index]);
        });
        return bienPositionById;
      };
      const resolveBienPointPosition = (
        bien,
        index,
        positions,
        bienPositionById = buildBienPositionById(positions)
      ) => {
        const basePosition =
          bienPositionById.get(bien.id) || positions[index] || rawBienPositions[index];
        const anchorBienId = addressAnchorAssignments.get(bien.id);
        return anchorBienId
          ? bienPositionById.get(anchorBienId) || basePosition
          : basePosition;
      };
      const bienEntitiesByIndex = new Array(biensAvecCoordonnees.length);
      const customEntitiesByIndex = new Array(customMarkers.length);
      const applyBienEntityPositions = (positions) => {
        const bienPositionById = buildBienPositionById(positions);
        biensAvecCoordonnees.forEach((bien, index) => {
          const entity = bienEntitiesByIndex[index];
          if (!entity) return;
          const resolvedPosition = resolveBienPointPosition(
            bien,
            index,
            positions,
            bienPositionById
          );
          entity.position = resolvedPosition;
          entity.markerPositionCartesian = resolvedPosition;
        });
      };
      const applyCustomEntityPositions = (positions) => {
        customMarkers.forEach((marker, markerIndex) => {
          const entity = customEntitiesByIndex[markerIndex];
          if (!entity) return;
          const resolvedPosition =
            positions[markerIndex] || rawCustomPositions[markerIndex];
          entity.position = resolvedPosition;
          entity.markerPositionCartesian = resolvedPosition;
        });
      };
      const initialBienPositionById = buildBienPositionById(finalBienPositions);
      if (cancelled) return;

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
        const pointPosition = resolveBienPointPosition(
          bien,
          index,
          finalBienPositions,
          initialBienPositionById
        );
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
        entity.markerPositionCartesian = pointPosition;
        entitiesRef.current.push(entity);
        bienEntitiesByIndex[index] = entity;
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
        entity.markerPositionCartesian =
          finalCustomPositions[markerIndex] || rawCustomPositions[markerIndex];
        customMarkerEntitiesRef.current.push(entity);
        customEntitiesByIndex[markerIndex] = entity;
      });

      const refineMarkerHeightsWithClamp = async () => {
        const refineStartedAt = performance.now();
        const clampedBienPositions = [...finalBienPositions];
        const clampedCustomPositions = [...finalCustomPositions];
        const totalClampCandidateCount = rawBienPositions.length + rawCustomPositions.length;
        try {
          const maxClampPositions = isMobile
            ? SATELLITE_CLAMP_MAX_POSITIONS_MOBILE
            : SATELLITE_CLAMP_MAX_POSITIONS;

          if (rawBienPositions.length > 0) {
            const bienIndexesToClamp = selectClosestPositionIndexes(
              rawBienPositions,
              maxClampPositions
            );
            const sampleBienPositions = bienIndexesToClamp.map(
              (index) => rawBienPositions[index]
            );
            const clampedBiens = await withPromiseTimeout(
              viewer.scene.clampToHeightMostDetailed(sampleBienPositions),
              SATELLITE_CLAMP_TIMEOUT_MS,
              "CLAMP_TIMEOUT_BIENS",
              "CLAMP_TIMEOUT_BIENS"
            );
            if (!cancelled && Array.isArray(clampedBiens)) {
              clampedBiens.forEach((position, sampledIndex) => {
                const index = bienIndexesToClamp[sampledIndex];
                const elevated = elevateCartesianPosition(position);
                if (elevated) {
                  clampedBienPositions[index] = elevated;
                  return;
                }
                const bien = biensAvecCoordonnees[index];
                clampedBienPositions[index] = buildFallbackSatellitePosition(
                  bien.lon,
                  bien.lat
                );
              });
            }
          }

          if (rawCustomPositions.length > 0) {
            const customIndexesToClamp = selectClosestPositionIndexes(
              rawCustomPositions,
              maxClampPositions
            );
            const sampleCustomPositions = customIndexesToClamp.map(
              (index) => rawCustomPositions[index]
            );
            const clampedCustomMarkers = await withPromiseTimeout(
              viewer.scene.clampToHeightMostDetailed(sampleCustomPositions),
              SATELLITE_CLAMP_TIMEOUT_MS,
              "CLAMP_TIMEOUT_CUSTOM",
              "CLAMP_TIMEOUT_CUSTOM"
            );
            if (!cancelled && Array.isArray(clampedCustomMarkers)) {
              clampedCustomMarkers.forEach((position, sampledIndex) => {
                const index = customIndexesToClamp[sampledIndex];
                const elevated = elevateCartesianPosition(position);
                if (elevated) {
                  clampedCustomPositions[index] = elevated;
                  return;
                }
                const marker = customMarkers[index];
                clampedCustomPositions[index] = buildFallbackSatellitePosition(
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
        }

        if (cancelled) return;
        applyBienEntityPositions(clampedBienPositions);
        applyCustomEntityPositions(clampedCustomPositions);
        recordMapPerfEvent("marker_refine_complete", {
          durationMs: performance.now() - refineStartedAt,
          count: totalClampCandidateCount,
        });
        viewer.scene.requestRender();
      };

      if (shouldUseMeshClampForMarkers) {
        void refineMarkerHeightsWithClamp();
      }

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

    let cancelled = false;

    const clearMarkerLodSettleTimeout = () => {
      if (markerLodSettleTimeoutRef.current) {
        window.clearTimeout(markerLodSettleTimeoutRef.current);
        markerLodSettleTimeoutRef.current = null;
      }
    };

    const applyMarkerLod = () => {
      if (cancelled || !viewer || viewer.isDestroyed()) return;

      const isSatelliteMode =
        modeRef.current === "google3d" || Boolean(tilesetRef.current?.show);
      const bienEntities = entitiesRef.current;
      const customEntities = customMarkerEntitiesRef.current;

      if (!Array.isArray(bienEntities) || bienEntities.length === 0) return;

      const selectedId = selectedBienIdRef.current;
      const isMoving = Boolean(adaptiveQualityStateRef.current.isMoving);
      if (isMoving && markerLodRuntimeRef.current.movingStateApplied) {
        return;
      }

      const now = performance.now();
      if (!isMoving && now < markerLodRuntimeRef.current.nextUpdateAt) return;
      markerLodRuntimeRef.current.nextUpdateAt =
        now + SATELLITE_MARKER_LOD_UPDATE_INTERVAL_MS;

      let changed = false;

      if (!isSatelliteMode) {
        const signature = `osm|${bienEntities.length}|${customEntities.length}|${selectedId ?? ""}`;
        if (markerLodRuntimeRef.current.lastSignature === signature) return;
        markerLodRuntimeRef.current.lastSignature = signature;
        markerLodRuntimeRef.current.movingStateApplied = false;

        bienEntities.forEach((entity) => {
          const shouldShowPoint = entity.showPointByPriority !== false;
          if (entity.point?.show !== shouldShowPoint) {
            entity.point.show = shouldShowPoint;
            changed = true;
          }
          if (entity.label?.show !== true) {
            entity.label.show = true;
            changed = true;
          }
        });

        customEntities.forEach((entity) => {
          if (entity.point?.show !== true) {
            entity.point.show = true;
            changed = true;
          }
          if (entity.label?.show !== true) {
            entity.label.show = true;
            changed = true;
          }
        });

        if (changed) viewer.scene.requestRender();
        return;
      }

      if (isMoving && !isMobile) {
        const signature = `sat-moving-hold|${bienEntities.length}|${customEntities.length}|${selectedId ?? ""}`;
        if (markerLodRuntimeRef.current.lastSignature === signature) return;
        markerLodRuntimeRef.current.lastSignature = signature;

        bienEntities.forEach((entity) => {
          const bienId = entity.bienData?.id;
          const isSelected = bienId != null && bienId === selectedId;
          const shouldShowPoint = entity.showPointByPriority !== false;
          if (entity.point?.show !== shouldShowPoint) {
            entity.point.show = shouldShowPoint;
            changed = true;
          }
          if (isSelected && entity.label?.show !== true) {
            entity.label.show = true;
            changed = true;
          }
        });

        customEntities.forEach((entity) => {
          if (entity.point?.show !== true) {
            entity.point.show = true;
            changed = true;
          }
        });

        markerLodRuntimeRef.current.movingStateApplied = true;
        if (changed) {
          viewer.scene.requestRender();
        }
        return;
      }

      const cameraPosition = viewer.camera?.positionWC;
      if (!cameraPosition) return;
      const cameraHeight = getCameraHeight(viewer);
      const currentMobileProfile = normalizeMobileQualityProfile(
        mobileQualityProfileRef.current
      );
      const currentDesktopProfile = normalizeDesktopQualityProfile(
        desktopQualityProfileRef.current
      );
      const lodBudget = getSatelliteMarkerLodBudget(
        cameraHeight,
        isMobile,
        isMoving,
        currentMobileProfile,
        currentDesktopProfile
      );
      const cameraBucket = Number.isFinite(cameraHeight)
        ? Math.round(Math.min(12000, cameraHeight) / 140)
        : -1;
      const signature = [
        "sat",
        isMoving ? 1 : 0,
        cameraBucket,
        lodBudget.bienLabelBudget,
        lodBudget.bienPointBudget,
        lodBudget.customLabelBudget,
        lodBudget.customPointBudget,
        isMobile ? currentMobileProfile : currentDesktopProfile,
        bienEntities.length,
        customEntities.length,
        selectedId ?? "",
      ].join("|");
      if (markerLodRuntimeRef.current.lastSignature === signature) return;
      markerLodRuntimeRef.current.lastSignature = signature;

      const bienRanked = bienEntities
        .map((entity) => ({
          entity,
          distanceSquared: Cesium.Cartesian3.distanceSquared(
            cameraPosition,
            entity.markerPositionCartesian ||
              entity.position?.getValue?.(viewer.clock.currentTime) ||
              cameraPosition
          ),
        }))
        .sort((left, right) => left.distanceSquared - right.distanceSquared);
      const customRanked = customEntities
        .map((entity) => ({
          entity,
          distanceSquared: Cesium.Cartesian3.distanceSquared(
            cameraPosition,
            entity.markerPositionCartesian ||
              entity.position?.getValue?.(viewer.clock.currentTime) ||
              cameraPosition
          ),
        }))
        .sort((left, right) => left.distanceSquared - right.distanceSquared);

      const bienLabelVisibleSet = new Set(
        bienRanked.slice(0, lodBudget.bienLabelBudget).map((entry) => entry.entity)
      );
      const bienPointVisibleSet = new Set(
        bienRanked.slice(0, lodBudget.bienPointBudget).map((entry) => entry.entity)
      );
      const customLabelVisibleSet = new Set(
        customRanked.slice(0, lodBudget.customLabelBudget).map((entry) => entry.entity)
      );
      const customPointVisibleSet = new Set(
        customRanked.slice(0, lodBudget.customPointBudget).map((entry) => entry.entity)
      );
      const shouldShowDesktopLabelsForVisiblePoints = !isMobile && !isMoving;

      bienEntities.forEach((entity) => {
        const bienId = entity.bienData?.id;
        const isSelected = bienId != null && bienId === selectedId;
        const shouldShowPointBase = entity.showPointByPriority !== false;
        const shouldShowPoint =
          isSelected || (shouldShowPointBase && bienPointVisibleSet.has(entity));
        const shouldShowLabel =
          isSelected ||
          (shouldShowDesktopLabelsForVisiblePoints
            ? shouldShowPoint
            : bienLabelVisibleSet.has(entity));
        if (entity.point?.show !== shouldShowPoint) {
          entity.point.show = shouldShowPoint;
          changed = true;
        }
        if (entity.label?.show !== shouldShowLabel) {
          entity.label.show = shouldShowLabel;
          changed = true;
        }
      });

      customEntities.forEach((entity) => {
        const shouldShowPoint = customPointVisibleSet.has(entity);
        const shouldShowLabel = shouldShowDesktopLabelsForVisiblePoints
          ? shouldShowPoint
          : customLabelVisibleSet.has(entity);
        if (entity.point?.show !== shouldShowPoint) {
          entity.point.show = shouldShowPoint;
          changed = true;
        }
        if (entity.label?.show !== shouldShowLabel) {
          entity.label.show = shouldShowLabel;
          changed = true;
        }
      });

      markerLodRuntimeRef.current.movingStateApplied = isMoving;

      if (changed) {
        viewer.scene.requestRender();
      }
    };

    const invalidateMarkerLod = () => {
      clearMarkerLodSettleTimeout();
      markerLodRuntimeRef.current.nextUpdateAt = 0;
      markerLodRuntimeRef.current.lastSignature = "";
      markerLodRuntimeRef.current.movingStateApplied = false;
      applyMarkerLod();
    };

    const settleMarkerLodAfterMotion = () => {
      clearMarkerLodSettleTimeout();
      markerLodRuntimeRef.current.nextUpdateAt =
        performance.now() + SATELLITE_MARKER_LOD_SETTLE_DELAY_MS;
      markerLodRuntimeRef.current.lastSignature = "";
      markerLodRuntimeRef.current.movingStateApplied = false;
      markerLodSettleTimeoutRef.current = window.setTimeout(() => {
        markerLodSettleTimeoutRef.current = null;
        if (cancelled || viewer.isDestroyed()) return;
        if (adaptiveQualityStateRef.current.isMoving) return;
        markerLodRuntimeRef.current.nextUpdateAt = 0;
        applyMarkerLod();
      }, SATELLITE_MARKER_LOD_SETTLE_DELAY_MS);
    };

    viewer.scene.postRender.addEventListener(applyMarkerLod);
    viewer.camera.moveStart.addEventListener(invalidateMarkerLod);
    viewer.camera.moveEnd.addEventListener(settleMarkerLodAfterMotion);
    applyMarkerLod();

    return () => {
      cancelled = true;
      clearMarkerLodSettleTimeout();
      markerLodRuntimeRef.current.nextUpdateAt = 0;
      markerLodRuntimeRef.current.lastSignature = "";
      markerLodRuntimeRef.current.movingStateApplied = false;
      if (!viewer.isDestroyed()) {
        viewer.scene.postRender.removeEventListener(applyMarkerLod);
        viewer.camera.moveStart.removeEventListener(invalidateMarkerLod);
        viewer.camera.moveEnd.removeEventListener(settleMarkerLodAfterMotion);
      }
    };
  }, [
    isMobile,
    tilesReadyVersion,
    selectedBienId,
    mobileQualityProfile,
    desktopQualityProfile,
  ]);

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
    const useTouchNavigation = isMobile && hasTouchInput();
    const liveMode =
      modeRef.current === "google3d" || Boolean(tilesetRef.current?.show)
        ? "google3d"
        : canUseGoogle3D
          ? resolveMode(mapModeRef.current)
          : "osm";

    if (useTouchNavigation) {
      optimizeTouchNavigation(viewer, touchNavTuningRef.current, liveMode);
      const modeKey = getModeKey(liveMode);
      if (!Number.isFinite(syncPanHeightRef.current[modeKey])) {
        rememberSyncPanHeightForMode(viewer, liveMode);
      }
    } else {
      optimizeDesktopNavigation(viewer, touchNavTuningRef.current, liveMode);
    }
    viewer.scene.requestRender();
  }, [isMobile, mapMode, isTilted, touchNavTuning, canUseGoogle3D, tilesReadyVersion]);

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
          const encodedPhoto = await convertFileToStoredMarkerPhoto(file);
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
    if (tiltTransitionLockRef.current) return;
    const liveMode =
      modeRef.current === "google3d" || Boolean(tilesetRef.current?.show)
        ? "google3d"
        : canUseGoogle3D
          ? resolveMode(mapModeRef.current)
          : "osm";
    if (liveMode !== "google3d") return;

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

    const currentMode = liveMode;
    const cameraHeight =
      Cesium.Cartographic.fromCartesian(viewer.camera.positionWC)?.height || 0;
    const currentRangeToFocus = Cesium.Cartesian3.distance(
      viewer.camera.positionWC,
      focusPosition
    );
    const minimumTopDownRange = currentMode === "google3d" ? 120 : 850;
    const maximumTopDownRange = currentMode === "google3d" ? 18000 : 120000;
    const normalizedCurrentRange = Math.max(
      minimumTopDownRange,
      Math.min(
        maximumTopDownRange,
        Number.isFinite(currentRangeToFocus) && currentRangeToFocus > 0
          ? currentRangeToFocus
          : cameraHeight
      )
    );
    let topDownRange;

    if (!isTilted) {
      // Entering 3D: lock range from current camera distance so the toggle
      // preserves zoom instead of jumping far away.
      topDownRange = normalizedCurrentRange;
      tiltToggleBaseRangeRef.current = topDownRange;
    } else {
      // Returning to 2D: restore the locked top-down range, clamped to sane bounds.
      const stableRange = Number(tiltToggleBaseRangeRef.current);
      const fallbackRange =
        Number.isFinite(stableRange) && stableRange > 0
          ? stableRange
          : normalizedCurrentRange;
      topDownRange = Math.max(
        minimumTopDownRange,
        Math.min(maximumTopDownRange, fallbackRange)
      );
    }

    const obliqueRange = Math.max(
      topDownRange * (currentMode === "google3d" ? 1.06 : 1.1),
      currentMode === "google3d" ? 220 : 980
    );
    const boundingSphere = new Cesium.BoundingSphere(
      focusPosition,
      currentMode === "google3d" ? 55 : 140
    );
    const nextTiltedValue = !isTilted;
    const releaseTiltTransition = () => {
      if (tiltTransitionTimeoutRef.current) {
        window.clearTimeout(tiltTransitionTimeoutRef.current);
        tiltTransitionTimeoutRef.current = null;
      }
      tiltTransitionLockRef.current = false;
      setIsTiltTransitioning(false);
    };

    tiltTransitionLockRef.current = true;
    setIsTiltTransitioning(true);
    if (tiltTransitionTimeoutRef.current) {
      window.clearTimeout(tiltTransitionTimeoutRef.current);
    }
    tiltTransitionTimeoutRef.current = window.setTimeout(() => {
      releaseTiltTransition();
    }, 1100);

    viewer.camera.flyToBoundingSphere(boundingSphere, {
      offset: new Cesium.HeadingPitchRange(
        viewer.camera.heading,
        nextTiltedValue
          ? Cesium.Math.toRadians(-60)
          : Cesium.Math.toRadians(-90),
        nextTiltedValue ? obliqueRange : topDownRange
      ),
      duration: 0.8,
      complete: releaseTiltTransition,
      cancel: releaseTiltTransition,
    });

    setIsTilted(nextTiltedValue);
  };

  const isMapModeTransitioning = modeTransition.active;
  const isModeTransitionVisualVisible =
    modeTransitionVisual.visible || isMapModeTransitioning;
  const modeTransitionVisualOpacity =
    modeTransitionVisual.visible && modeTransitionVisual.fading ? 0 : 1;
  const hasModeTransitionSnapshot = Boolean(modeTransitionVisual.snapshotDataUrl);
  const isLiveSatelliteMode =
    modeRef.current === "google3d" || Boolean(tilesetRef.current?.show);
  const currentResolvedMode =
    isLiveSatelliteMode
      ? "google3d"
      : canUseGoogle3D
        ? resolveMode(mapModeRef.current)
        : "osm";
  const hasVisibleSatelliteIssue =
    Boolean(satelliteIssueMessage) && currentResolvedMode !== "google3d";
  const canTiltCurrentView = currentResolvedMode === "google3d";
  const isTiltToggleDisabled = isMapModeTransitioning || isTiltTransitioning;
  const desktopBenchmarkBottom = canTiltCurrentView ? 148 : 84;
  const desktopBenchmarkRecordBottom = canTiltCurrentView ? 212 : 148;
  const desktopPlusBottom = canTiltCurrentView ? 276 : 212;
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
  const isSatelliteSwitchingTo3D =
    isMapModeTransitioning && modeTransition.target === "google3d";
  const showSatelliteButtonSpinner =
    !hasVisibleSatelliteIssue &&
    (isSatelliteTogglePending || isSatelliteSwitchingTo3D);
  const isMapModeToggleDisabled = !canUseGoogle3D;
  const fpsRecordedScenario = sanitizeBenchmarkRecording(
    fpsBenchmarkState.scenario?.recording
  );
  const hasRecordedFpsScenario = Boolean(fpsRecordedScenario);
  const isFpsBenchmarkRecordingDisabled =
    fpsBenchmarkState.running ||
    fpsBenchmarkState.recording ||
    isMapModeTransitioning ||
    currentResolvedMode !== "google3d";
  const isFpsBenchmarkButtonDisabled =
    fpsBenchmarkState.running ||
    fpsBenchmarkState.recording ||
    isMapModeTransitioning ||
    currentResolvedMode !== "google3d";
  const isFpsBenchmarkLogButtonDisabled =
    fpsBenchmarkState.running ||
    fpsBenchmarkState.recording ||
    !fpsBenchmarkState.lastLogText;
  const fpsBenchmarkButtonLabel = fpsBenchmarkState.running
    ? "Test..."
    : fpsBenchmarkState.recording
      ? "Rec..."
      : hasRecordedFpsScenario
        ? "Test FPS reel"
        : fpsBenchmarkState.scenario?.startCamera
          ? "Test FPS script"
          : "Init FPS";
  const fpsBenchmarkRecordButtonLabel = fpsBenchmarkState.recording
    ? "Rec..."
    : hasRecordedFpsScenario
      ? "Refaire trajet"
      : "Rec trajet";
  const fpsBenchmarkButtonTitle = fpsBenchmarkState.running
    ? "Benchmark FPS en cours..."
    : fpsBenchmarkState.scenario?.startCamera
      ? "Relance le meme trajet pour comparer les patches. Shift+clic pour redefinir le point de depart."
      : "Memorise une zone benchmark orientee repères, puis lance un test FPS reproductible.";
  const fpsBenchmarkLogButtonTitle = fpsBenchmarkState.lastLogText
    ? "Copie le dernier benchmark FPS en JSON, avec ms, pics de lag et historique recent."
    : "Lance d'abord un benchmark FPS pour generer des logs.";
  const fpsBenchmarkPrimaryButtonTitle = fpsBenchmarkState.running
    ? "Benchmark FPS en cours..."
    : fpsBenchmarkState.recording
      ? "Enregistrement du trajet reel en cours..."
      : hasRecordedFpsScenario
        ? "Relance exactement la trace humaine enregistree pour mesurer un benchmark proche d'un usage reel."
        : fpsBenchmarkState.scenario?.startCamera
          ? "Lance le benchmark scriptable memorise sur cette zone."
          : "Memorise une zone benchmark orientee reperes, puis lance un test FPS reproductible.";
  const fpsBenchmarkRecordButtonTitle = fpsBenchmarkState.recording
    ? "Enregistrement du trajet reel en cours..."
    : hasRecordedFpsScenario
      ? "Enregistre une nouvelle trace humaine de 26 secondes pour remplacer l'ancienne."
      : "Enregistre pendant 26 secondes un vrai trajet humain qui servira ensuite de benchmark.";
  const fpsBenchmarkSummary = fpsBenchmarkState.message || "";
  const mapModeButtonLabel =
    currentResolvedMode === "google3d"
      ? "Vue plan"
      : isSatelliteTogglePending
        ? "Satellite..."
        : "Vue satellite";
  const mapModeButtonTitle = satelliteIssueMessage
    ? hasVisibleSatelliteIssue
      ? satelliteIssueMessage
      : "Passer a la vue plan"
    : !canUseGoogle3D
      ? "Ajoute un token Cesium ion pour activer Google 3D"
      : currentResolvedMode === "google3d"
        ? "Passer a la vue plan"
        : isSatelliteTogglePending
          ? "Vue satellite en cours de chargement..."
          : !isSatelliteReady
            ? "Prechargement long detecte. Premier basculement possible mais peut prendre quelques secondes."
          : "Passer a la vue satellite";
  const mobileTopInset = isMobile
    ? isStandalonePwa
      ? "calc(env(safe-area-inset-top, 0px) + 8px)"
      : 12
    : 16;
  const mobileBannerTop = isMobile
    ? isStandalonePwa
      ? "calc(env(safe-area-inset-top, 0px) + 56px)"
      : 64
    : 20;
  const mobileTransitionTop = isMobile
    ? isStandalonePwa
      ? "calc(env(safe-area-inset-top, 0px) + 60px)"
      : 68
    : 20;

  function persistFpsBenchmarkState(updater) {
    setFpsBenchmarkState((previousState) => {
      const nextState =
        typeof updater === "function" ? updater(previousState) : previousState;
      writeFpsBenchmarkStore({
        scenario: sanitizeFpsBenchmarkScenario(nextState?.scenario),
        lastResult: nextState?.lastResult || null,
        history: normalizeBenchmarkHistory(nextState?.history),
        lastLogText: String(nextState?.lastLogText || ""),
      });
      return nextState;
    });
  }

  function finishFpsBenchmarkRun(viewer) {
    if (fpsBenchmarkRafRef.current) {
      window.cancelAnimationFrame(fpsBenchmarkRafRef.current);
      fpsBenchmarkRafRef.current = null;
    }
    if (fpsBenchmarkStartTimeoutRef.current) {
      window.clearTimeout(fpsBenchmarkStartTimeoutRef.current);
      fpsBenchmarkStartTimeoutRef.current = null;
    }
    if (fpsBenchmarkQualityLockTimeoutRef.current) {
      window.clearTimeout(fpsBenchmarkQualityLockTimeoutRef.current);
      fpsBenchmarkQualityLockTimeoutRef.current = null;
    }
    if (
      viewer &&
      !viewer.isDestroyed() &&
      fpsBenchmarkCameraInputsRef.current !== null
    ) {
      viewer.scene.screenSpaceCameraController.enableInputs =
        fpsBenchmarkCameraInputsRef.current;
    }
    fpsBenchmarkCameraInputsRef.current = null;
    fpsBenchmarkActiveRef.current = false;
    fpsBenchmarkLastSegmentKeyRef.current = "";
    releaseFpsBenchmarkMovingQualityRef.current?.();
  }

  function getPreferredFpsBenchmarkStartCamera(viewer, baseCamera) {
    if (!isSerializableCameraStateValid(baseCamera)) {
      return { startCamera: baseCamera, markerCluster: null };
    }

    const markerCandidates = extractBenchmarkMarkerCandidates([
      ...entitiesRef.current,
      ...customMarkerEntitiesRef.current,
    ]);
    const markerCluster = findPreferredBenchmarkMarkerCluster(
      baseCamera,
      markerCandidates
    );
    if (!markerCluster) {
      return { startCamera: baseCamera, markerCluster: null };
    }

    return {
      startCamera: {
        ...baseCamera,
        longitude: markerCluster.longitude,
        latitude: markerCluster.latitude,
      },
      markerCluster: {
        longitude: roundBenchmarkValue(markerCluster.longitude, 6),
        latitude: roundBenchmarkValue(markerCluster.latitude, 6),
        markerCount: markerCluster.markerCount,
      },
    };
  }

  async function handleCopyFpsBenchmarkLogs() {
    if (!fpsBenchmarkState.lastLogText) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(fpsBenchmarkState.lastLogText);
      }
      persistFpsBenchmarkState((previousState) => ({
        ...previousState,
        message: "Logs FPS copies. Tu peux me les coller directement.",
      }));
    } catch {
      persistFpsBenchmarkState((previousState) => ({
        ...previousState,
        message:
          "Logs FPS prets dans window.__IMMO3D_FPS_BENCHMARK_LOG_TEXT__. Copie-les depuis la console.",
      }));
    }
  }

  function finishFpsBenchmarkRecording() {
    if (fpsBenchmarkRecordingRafRef.current) {
      window.cancelAnimationFrame(fpsBenchmarkRecordingRafRef.current);
      fpsBenchmarkRecordingRafRef.current = null;
    }
    fpsBenchmarkRecordingDetachRef.current?.();
    fpsBenchmarkRecordingDetachRef.current = () => {};
    fpsBenchmarkRecordingMoveActiveRef.current = false;
  }

  function buildScriptedFpsBenchmarkScenario(viewer) {
    const baseCamera = captureSerializableCameraState(viewer);
    if (!isSerializableCameraStateValid(baseCamera)) {
      return { scenario: null, message: "Impossible de memoriser ce point de depart." };
    }
    const { startCamera, markerCluster } = getPreferredFpsBenchmarkStartCamera(
      viewer,
      baseCamera
    );
    return {
      scenario: sanitizeFpsBenchmarkScenario({
        createdAt: Date.now(),
        routeVersion: FPS_BENCHMARK_ROUTE_VERSION,
        baseCamera,
        startCamera,
        markerCluster,
      }),
      message: markerCluster
        ? `Point de depart FPS memorise dans une zone avec ${markerCluster.markerCount} reperes.`
        : "Point de depart FPS memorise.",
    };
  }

  function runFpsBenchmark(viewer, scenario) {
    const safeScenario = sanitizeFpsBenchmarkScenario(scenario);
    if (
      !viewer ||
      viewer.isDestroyed() ||
      !safeScenario ||
      !isSerializableCameraStateValid(safeScenario.startCamera)
    ) {
      return;
    }

    finishFpsBenchmarkRecording();
    finishFpsBenchmarkRun(viewer);
    fpsBenchmarkActiveRef.current = true;
    clearQualityRecoverySafetyTimeout();
    clearGoogleQualityTimeout();
    clearDesktopQualityRestoreTimeouts();
    clearMobileQualityRestoreTimeout();
    clearMobileUltraRestoreTimeout();
    resetAdaptiveQualityStats();
    desktopMovingVisibleUntilRef.current = 0;
    desktopSettleSnapshotRef.current = null;

    const recording = sanitizeBenchmarkRecording(safeScenario.recording);
    const benchmarkSegmentTimeline =
      recording?.segmentTimeline?.length > 0
        ? recording.segmentTimeline
        : FPS_BENCHMARK_SEGMENT_TIMELINE;
    const benchmarkTotalDurationMs =
      recording?.durationMs || FPS_BENCHMARK_TOTAL_DURATION_MS;
    const startCamera =
      recording?.samples?.[0] && isSerializableCameraStateValid(recording.samples[0])
        ? recording.samples[0]
        : safeScenario.startCamera;
    const routeKind = recording ? "recorded" : "synthetic";
    const routeLabel = recording ? "trace reelle" : "script";
    const runMode =
      modeRef.current === "google3d" || Boolean(tilesetRef.current?.show)
        ? "google3d"
        : "osm";
    const qualityProfile = isMobile
      ? normalizeMobileQualityProfile(mobileQualityProfileRef.current)
      : normalizeDesktopQualityProfile(desktopQualityProfileRef.current);
    const benchmarkDistanceMeters = getFpsBenchmarkDistanceMeters(startCamera);
    const isColdStart = fpsBenchmarkRunCountRef.current === 0;
    const runKind = isColdStart ? "cold" : "warm";

    fpsBenchmarkCameraInputsRef.current =
      viewer.scene.screenSpaceCameraController.enableInputs;
    viewer.scene.screenSpaceCameraController.enableInputs = false;
    const initialSegmentMeta = getFpsBenchmarkSegmentMetaAt(
      0,
      benchmarkSegmentTimeline
    );
    const initialSegmentShouldMove =
      typeof initialSegmentMeta?.benchmarkMoving === "boolean"
        ? Boolean(initialSegmentMeta.benchmarkMoving)
        : true;
    adaptiveQualityStateRef.current.isMoving = initialSegmentShouldMove;
    if (initialSegmentMeta?.key) {
      fpsBenchmarkLastSegmentKeyRef.current = initialSegmentMeta.key;
    }
    if (initialSegmentShouldMove) {
      applyFpsBenchmarkMovingQualityRef.current?.(
        Number(initialSegmentMeta?.durationMs) || null
      );
    } else {
      applyFpsBenchmarkInitialPauseQualityRef.current?.();
    }
    restoreSerializableCameraState(viewer, startCamera);
    viewer.scene.requestRender();

    persistFpsBenchmarkState((previousState) => ({
      ...previousState,
      running: true,
      recording: false,
      message: `Test FPS ${runKind} (${routeLabel}, ${Math.round(
        benchmarkDistanceMeters
      )} m) en cours...`,
    }));

    fpsBenchmarkStartTimeoutRef.current = window.setTimeout(() => {
      fpsBenchmarkStartTimeoutRef.current = null;
      if (viewer.isDestroyed()) {
        finishFpsBenchmarkRun(viewer);
        return;
      }

      applyFpsBenchmarkSegmentQualityRef.current?.(initialSegmentMeta);

      const telemetryStartedAtMs = Date.now();
      const anchor = recording
        ? null
        : Cesium.Cartesian3.fromDegrees(startCamera.longitude, startCamera.latitude, 0);
      const benchmarkFrame = anchor
        ? Cesium.Transforms.eastNorthUpToFixedFrame(anchor)
        : null;
      const benchmarkFrameInverse = benchmarkFrame
        ? Cesium.Matrix4.inverseTransformation(benchmarkFrame, new Cesium.Matrix4())
        : null;
      const startDestination = benchmarkFrameInverse
        ? Cesium.Cartesian3.fromDegrees(
            startCamera.longitude,
            startCamera.latitude,
            startCamera.height
          )
        : null;
      const startLocalPosition =
        benchmarkFrameInverse && startDestination
          ? Cesium.Matrix4.multiplyByPoint(
              benchmarkFrameInverse,
              startDestination,
              new Cesium.Cartesian3()
            )
          : null;
      const frameSamples = [];
      let benchmarkStartedAt = null;
      let lastFrameAt = null;
      let recordingSampleIndex = 0;

      const stepBenchmark = (timestamp) => {
        if (viewer.isDestroyed()) {
          finishFpsBenchmarkRun(viewer);
          return;
        }

        if (benchmarkStartedAt === null) {
          benchmarkStartedAt = timestamp;
          lastFrameAt = timestamp;
        }

        const frameGapMs =
          lastFrameAt !== null ? Number(timestamp - lastFrameAt) || 0 : 0;
        if (lastFrameAt !== null && frameGapMs >= FPS_BENCHMARK_INTERRUPT_FRAME_GAP_MS) {
          finishFpsBenchmarkRun(viewer);
          persistFpsBenchmarkState((previousState) => ({
            ...previousState,
            running: false,
            message:
              "Test FPS interrompu (gros gel externe ou onglet mis en pause). Relance-le sans changer d'onglet.",
          }));
          return;
        }

        const elapsedMs = Math.min(
          timestamp - benchmarkStartedAt,
          benchmarkTotalDurationMs
        );
        const segmentMeta = getFpsBenchmarkSegmentMetaAt(
          elapsedMs,
          benchmarkSegmentTimeline
        );
        if (
          segmentMeta?.key &&
          fpsBenchmarkLastSegmentKeyRef.current !== segmentMeta.key
        ) {
          fpsBenchmarkLastSegmentKeyRef.current = segmentMeta.key;
          applyFpsBenchmarkSegmentQualityRef.current?.(segmentMeta);
        }
        if (recording?.samples?.length > 1) {
          while (
            recordingSampleIndex < recording.samples.length - 2 &&
            elapsedMs >= Number(recording.samples[recordingSampleIndex + 1]?.elapsedMs || 0)
          ) {
            recordingSampleIndex += 1;
          }
          const fromSample =
            recording.samples[recordingSampleIndex] || recording.samples[0];
          const toSample =
            recording.samples[
              Math.min(recordingSampleIndex + 1, recording.samples.length - 1)
            ] || fromSample;
          const sampleDurationMs = Math.max(
            1,
            Number(toSample?.elapsedMs || 0) - Number(fromSample?.elapsedMs || 0)
          );
          const sampleProgress =
            toSample === fromSample
              ? 0
              : (elapsedMs - Number(fromSample?.elapsedMs || 0)) / sampleDurationMs;
          const nextCameraState = interpolateSerializableCameraState(
            fromSample,
            toSample,
            sampleProgress
          );
          restoreSerializableCameraState(viewer, nextCameraState);
        } else {
          const offset = getFpsBenchmarkOffsetAt(elapsedMs, benchmarkDistanceMeters);
          const rotatedOffset = rotateBenchmarkOffsetByHeading(
            offset.x,
            offset.y,
            startCamera.heading
          );
          const worldPosition = Cesium.Matrix4.multiplyByPoint(
            benchmarkFrame,
            new Cesium.Cartesian3(
              rotatedOffset.east,
              rotatedOffset.north,
              startLocalPosition.z *
                (Number.isFinite(Number(offset.heightScale))
                  ? Number(offset.heightScale)
                  : 1)
            ),
            new Cesium.Cartesian3()
          );

          viewer.camera.setView({
            destination: worldPosition,
            orientation: {
              heading: Number(startCamera.heading) || 0,
              pitch: Number(startCamera.pitch) || Cesium.Math.toRadians(-90),
              roll: Number(startCamera.roll) || 0,
            },
          });
        }
        viewer.scene.requestRender();

        if (lastFrameAt !== null && timestamp > lastFrameAt) {
          const qualitySnapshot = currentQualityTelemetryRef.current || {};
          frameSamples.push({
            frameMs: timestamp - lastFrameAt,
            elapsedMs,
            segmentIndex: Number(segmentMeta?.index || 0),
            segmentKey: String(segmentMeta?.key || ""),
            segmentLabel: String(segmentMeta?.label || ""),
            phaseKey: String(segmentMeta?.phaseKey || ""),
            phaseLabel: String(segmentMeta?.phaseLabel || ""),
            benchmarkMoving:
              typeof segmentMeta?.benchmarkMoving === "boolean"
                ? Boolean(segmentMeta.benchmarkMoving)
                : null,
            qualityPreset: String(qualitySnapshot.preset || ""),
            qualityMoving:
              typeof qualitySnapshot.moving === "boolean"
                ? Boolean(qualitySnapshot.moving)
                : null,
            resolutionScale: qualitySnapshot.resolutionScale,
            msaaSamples: qualitySnapshot.msaaSamples,
            globeSse: qualitySnapshot.globeSse,
            tilesetSse: qualitySnapshot.tilesetSse,
            phaseOrder:
              String(segmentMeta?.phaseKey || "") === "settle"
                ? 1000 + Number(segmentMeta?.index || 0)
                : Number(segmentMeta?.index || 0),
          });
        }
        lastFrameAt = timestamp;

        if (elapsedMs < benchmarkTotalDurationMs) {
          fpsBenchmarkRafRef.current =
            window.requestAnimationFrame(stepBenchmark);
          return;
        }

        finishFpsBenchmarkRun(viewer);

        const telemetry = getMapPerfTelemetry();
        const benchmarkLongTasks = (telemetry.recentEvents || []).filter(
          (event) =>
            event?.type === "long_task" &&
            Date.parse(String(event?.at || "")) >= telemetryStartedAtMs
        );
        const benchmarkTileBursts = (telemetry.recentEvents || []).filter(
          (event) =>
            event?.type === "tile_load_burst_complete" &&
            Date.parse(String(event?.at || "")) >= telemetryStartedAtMs
        );
        const longTaskEvents = buildBenchmarkPerfEventSamples(
          benchmarkLongTasks,
          telemetryStartedAtMs,
          benchmarkSegmentTimeline
        );
        const tileBurstEvents = buildBenchmarkPerfEventSamples(
          benchmarkTileBursts,
          telemetryStartedAtMs,
          benchmarkSegmentTimeline
        );
        const sortedLongTaskDurationsMs = benchmarkLongTasks
          .map((event) => roundBenchmarkValue(Number(event?.durationMs) || 0))
          .filter((value) => Number.isFinite(value) && value > 0)
          .sort((left, right) => right - left)
          .slice(0, FPS_BENCHMARK_SPIKE_SAMPLE_LIMIT);
        const sortedTileBurstDurationsMs = benchmarkTileBursts
          .map((event) => roundBenchmarkValue(Number(event?.durationMs) || 0))
          .filter((value) => Number.isFinite(value) && value > 0)
          .sort((left, right) => right - left)
          .slice(0, FPS_BENCHMARK_SPIKE_SAMPLE_LIMIT);
        const result = buildFpsBenchmarkResult(
          frameSamples,
          {
            routeVersion:
              Number(safeScenario.routeVersion) || FPS_BENCHMARK_ROUTE_VERSION,
            routeKind,
            coldStart: isColdStart,
            runKind,
            runIndexSinceReload: fpsBenchmarkRunCountRef.current + 1,
            distanceMeters: Math.round(benchmarkDistanceMeters),
            mode: runMode,
            qualityProfile,
            markerCluster: safeScenario.markerCluster || null,
            recordingDurationMs: recording?.durationMs || null,
            recordingSampleCount: recording?.sampleCount || null,
            longTaskCount: benchmarkLongTasks.length,
            maxLongTaskMs: roundBenchmarkValue(
              benchmarkLongTasks.reduce(
                (maxDuration, event) =>
                  Math.max(maxDuration, Number(event?.durationMs) || 0),
                0
              )
            ),
            longTaskDurationsMs: sortedLongTaskDurationsMs,
            longTaskEvents,
            tileBurstCount: benchmarkTileBursts.length,
            tileBurstDurationsMs: sortedTileBurstDurationsMs,
            tileBurstEvents,
          },
          benchmarkSegmentTimeline
        );
        if (!result) {
          persistFpsBenchmarkState((previousState) => ({
            ...previousState,
            running: false,
            recording: false,
            message: "Test FPS impossible a mesurer.",
          }));
          return;
        }

        recordMapPerfEvent("fps_benchmark_complete", {
          avgFps: result.avgFps,
          minFps: result.minFps,
          p95FrameMs: result.p95FrameMs,
          durationMs: result.durationMs,
          runKind,
          mode: runMode,
          qualityProfile,
          longTaskCount: result.longTaskCount,
        });
        fpsBenchmarkRunCountRef.current += 1;
        const nextHistory = [
          sanitizeBenchmarkHistoryEntry(result),
          ...fpsBenchmarkState.history,
        ]
          .filter(Boolean)
          .slice(0, FPS_BENCHMARK_HISTORY_LIMIT);
        const logPayload = buildFpsBenchmarkLogPayload(result, nextHistory);
        const logText = formatFpsBenchmarkLogText(logPayload);
        publishFpsBenchmarkLogs(logPayload);
        console.info("IMMO3D_FPS_BENCHMARK", logPayload);
        persistFpsBenchmarkState((previousState) => ({
          ...previousState,
          running: false,
          recording: false,
          lastResult: result,
          history: nextHistory,
          lastLogText: logText,
          message: `${routeLabel} | ${formatFpsBenchmarkSummaryDisplay(result)}`,
        }));
      };

      fpsBenchmarkRafRef.current = window.requestAnimationFrame(stepBenchmark);
    }, FPS_BENCHMARK_PREPARE_DELAY_MS);
  }

  function handleRecordFpsBenchmark() {
    const viewer = viewerRef.current;
    if (
      !viewer ||
      viewer.isDestroyed() ||
      fpsBenchmarkState.running ||
      fpsBenchmarkState.recording
    ) {
      return;
    }

    const liveMode =
      modeRef.current === "google3d" || Boolean(tilesetRef.current?.show)
        ? "google3d"
        : "osm";
    if (liveMode !== "google3d") {
      persistFpsBenchmarkState((previousState) => ({
        ...previousState,
        message: "Passe d'abord en vue satellite pour comparer les FPS.",
      }));
      return;
    }

    const baseCamera = captureSerializableCameraState(viewer);
    if (!isSerializableCameraStateValid(baseCamera)) {
      persistFpsBenchmarkState((previousState) => ({
        ...previousState,
        message: "Impossible de demarrer l'enregistrement depuis cette vue.",
      }));
      return;
    }
    const { markerCluster } = getPreferredFpsBenchmarkStartCamera(viewer, baseCamera);
    const recordingSamples = [];
    const recordingCreatedAt = Date.now();
    let recordingStartedAt = null;
    let previousSampleElapsedMs = null;

    finishFpsBenchmarkRun(viewer);
    finishFpsBenchmarkRecording();
    fpsBenchmarkRecordingMoveActiveRef.current = false;

    const handleRecordingMoveStart = () => {
      fpsBenchmarkRecordingMoveActiveRef.current = true;
    };
    const handleRecordingMoveEnd = () => {
      fpsBenchmarkRecordingMoveActiveRef.current = false;
    };
    viewer.camera.moveStart.addEventListener(handleRecordingMoveStart);
    viewer.camera.moveEnd.addEventListener(handleRecordingMoveEnd);
    fpsBenchmarkRecordingDetachRef.current = () => {
      try {
        viewer.camera.moveStart.removeEventListener(handleRecordingMoveStart);
        viewer.camera.moveEnd.removeEventListener(handleRecordingMoveEnd);
      } catch {
        // Ignore teardown issues if the viewer is already gone.
      }
    };

    persistFpsBenchmarkState((previousState) => ({
      ...previousState,
      running: false,
      recording: true,
      message:
        "Enregistrement du trajet reel pendant 26s... Deplace-toi naturellement dans l'app.",
    }));

    const stepRecording = (timestamp) => {
      if (viewer.isDestroyed()) {
        finishFpsBenchmarkRecording();
        persistFpsBenchmarkState((previousState) => ({
          ...previousState,
          recording: false,
          message: "Enregistrement annule.",
        }));
        return;
      }

      if (recordingStartedAt === null) {
        recordingStartedAt = timestamp;
      }

      const elapsedMs = Math.min(
        timestamp - recordingStartedAt,
        FPS_BENCHMARK_RECORDING_DURATION_MS
      );
      const currentCameraSample = captureSerializableCameraState(viewer);
      if (isSerializableCameraStateValid(currentCameraSample)) {
        if (
          Number.isFinite(previousSampleElapsedMs) &&
          elapsedMs - Number(previousSampleElapsedMs || 0) >=
            FPS_BENCHMARK_INTERRUPT_FRAME_GAP_MS
        ) {
          finishFpsBenchmarkRecording();
          persistFpsBenchmarkState((previousState) => ({
            ...previousState,
            recording: false,
            message:
              "Enregistrement interrompu (gros gel externe ou onglet mis en pause). Recommence sans changer d'onglet.",
          }));
          return;
        }

        recordingSamples.push({
          elapsedMs,
          ...currentCameraSample,
          benchmarkMoving: fpsBenchmarkRecordingMoveActiveRef.current,
        });
        previousSampleElapsedMs = elapsedMs;
      }

      if (elapsedMs < FPS_BENCHMARK_RECORDING_DURATION_MS) {
        fpsBenchmarkRecordingRafRef.current =
          window.requestAnimationFrame(stepRecording);
        return;
      }

      finishFpsBenchmarkRecording();
      const recording = sanitizeBenchmarkRecording({
        createdAt: recordingCreatedAt,
        durationMs: FPS_BENCHMARK_RECORDING_DURATION_MS,
        samples: recordingSamples,
      });
      if (
        !recording ||
        !recording.segmentTimeline.some((segment) => segment.benchmarkMoving)
      ) {
        persistFpsBenchmarkState((previousState) => ({
          ...previousState,
          recording: false,
          message:
            "Trajet reel insuffisant. Recommence en bougeant franchement la carte pendant 20 a 30 secondes.",
        }));
        return;
      }

      const nextScenario = sanitizeFpsBenchmarkScenario({
        createdAt: recordingCreatedAt,
        routeVersion: FPS_BENCHMARK_ROUTE_VERSION,
        baseCamera,
        startCamera: recording.samples[0],
        markerCluster,
        recording,
      });
      persistFpsBenchmarkState((previousState) => ({
        ...previousState,
        running: false,
        recording: false,
        scenario: nextScenario,
        message: `Trajet reel enregistre (${Math.round(
          recording.durationMs / 1000
        )}s, ${recording.sampleCount} points, ${
          recording.segmentTimeline.length
        } phases). Lance maintenant le test FPS.`,
      }));
    };

    fpsBenchmarkRecordingRafRef.current =
      window.requestAnimationFrame(stepRecording);
  }

  function handleStartFpsBenchmark() {
    const viewer = viewerRef.current;
    if (
      !viewer ||
      viewer.isDestroyed() ||
      fpsBenchmarkState.running ||
      fpsBenchmarkState.recording
    ) {
      return;
    }

    const liveMode =
      modeRef.current === "google3d" || Boolean(tilesetRef.current?.show)
        ? "google3d"
        : "osm";
    if (liveMode !== "google3d") {
      persistFpsBenchmarkState((previousState) => ({
        ...previousState,
        message: "Passe d'abord en vue satellite pour comparer les FPS.",
      }));
      return;
    }

    let nextScenario = sanitizeFpsBenchmarkScenario(fpsBenchmarkState.scenario);
    if (!nextScenario?.startCamera) {
      const scriptedScenario = buildScriptedFpsBenchmarkScenario(viewer);
      if (!scriptedScenario.scenario) {
        persistFpsBenchmarkState((previousState) => ({
          ...previousState,
          message: scriptedScenario.message,
        }));
        return;
      }
      nextScenario = scriptedScenario.scenario;
      persistFpsBenchmarkState((previousState) => ({
        ...previousState,
        scenario: nextScenario,
        message: scriptedScenario.message,
      }));
    }

    try {
      runFpsBenchmark(viewer, nextScenario);
    } catch (error) {
      console.error("Erreur lancement benchmark FPS :", error);
      persistFpsBenchmarkState((previousState) => ({
        ...previousState,
        running: false,
        message: "Le test FPS n'a pas pu demarrer. Recharge la page puis reessaie.",
      }));
    }
  }

  function forcePlanModeImmediate(options = {}) {
    const { keepTransition = false } = options;
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    modeRef.current = "osm";
    mapModeRef.current = "osm";

    setSceneGoogleTilesetsVisibility(viewer, false);

    viewer.terrainProvider = ellipsoidTerrainProviderRef.current;
    viewer.scene.globe.show = true;
    viewer.scene.skyBox.show = false;
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#dbeafe");

    if (osmImageryLayerRef.current) {
      osmImageryLayerRef.current.show = true;
      osmImageryLayerRef.current.alpha = 1;
    }

    setIsTilted(false);
    tiltToggleBaseRangeRef.current = null;
    setSatelliteIssueMessage("");
    setIsSatelliteReady(false);
    if (!keepTransition) {
      setModeTransition({
        active: false,
        target: null,
      });
    }
    setTilesReadyVersion((value) => value + 1);
    viewer.scene.requestRender();
  }

  function handleToggleMapMode() {
    if (!canUseGoogle3D) return;
    if (isLiveSatelliteMode || mapMode === "google3d") {
      startModeTransition("osm");
      forcePlanModeImmediate({ keepTransition: true });
      if (onSetMapModeRef.current) {
        onSetMapModeRef.current("osm");
      } else {
        onToggleMapMode?.();
      }
      return;
    }

    const nextMode = "google3d";
    if (isMapModeTransitioning) {
      recordMapPerfEvent("mode_switch_queued", { targetMode: nextMode });
    }
    if (nextMode === "google3d") {
      setSatelliteIssueMessage("");
    }
    mapModeRef.current = nextMode;
    if (onSetMapModeRef.current) {
      onSetMapModeRef.current(nextMode);
    } else {
      onToggleMapMode?.();
    }
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

      {!isMobile && fpsBenchmarkSummary ? (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 88,
            zIndex: 8,
            maxWidth: 520,
            padding: "10px 14px",
            borderRadius: 14,
            border: "1px solid rgba(15, 23, 42, 0.12)",
            background: "rgba(255,255,255,0.92)",
            color: "var(--text-primary)",
            boxShadow: "0 14px 26px rgba(15, 23, 42, 0.14)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.4,
          }}
        >
          <div>Test FPS: {fpsBenchmarkSummary}</div>
          {fpsRecordedScenario ? (
            <div
              style={{
                marginTop: 6,
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
              }}
            >
              Trace humaine: {Math.round(fpsRecordedScenario.durationMs / 1000)}s |{" "}
              {fpsRecordedScenario.sampleCount} points |{" "}
              {fpsRecordedScenario.segmentTimeline.length} phases
            </div>
          ) : null}
          {fpsBenchmarkState.lastLogText ? (
            <button
              onClick={handleCopyFpsBenchmarkLogs}
              disabled={isFpsBenchmarkLogButtonDisabled}
              title={fpsBenchmarkLogButtonTitle}
              style={{
                marginTop: 8,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid rgba(15, 23, 42, 0.12)",
                background: "rgba(255,255,255,0.9)",
                color: "var(--text-primary)",
                fontSize: 12,
                fontWeight: 700,
                cursor: isFpsBenchmarkLogButtonDisabled ? "not-allowed" : "pointer",
                opacity: isFpsBenchmarkLogButtonDisabled ? 0.6 : 1,
              }}
            >
              Copier logs FPS
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 4,
          pointerEvents: "none",
          opacity: isModeTransitionVisualVisible ? modeTransitionVisualOpacity : 0,
          transition: modeTransitionVisual.fading
            ? `opacity ${MODE_TRANSITION_VISUAL_FADE_OUT_MS}ms ease`
            : "opacity 120ms ease",
        }}
      >
        {hasModeTransitionSnapshot ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${modeTransitionVisual.snapshotDataUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(12px) saturate(1.04)",
              transform: "scale(1.03)",
              opacity: 0.92,
            }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              hasModeTransitionSnapshot
                ? "linear-gradient(180deg, rgba(8, 15, 28, 0.20) 0%, rgba(8, 15, 28, 0.30) 100%)"
                : "linear-gradient(180deg, rgba(240, 244, 250, 0.88) 0%, rgba(225, 232, 242, 0.92) 100%)",
            backdropFilter: isModeTransitionVisualVisible ? "blur(4px)" : "blur(0px)",
            WebkitBackdropFilter: isModeTransitionVisualVisible ? "blur(4px)" : "blur(0px)",
          }}
        />
        {!hasModeTransitionSnapshot ? (
          <>
            <div
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.45,
                backgroundImage:
                  "radial-gradient(circle at 20% 22%, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0) 40%), radial-gradient(circle at 78% 72%, rgba(148,163,184,0.20) 0%, rgba(148,163,184,0) 44%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: "-10% 0",
                background:
                  "linear-gradient(110deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.42) 48%, rgba(255,255,255,0) 100%)",
                transform: "translateX(-60%)",
                animation: "immoMapTransitionShine 900ms ease-out 1",
              }}
            />
          </>
        ) : null}
        <div
          style={{
            position: "absolute",
            top: mobileTransitionTop,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "10px 14px",
            borderRadius: 999,
            border: hasModeTransitionSnapshot
              ? "1px solid rgba(255,255,255,0.34)"
              : "1px solid rgba(148, 163, 184, 0.5)",
            background: hasModeTransitionSnapshot
              ? "rgba(15, 23, 42, 0.72)"
              : "rgba(255, 255, 255, 0.78)",
            color: hasModeTransitionSnapshot ? "#f8fafc" : "#0f172a",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.01em",
            boxShadow: hasModeTransitionSnapshot
              ? "0 12px 30px rgba(15, 23, 42, 0.18)"
              : "0 12px 28px rgba(15, 23, 42, 0.14)",
            opacity: isModeTransitionVisualVisible ? 1 : 0,
            transition: "opacity 180ms ease",
            whiteSpace: "nowrap",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <LoadingSpinner size={13} />
          {modeTransitionLabel}
        </div>
      </div>

      {topLeftOverlay ? (
        <div
          style={{
            position: "absolute",
            top: mobileTopInset,
            left: isMobile ? 12 : 16,
            zIndex: 6,
          }}
        >
          {topLeftOverlay}
        </div>
      ) : null}
      <style>
        {`@keyframes immoMapTransitionShine {
          0% { transform: translateX(-62%); opacity: 0; }
          18% { opacity: 0.95; }
          100% { transform: translateX(58%); opacity: 0; }
        }`}
      </style>

      {hasVisibleSatelliteIssue ? (
        <div
          style={{
            position: "absolute",
            top: mobileBannerTop,
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
            top: mobileBannerTop,
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
            top: mobileBannerTop,
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
            onClick={handleRecordFpsBenchmark}
            disabled={isFpsBenchmarkRecordingDisabled}
            style={desktopMapButtonStyle(
              desktopBenchmarkRecordBottom,
              !isFpsBenchmarkRecordingDisabled
            )}
            title={fpsBenchmarkRecordButtonTitle}
          >
            <span style={mapModeButtonContentStyle()}>
              {fpsBenchmarkState.recording ? <LoadingSpinner size={14} /> : null}
              <span>{fpsBenchmarkRecordButtonLabel}</span>
            </span>
          </button>
          <button
            onClick={handleStartFpsBenchmark}
            disabled={isFpsBenchmarkButtonDisabled}
            style={desktopMapButtonStyle(
              desktopBenchmarkBottom,
              !isFpsBenchmarkButtonDisabled
            )}
            title={fpsBenchmarkPrimaryButtonTitle}
          >
            <span style={mapModeButtonContentStyle()}>
              {fpsBenchmarkState.running ? <LoadingSpinner size={14} /> : null}
              <span>{fpsBenchmarkButtonLabel}</span>
            </span>
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
            <span style={mapModeButtonContentStyle()}>
              {showSatelliteButtonSpinner ? <LoadingSpinner size={14} /> : null}
              <span>{mapModeButtonLabel}</span>
            </span>
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
            <div style={{ display: "grid", gap: 8, maxHeight: 320, overflowY: "auto" }}>
              {stackedMarkerOptions.map((bien) => {
                const previewPhoto = getBienPreviewPhoto(bien);
                const badge = getStackedOptionBadge(bien);
                const publicationText =
                  bien.anciennete !== null && bien.anciennete !== undefined
                    ? `Publie il y a ${bien.anciennete} jours`
                    : "Publication inconnue";
                return (
                  <button
                    key={`stack-choice-${bien.id}`}
                    onClick={() => selectStackedMarkerOption(bien)}
                    style={stackedMarkerChoiceButtonStyle(isMobile)}
                  >
                    <div style={{ display: "flex", gap: 8, alignItems: "stretch", height: "100%" }}>
                      {isMobile ? (
                        <div
                          style={{
                            width: "48%",
                            minWidth: "48%",
                            height: "100%",
                            borderRadius: 10,
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
                              alt="Apercu annonce"
                              loading="lazy"
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                                padding: 8,
                              }}
                            >
                              Pas de photo
                            </span>
                          )}
                        </div>
                      ) : null}
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          height: "100%",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          textAlign: "left",
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
                        <span style={{ fontWeight: 700 }}>{formatMarkerPrix(bien.prix)}</span>
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            fontSize: 12,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {bien.agence || "Agence inconnue"}
                        </span>
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                          {formatSurface(bien.surface)}
                        </span>
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                          {publicationText}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
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
              disabled={isTiltToggleDisabled}
              style={mobileFloatingCircleButtonStyle(false, isTiltToggleDisabled)}
              title={
                isTiltTransitioning
                  ? "Changement d'inclinaison en cours..."
                  : "Changer l'inclinaison"
              }
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
            <span style={mapModeButtonContentStyle()}>
              {showSatelliteButtonSpinner ? <LoadingSpinner size={14} /> : null}
              <span>{mapModeButtonLabel}</span>
            </span>
          </button>
        </div>
      ) : (
        canTiltCurrentView ? (
          <button
            onClick={toggleTilt}
            disabled={isTiltToggleDisabled}
            style={desktopMapButtonStyle(84, !isTiltToggleDisabled, true)}
            title={
              isTiltTransitioning
                ? "Changement d'inclinaison en cours..."
                : "Changer l'inclinaison"
            }
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

function LoadingSpinner({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
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

function stackedMarkerChoiceButtonStyle(isMobile = false) {
  return {
    width: "100%",
    height: isMobile ? MOBILE_BIEN_CARD_HEIGHT : "auto",
    textAlign: "left",
    display: "grid",
    gap: 4,
    border: "1px solid var(--border-color)",
    borderRadius: 12,
    background: "var(--panel-muted-bg)",
    color: "var(--text-primary)",
    padding: "10px 12px",
    cursor: "pointer",
    overflow: "hidden",
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

function mapModeButtonContentStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 18,
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

function mobileFloatingCircleButtonStyle(active, disabled = false) {
  return {
    width: 52,
    minWidth: 52,
    height: 52,
    border: active ? "1px solid var(--text-primary)" : "1px solid var(--control-border)",
    background: active ? "var(--text-primary)" : "var(--control-bg)",
    color: active ? "var(--panel-bg)" : "var(--text-primary)",
    borderRadius: "50%",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
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
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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

