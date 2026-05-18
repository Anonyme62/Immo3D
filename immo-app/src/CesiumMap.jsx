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
const GOOGLE_TILESET_SWITCH_TIMEOUT_MS = 12000;
const MODE_TRANSITION_FAILSAFE_MS = 6500;
const GOOGLE_TILESET_PREMIUM_SSE = 6;
const GOOGLE_TILESET_FAST_PHASE_MS = 420;
const GOOGLE_TILESET_ULTRA_PHASE_MS = 2600;
const GOOGLE_TILESET_FOVEATED_TIME_DELAY_IDLE_SECONDS = 0.2;
const GOOGLE_TILESET_FOVEATED_TIME_DELAY_SETTLE_SECONDS = 0.08;
const GOOGLE_TILESET_FOVEATED_TIME_DELAY_REFINED_SECONDS = 0.14;
const GOOGLE_TILESET_FOVEATED_TIME_DELAY_MOVING_SECONDS = 0.0;
const GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION_MOVING = 0.3;
const GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION_MOVING_CRUISE = 0.42;
const GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION_SETTLE = 0.42;
const GOOGLE_WARMUP_START_DELAY_MS = 220;
const SATELLITE_PREDICTIVE_WARMUP_DELAY_MS_DESKTOP = 260;
const SATELLITE_PREDICTIVE_WARMUP_DELAY_MS_MOBILE = 760;
const SATELLITE_PREDICTIVE_WARMUP_FRESH_MS = 1000 * 60 * 3;
const SATELLITE_WARMUP_MAX_BLOCK_MS = 6500;
const SATELLITE_LOAD_WATCHDOG_MS = 15000;
const SATELLITE_INITIAL_VISUAL_RELEASE_MS = 850;
const SATELLITE_BOOT_CACHE_VISUAL_RELEASE_MS = 260;
const SATELLITE_INITIAL_RENDER_PUMP_MS = 3800;
const SATELLITE_INITIAL_CAMERA_NUDGE_METERS = 1.2;
const SATELLITE_INITIAL_RENDER_PUMP_MS_MOBILE = 6500;
const DESKTOP_RESOLUTION_SCALE = 1.72;
const DESKTOP_ULTRA_RESOLUTION_SCALE = 2.22;
const DESKTOP_MOVING_RESOLUTION_SCALE = 1.18;
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
const DESKTOP_AUTO_MOVE_TO_SETTLE_DELAY_MS = 100;
const DESKTOP_AUTO_MIN_MOVING_VISIBLE_MS = DESKTOP_AUTO_MOVE_TO_SETTLE_DELAY_MS;
const DESKTOP_AUTO_INPUT_INTENT_MS = 920;
const DESKTOP_AUTO_WHEEL_INTENT_MS = 1250;
const DESKTOP_AUTO_SETTLE_RECHECK_DELAY_MS = 180;
const DESKTOP_AUTO_IDLE_HYSTERESIS_MS = 850;
const DESKTOP_AUTO_MOVING_MIN_DWELL_MS = 220;
const DESKTOP_AUTO_SETTLE_MIN_DWELL_MS = 420;
const DESKTOP_AUTO_IDLE_MIN_DWELL_MS = 1200;
const DESKTOP_AUTO_MOTION_CONFIRMATION_SAMPLES = 2;
const DESKTOP_AUTO_SETTLE_POSITION_EPSILON_METERS = 1.8;
const DESKTOP_AUTO_SETTLE_ANGLE_EPSILON_RAD = Cesium.Math.toRadians(0.18);
const DESKTOP_AUTO_SETTLE_HEIGHT_EPSILON_METERS = 24;
const DESKTOP_AUTO_SETTLE_HEIGHT_EPSILON_RATIO = 0.012;
const DESKTOP_AUTO_LOW_ALTITUDE_METERS = 1100;
const DESKTOP_AUTO_STREET_ALTITUDE_METERS = 320;
const DESKTOP_AUTO_HIGH_ALTITUDE_METERS = 2600;
const DESKTOP_AUTO_VERY_HIGH_ALTITUDE_METERS = 7000;
const DESKTOP_AUTO_HIGH_ALTITUDE_MOVING_VISIBLE_MS = 1200;
const DESKTOP_AUTO_VERY_HIGH_ALTITUDE_MOVING_VISIBLE_MS = 1500;
const DESKTOP_AUTO_HIGH_ALTITUDE_WHEEL_INTENT_MS = 1650;
const DESKTOP_AUTO_VERY_HIGH_ALTITUDE_WHEEL_INTENT_MS = 1900;
const DESKTOP_AUTO_HIGH_ALTITUDE_IDLE_RESTORE_MS = 920;
const DESKTOP_AUTO_VERY_HIGH_ALTITUDE_IDLE_RESTORE_MS = 1280;
const DESKTOP_AUTO_HIGH_ALTITUDE_SETTLE_HOLD_MS = 1200;
const DESKTOP_AUTO_VERY_HIGH_ALTITUDE_SETTLE_HOLD_MS = 1600;
const DESKTOP_AUTO_HIGH_ALTITUDE_RECHECK_MS = 220;
const DESKTOP_AUTO_VERY_HIGH_ALTITUDE_RECHECK_MS = 320;
const DESKTOP_AUTO_CINEMATIC_GLOBE_HEIGHT_METERS = 1800000;
const DESKTOP_AUTO_SPACE_BACKDROP_HEIGHT_METERS = 2600000;
const DESKTOP_GLOBE_BACKDROP_SHOW_HEIGHT_METERS = 760000;
const DESKTOP_GLOBE_BACKDROP_HIDE_HEIGHT_METERS = 620000;
const DESKTOP_GLOBE_CLOUDS_SHOW_HEIGHT_METERS = 12000000;
const DESKTOP_GLOBE_CLOUDS_HIDE_HEIGHT_METERS = 11000000;
const DESKTOP_GLOBE_EFFECTS_HIDE_HEIGHT_METERS = 3200000;
const DESKTOP_GLOBE_EFFECTS_FADE_RANGE_METERS = 2200000;
const DESKTOP_GOOGLE_TILESET_HIDE_HEIGHT_METERS = 900000;
const DESKTOP_GOOGLE_TILESET_SHOW_HEIGHT_METERS = 720000;
const GLOBE_CLOUD_MIN_ALPHA = 0.52;
const GLOBE_CLOUD_MAX_ALPHA = 1.0;
const GLOBE_CLOUD_ALPHA_FADE_START_HEIGHT_METERS =
  DESKTOP_GLOBE_CLOUDS_HIDE_HEIGHT_METERS - 3800000;
const GLOBE_CLOUD_TEXTURE_REVEAL_DURATION_MS = 260;
const LOCAL_GLOBE_TEXTURE_WIDTH = 8192;
const LOCAL_GLOBE_TEXTURE_HEIGHT = 4096;
const LOCAL_STARFIELD_URL = "/globe/etoiles.jpg";
const LOCAL_GLOBE_NIGHT_URL = "/globe/terre%20nuit.jpg";
const LOCAL_GLOBE_CLOUDS_URL = "/globe/Nuage%20test.png";
const LOCAL_GLOBE_CLOUDS_ALPHA_URL =
  LOCAL_GLOBE_CLOUDS_URL;
const TRANSPARENT_PIXEL_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const GLOBE_CLOUD_SHELL_ALTITUDE_METERS = 16000;
const GLOBE_CLOUD_SHELL_STACK_PARTITIONS = 96;
const GLOBE_CLOUD_SHELL_SLICE_PARTITIONS = 96;
const GLOBE_CLOUD_ALPHA_FADE_IN_LERP = 0.16;
const GLOBE_CLOUD_ALPHA_FADE_OUT_LERP = 0.24;
const GLOBE_NIGHT_SHELL_ALTITUDE_METERS = 120;
const GLOBE_NIGHT_MIN_ALPHA = 0.34;
const GLOBE_NIGHT_MAX_ALPHA = 0.88;
const GLOBE_ATMOSPHERE_SHELL_ALTITUDE_METERS = 22000;
const GLOBE_ATMOSPHERE_MIN_ALPHA = 0.34;
const GLOBE_ATMOSPHERE_MAX_ALPHA = 0.99;
const GLOBE_ATMOSPHERE_ALPHA_FADE_IN_LERP = 0.14;
const GLOBE_ATMOSPHERE_ALPHA_FADE_OUT_LERP = 0.2;
const GLOBE_EFFECT_ALPHA_EPSILON = 0.002;
const GLOBE_ATMOSPHERE_GLOW_SHELL_ALTITUDE_METERS = 92000;
const GLOBE_ATMOSPHERE_GLOW_MIN_ALPHA = 0.03;
const GLOBE_ATMOSPHERE_GLOW_MAX_ALPHA = 0.22;
const DESKTOP_AUTO_FOG_DISABLE_HEIGHT_METERS = 900000;
const MODE_TRANSITION_MIN_VISIBLE_MS = 240;
const MODE_TRANSITION_VISUAL_FADE_OUT_MS = 180;
const DESKTOP_GOOGLE_OSM_ALPHA = 0.9;
const DESKTOP_OSM_MOVING_RESOLUTION_SCALE = 1.0;
const DESKTOP_OSM_SETTLE_RESOLUTION_SCALE = 1.06;
const DESKTOP_OSM_IDLE_RESOLUTION_SCALE = 1.12;
const DESKTOP_OSM_ULTRA_RESOLUTION_SCALE = 1.18;
const DESKTOP_OSM_MOVING_GLOBE_SSE = 1.8;
const DESKTOP_OSM_SETTLE_GLOBE_SSE = 1.45;
const DESKTOP_OSM_IDLE_GLOBE_SSE = 1.2;
const DESKTOP_OSM_ULTRA_GLOBE_SSE = 0.96;
const MOBILE_QUALITY_RESTORE_DELAY_MS = 180;
const MOBILE_GOOGLE_OSM_ALPHA = 0.78;
const MOBILE_QUALITY_ULTRA_DELAY_MS = 980;
const MOBILE_ULTRA_RESOLUTION_SCALE = 1.08;
const MOBILE_GOOGLE_TILESET_ULTRA_SSE = 6.9;
const MOBILE_GLOBE_SSE_ULTRA = 1.24;
const MOBILE_OSM_MOVING_RESOLUTION_SCALE = 0.72;
const MOBILE_OSM_IDLE_RESOLUTION_SCALE = 0.82;
const MOBILE_OSM_ULTRA_RESOLUTION_SCALE = 0.92;
const MOBILE_OSM_MOVING_GLOBE_SSE = 2.8;
const MOBILE_OSM_IDLE_GLOBE_SSE = 2.1;
const MOBILE_OSM_ULTRA_GLOBE_SSE = 1.7;
const SATELLITE_MOVE_RECOVERY_DELAY_MS = 1600;
const ADAPTIVE_QUALITY_SAMPLE_WINDOW_MS = 1450;
const ADAPTIVE_QUALITY_DROP_FRAME_MS = 34;
const ADAPTIVE_QUALITY_DROP_STREAK_LIMIT = 7;
const ADAPTIVE_QUALITY_AUTO_DROP_FRAME_MS = 42;
const ADAPTIVE_QUALITY_AUTO_SEVERE_FRAME_MS = 72;
const ADAPTIVE_QUALITY_AUTO_DROP_STREAK_LIMIT = 4;
const ADAPTIVE_QUALITY_AUTO_FRAME_RECOVERY_MS = 1200;
const ADAPTIVE_QUALITY_AUTO_LONG_TASK_RECOVERY_MS = 2200;
const ADAPTIVE_QUALITY_AUTO_TILE_RECOVERY_MS = 650;
const ADAPTIVE_QUALITY_AUTO_RECOVERY_RECHECK_MS = 120;
const ADAPTIVE_QUALITY_AUTO_TILE_BUSY_THRESHOLD = 24;
const ADAPTIVE_QUALITY_AUTO_DROP_MIN_INTERVAL_MS = 420;
const ADAPTIVE_QUALITY_AUTO_SLOW_AVG_FRAME_MS = 24;
const DESKTOP_AUTO_CRUISE_MOVING_RESOLUTION_SCALE_BIAS = 0.04;
const DESKTOP_AUTO_CRUISE_MOVING_GLOBE_SSE_MULTIPLIER = 1.45;
const DESKTOP_AUTO_CRUISE_MOVING_TILESET_SSE_MULTIPLIER = 1.8;
const DESKTOP_AUTO_DEFENSIVE_MOVING_RESOLUTION_SCALE = 1.08;
const DESKTOP_AUTO_DEFENSIVE_MOVING_GLOBE_SSE = 2.1;
const DESKTOP_AUTO_DEFENSIVE_MOVING_TILESET_SSE = 14;
const DESKTOP_AUTO_DEFENSIVE_MOVING_MSAA_SAMPLES = 2;
const FPS_BENCHMARK_HOT_PATH_MIN_DURATION_MS = 12;
const FPS_BENCHMARK_HOT_PATH_COOLDOWN_MS = 180;
const FPS_BENCHMARK_HOT_PATH_CAPTURE_LIMIT = 18;
const ADAPTIVE_QUALITY_RAISE_FPS_MOBILE = 52;
const ADAPTIVE_QUALITY_RAISE_FPS_DESKTOP = 57;
const MOBILE_QUALITY_PROFILE_DEFAULT = "auto";
const MOBILE_QUALITY_PROFILE_VALUES = ["auto", "high", "ultra", "perf"];
const DESKTOP_QUALITY_PROFILE_DEFAULT = "auto";
const DESKTOP_QUALITY_PROFILE_VALUES = ["auto", "high", "ultra", "perf"];
const DESKTOP_QUALITY_PROFILE_CONFIG = {
  auto: {
    // Auto should stay visually crisp like Google Earth Web and let Cesium
    // refine scene detail progressively instead of visibly dropping canvas
    // resolution between motion states.
    movingResolutionScale: 1.14,
    movingGlobeSse: 2.35,
    movingTilesetSse: 14.5,
    movingMsaa: 2,
    settleResolutionScale: 1.16,
    settleGlobeSse: 0.88,
    settleTilesetSse: 3.2,
    settleMsaa: 4,
    idleResolutionScale: 1.24,
    idleGlobeSse: 0.64,
    idleTilesetSse: 1.45,
    idleMsaa: 4,
    ultraResolutionScaleCap: 2.46,
    ultraGlobeSse: 0.3,
    ultraTilesetSse: 0.68,
    ultraMsaa: DESKTOP_ULTRA_MSAA_SAMPLES,
    fastTilesetSse: 5.2,
    premiumTilesetSse: 1.5,
    adaptiveRaiseFps: 42,
    idleRestoreDelayMs: 460,
    settleHoldMs: 180,
    ultraRestoreDelayMs: 360,
    idleAllowOverdrive: true,
    ultraAllowOverdrive: true,
    enableUltra: false,
  },
  high: {
    movingResolutionScale: 1.42,
    movingGlobeSse: 0.76,
    movingTilesetSse: 3.2,
    movingMsaa: 8,
    idleResolutionScale: 1.82,
    idleGlobeSse: 0.42,
    idleTilesetSse: 1.45,
    idleMsaa: 8,
    ultraResolutionScaleCap: 2.0,
    ultraGlobeSse: 0.28,
    ultraTilesetSse: 0.95,
    ultraMsaa: 8,
    fastTilesetSse: 2.1,
    premiumTilesetSse: 1.15,
    adaptiveRaiseFps: 18,
    idleRestoreDelayMs: 50,
    ultraRestoreDelayMs: 90,
    enableUltra: true,
  },
  ultra: {
    movingResolutionScale: 1.54,
    movingGlobeSse: 0.62,
    movingTilesetSse: 2.4,
    movingMsaa: 8,
    idleResolutionScale: 1.96,
    idleGlobeSse: 0.34,
    idleTilesetSse: 1.08,
    idleMsaa: 8,
    ultraResolutionScaleCap: 2.15,
    ultraGlobeSse: 0.22,
    ultraTilesetSse: 0.72,
    ultraMsaa: 8,
    fastTilesetSse: 1.7,
    premiumTilesetSse: 0.95,
    adaptiveRaiseFps: 14,
    idleRestoreDelayMs: 40,
    ultraRestoreDelayMs: 70,
    enableUltra: true,
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
    enableUltra: false,
  },
};
const MOBILE_QUALITY_PROFILE_CONFIG = {
  auto: {
    // Mobile auto mirrors the desktop strategy: stay light while the finger
    // moves, then refine quickly after release without forcing ultra blindly.
    movingResolutionScale: 0.76,
    movingGlobeSse: 2.7,
    movingTilesetSse: 26,
    idleResolutionScale: 0.98,
    idleGlobeSse: 1.32,
    idleTilesetSse: 7.2,
    ultraResolutionScaleCap: 1.14,
    ultraGlobeSse: 0.98,
    ultraTilesetSse: 4.9,
    fastTilesetSse: 14,
    premiumTilesetSse: 7.6,
    enableUltra: true,
    adaptiveRaiseFps: 54,
    idleRestoreDelayMs: 120,
    ultraRestoreDelayMs: 760,
  },
  high: {
    movingResolutionScale: 0.86,
    movingGlobeSse: 2.05,
    movingTilesetSse: 16,
    idleResolutionScale: 1.12,
    idleGlobeSse: 1.05,
    idleTilesetSse: 5.8,
    ultraResolutionScaleCap: 1.28,
    ultraGlobeSse: 0.82,
    ultraTilesetSse: 3.8,
    fastTilesetSse: 9.8,
    premiumTilesetSse: 6.0,
    enableUltra: true,
    adaptiveRaiseFps: 48,
    idleRestoreDelayMs: 110,
    ultraRestoreDelayMs: 560,
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
const DEFAULT_SCENE_BACKGROUND_COLOR = Cesium.Color.fromCssColorString("#dbeafe");
const CINEMATIC_SCENE_BACKGROUND_COLOR = Cesium.Color.BLACK;
const DEFAULT_SCENE_BLOOM_CONTRAST = 128;
const CINEMATIC_SCENE_BLOOM_CONTRAST = 210;
const DEFAULT_SCENE_BLOOM_BRIGHTNESS = -0.3;
const CINEMATIC_SCENE_BLOOM_BRIGHTNESS = -0.12;
const DEFAULT_SCENE_EXPOSURE = 1.0;
const CINEMATIC_SCENE_EXPOSURE = 1.1;
const DEFAULT_SCENE_SHADOW_MAP_SIZE = 2048;
const CINEMATIC_SCENE_SHADOW_MAP_SIZE = 4096;
const DEFAULT_SCENE_SHADOW_DISTANCE = 5000;
const CINEMATIC_SCENE_SHADOW_DISTANCE = 12000;
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
const SATELLITE_BOOT_CACHE_STORAGE_KEY = "immo3d_satellite_boot_cache_v1";
const SATELLITE_BOOT_CACHE_TTL_MS = 1000 * 60 * 60 * 18;
const SATELLITE_BOOT_CACHE_FALLBACK_ZONE_KEY = "__global__";
const SATELLITE_BOOT_SNAPSHOT_MAX_LENGTH = 1_450_000;
const SATELLITE_BOOT_SNAPSHOT_EXPORT_MAX_WIDTH = 1280;
const SATELLITE_BOOT_SNAPSHOT_EXPORT_QUALITY = 0.54;
const SATELLITE_BOOT_CACHE_PERSIST_DELAY_MS = 420;
const SATELLITE_ZONE_LIMIT_PADDING_DEGREES = 0.002;
let markerPhotoMimeTypeCache = null;
let processedGlobalCloudTexturePromise = null;
let processedGlobalNightTexturePromise = null;
const MARKER_LABEL_SCALE_BY_DISTANCE = new Cesium.NearFarScalar(
  1200,
  1.18,
  30000,
  0.6
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
const FPS_BENCHMARK_COLD_STABILIZE_WINDOW_MS = 1000;
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

function getViewerCameraSafely(viewer) {
  if (!viewer || typeof viewer !== "object") return null;
  try {
    if (viewer.isDestroyed?.()) return null;
  } catch {
    return null;
  }
  try {
    return viewer.camera || null;
  } catch {
    return null;
  }
}

function getViewerSceneSafely(viewer) {
  if (!viewer || typeof viewer !== "object") return null;
  try {
    if (viewer.isDestroyed?.()) return null;
  } catch {
    return null;
  }
  try {
    return viewer.scene || null;
  } catch {
    return null;
  }
}

function getViewerImageryLayersSafely(viewer) {
  if (!viewer || typeof viewer !== "object") return null;
  try {
    if (viewer.isDestroyed?.()) return null;
  } catch {
    return null;
  }
  try {
    return viewer.imageryLayers || null;
  } catch {
    return null;
  }
}

function getViewerShadowMapSafely(viewer) {
  if (!viewer || typeof viewer !== "object") return null;
  try {
    if (viewer.isDestroyed?.()) return null;
  } catch {
    return null;
  }
  try {
    return viewer.shadowMap || null;
  } catch {
    return null;
  }
}

function requestViewerRender(viewer) {
  const scene = getViewerSceneSafely(viewer);
  if (!scene || typeof scene.requestRender !== "function") return false;
  try {
    scene.requestRender();
    return true;
  } catch {
    return false;
  }
}

function setViewerTerrainProviderSafely(viewer, terrainProvider) {
  if (!viewer || typeof viewer !== "object") return false;
  try {
    if (viewer.isDestroyed?.()) return false;
    viewer.terrainProvider = terrainProvider;
    return true;
  } catch {
    return false;
  }
}

function captureCamera(viewer) {
  const camera = getViewerCameraSafely(viewer);
  if (!camera) return null;
  return {
    destination: Cesium.Cartesian3.clone(camera.position),
    heading: camera.heading,
    pitch: camera.pitch,
    roll: camera.roll,
  };
}

function restoreCamera(viewer, cameraState) {
  if (!cameraState) return;
  const camera = getViewerCameraSafely(viewer);
  if (!camera) return;

  try {
    camera.setView({
      destination: cameraState.destination,
      orientation: {
        heading: cameraState.heading,
        pitch: cameraState.pitch,
        roll: cameraState.roll,
      },
    });
  } catch {
    // Ignore transient Cesium viewer states during startup/shutdown.
  }
}

function refreshViewer(viewer) {
  if (!viewer) return;
  try {
    if (viewer.isDestroyed?.()) return;
  } catch {
    return;
  }

  const cameraState = captureCamera(viewer);
  try {
    viewer.resize();
  } catch {
    return;
  }
  restoreCamera(viewer, cameraState);
  requestViewerRender(viewer);
}

function isUsableCesiumViewer(viewer) {
  return Boolean(getViewerCameraSafely(viewer) && getViewerSceneSafely(viewer));
}

function captureQualityCameraSnapshot(viewer) {
  if (!isUsableCesiumViewer(viewer)) return null;
  return {
    position: Cesium.Cartesian3.clone(viewer.camera.position),
    height: getCameraHeight(viewer),
    heading: Number(viewer.camera.heading) || 0,
    pitch: Number(viewer.camera.pitch) || Cesium.Math.toRadians(-90),
    roll: Number(viewer.camera.roll) || 0,
  };
}

function getDesktopAutoStabilityProfile(viewerOrSnapshot = null) {
  const baseProfile = DESKTOP_QUALITY_PROFILE_CONFIG.auto;
  const snapshotHeight = Number(viewerOrSnapshot?.height);
  const cameraHeight = Number.isFinite(snapshotHeight)
    ? snapshotHeight
    : viewerOrSnapshot?.camera || viewerOrSnapshot?.position
    ? getCameraHeight(viewerOrSnapshot)
    : null;

  const baseConfig = {
    movingVisibleMs: DESKTOP_AUTO_MIN_MOVING_VISIBLE_MS,
    wheelIntentMs: DESKTOP_AUTO_WHEEL_INTENT_MS,
    idleRestoreDelayMs: baseProfile.idleRestoreDelayMs,
    settleHoldMs: baseProfile.settleHoldMs,
    settleRecheckDelayMs: DESKTOP_AUTO_SETTLE_RECHECK_DELAY_MS,
  };

  if (!Number.isFinite(cameraHeight)) {
    return baseConfig;
  }

  if (cameraHeight >= DESKTOP_AUTO_VERY_HIGH_ALTITUDE_METERS) {
    return {
      movingVisibleMs: DESKTOP_AUTO_VERY_HIGH_ALTITUDE_MOVING_VISIBLE_MS,
      wheelIntentMs: DESKTOP_AUTO_VERY_HIGH_ALTITUDE_WHEEL_INTENT_MS,
      idleRestoreDelayMs: Math.max(
        baseConfig.idleRestoreDelayMs,
        DESKTOP_AUTO_VERY_HIGH_ALTITUDE_IDLE_RESTORE_MS
      ),
      settleHoldMs: Math.max(
        baseConfig.settleHoldMs,
        DESKTOP_AUTO_VERY_HIGH_ALTITUDE_SETTLE_HOLD_MS
      ),
      settleRecheckDelayMs: Math.max(
        baseConfig.settleRecheckDelayMs,
        DESKTOP_AUTO_VERY_HIGH_ALTITUDE_RECHECK_MS
      ),
    };
  }

  if (cameraHeight >= DESKTOP_AUTO_HIGH_ALTITUDE_METERS) {
    return {
      movingVisibleMs: DESKTOP_AUTO_HIGH_ALTITUDE_MOVING_VISIBLE_MS,
      wheelIntentMs: DESKTOP_AUTO_HIGH_ALTITUDE_WHEEL_INTENT_MS,
      idleRestoreDelayMs: Math.max(
        baseConfig.idleRestoreDelayMs,
        DESKTOP_AUTO_HIGH_ALTITUDE_IDLE_RESTORE_MS
      ),
      settleHoldMs: Math.max(
        baseConfig.settleHoldMs,
        DESKTOP_AUTO_HIGH_ALTITUDE_SETTLE_HOLD_MS
      ),
      settleRecheckDelayMs: Math.max(
        baseConfig.settleRecheckDelayMs,
        DESKTOP_AUTO_HIGH_ALTITUDE_RECHECK_MS
      ),
    };
  }

  return baseConfig;
}

function getDesktopAutoQualityProfile(viewerOrSnapshot = null) {
  const baseProfile = DESKTOP_QUALITY_PROFILE_CONFIG.auto;
  const snapshotHeight = Number(viewerOrSnapshot?.height);
  const cameraHeight = Number.isFinite(snapshotHeight)
    ? snapshotHeight
    : viewerOrSnapshot?.camera || viewerOrSnapshot?.position
    ? getCameraHeight(viewerOrSnapshot)
    : null;

  const baseConfig = {
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
    idleAllowOverdrive: Boolean(baseProfile.idleAllowOverdrive),
    ultraAllowOverdrive: Boolean(baseProfile.ultraAllowOverdrive),
    enableUltra: Boolean(baseProfile.enableUltra),
  };

  if (!Number.isFinite(cameraHeight)) {
    return baseConfig;
  }

  if (cameraHeight <= DESKTOP_AUTO_STREET_ALTITUDE_METERS) {
    return {
      ...baseConfig,
      settleResolutionScale: 1.18,
      settleGlobeSse: 0.62,
      settleTilesetSse: 1.35,
      settleMsaa: 4,
      idleResolutionScale: 1.28,
      idleGlobeSse: 0.36,
      idleTilesetSse: 0.68,
      idleMsaa: 4,
      idleRestoreDelayMs: Math.max(baseConfig.idleRestoreDelayMs, 240),
      settleHoldMs: Math.max(baseConfig.settleHoldMs, 160),
    };
  }

  if (cameraHeight <= DESKTOP_AUTO_LOW_ALTITUDE_METERS) {
    return {
      ...baseConfig,
      settleResolutionScale: 1.14,
      settleGlobeSse: 0.68,
      settleTilesetSse: 1.8,
      settleMsaa: 4,
      idleResolutionScale: 1.22,
      idleGlobeSse: 0.46,
      idleTilesetSse: 1.0,
      idleMsaa: 4,
      idleRestoreDelayMs: Math.max(baseConfig.idleRestoreDelayMs, 230),
      settleHoldMs: Math.max(baseConfig.settleHoldMs, 130),
    };
  }

  return baseConfig;
}

function isDesktopAutoCloseDetailHeight(cameraHeight) {
  return Number.isFinite(cameraHeight) && cameraHeight <= DESKTOP_AUTO_LOW_ALTITUDE_METERS;
}

function isDesktopAutoStreetDetailHeight(cameraHeight) {
  return Number.isFinite(cameraHeight) && cameraHeight <= DESKTOP_AUTO_STREET_ALTITUDE_METERS;
}

function getDesktopGoogle3dOverlayAlpha(
  viewerOrSnapshot = null,
  qualityProfileId = DESKTOP_QUALITY_PROFILE_DEFAULT
) {
  void viewerOrSnapshot;
  void qualityProfileId;
  return 0;
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
  const previousHeight = Math.max(0, Number(previousSnapshot.height) || 0);
  const nextHeight = Math.max(0, Number(nextSnapshot.height) || 0);
  const heightDeltaMeters = Math.abs(previousHeight - nextHeight);
  const maxHeightDeltaMeters = Math.max(
    DESKTOP_AUTO_SETTLE_HEIGHT_EPSILON_METERS,
    Math.max(previousHeight, nextHeight) * DESKTOP_AUTO_SETTLE_HEIGHT_EPSILON_RATIO
  );
  if (heightDeltaMeters > maxHeightDeltaMeters) return false;
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

function isPrivateOrLocalHostname(hostname) {
  const normalizedHostname = String(hostname || "").trim().toLowerCase();
  if (!normalizedHostname) return false;
  if (
    normalizedHostname === "localhost" ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname === "::1"
  ) {
    return true;
  }
  return (
    normalizedHostname.startsWith("192.168.") ||
    normalizedHostname.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalizedHostname)
  );
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
      normalized !== "perf" && baseProfile.enableUltra && allowUltraFromDevice
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
    idleAllowOverdrive: Boolean(baseProfile.idleAllowOverdrive),
    ultraAllowOverdrive: Boolean(baseProfile.ultraAllowOverdrive),
    enableUltra: Boolean(baseProfile.enableUltra),
  };
}

function getPreferredResolutionScale(isMobile, isIOSDevice = false) {
  if (isIOSDevice) return IOS_RESOLUTION_SCALE;
  if (isMobile) return MOBILE_RESOLUTION_SCALE;
  if (typeof window === "undefined") return DESKTOP_RESOLUTION_SCALE;
  const devicePixelRatio = Number(window.devicePixelRatio) || 1;
  const qualityScale = Math.max(
    1.48,
    Math.min(DESKTOP_RESOLUTION_SCALE, devicePixelRatio * 1.38)
  );
  return qualityScale;
}

function getUltraResolutionScale(isIOSDevice = false) {
  if (isIOSDevice) return IOS_RESOLUTION_SCALE;
  if (typeof window === "undefined") return DESKTOP_ULTRA_RESOLUTION_SCALE;
  const devicePixelRatio = Number(window.devicePixelRatio) || 1;
  return Math.max(
    DESKTOP_RESOLUTION_SCALE,
    Math.min(DESKTOP_ULTRA_RESOLUTION_SCALE, devicePixelRatio * 2)
  );
}

function getDesktopProfileResolutionScale(
  targetScale,
  fallbackScale = DESKTOP_RESOLUTION_SCALE,
  allowOverdrive = false
) {
  const safeTarget = Number(targetScale);
  if (!Number.isFinite(safeTarget) || safeTarget <= 0) return fallbackScale;
  if (typeof window === "undefined") return safeTarget;
  const devicePixelRatio = Number(window.devicePixelRatio) || 1;
  const hardCap = allowOverdrive
    ? Math.max(2.35, devicePixelRatio * 2.8)
    : Math.max(1.55, devicePixelRatio * 1.6);
  return Math.max(1, Math.min(safeTarget, hardCap));
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
  const stabilizedStats =
    entry?.stabilizedStats &&
    Number.isFinite(Number(entry.stabilizedStats.avgFps))
      ? {
          sampleCount: Math.max(0, Number(entry.stabilizedStats.sampleCount || 0)),
          durationMs: Math.max(0, Number(entry.stabilizedStats.durationMs || 0)),
          avgFps: roundBenchmarkValue(Number(entry.stabilizedStats.avgFps)),
          minFps: roundBenchmarkValue(Number(entry.stabilizedStats.minFps)),
          avgFrameMs: roundBenchmarkValue(Number(entry.stabilizedStats.avgFrameMs)),
          p95FrameMs: roundBenchmarkValue(Number(entry.stabilizedStats.p95FrameMs)),
          maxFrameMs: roundBenchmarkValue(Number(entry.stabilizedStats.maxFrameMs)),
        }
      : null;
  return {
    ranAt: String(entry.ranAt || ""),
    avgFps: roundBenchmarkValue(Number(entry.avgFps)),
    minFps: roundBenchmarkValue(Number(entry.minFps)),
    avgFrameMs: roundBenchmarkValue(Number(entry.avgFrameMs)),
    p95FrameMs: roundBenchmarkValue(Number(entry.p95FrameMs)),
    maxFrameMs: roundBenchmarkValue(Number(entry.maxFrameMs)),
    longTaskCount: Math.max(0, Number(entry.longTaskCount || 0)),
    maxLongTaskMs: roundBenchmarkValue(Number(entry.maxLongTaskMs)),
    hotPathCount: Math.max(0, Number(entry.hotPathCount || 0)),
    maxHotPathMs: roundBenchmarkValue(Number(entry.maxHotPathMs)),
    qualityProfile: String(entry.qualityProfile || ""),
    runKind,
    coldStart: Boolean(entry.coldStart),
    distanceMeters: Math.max(0, Number(entry.distanceMeters || 0)),
    routeKind: String(entry.routeKind || ""),
    stabilizedWindowMs: Math.max(
      0,
      Number(entry.stabilizedWindowMs || FPS_BENCHMARK_COLD_STABILIZE_WINDOW_MS)
    ),
    stabilizedStats,
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
        handler: event?.handler ? String(event.handler) : null,
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
        cameraHeight: roundBenchmarkValue(Number(event?.cameraHeight), 1),
        branch: event?.branch ? String(event.branch) : null,
        detail: event?.detail ? String(event.detail) : null,
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

  const stabilizedFrameSamples = safeFrameSamples.filter(
    (sample) =>
      Number.isFinite(Number(sample?.elapsedMs)) &&
      Number(sample.elapsedMs) >= FPS_BENCHMARK_COLD_STABILIZE_WINDOW_MS
  );
  const shouldIncludeStabilizedStats =
    String(extra?.runKind || "").toLowerCase() === "cold";
  const stabilizedFrameStats =
    shouldIncludeStabilizedStats && stabilizedFrameSamples.length > 0
      ? buildBenchmarkFrameStats(
          stabilizedFrameSamples.map((sample) => Number(sample.frameMs))
        )
      : null;

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
    stabilizedWindowMs: FPS_BENCHMARK_COLD_STABILIZE_WINDOW_MS,
    stabilizedStats: stabilizedFrameStats,
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

function formatFpsBenchmarkStabilizedSummary(result) {
  const stabilizedStats = result?.stabilizedStats;
  if (!stabilizedStats || !Number.isFinite(stabilizedStats.avgFps)) return "";
  const parts = [
    `stable avg ${stabilizedStats.avgFps} fps`,
    Number.isFinite(stabilizedStats.p95FrameMs)
      ? `stable p95 ${stabilizedStats.p95FrameMs} ms`
      : null,
    Number.isFinite(stabilizedStats.maxFrameMs)
      ? `stable max ${stabilizedStats.maxFrameMs} ms`
      : null,
  ].filter(Boolean);
  return parts.join(" | ");
}

function formatFpsBenchmarkSummaryDisplay(result) {
  const baseSummary = formatFpsBenchmarkSummary(result);
  if (!baseSummary) return "";
  const normalizedSummary = baseSummary
    .split(" Â· ")
    .join(" | ")
    .split(" · ")
    .join(" | ");
  const stabilizedSummary =
    result?.runKind === "cold" ? formatFpsBenchmarkStabilizedSummary(result) : "";
  return `${
    result.runKind === "cold" ? "cold" : "warm"
  } | ${normalizedSummary}${stabilizedSummary ? ` | ${stabilizedSummary}` : ""}`;
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

async function copyTextToClipboardWithFallback(text) {
  const safeText = String(text ?? "");
  if (!safeText) return false;

  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(safeText);
      return true;
    } catch {
      // Fallback below when Clipboard API is blocked on local HTTP.
    }
  }

  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = safeText;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, safeText.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

function normalizeSatelliteBootCacheZoneKey(zoneCacheKey) {
  const trimmed = String(zoneCacheKey || "")
    .trim()
    .toLowerCase();
  return trimmed || SATELLITE_BOOT_CACHE_FALLBACK_ZONE_KEY;
}

function isSatelliteBootSnapshotDataUrl(snapshotDataUrl) {
  return (
    typeof snapshotDataUrl === "string" &&
    snapshotDataUrl.startsWith("data:image/")
  );
}

function readSatelliteBootCache(zoneCacheKey) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SATELLITE_BOOT_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const updatedAt = Number(parsed.updatedAt) || 0;
    if (
      updatedAt <= 0 ||
      Date.now() - updatedAt > SATELLITE_BOOT_CACHE_TTL_MS
    ) {
      return null;
    }

    const expectedZoneKey = normalizeSatelliteBootCacheZoneKey(zoneCacheKey);
    const storedZoneKey = normalizeSatelliteBootCacheZoneKey(parsed.zoneKey);
    if (expectedZoneKey !== storedZoneKey) return null;

    const snapshotDataUrl = isSatelliteBootSnapshotDataUrl(parsed.snapshotDataUrl)
      ? parsed.snapshotDataUrl
      : "";
    const camera = isSerializableCameraStateValid(parsed.camera)
      ? sanitizeSerializableCameraState(parsed.camera)
      : null;

    if (!snapshotDataUrl && !camera) return null;

    return {
      zoneKey: storedZoneKey,
      snapshotDataUrl,
      camera,
      updatedAt,
    };
  } catch {
    return null;
  }
}

function writeSatelliteBootCache(zoneCacheKey, nextEntry) {
  if (typeof window === "undefined") return;
  try {
    const normalizedZoneKey = normalizeSatelliteBootCacheZoneKey(zoneCacheKey);
    const snapshotDataUrl = isSatelliteBootSnapshotDataUrl(
      nextEntry?.snapshotDataUrl
    )
      ? nextEntry.snapshotDataUrl
      : "";
    const safeSnapshotDataUrl =
      snapshotDataUrl.length <= SATELLITE_BOOT_SNAPSHOT_MAX_LENGTH
        ? snapshotDataUrl
        : "";
    const camera = isSerializableCameraStateValid(nextEntry?.camera)
      ? sanitizeSerializableCameraState(nextEntry.camera)
      : null;

    if (!safeSnapshotDataUrl && !camera) return;

    window.localStorage.setItem(
      SATELLITE_BOOT_CACHE_STORAGE_KEY,
      JSON.stringify({
        zoneKey: normalizedZoneKey,
        updatedAt: Date.now(),
        snapshotDataUrl: safeSnapshotDataUrl,
        camera,
      })
    );
  } catch {
    // Ignore storage/runtime issues.
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
  const code = String(error?.code || error?.diagnostic?.code || "");
  const rawMessage = [
    error?.message,
    error?.cause?.message,
    error?.diagnostic?.message,
    error?.diagnostic?.detail,
  ]
    .filter(Boolean)
    .join(" | ")
    .toLowerCase();

  if (
    code === "GOOGLE_TILESET_TIMEOUT" ||
    rawMessage.includes("timeout") ||
    rawMessage.includes("timed out")
  ) {
    return "Vue satellite indisponible: chargement trop long. Retour en vue plan.";
  }

  if (
    code === "CESIUM_ION_UNAUTHORIZED" ||
    code === "CESIUM_ION_FORBIDDEN" ||
    rawMessage.includes("401") ||
    rawMessage.includes("403") ||
    rawMessage.includes("unauthorized") ||
    rawMessage.includes("forbidden") ||
    rawMessage.includes("not authorized") ||
    rawMessage.includes("not allowed")
  ) {
    return "Vue satellite indisponible: token Cesium non autorise pour ce domaine.";
  }

  if (
    code === "CESIUM_ION_QUOTA" ||
    rawMessage.includes("429") ||
    rawMessage.includes("quota") ||
    rawMessage.includes("limit") ||
    rawMessage.includes("too many requests") ||
    rawMessage.includes("exceeded")
  ) {
    return "Vue satellite indisponible: quota Cesium/Google 3D atteint pour ce token.";
  }

  if (
    code === "CESIUM_ION_NETWORK" ||
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

function applyViewerRenderStrategyForMode(viewer, activeMode, isMobile) {
  const scene = getViewerSceneSafely(viewer);
  if (!scene) return;
  const useDemandRendering = !isMobile && activeMode !== "google3d";
  scene.requestRenderMode = useDemandRendering;
  scene.maximumRenderTimeChange = useDemandRendering
    ? Number.POSITIVE_INFINITY
    : 0;
  requestViewerRender(viewer);
}

function loadProcessedGlobalCloudTextureAsync() {
  if (processedGlobalCloudTexturePromise) {
    return processedGlobalCloudTexturePromise;
  }

  if (typeof window === "undefined") {
    return Promise.resolve(LOCAL_GLOBE_CLOUDS_ALPHA_URL);
  }

  processedGlobalCloudTexturePromise = new Promise((resolve, reject) => {
    const image = new window.Image();
    let settled = false;

    const finalize = (resolver, value) => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      resolver(value);
    };

    image.decoding = "async";
    image.onload = () => finalize(resolve, image);
    image.onerror = () =>
      finalize(
        reject,
        new Error("Impossible de charger la texture de nuages globale.")
      );
    image.src = LOCAL_GLOBE_CLOUDS_ALPHA_URL;

    if (image.complete && Number(image.naturalWidth) > 0) {
      finalize(resolve, image);
    }
  });

  return processedGlobalCloudTexturePromise;
}

function loadProcessedGlobalNightTextureAsync() {
  if (processedGlobalNightTexturePromise) {
    return processedGlobalNightTexturePromise;
  }

  processedGlobalNightTexturePromise = new Promise((resolve) => {
    if (typeof Image === "undefined") {
      resolve(LOCAL_GLOBE_NIGHT_URL);
      return;
    }

    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(LOCAL_GLOBE_NIGHT_URL);
    image.src = LOCAL_GLOBE_NIGHT_URL;
  });
  return processedGlobalNightTexturePromise;
}

function updateBaseImageryLayersForViewer(
  viewer,
  osmLayer,
  google3dBaseLayer,
  activeMode
) {
  if (!viewer) return;
  const imageryLayers = getViewerImageryLayersSafely(viewer);

  const isGoogle3dMode = activeMode === "google3d";

  if (imageryLayers) {
    for (let index = 0; index < imageryLayers.length; index += 1) {
      const layer = imageryLayers.get(index);
      if (!layer) continue;

      if (layer === osmLayer) {
        const shouldShowOsm = !isGoogle3dMode;
        layer.show = shouldShowOsm;
        layer.alpha = shouldShowOsm ? 1 : 0;
        continue;
      }

      layer.show = false;
      layer.alpha = 0;
    }
    return;
  }

  if (osmLayer) {
    const shouldShowOsm = !isGoogle3dMode;
    osmLayer.show = shouldShowOsm;
    osmLayer.alpha = shouldShowOsm ? 1 : 0;
  }

  if (google3dBaseLayer) {
    google3dBaseLayer.show = false;
    google3dBaseLayer.alpha = 0;
  }
}

function updateCesiumGlobeVisibilityForMode(viewer, activeMode) {
  void activeMode;
  const scene = getViewerSceneSafely(viewer);
  if (!scene?.globe) return;
  scene.globe.show = true;
}

function smoothBackdropEffectAlpha(
  previousAlpha,
  targetAlpha,
  fadeInLerp,
  fadeOutLerp
) {
  const safePreviousAlpha = Number.isFinite(previousAlpha) ? previousAlpha : 0;
  const safeTargetAlpha = Number.isFinite(targetAlpha) ? targetAlpha : 0;
  const delta = safeTargetAlpha - safePreviousAlpha;
  if (Math.abs(delta) <= GLOBE_EFFECT_ALPHA_EPSILON) {
    return safeTargetAlpha;
  }
  const lerpFactor = delta > 0 ? fadeInLerp : fadeOutLerp;
  return Cesium.Math.lerp(
    safePreviousAlpha,
    safeTargetAlpha,
    Cesium.Math.clamp(lerpFactor, 0.01, 1)
  );
}

function createGlobalCloudLayerForViewer(viewer, isMobile) {
  if (!viewer || viewer.isDestroyed?.() || isMobile) return null;
  const cloudMaterial = Cesium.Material.fromType(Cesium.Material.ImageType, {
    image: TRANSPARENT_PIXEL_DATA_URL,
    repeat: new Cesium.Cartesian2(1, 1),
    color: Cesium.Color.WHITE.withAlpha(0),
  });
  const cloudLayer = {
    alpha: 0,
    lastAlpha: 0,
    material: cloudMaterial,
    primitive: null,
    textureReady: false,
    textureRevealStartedAt: null,
  };
  const ellipsoidRadii = new Cesium.Cartesian3(
    Cesium.Ellipsoid.WGS84.radii.x + GLOBE_CLOUD_SHELL_ALTITUDE_METERS,
    Cesium.Ellipsoid.WGS84.radii.y + GLOBE_CLOUD_SHELL_ALTITUDE_METERS,
    Cesium.Ellipsoid.WGS84.radii.z + GLOBE_CLOUD_SHELL_ALTITUDE_METERS
  );
  cloudLayer.primitive = viewer.scene.primitives.add(
    new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({
        geometry: new Cesium.EllipsoidGeometry({
          radii: ellipsoidRadii,
          stackPartitions: GLOBE_CLOUD_SHELL_STACK_PARTITIONS,
          slicePartitions: GLOBE_CLOUD_SHELL_SLICE_PARTITIONS,
          vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
        }),
      }),
      appearance: new Cesium.EllipsoidSurfaceAppearance({
        material: cloudMaterial,
        translucent: true,
        aboveGround: false,
        flat: true,
        faceForward: true,
        renderState: {
          depthTest: {
            enabled: false,
          },
          depthMask: false,
          blending: Cesium.BlendingState.ALPHA_BLEND,
        },
      }),
      asynchronous: false,
      allowPicking: false,
      show: false,
    })
  );
  viewer.scene.primitives.raiseToTop?.(cloudLayer.primitive);

  loadProcessedGlobalCloudTextureAsync()
    .then((cloudUrl) => {
      if (!viewer || viewer.isDestroyed?.() || !cloudLayer.material) return;
      cloudLayer.material.uniforms.image = cloudUrl;
      viewer.scene.requestRender?.();

      const finalizeTextureReveal = () => {
        if (!viewer || viewer.isDestroyed?.() || !cloudLayer.material) return;
        cloudLayer.textureReady = true;
        cloudLayer.textureRevealStartedAt =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        viewer.scene.primitives.raiseToTop?.(cloudLayer.primitive);
        viewer.scene.requestRender?.();
      };

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          finalizeTextureReveal();
        });
      });
    })
    .catch((error) => {
      console.warn("Impossible de creer la couche de nuages globale.", error);
    });
  return cloudLayer;
}

function createGlobalNightLayerForViewer(viewer, isMobile) {
  if (!viewer || viewer.isDestroyed?.() || isMobile) return null;
  const nightMaterial = Cesium.Material.fromType(Cesium.Material.ImageType, {
    image: TRANSPARENT_PIXEL_DATA_URL,
    repeat: new Cesium.Cartesian2(1, 1),
    color: Cesium.Color.WHITE.withAlpha(0),
  });
  const nightLayer = {
    alpha: 0,
    lastAlpha: 0,
    material: nightMaterial,
    primitive: null,
    textureReady: false,
  };
  const ellipsoidRadii = new Cesium.Cartesian3(
    Cesium.Ellipsoid.WGS84.radii.x + GLOBE_NIGHT_SHELL_ALTITUDE_METERS,
    Cesium.Ellipsoid.WGS84.radii.y + GLOBE_NIGHT_SHELL_ALTITUDE_METERS,
    Cesium.Ellipsoid.WGS84.radii.z + GLOBE_NIGHT_SHELL_ALTITUDE_METERS
  );
  nightLayer.primitive = viewer.scene.primitives.add(
    new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({
        geometry: new Cesium.EllipsoidGeometry({
          radii: ellipsoidRadii,
          stackPartitions: 96,
          slicePartitions: 96,
          vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
        }),
      }),
      appearance: new Cesium.EllipsoidSurfaceAppearance({
        material: nightMaterial,
        translucent: true,
        aboveGround: false,
        flat: true,
        faceForward: true,
        renderState: {
          depthTest: {
            enabled: false,
          },
          depthMask: false,
          blending: Cesium.BlendingState.ALPHA_BLEND,
        },
      }),
      asynchronous: false,
      allowPicking: false,
      show: false,
    })
  );

  loadProcessedGlobalNightTextureAsync()
    .then((nightUrl) => {
      if (!viewer || viewer.isDestroyed?.() || !nightLayer.material) return;
      nightLayer.material.uniforms.image = nightUrl;
      nightLayer.textureReady = true;
      viewer.scene.requestRender?.();
    })
    .catch((error) => {
      console.warn("Impossible de creer la couche nuit globale.", error);
    });
  return nightLayer;
}

function createGlobalAtmosphereLayerForViewer(viewer, isMobile) {
  if (!viewer || viewer.isDestroyed?.() || isMobile) return null;
  const glowMaterial = new Cesium.Material({
    fabric: {
      type: "ImmoGlobeAtmosphereGlow",
      uniforms: {
        glowColor: new Cesium.Color(0.42, 0.72, 1.0, 0),
      },
      source: `
        czm_material czm_getMaterial(czm_materialInput materialInput)
        {
          czm_material material = czm_getDefaultMaterial(materialInput);
          vec3 normal = normalize(materialInput.normalEC);
          float horizon = length(normal.xy);
          float limb = smoothstep(0.82, 0.995, horizon);
          float upperAir = smoothstep(-0.10, 0.72, normal.y + normal.x * 0.10);
          float glow = clamp(limb * (0.72 + upperAir * 0.28), 0.0, 1.0);
          material.diffuse = glowColor.rgb;
          material.emission = glowColor.rgb * glow * 0.18;
          material.alpha = glowColor.a * glow;
          return material;
        }
      `,
    },
    translucent: () => true,
  });
  const shadeMaterial = new Cesium.Material({
    fabric: {
      type: "ImmoGlobeCameraShade",
      uniforms: {
        shadeColor: Cesium.Color.BLACK.withAlpha(0),
      },
      source: `
        czm_material czm_getMaterial(czm_materialInput materialInput)
        {
          czm_material material = czm_getDefaultMaterial(materialInput);
          vec3 normal = normalize(materialInput.normalEC);
          float shadowAxis = normal.x - normal.y * 0.56;
          float rightSide = smoothstep(-0.02, 0.52, shadowAxis);
          float nightCore = smoothstep(0.34, 0.88, shadowAxis);
          float rightLimb = smoothstep(0.62, 0.98, normal.x);
          float lowerSweep = smoothstep(0.10, 0.74, -normal.y + normal.x * 0.12);
          float outerLimb = smoothstep(0.72, 0.99, length(normal.xy));
          float terminator = clamp(
            rightSide * 0.32 +
            nightCore * 0.78 +
            rightLimb * 0.38 +
            lowerSweep * rightSide * 0.12 +
            outerLimb * rightSide * 0.24,
            0.0,
            1.0
          );
          material.diffuse = shadeColor.rgb;
          material.alpha = shadeColor.a * terminator;
          return material;
        }
      `,
    },
    translucent: () => true,
  });
  const atmosphereLayer = {
    alpha: 0,
    glowAlpha: 0,
    lastAlpha: 0,
    lastGlowAlpha: 0,
    glowMaterial,
    material: shadeMaterial,
    glowPrimitive: null,
    primitive: null,
  };
  const glowEllipsoidRadii = new Cesium.Cartesian3(
    Cesium.Ellipsoid.WGS84.radii.x + GLOBE_ATMOSPHERE_GLOW_SHELL_ALTITUDE_METERS,
    Cesium.Ellipsoid.WGS84.radii.y + GLOBE_ATMOSPHERE_GLOW_SHELL_ALTITUDE_METERS,
    Cesium.Ellipsoid.WGS84.radii.z + GLOBE_ATMOSPHERE_GLOW_SHELL_ALTITUDE_METERS
  );
  atmosphereLayer.glowPrimitive = viewer.scene.primitives.add(
    new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({
        geometry: new Cesium.EllipsoidGeometry({
          radii: glowEllipsoidRadii,
          stackPartitions: 64,
          slicePartitions: 64,
          vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
        }),
      }),
      appearance: new Cesium.EllipsoidSurfaceAppearance({
        material: glowMaterial,
        translucent: true,
        aboveGround: false,
        flat: true,
        faceForward: true,
        renderState: {
          depthTest: {
            enabled: false,
          },
          depthMask: false,
          blending: Cesium.BlendingState.ALPHA_BLEND,
        },
      }),
      asynchronous: false,
      allowPicking: false,
      show: false,
    })
  );
  const ellipsoidRadii = new Cesium.Cartesian3(
    Cesium.Ellipsoid.WGS84.radii.x + GLOBE_ATMOSPHERE_SHELL_ALTITUDE_METERS,
    Cesium.Ellipsoid.WGS84.radii.y + GLOBE_ATMOSPHERE_SHELL_ALTITUDE_METERS,
    Cesium.Ellipsoid.WGS84.radii.z + GLOBE_ATMOSPHERE_SHELL_ALTITUDE_METERS
  );
  atmosphereLayer.primitive = viewer.scene.primitives.add(
    new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({
        geometry: new Cesium.EllipsoidGeometry({
          radii: ellipsoidRadii,
          stackPartitions: 64,
          slicePartitions: 64,
          vertexFormat: Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
        }),
      }),
      appearance: new Cesium.EllipsoidSurfaceAppearance({
        material: shadeMaterial,
        translucent: true,
        aboveGround: false,
        flat: true,
        faceForward: true,
        renderState: {
          depthTest: {
            enabled: false,
          },
          depthMask: false,
          blending: Cesium.BlendingState.ALPHA_BLEND,
        },
      }),
      asynchronous: false,
      allowPicking: false,
      show: false,
    })
  );
  viewer.scene.primitives.raiseToTop?.(atmosphereLayer.glowPrimitive);
  viewer.scene.primitives.raiseToTop?.(atmosphereLayer.primitive);
  return atmosphereLayer;
}

function updateGlobalCloudBackdropForViewer(
  viewer,
  cloudLayer,
  activeMode,
  cameraHeight,
  isMobile
) {
  if (!viewer || viewer.isDestroyed?.() || !cloudLayer) return;

  const resolvedHeight = Number.isFinite(cameraHeight)
    ? cameraHeight
    : getCameraHeight(viewer);
  const previousShow =
    (cloudLayer.lastAlpha ?? 0) > 0.01 ||
    Boolean(cloudLayer.primitive?.show);
  const showThreshold = previousShow
    ? DESKTOP_GLOBE_CLOUDS_HIDE_HEIGHT_METERS
    : DESKTOP_GLOBE_CLOUDS_SHOW_HEIGHT_METERS;
  const shouldRenderCloudLayer = !isMobile && activeMode === "google3d";
  const shouldComputeClouds =
    shouldRenderCloudLayer &&
    Boolean(cloudLayer.textureReady) &&
    !isMobile &&
    Number.isFinite(resolvedHeight);
  const textureRevealProgress =
    cloudLayer.textureRevealStartedAt == null
      ? 0
      : Cesium.Math.clamp(
          ((typeof performance !== "undefined"
            ? performance.now()
            : Date.now()) - cloudLayer.textureRevealStartedAt) /
            GLOBE_CLOUD_TEXTURE_REVEAL_DURATION_MS,
          0,
          1
        );
  const visibilityProgress = Number.isFinite(resolvedHeight)
    ? Cesium.Math.clamp(
        (resolvedHeight - GLOBE_CLOUD_ALPHA_FADE_START_HEIGHT_METERS) /
          Math.max(
            1,
            DESKTOP_GLOBE_CLOUDS_SHOW_HEIGHT_METERS -
              GLOBE_CLOUD_ALPHA_FADE_START_HEIGHT_METERS
          ),
        0,
        1
      )
    : 0;
  const easedVisibilityProgress = Math.pow(visibilityProgress, 0.72);
  const layeredCloudAlpha = Cesium.Math.lerp(
    GLOBE_CLOUD_MIN_ALPHA,
    GLOBE_CLOUD_MAX_ALPHA,
    easedVisibilityProgress
  );
  const targetAlpha =
    shouldComputeClouds &&
    (resolvedHeight >= showThreshold || previousShow || visibilityProgress > 0)
      ? layeredCloudAlpha * visibilityProgress * textureRevealProgress
      : 0;
  const nextAlpha = smoothBackdropEffectAlpha(
    cloudLayer.lastAlpha,
    targetAlpha,
    GLOBE_CLOUD_ALPHA_FADE_IN_LERP,
    GLOBE_CLOUD_ALPHA_FADE_OUT_LERP
  );
  const shouldShowLayer =
    shouldRenderCloudLayer &&
    Boolean(cloudLayer.textureReady) &&
    Boolean(cloudLayer.primitive);
  const nextPrimitiveShow =
    shouldShowLayer && (targetAlpha > 0.004 || nextAlpha > 0.004);
  const showChanged = Boolean(cloudLayer.primitive?.show) !== nextPrimitiveShow;
  const alphaChanged =
    Math.abs((cloudLayer.lastAlpha ?? 0) - nextAlpha) > GLOBE_EFFECT_ALPHA_EPSILON;

  cloudLayer.lastAlpha = nextAlpha;
  cloudLayer.alpha = nextAlpha;
  if (cloudLayer.material && alphaChanged) {
    cloudLayer.material.uniforms.color = Cesium.Color.WHITE.withAlpha(nextAlpha);
  }
  if (cloudLayer.primitive) {
    if (showChanged) {
      cloudLayer.primitive.show = nextPrimitiveShow;
    }
    if (nextPrimitiveShow && (showChanged || alphaChanged)) {
      viewer.scene.primitives.raiseToTop?.(cloudLayer.primitive);
    }
  }
  if (showChanged || alphaChanged) {
    viewer.scene.requestRender?.();
  }
}

function updateGlobalNightBackdropForViewer(
  viewer,
  nightLayer,
  activeMode,
  cameraHeight,
  isMobile,
  isNightModeEnabled
) {
  if (!viewer || viewer.isDestroyed?.() || !nightLayer) return;

  const resolvedHeight = Number.isFinite(cameraHeight)
    ? cameraHeight
    : getCameraHeight(viewer);
  const shouldRenderNightLayer =
    !isMobile &&
    activeMode === "google3d" &&
    Boolean(isNightModeEnabled) &&
    Boolean(nightLayer.textureReady) &&
    Number.isFinite(resolvedHeight) &&
    resolvedHeight >= DESKTOP_GLOBE_EFFECTS_HIDE_HEIGHT_METERS;
  const visibilityProgress = Number.isFinite(resolvedHeight)
    ? Cesium.Math.clamp(
        (resolvedHeight - DESKTOP_GLOBE_EFFECTS_HIDE_HEIGHT_METERS) /
          DESKTOP_GLOBE_EFFECTS_FADE_RANGE_METERS,
        0,
        1
      )
    : 0;
  const targetAlpha = shouldRenderNightLayer
    ? Cesium.Math.lerp(
        GLOBE_NIGHT_MIN_ALPHA,
        GLOBE_NIGHT_MAX_ALPHA,
        Math.pow(visibilityProgress, 0.72)
      )
    : 0;
  const nextPrimitiveShow = shouldRenderNightLayer && targetAlpha > 0.01;
  const showChanged = Boolean(nightLayer.primitive?.show) !== nextPrimitiveShow;
  const alphaChanged = Math.abs((nightLayer.lastAlpha ?? 0) - targetAlpha) > 0.002;

  nightLayer.lastAlpha = targetAlpha;
  nightLayer.alpha = targetAlpha;
  if (nightLayer.material && alphaChanged) {
    nightLayer.material.uniforms.color = Cesium.Color.WHITE.withAlpha(targetAlpha);
  }
  if (nightLayer.primitive) {
    if (showChanged) {
      nightLayer.primitive.show = nextPrimitiveShow;
    }
    if (nextPrimitiveShow && (showChanged || alphaChanged)) {
      viewer.scene.primitives.raiseToTop?.(nightLayer.primitive);
    }
  }
  if (showChanged || alphaChanged) {
    viewer.scene.requestRender?.();
  }
}

function updateGlobalAtmosphereBackdropForViewer(
  viewer,
  atmosphereLayer,
  activeMode,
  cameraHeight,
  isMobile
) {
  if (!viewer || viewer.isDestroyed?.() || !atmosphereLayer) return;

  const resolvedHeight = Number.isFinite(cameraHeight)
    ? cameraHeight
    : getCameraHeight(viewer);
  const previousShow =
    (atmosphereLayer.lastGlowAlpha ?? 0) > 0.01 ||
    Boolean(atmosphereLayer.glowPrimitive?.show) ||
    (atmosphereLayer.lastAlpha ?? 0) > 0.01 ||
    Boolean(atmosphereLayer.primitive?.show);
  const showThreshold = previousShow
    ? DESKTOP_GLOBE_CLOUDS_HIDE_HEIGHT_METERS
    : DESKTOP_GLOBE_CLOUDS_SHOW_HEIGHT_METERS;
  const shouldRenderAtmosphere = !isMobile && activeMode === "google3d";
  const shouldShowAtmosphere =
    shouldRenderAtmosphere &&
    Number.isFinite(resolvedHeight) &&
    resolvedHeight >= showThreshold;
  const visibilityProgress = Number.isFinite(resolvedHeight)
    ? Cesium.Math.clamp(
        (resolvedHeight - DESKTOP_GLOBE_CLOUDS_HIDE_HEIGHT_METERS) /
          Math.max(
            1,
            DESKTOP_GLOBE_CLOUDS_SHOW_HEIGHT_METERS -
              DESKTOP_GLOBE_CLOUDS_HIDE_HEIGHT_METERS
          ),
        0,
        1
      )
    : 0;
  const targetAlpha = shouldShowAtmosphere
    ? Cesium.Math.lerp(
        GLOBE_ATMOSPHERE_MIN_ALPHA,
        GLOBE_ATMOSPHERE_MAX_ALPHA,
        Math.pow(visibilityProgress, 0.82)
      )
    : 0;
  const targetGlowAlpha = shouldShowAtmosphere
    ? Cesium.Math.lerp(
        GLOBE_ATMOSPHERE_GLOW_MIN_ALPHA,
        GLOBE_ATMOSPHERE_GLOW_MAX_ALPHA,
        Math.pow(visibilityProgress, 0.76)
      )
    : 0;
  const nextAlpha = smoothBackdropEffectAlpha(
    atmosphereLayer.lastAlpha,
    targetAlpha,
    GLOBE_ATMOSPHERE_ALPHA_FADE_IN_LERP,
    GLOBE_ATMOSPHERE_ALPHA_FADE_OUT_LERP
  );
  const nextGlowAlpha = smoothBackdropEffectAlpha(
    atmosphereLayer.lastGlowAlpha,
    targetGlowAlpha,
    GLOBE_ATMOSPHERE_ALPHA_FADE_IN_LERP,
    GLOBE_ATMOSPHERE_ALPHA_FADE_OUT_LERP
  );
  const nextPrimitiveShow =
    shouldRenderAtmosphere && (targetAlpha > 0.004 || nextAlpha > 0.004);
  const nextGlowPrimitiveShow =
    shouldRenderAtmosphere &&
    (targetGlowAlpha > 0.004 || nextGlowAlpha > 0.004);
  const showChanged =
    Boolean(atmosphereLayer.primitive?.show) !== nextPrimitiveShow;
  const glowShowChanged =
    Boolean(atmosphereLayer.glowPrimitive?.show) !== nextGlowPrimitiveShow;
  const alphaChanged =
    Math.abs((atmosphereLayer.lastAlpha ?? 0) - nextAlpha) >
    GLOBE_EFFECT_ALPHA_EPSILON;
  const glowAlphaChanged =
    Math.abs((atmosphereLayer.lastGlowAlpha ?? 0) - nextGlowAlpha) >
    GLOBE_EFFECT_ALPHA_EPSILON;

  atmosphereLayer.lastAlpha = nextAlpha;
  atmosphereLayer.alpha = nextAlpha;
  atmosphereLayer.lastGlowAlpha = nextGlowAlpha;
  atmosphereLayer.glowAlpha = nextGlowAlpha;
  if (atmosphereLayer.glowMaterial && glowAlphaChanged) {
    atmosphereLayer.glowMaterial.uniforms.glowColor = new Cesium.Color(
      0.42,
      0.72,
      1.0,
      nextGlowAlpha
    );
  }
  if (atmosphereLayer.material && alphaChanged) {
    atmosphereLayer.material.uniforms.shadeColor =
      Cesium.Color.BLACK.withAlpha(nextAlpha);
  }
  if (atmosphereLayer.glowPrimitive) {
    if (glowShowChanged) {
      atmosphereLayer.glowPrimitive.show = nextGlowPrimitiveShow;
    }
    if (nextGlowPrimitiveShow) {
      viewer.scene.primitives.raiseToTop?.(atmosphereLayer.glowPrimitive);
    }
  }
  if (atmosphereLayer.primitive) {
    if (showChanged) {
      atmosphereLayer.primitive.show = nextPrimitiveShow;
    }
    if (nextPrimitiveShow) {
      viewer.scene.primitives.raiseToTop?.(atmosphereLayer.primitive);
    }
  }
  if (showChanged || alphaChanged || glowShowChanged || glowAlphaChanged) {
    viewer.scene.requestRender?.();
  }
}

function updateSceneBackdropLightForViewer(
  viewer,
  activeMode,
  cameraHeight,
  isMobile
) {
  if (!viewer || viewer.isDestroyed?.() || !viewer.scene) return;
  const resolvedHeight = Number.isFinite(cameraHeight)
    ? cameraHeight
    : getCameraHeight(viewer);
  const useBackdropLighting =
    !isMobile &&
    activeMode === "google3d" &&
    Number.isFinite(resolvedHeight) &&
    resolvedHeight >= DESKTOP_GLOBE_EFFECTS_HIDE_HEIGHT_METERS;
  const lightingProgress = Number.isFinite(resolvedHeight)
    ? Cesium.Math.clamp(
        (resolvedHeight - DESKTOP_GLOBE_EFFECTS_HIDE_HEIGHT_METERS) /
          DESKTOP_GLOBE_EFFECTS_FADE_RANGE_METERS,
        0,
        1
      )
    : 0;
  const lightIntensity = useBackdropLighting
    ? Cesium.Math.lerp(2.0, 2.85, Math.pow(lightingProgress, 0.7))
    : 1.6;
  const previousLightState = viewer.scene._immoBackdropLightState || null;
  const canReuseBackdropLightState =
    previousLightState &&
    previousLightState.activeMode === activeMode &&
    previousLightState.isMobile === Boolean(isMobile) &&
    previousLightState.useBackdropLighting === useBackdropLighting &&
    Math.abs((previousLightState.lightIntensity ?? 0) - lightIntensity) < 0.02 &&
    Math.abs((previousLightState.lightingProgress ?? 0) - lightingProgress) < 0.01;

  if (canReuseBackdropLightState) {
    return;
  }

  viewer.scene._immoBackdropLightState = {
    activeMode,
    isMobile: Boolean(isMobile),
    useBackdropLighting,
    lightIntensity,
    lightingProgress,
  };

  if (
    !(viewer.scene.light instanceof Cesium.SunLight) ||
    Math.abs((viewer.scene.light?.intensity ?? 0) - lightIntensity) > 0.02
  ) {
    viewer.scene.light = new Cesium.SunLight({
      intensity: lightIntensity,
    });
  }

  viewer.scene.globe.enableLighting = useBackdropLighting;
  viewer.scene.globe.dynamicAtmosphereLighting = useBackdropLighting;
  viewer.scene.globe.dynamicAtmosphereLightingFromSun = useBackdropLighting;
  viewer.scene.globe.showGroundAtmosphere = useBackdropLighting;
  viewer.scene.globe.atmosphereLightIntensity = Cesium.Math.lerp(
    2.0,
    3.1,
    Math.pow(lightingProgress, 0.68)
  );
  viewer.scene.globe.atmosphereSaturationShift = useBackdropLighting ? -0.02 : -0.06;
  viewer.scene.globe.atmosphereBrightnessShift = useBackdropLighting ? 0.02 : -0.18;
  viewer.scene.globe.lightingFadeInDistance = 8.0e4;
  viewer.scene.globe.lightingFadeOutDistance = 9.0e6;
  viewer.scene.globe.nightFadeInDistance = 6.0e4;
  viewer.scene.globe.nightFadeOutDistance = 7.2e6;

  if (viewer.scene.skyAtmosphere) {
    viewer.scene.skyAtmosphere.show = useBackdropLighting;
    viewer.scene.skyAtmosphere.atmosphereLightIntensity = Cesium.Math.lerp(
      1.8,
      2.8,
      Math.pow(lightingProgress, 0.72)
    );
    viewer.scene.skyAtmosphere.saturationShift = -0.03;
    viewer.scene.skyAtmosphere.brightnessShift = useBackdropLighting ? 0.02 : -0.1;
  }
}

function updateGoogleTilesetBackdropVisibility(
  viewer,
  tileset,
  activeMode,
  cameraHeight,
  isMobile
) {
  if (!viewer || viewer.isDestroyed?.() || !tileset) return false;

  const applyTilesetVisibility = (visible) => {
    const primitives = viewer.scene?.primitives;
    if (!primitives) return;
    tileset.show = visible;
    for (let index = 0; index < primitives.length; index += 1) {
      const primitive = primitives.get(index);
      if (!(primitive instanceof Cesium.Cesium3DTileset)) continue;
      primitive.show = visible && primitive === tileset;
    }
  };

  if (activeMode !== "google3d") {
    applyTilesetVisibility(false);
    return false;
  }

  if (isMobile) {
    applyTilesetVisibility(true);
    return true;
  }

  void cameraHeight;
  applyTilesetVisibility(true);
  return true;
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
  try {
    const camera = getViewerCameraSafely(viewer);
    const cameraPosition =
      camera?.positionWC || camera?.position || viewer?.position || null;
    if (!cameraPosition) return null;
    const cartographic = Cesium.Cartographic.fromCartesian(cameraPosition);
    if (!cartographic || !Number.isFinite(cartographic.height)) return null;
    return cartographic.height;
  } catch {
    return null;
  }
}

async function diagnoseGoogleTilesetEndpointAccess(accessToken) {
  const trimmedToken = String(accessToken || "").trim();

  if (!trimmedToken) {
    const error = new Error("Token Cesium manquant.");
    error.code = "CESIUM_ION_TOKEN_MISSING";
    throw error;
  }

  const endpointUrl = new URL(
    `https://api.cesium.com/v1/assets/${GOOGLE_TILES_ASSET_ID}/endpoint`
  );
  endpointUrl.searchParams.set("access_token", trimmedToken);

  let response;
  try {
    response = await fetch(endpointUrl.toString(), {
      method: "GET",
      mode: "cors",
      cache: "no-store",
    });
  } catch (cause) {
    const error = new Error("Acces reseau a l'endpoint Cesium impossible.");
    error.code = "CESIUM_ION_NETWORK";
    error.cause = cause;
    throw error;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.ok) {
    return {
      ok: true,
      status: response.status,
      payload,
    };
  }

  const detail =
    String(
      payload?.message ||
        payload?.error ||
        payload?.detail ||
        payload?.code ||
        ""
    ).trim() || `HTTP ${response.status}`;
  const error = new Error(detail);
  error.status = response.status;
  error.detail = detail;
  error.diagnostic = {
    status: response.status,
    detail,
    payload,
  };

  if (response.status === 401) {
    error.code = "CESIUM_ION_UNAUTHORIZED";
  } else if (response.status === 403) {
    error.code = "CESIUM_ION_FORBIDDEN";
  } else if (response.status === 429) {
    error.code = "CESIUM_ION_QUOTA";
  } else {
    error.code = "CESIUM_ION_ENDPOINT_ERROR";
  }

  throw error;
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
  desktopRightInset = 20,
}) {
  const initialZoneCacheKey = buildZoneCacheKey(searchZone);
  const shouldBootInSatelliteMode =
    canUseGoogle3D && resolveMode(mapMode) === "google3d";
  const initialSatelliteBootCache = shouldBootInSatelliteMode
    ? readSatelliteBootCache(initialZoneCacheKey)
    : null;
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
  const google3dBaseImageryLayerRef = useRef(null);
  const globeCloudCollectionRef = useRef(null);
  const globeNightCollectionRef = useRef(null);
  const globeAtmosphereCollectionRef = useRef(null);
  const boundaryDataSourceRef = useRef(null);
  const placementGhostDataSourceRef = useRef(null);
  const placementGhostEntityRef = useRef(null);
  const placementCursorOverlayRef = useRef(null);
  const entitiesRef = useRef([]);
  const markerDataByIdRef = useRef(new Map());
  const markerRenderContextRef = useRef({
    biensAvecCoordonnees: [],
    customMarkers: [],
    addressAnchorAssignments: new Map(),
  });
  const modeRef = useRef(null);
  const modeTransitionTimeoutRef = useRef(null);
  const modeTransitionVisualTimeoutRef = useRef(null);
  const modeTransitionFailSafeTimeoutRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const resizeRefreshFrameRef = useRef(null);
  const modeTransitionStartedAtRef = useRef(0);
  const modeTransitionTargetRef = useRef(null);
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
  const satelliteInitialVisualReleaseTimeoutRef = useRef(null);
  const satelliteInitialRenderPumpFrameRef = useRef(null);
  const satelliteBootCachePersistTimeoutRef = useRef(null);
  const adaptiveQualityStateRef = useRef({
    isMoving: false,
    isUltraActive: false,
    lastFrameAt: 0,
    sampleStartAt: 0,
    sampleFrameCount: 0,
    sampleFrameMsTotal: 0,
    dropFrameStreak: 0,
    overloadFrameStreak: 0,
    stabilityHoldUntil: 0,
    lastOverloadAt: 0,
    lastLongTaskAt: 0,
    lastTileActivityAt: 0,
    lastDefensiveDropAt: 0,
  });
  const tileLoadBurstStateRef = useRef({
    active: false,
    startedAt: 0,
    peakRemainingTiles: 0,
    lastRemainingTiles: 0,
  });
  const appBootTimestampRef = useRef(Date.now());
  const tiltToggleBaseRangeRef = useRef(null);
  const activeZoneCacheKeyRef = useRef(initialZoneCacheKey);
  const satelliteViewLimitRectangleRef = useRef(null);
  const satelliteBootCacheRef = useRef(initialSatelliteBootCache);
  const zoneCameraRestoreDoneRef = useRef(false);
  const hasInitialFlyRef = useRef(false);
  const mapModeRef = useRef(canUseGoogle3D ? mapMode : "osm");
  const isNightModeRef = useRef(false);
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
  const markerRefineRuntimeRef = useRef({
    timeoutId: null,
    requestId: 0,
    lastAppliedSignature: "",
  });
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
  const lastDesktopUserIntentAtRef = useRef(0);
  const desktopSettleSnapshotRef = useRef(null);
  const desktopMovingVisibleUntilRef = useRef(0);
  const desktopMovingRecoveryWatchRef = useRef({
    lastSnapshot: null,
    stableSinceAt: 0,
    forcedAt: 0,
  });
  const desktopCameraMotionWatchRef = useRef({
    lastSnapshot: null,
    lastDetectedAt: 0,
    motionSamples: 0,
  });
  const desktopAutoPhaseRef = useRef({
    phase: "idle",
    enteredAt: 0,
  });
  const applyFpsBenchmarkMovingQualityRef = useRef(() => {});
  const applyFpsBenchmarkInitialPauseQualityRef = useRef(() => {});
  const releaseFpsBenchmarkMovingQualityRef = useRef(() => {});
  const applyFpsBenchmarkSegmentQualityRef = useRef(() => {});
  const prepareFpsBenchmarkQualityRef = useRef(() => {});
  const currentQualityTelemetryRef = useRef({
    preset: "",
    moving: null,
    resolutionScale: null,
    msaaSamples: null,
    globeSse: null,
    tilesetSse: null,
    source: "",
    appliedAt: 0,
    debugReason: "",
    debugBlockMs: 0,
    debugIntentAgeMs: null,
    debugCameraHeight: null,
    debugRemainingTiles: 0,
    debugPointerActive: false,
    debugRecentTransitions: [],
  });
  const qualityTransitionHistoryRef = useRef([]);
  const fpsBenchmarkHotPathTraceRef = useRef({
    totalCount: 0,
    topEvents: [],
    lastRecordedAtByKey: new Map(),
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
  const [isNightMode, setIsNightMode] = useState(false);
  const [modeTransition, setModeTransition] = useState({
    active: shouldBootInSatelliteMode,
    target: shouldBootInSatelliteMode ? "google3d" : null,
  });
  const [modeTransitionVisual, setModeTransitionVisual] = useState({
    visible: shouldBootInSatelliteMode,
    fading: false,
    snapshotDataUrl: initialSatelliteBootCache?.snapshotDataUrl || "",
  });
  const [renderResolutionDebug, setRenderResolutionDebug] = useState(null);
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

  function resetFpsBenchmarkHotPathTrace() {
    fpsBenchmarkHotPathTraceRef.current = {
      totalCount: 0,
      topEvents: [],
      lastRecordedAtByKey: new Map(),
    };
  }

  function captureFpsBenchmarkHotPathEvent(handler, durationMs, extra = {}) {
    if (!fpsBenchmarkActiveRef.current) return;

    const normalizedDurationMs = roundBenchmarkValue(Number(durationMs) || 0);
    if (
      !Number.isFinite(normalizedDurationMs) ||
      normalizedDurationMs < FPS_BENCHMARK_HOT_PATH_MIN_DURATION_MS
    ) {
      return;
    }

    const traceState = fpsBenchmarkHotPathTraceRef.current;
    const nowMs = Date.now();
    const branch = extra?.branch ? String(extra.branch) : "";
    const detail = extra?.detail ? String(extra.detail) : "";
    const cooldownMs = Number.isFinite(Number(extra?.cooldownMs))
      ? Math.max(0, Number(extra.cooldownMs))
      : FPS_BENCHMARK_HOT_PATH_COOLDOWN_MS;
    const dedupeKey = `${String(handler || "")}|${branch}|${detail}`;
    const lastRecordedAt = Number(
      traceState.lastRecordedAtByKey.get(dedupeKey) || 0
    );

    if (cooldownMs > 0 && nowMs - lastRecordedAt < cooldownMs) {
      return;
    }

    traceState.lastRecordedAtByKey.set(dedupeKey, nowMs);
    traceState.totalCount += 1;

    const viewer = viewerRef.current;
    const qualitySnapshot = currentQualityTelemetryRef.current || {};
    const cameraHeight =
      viewer && !viewer.isDestroyed?.() ? getCameraHeight(viewer) : null;
    const nextEvent = {
      type: "hot_path_duration",
      at: new Date().toISOString(),
      handler: String(handler || ""),
      durationMs: normalizedDurationMs,
      moving: Boolean(adaptiveQualityStateRef.current.isMoving),
      qualityPreset: String(qualitySnapshot.preset || ""),
      qualityMoving:
        typeof qualitySnapshot.moving === "boolean"
          ? Boolean(qualitySnapshot.moving)
          : null,
      resolutionScale: roundBenchmarkValue(
        Number(qualitySnapshot.resolutionScale),
        2
      ),
      msaaSamples: Number.isFinite(Number(qualitySnapshot.msaaSamples))
        ? Math.max(0, Number(qualitySnapshot.msaaSamples))
        : null,
      globeSse: roundBenchmarkValue(Number(qualitySnapshot.globeSse), 2),
      tilesetSse: roundBenchmarkValue(Number(qualitySnapshot.tilesetSse), 2),
      remainingTiles: Math.max(
        0,
        Math.round(Number(tileLoadBurstStateRef.current.lastRemainingTiles) || 0)
      ),
      cameraHeight: roundBenchmarkValue(Number(cameraHeight), 1),
      branch: branch || null,
      detail: detail || null,
    };

    traceState.topEvents = [...traceState.topEvents, nextEvent]
      .sort((left, right) => Number(right.durationMs) - Number(left.durationMs))
      .slice(0, FPS_BENCHMARK_HOT_PATH_CAPTURE_LIMIT);
  }

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
    if (!placingBienId) {
      hidePlacementCursorOverlay();
    }
  }, [placingBienId]);

  useEffect(() => {
    mapModeRef.current = canUseGoogle3D ? resolveMode(mapMode) : "osm";
  }, [mapMode, canUseGoogle3D, tilesReadyVersion]);

  useEffect(() => {
    isSatelliteReadyRef.current = isSatelliteReady;
  }, [isSatelliteReady]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !isSatelliteReady) return;
    if (resolveMode(mapModeRef.current) !== "google3d") return;
    scheduleSatelliteBootCachePersist(220);
  }, [isSatelliteReady, tilesReadyVersion]);

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
  }, [isMobile, isIOSDevice]);

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
    satelliteBootCacheRef.current = readSatelliteBootCache(zoneCacheKey);
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
      hidePlacementCursorOverlay();
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
      if (satelliteInitialVisualReleaseTimeoutRef.current) {
        window.clearTimeout(satelliteInitialVisualReleaseTimeoutRef.current);
      }
      if (satelliteInitialRenderPumpFrameRef.current) {
        window.cancelAnimationFrame(satelliteInitialRenderPumpFrameRef.current);
      }
      if (modeTransitionVisualTimeoutRef.current) {
        window.clearTimeout(modeTransitionVisualTimeoutRef.current);
      }
      if (modeTransitionFailSafeTimeoutRef.current) {
        window.clearTimeout(modeTransitionFailSafeTimeoutRef.current);
      }
      if (modeTransitionTimeoutRef.current) {
        window.clearTimeout(modeTransitionTimeoutRef.current);
      }
      modeTransitionTargetRef.current = null;
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (resizeRefreshFrameRef.current) {
        window.cancelAnimationFrame(resizeRefreshFrameRef.current);
        resizeRefreshFrameRef.current = null;
      }
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
      }
      if (satelliteBootCachePersistTimeoutRef.current) {
        window.clearTimeout(satelliteBootCachePersistTimeoutRef.current);
        satelliteBootCachePersistTimeoutRef.current = null;
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

  function clearSatelliteInitialVisualReleaseTimeout() {
    if (!satelliteInitialVisualReleaseTimeoutRef.current) return;
    window.clearTimeout(satelliteInitialVisualReleaseTimeoutRef.current);
    satelliteInitialVisualReleaseTimeoutRef.current = null;
  }

  function clearSatelliteInitialRenderPump() {
    if (!satelliteInitialRenderPumpFrameRef.current) return;
    window.cancelAnimationFrame(satelliteInitialRenderPumpFrameRef.current);
    satelliteInitialRenderPumpFrameRef.current = null;
  }

  function clearSatelliteBootCachePersistTimeout() {
    if (!satelliteBootCachePersistTimeoutRef.current) return;
    window.clearTimeout(satelliteBootCachePersistTimeoutRef.current);
    satelliteBootCachePersistTimeoutRef.current = null;
  }

  function clearModeTransitionVisualTimeout() {
    if (!modeTransitionVisualTimeoutRef.current) return;
    window.clearTimeout(modeTransitionVisualTimeoutRef.current);
    modeTransitionVisualTimeoutRef.current = null;
  }

  function clearModeTransitionFailSafeTimeout() {
    if (!modeTransitionFailSafeTimeoutRef.current) return;
    window.clearTimeout(modeTransitionFailSafeTimeoutRef.current);
    modeTransitionFailSafeTimeoutRef.current = null;
  }

  function captureTransitionSnapshot(options = {}) {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return "";
    try {
      viewer.scene.requestRender();
      const canvas = viewer.canvas;
      if (!canvas || typeof canvas.toDataURL !== "function") return "";
      const quality = Cesium.Math.clamp(
        Number(options.quality) || 0.62,
        0.2,
        0.92
      );
      const maxWidth = Math.max(0, Number(options.maxWidth) || 0);

      if (maxWidth > 0 && canvas.width > maxWidth) {
        const exportWidth = Math.round(maxWidth);
        const exportHeight = Math.max(
          1,
          Math.round((canvas.height * exportWidth) / canvas.width)
        );
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = exportWidth;
        exportCanvas.height = exportHeight;
        const exportContext = exportCanvas.getContext("2d", { alpha: false });
        if (exportContext) {
          exportContext.drawImage(canvas, 0, 0, exportWidth, exportHeight);
          return exportCanvas.toDataURL("image/jpeg", quality);
        }
      }

      return canvas.toDataURL("image/jpeg", quality);
    } catch {
      // CORS-tainted canvases can fail to export; fallback to blur-only overlay.
      return "";
    }
  }

  function persistSatelliteBootCache(viewer, options = {}) {
    if (!viewer || viewer.isDestroyed()) return false;
    if (resolveMode(mapModeRef.current) !== "google3d") return false;

    const cameraState = captureSerializableCameraState(viewer);
    if (!cameraState) return false;

    const existingEntry =
      satelliteBootCacheRef.current ||
      readSatelliteBootCache(activeZoneCacheKeyRef.current);
    const snapshotDataUrl =
      options.snapshotDataUrl ||
      captureTransitionSnapshot({
        quality: SATELLITE_BOOT_SNAPSHOT_EXPORT_QUALITY,
        maxWidth: SATELLITE_BOOT_SNAPSHOT_EXPORT_MAX_WIDTH,
      }) ||
      existingEntry?.snapshotDataUrl ||
      "";

    writeSatelliteBootCache(activeZoneCacheKeyRef.current, {
      snapshotDataUrl,
      camera: cameraState,
    });
    satelliteBootCacheRef.current = readSatelliteBootCache(
      activeZoneCacheKeyRef.current
    );
    return true;
  }

  function scheduleSatelliteBootCachePersist(delayMs = SATELLITE_BOOT_CACHE_PERSIST_DELAY_MS) {
    clearSatelliteBootCachePersistTimeout();
    satelliteBootCachePersistTimeoutRef.current = window.setTimeout(() => {
      satelliteBootCachePersistTimeoutRef.current = null;
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;
      if (resolveMode(mapModeRef.current) !== "google3d") return;
      if (!tilesetRef.current?.show && !isSatelliteReadyRef.current) return;
      persistSatelliteBootCache(viewer);
    }, Math.max(0, Number(delayMs) || 0));
  }

  function restoreCameraFromSatelliteBootCache(viewer) {
    if (!viewer) return false;
    const cachedEntry =
      satelliteBootCacheRef.current ||
      readSatelliteBootCache(activeZoneCacheKeyRef.current);
    const cachedCamera = cachedEntry?.camera;
    if (!cachedCamera) return false;

    const expectedRectangle = satelliteViewLimitRectangleRef.current || getBiensBounds();
    if (
      expectedRectangle &&
      !isSerializedCameraInsideRectangle(cachedCamera, expectedRectangle)
    ) {
      return false;
    }

    const restored = restoreSerializableCameraState(viewer, cachedCamera);
    if (restored) {
      viewer.scene.requestRender();
    }
    return restored;
  }

  function isGoogleSatelliteTransitionReady() {
    const viewer = viewerRef.current;
    const tileset = tilesetRef.current;
    if (!viewer || viewer.isDestroyed?.() || modeRef.current !== "google3d") {
      return false;
    }
    if (!tileset || !tileset.show) {
      return false;
    }
    return Boolean(tileset.tilesLoaded || isSatelliteReadyRef.current);
  }

  function startModeTransition(targetMode) {
    if (modeTransitionTimeoutRef.current) {
      window.clearTimeout(modeTransitionTimeoutRef.current);
      modeTransitionTimeoutRef.current = null;
    }
    clearModeTransitionVisualTimeout();
    clearModeTransitionFailSafeTimeout();
    modeTransitionStartedAtRef.current = Date.now();
    modeTransitionTargetRef.current = targetMode;
    const isSatelliteTransition = targetMode === "google3d";
    const transitionStartedAt = modeTransitionStartedAtRef.current;

    setModeTransitionVisual({
      visible: true,
      fading: false,
      snapshotDataUrl: captureTransitionSnapshot(),
    });

    setModeTransition({
      active: true,
      target: targetMode,
    });

    if (isSatelliteTransition) {
      // Let the dark loading cover paint before hiding the plan imagery.
      window.requestAnimationFrame(() => {
        if (modeTransitionStartedAtRef.current !== transitionStartedAt) return;

        updateCesiumGlobeVisibilityForMode(viewerRef.current, "google3d");
        if (osmImageryLayerRef.current && !isMobile) {
          osmImageryLayerRef.current.show = false;
          osmImageryLayerRef.current.alpha = 0;
        }
        if (google3dBaseImageryLayerRef.current) {
          google3dBaseImageryLayerRef.current.show = false;
          google3dBaseImageryLayerRef.current.alpha = 0;
        }
        viewerRef.current?.scene?.requestRender?.();
      });
    }

    if (targetMode === "google3d") {
      modeTransitionFailSafeTimeoutRef.current = window.setTimeout(() => {
        modeTransitionFailSafeTimeoutRef.current = null;
        if (isGoogleSatelliteTransitionReady()) {
          finishModeTransition({ force: true });
        }
      }, MODE_TRANSITION_FAILSAFE_MS);
    }
  }

  function finishModeTransition(options = {}) {
    const { force = false } = options;
    if (
      !force &&
      modeTransitionTargetRef.current === "google3d" &&
      !isGoogleSatelliteTransitionReady()
    ) {
      return;
    }
    if (modeTransitionTimeoutRef.current) {
      window.clearTimeout(modeTransitionTimeoutRef.current);
    }
    clearModeTransitionVisualTimeout();
    clearModeTransitionFailSafeTimeout();
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
      modeTransitionTargetRef.current = null;
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
    const scene = getViewerSceneSafely(viewer);
    const primitives = scene?.primitives;
    if (!primitives) return;
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
    hidePlacementCursorOverlay();
  }

  function applyMarkerPlacementPosition(position) {
    setPendingMarkerPosition(position);
    setIsAwaitingMarkerPlacement(false);
    setMarkerEditorMode("map");
    setMarkerEditorOpen(true);
    setMarkerError("");
    hidePlacementGhost();
    hidePlacementCursorOverlay();
  }

  function hidePlacementGhost() {
    const ghostEntity = placementGhostEntityRef.current;
    if (!ghostEntity) return;
    ghostEntity.show = false;
  }

  function hidePlacementCursorOverlay() {
    const overlay = placementCursorOverlayRef.current;
    if (!overlay) return;
    overlay.style.opacity = "0";
  }

  function updatePlacementCursorOverlay(screenPosition) {
    const overlay = placementCursorOverlayRef.current;
    if (!overlay) return;

    const x = Number(screenPosition?.x);
    const y = Number(screenPosition?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      overlay.style.opacity = "0";
      return;
    }

    overlay.style.opacity = "1";
    overlay.style.transform = `translate3d(${x}px, ${y}px, 0) translate3d(-50%, -50%, 0)`;
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

function getCameraScreenCenter(scene) {
  const canvas = scene?.canvas;
  if (!canvas) return null;

  const canvasRect = canvas.getBoundingClientRect?.();
  const width = canvasRect?.width || canvas.clientWidth || canvas.width || 0;
  const height = canvasRect?.height || canvas.clientHeight || canvas.height || 0;
  if (!(width > 0) || !(height > 0)) return null;

  return new Cesium.Cartesian2(width / 2, height / 2);
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

function getPreservedCameraDestinationForBien(viewer, bien) {
  if (!viewer?.scene || !viewer.camera || !bien || bien.lat == null || bien.lon == null) {
    return null;
  }

  const screenCenter = getCameraScreenCenter(viewer.scene);
  if (!screenCenter) return null;

  const currentPivot = getClickPosition(viewer.scene, screenCenter);
  if (!currentPivot) return null;

  const currentFrame = Cesium.Transforms.eastNorthUpToFixedFrame(currentPivot);
  const inverseCurrentFrame = Cesium.Matrix4.inverseTransformation(
    currentFrame,
    new Cesium.Matrix4()
  );
  const localCameraPosition = Cesium.Matrix4.multiplyByPoint(
    inverseCurrentFrame,
    viewer.camera.positionWC,
    new Cesium.Cartesian3()
  );

  const targetCartographic = Cesium.Cartographic.fromDegrees(bien.lon, bien.lat);
  const targetSurfaceHeight = getSurfaceHeight(viewer.scene, targetCartographic);
  const targetPivot = Cesium.Cartesian3.fromRadians(
    targetCartographic.longitude,
    targetCartographic.latitude,
    Number.isFinite(targetSurfaceHeight) ? targetSurfaceHeight : 0
  );
  const targetFrame = Cesium.Transforms.eastNorthUpToFixedFrame(targetPivot);

  return Cesium.Matrix4.multiplyByPoint(
    targetFrame,
    localCameraPosition,
    new Cesium.Cartesian3()
  );
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

  function focusOnBien(viewer, bien, duration = 1, onComplete = null, options = {}) {
    if (!viewer || !bien || bien.lat == null || bien.lon == null) return;

    const currentMode = resolveMode(mapModeRef.current);
    const preserveView = Boolean(options?.preserveView);
    const preservedDestination = preserveView
      ? getPreservedCameraDestinationForBien(viewer, bien)
      : null;
    viewer.camera.flyTo({
      destination:
        preservedDestination ||
        Cesium.Cartesian3.fromDegrees(
          bien.lon,
          bien.lat,
          currentMode === "google3d" ? 260 : 1100
        ),
      orientation: {
        heading: viewer.camera.heading,
        pitch: preserveView
          ? viewer.camera.pitch
          : currentMode === "google3d"
            ? Cesium.Math.toRadians(-48)
            : Cesium.Math.toRadians(-90),
        roll: preserveView ? viewer.camera.roll : 0,
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
          alpha: true,
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
    viewer.container.style.backgroundColor = "transparent";
    if (viewer.cesiumWidget?.container) {
      viewer.cesiumWidget.container.style.backgroundColor = "transparent";
    }
    viewer.scene.canvas.style.touchAction = "none";
    viewer.scene.canvas.style.backgroundColor = "transparent";
    viewer.scene.canvas.style.webkitUserSelect = "none";
    viewer.scene.canvas.style.userSelect = "none";
    viewer.scene.canvas.style.webkitTapHighlightColor = "transparent";
    viewer.scene.canvas.style.imageRendering = "auto";
    const applyRenderStrategyForMode = (activeMode = modeRef.current) => {
      applyViewerRenderStrategyForMode(viewer, activeMode, isMobile);
    };
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
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.dynamicAtmosphereLighting = false;
    viewer.scene.globe.dynamicAtmosphereLightingFromSun = false;
    viewer.scene.globe.showGroundAtmosphere = false;
    viewer.scene.globe.showWaterEffect = false;
    viewer.scene.globe.shadows = Cesium.ShadowMode.DISABLED;
    viewer.scene.skyAtmosphere.show = !isIOSDevice;
    viewer.scene.skyBox.show = false;
    viewer.scene.fog.enabled = false;
    viewer.scene.highDynamicRange = !isIOSDevice;
    viewer.scene.sunBloom = false;
    viewer.scene.backgroundColor = DEFAULT_SCENE_BACKGROUND_COLOR;
    viewer.scene.fxaa = false;
    if (viewer.scene.postProcessStages?.fxaa) {
      viewer.scene.postProcessStages.fxaa.enabled = false;
    }
    if (viewer.scene.postProcessStages?.bloom) {
      viewer.scene.postProcessStages.bloom.enabled = false;
      viewer.scene.postProcessStages.bloom.uniforms.contrast =
        DEFAULT_SCENE_BLOOM_CONTRAST;
      viewer.scene.postProcessStages.bloom.uniforms.brightness =
        DEFAULT_SCENE_BLOOM_BRIGHTNESS;
      viewer.scene.postProcessStages.bloom.uniforms.glowOnly = false;
    }
    if (viewer.scene.postProcessStages) {
      viewer.scene.postProcessStages.tonemapper = Cesium.Tonemapper.PBR_NEUTRAL;
      viewer.scene.postProcessStages.exposure = DEFAULT_SCENE_EXPOSURE;
    }
    viewer.shadows = false;
    viewer.terrainShadows = Cesium.ShadowMode.RECEIVE_ONLY;
    viewer.shadowMap.enabled = false;
    viewer.shadowMap.softShadows = false;
    viewer.shadowMap.normalOffset = true;
    viewer.shadowMap.fadingEnabled = true;
    viewer.shadowMap.size = DEFAULT_SCENE_SHADOW_MAP_SIZE;
    viewer.shadowMap.maximumDistance = DEFAULT_SCENE_SHADOW_DISTANCE;
    viewer.terrainProvider = ellipsoidTerrainProviderRef.current;
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

    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      let lastWidth = 0;
      let lastHeight = 0;
      resizeObserverRef.current = new ResizeObserver((entries) => {
        const entry = entries?.[0];
        const width = Math.round(entry?.contentRect?.width || 0);
        const height = Math.round(entry?.contentRect?.height || 0);
        if (!width || !height) return;
        if (width === lastWidth && height === lastHeight) return;
        lastWidth = width;
        lastHeight = height;
        if (resizeRefreshFrameRef.current) {
          window.cancelAnimationFrame(resizeRefreshFrameRef.current);
        }
        resizeRefreshFrameRef.current = window.requestAnimationFrame(() => {
          resizeRefreshFrameRef.current = null;
          refreshViewer(viewer);
        });
      });
      resizeObserverRef.current.observe(containerRef.current);
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
      if (resolveMode(mapModeRef.current) === "google3d") {
        scheduleSatelliteBootCachePersist();
      }
    };
    const syncBackdropVisuals = () => {
      const currentCameraHeight = getCameraHeight(viewer);
      updateSceneBackdropLightForViewer(
        viewer,
        modeRef.current,
        currentCameraHeight,
        isMobile
      );
      updateGlobalNightBackdropForViewer(
        viewer,
        globeNightCollectionRef.current,
        modeRef.current,
        currentCameraHeight,
        isMobile,
        isNightModeRef.current
      );
      updateGlobalCloudBackdropForViewer(
        viewer,
        globeCloudCollectionRef.current,
        modeRef.current,
        currentCameraHeight,
        isMobile
      );
      updateGlobalAtmosphereBackdropForViewer(
        viewer,
        globeAtmosphereCollectionRef.current,
        modeRef.current,
        currentCameraHeight,
        isMobile
      );
    };
    if (isTouchNavigationDevice) {
      viewer.scene.postRender.addEventListener(enforceSatelliteZoomFloor);
    }
    viewer.scene.postRender.addEventListener(syncBackdropVisuals);
    viewer.camera.moveEnd.addEventListener(saveCameraStateOnMoveEnd);
    viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );
    const requestedInitialMode = canUseGoogle3D
      ? resolveMode(mapModeRef.current)
      : "osm";

    google3dBaseImageryLayerRef.current = null;
    osmImageryLayerRef.current = viewer.imageryLayers.addImageryProvider(
      new Cesium.OpenStreetMapImageryProvider({
        url: "https://tile.openstreetmap.org/",
        maximumLevel: OSM_IMAGERY_MAX_LEVEL,
        enablePickFeatures: false,
      })
    );
    tuneImageryLayer(osmImageryLayerRef.current, "plan");
    updateBaseImageryLayersForViewer(
      viewer,
      osmImageryLayerRef.current,
      google3dBaseImageryLayerRef.current,
      requestedInitialMode
    );
    globeCloudCollectionRef.current = createGlobalCloudLayerForViewer(viewer, isMobile);
    globeNightCollectionRef.current = createGlobalNightLayerForViewer(viewer, isMobile);
    globeAtmosphereCollectionRef.current = createGlobalAtmosphereLayerForViewer(
      viewer,
      isMobile
    );
    modeRef.current = "osm";
    viewer.scene.backgroundColor =
      requestedInitialMode === "google3d"
        ? Cesium.Color.BLACK
        : Cesium.Color.fromCssColorString("#dbeafe");
    applyViewerRenderStrategyForMode(viewer, requestedInitialMode, isMobile);

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
        hidePlacementCursorOverlay();
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
        hidePlacementCursorOverlay();
        return;
      }

      const pointerPosition = movement?.endPosition;
      if (!pointerPosition) {
        hidePlacementGhost();
        hidePlacementCursorOverlay();
        return;
      }

      updatePlacementCursorOverlay(pointerPosition);
      hidePlacementGhost();
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
      google3dBaseImageryLayerRef.current = null;
      globeCloudCollectionRef.current = null;
      globeNightCollectionRef.current = null;
      globeAtmosphereCollectionRef.current = null;
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
      const adaptiveState = adaptiveQualityStateRef.current;
      const normalizedRemainingTiles = Math.max(
        0,
        Math.round(Number(remainingTiles) || 0)
      );
      state.lastRemainingTiles = normalizedRemainingTiles;

      if (normalizedRemainingTiles > 0) {
        adaptiveState.lastTileActivityAt = Date.now();
        if (!state.active) {
          state.active = true;
          state.startedAt = performance.now();
          state.peakRemainingTiles = normalizedRemainingTiles;
          if (
            normalizedRemainingTiles >= ADAPTIVE_QUALITY_AUTO_TILE_BUSY_THRESHOLD &&
            !adaptiveState.isMoving
          ) {
            triggerAutoStabilityDrop({
              holdMs: ADAPTIVE_QUALITY_AUTO_TILE_RECOVERY_MS,
            });
          }
          return;
        }
        state.peakRemainingTiles = Math.max(
          state.peakRemainingTiles,
          normalizedRemainingTiles
        );
        if (
          normalizedRemainingTiles >= ADAPTIVE_QUALITY_AUTO_TILE_BUSY_THRESHOLD &&
          !adaptiveState.isMoving
        ) {
          triggerAutoStabilityDrop({
            holdMs: ADAPTIVE_QUALITY_AUTO_TILE_RECOVERY_MS,
          });
        }
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
            if (entry.duration >= 40) {
              adaptiveQualityStateRef.current.lastLongTaskAt = Date.now();
              triggerAutoStabilityDrop({
                holdMs: Math.max(
                  ADAPTIVE_QUALITY_AUTO_LONG_TASK_RECOVERY_MS,
                  Math.round(entry.duration * 12)
                ),
                downgrade: !adaptiveQualityStateRef.current.isMoving,
              });
            }
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
      adaptiveQualityStateRef.current.overloadFrameStreak = 0;
    };
    const clearAdaptiveQualityPressure = () => {
      adaptiveQualityStateRef.current.stabilityHoldUntil = 0;
      adaptiveQualityStateRef.current.lastOverloadAt = 0;
      adaptiveQualityStateRef.current.lastLongTaskAt = 0;
      adaptiveQualityStateRef.current.lastTileActivityAt = 0;
      adaptiveQualityStateRef.current.lastDefensiveDropAt = 0;
    };
    const resetDesktopMovingRecoveryWatch = () => {
      desktopMovingRecoveryWatchRef.current.lastSnapshot = null;
      desktopMovingRecoveryWatchRef.current.stableSinceAt = 0;
    };
      const resetDesktopCameraMotionWatch = () => {
        desktopCameraMotionWatchRef.current.lastSnapshot = null;
        desktopCameraMotionWatchRef.current.lastDetectedAt = 0;
        desktopCameraMotionWatchRef.current.motionSamples = 0;
      };
    const detectDesktopAutoCameraMotion = () => {
      if (cancelled || isMobile || selectedDesktopQualityProfileId !== "auto") {
        resetDesktopCameraMotionWatch();
        return;
      }
      if (useTouchNavigation || modeRef.current !== "google3d") {
        resetDesktopCameraMotionWatch();
        return;
      }

      const currentSnapshot = captureQualityCameraSnapshot(viewer);
      if (!currentSnapshot) return;

      const previousSnapshot = desktopCameraMotionWatchRef.current.lastSnapshot;
      desktopCameraMotionWatchRef.current.lastSnapshot = currentSnapshot;
      if (!previousSnapshot) return;

      if (isQualityCameraSnapshotStable(previousSnapshot, currentSnapshot)) {
        desktopCameraMotionWatchRef.current.motionSamples = 0;
        return;
      }

      const now = Date.now();
      const autoStabilityProfile = getDesktopAutoStabilityProfile(currentSnapshot);
      const hasRecentIntent =
        desktopPointerNavigationActiveRef.current ||
        hasRecentDesktopUserIntent(
          Math.max(420, autoStabilityProfile.movingVisibleMs, autoStabilityProfile.wheelIntentMs)
        ) ||
        fpsBenchmarkActiveRef.current ||
        fpsBenchmarkQualityLockRef.current;
      if (!hasRecentIntent) {
        desktopCameraMotionWatchRef.current.motionSamples = 0;
        return;
      }
      desktopCameraMotionWatchRef.current.motionSamples += 1;
      if (
        desktopCameraMotionWatchRef.current.motionSamples <
        DESKTOP_AUTO_MOTION_CONFIRMATION_SAMPLES
      ) {
        return;
      }
      desktopMovingVisibleUntilRef.current = Math.max(
        desktopMovingVisibleUntilRef.current,
        now + autoStabilityProfile.movingVisibleMs
      );

      if (
        adaptiveQualityStateRef.current.isMoving &&
        currentQualityTelemetryRef.current?.moving === true
      ) {
        desktopCameraMotionWatchRef.current.lastDetectedAt = now;
        return;
      }

      if (now - desktopCameraMotionWatchRef.current.lastDetectedAt < 120) {
        return;
      }
      if (
        !canSwitchDesktopAutoPhase("moving", {
          strong: hasRecentIntent,
          now,
        })
      ) {
        desktopCameraMotionWatchRef.current.motionSamples = 0;
        return;
      }

      desktopCameraMotionWatchRef.current.lastDetectedAt = now;
      desktopCameraMotionWatchRef.current.motionSamples = 0;
      adaptiveQualityStateRef.current.isMoving = true;
      resetDesktopMovingRecoveryWatch();
      desktopSettleSnapshotRef.current = null;
      clearQualityRecoverySafetyTimeout();
      clearDesktopQualityRestoreTimeouts();
      applyDesktopMovingQuality(undefined, "detect_desktop_camera_motion");
      scheduleQualityRecoverySafety();
    };
    const maybeRecoverStuckDesktopMovingState = () => {
      if (cancelled || isMobile || selectedDesktopQualityProfileId !== "auto") return;
      if (!adaptiveQualityStateRef.current.isMoving) {
        resetDesktopMovingRecoveryWatch();
        return;
      }
      if (useTouchNavigation) return;
      if (fpsBenchmarkActiveRef.current || fpsBenchmarkQualityLockRef.current) return;
      if (desktopPointerNavigationActiveRef.current) {
        resetDesktopMovingRecoveryWatch();
        return;
      }

      const now = Date.now();
      if (desktopMovingVisibleUntilRef.current > now) return;
      if (now - desktopMovingRecoveryWatchRef.current.forcedAt < 450) return;

      const currentSnapshot = captureQualityCameraSnapshot(viewer);
      if (!currentSnapshot) return;

      const previousSnapshot = desktopMovingRecoveryWatchRef.current.lastSnapshot;
      if (
        !previousSnapshot ||
        !isQualityCameraSnapshotStable(previousSnapshot, currentSnapshot)
      ) {
        desktopMovingRecoveryWatchRef.current.lastSnapshot = currentSnapshot;
        desktopMovingRecoveryWatchRef.current.stableSinceAt = now;
        return;
      }

      if (!desktopMovingRecoveryWatchRef.current.stableSinceAt) {
        desktopMovingRecoveryWatchRef.current.stableSinceAt = now;
        return;
      }

      desktopMovingRecoveryWatchRef.current.lastSnapshot = currentSnapshot;
      if (now - desktopMovingRecoveryWatchRef.current.stableSinceAt < 260) return;

      adaptiveQualityStateRef.current.isMoving = false;
      desktopMovingVisibleUntilRef.current = 0;
      desktopMovingRecoveryWatchRef.current.forcedAt = now;
      clearQualityRecoverySafetyTimeout();
      clearDesktopQualityRestoreTimeouts();
      const restoreAttemptId = desktopIdleRestoreAttemptRef.current;
      desktopSettleSnapshotRef.current = currentSnapshot;
      scheduleDesktopIdleRestore(restoreAttemptId, 0);
    };
    const forceExitDesktopMovingQuality = () => {
      if (cancelled || isMobile || selectedDesktopQualityProfileId !== "auto") return;
      if (fpsBenchmarkActiveRef.current || fpsBenchmarkQualityLockRef.current) return;
      if (modeRef.current !== "google3d") return;
      if (!tilesetRef.current?.tilesLoaded) return;
      if (tileLoadBurstStateRef.current.lastRemainingTiles > 0) return;
      if (desktopPointerNavigationActiveRef.current) return;

      adaptiveQualityStateRef.current.isMoving = false;
      desktopMovingVisibleUntilRef.current = 0;
      resetDesktopMovingRecoveryWatch();
      clearQualityRecoverySafetyTimeout();
      clearDesktopQualityRestoreTimeouts();
      const restoreAttemptId = desktopIdleRestoreAttemptRef.current;
      desktopSettleSnapshotRef.current = captureQualityCameraSnapshot(viewer);
      scheduleDesktopIdleRestore(restoreAttemptId, 0);
    };

    const scheduleQualityRecoverySafety = () => {
      clearQualityRecoverySafetyTimeout();
      qualityRecoverySafetyTimeoutRef.current = window.setTimeout(() => {
        if (cancelled) return;
        if (fpsBenchmarkActiveRef.current || fpsBenchmarkQualityLockRef.current) {
          scheduleQualityRecoverySafety();
          return;
        }
        if (isMobile) {
          clearMobileQualityRestoreTimeout();
          clearMobileUltraRestoreTimeout();
          applyMobileIdleQuality();
          return;
        }
        if (!isMobile) {
          const blockedRecoveryDelayMs = getAutoRecoveryBlockDelayMs();
          if (
            selectedDesktopQualityProfileId === "auto" &&
            blockedRecoveryDelayMs > 0
          ) {
            scheduleQualityRecoverySafety();
            return;
          }
          clearDesktopQualityRestoreTimeouts();
          applyDesktopIdleQuality(undefined, "quality_recovery_safety_idle");
          if (selectedDesktopQualityProfile.enableUltra && modeRef.current === "google3d") {
            desktopUltraRestoreTimeoutRef.current = window.setTimeout(() => {
              if (cancelled) return;
              applyDesktopUltraQuality(undefined, "quality_recovery_safety_ultra");
            }, selectedDesktopQualityProfile.ultraRestoreDelayMs);
          }
        }
      }, SATELLITE_MOVE_RECOVERY_DELAY_MS);
    };

    const scheduleDesktopIdleRestore = (
      attemptId,
      delayMs,
      { allowDuringBenchmark = false } = {}
    ) => {
      desktopQualityRestoreTimeoutRef.current = window.setTimeout(() => {
        desktopQualityRestoreTimeoutRef.current = null;
        if (cancelled) return;
        if (attemptId !== desktopIdleRestoreAttemptRef.current) return;
        if (
          !allowDuringBenchmark &&
          (fpsBenchmarkActiveRef.current || fpsBenchmarkQualityLockRef.current)
        ) {
          return;
        }
        if (!isUsableCesiumViewer(viewer)) return;
        if (adaptiveQualityStateRef.current.isMoving) return;

        const currentSnapshot = captureQualityCameraSnapshot(viewer);
        const autoStabilityProfile =
          selectedDesktopQualityProfileId === "auto"
            ? getDesktopAutoStabilityProfile(currentSnapshot)
            : null;
        const settleRecheckDelayMs =
          autoStabilityProfile?.settleRecheckDelayMs ??
          DESKTOP_AUTO_SETTLE_RECHECK_DELAY_MS;
        const settleHoldMs =
          autoStabilityProfile?.settleHoldMs ??
          selectedDesktopQualityProfile.settleHoldMs;
        const shouldUseDesktopSettleStage =
          selectedDesktopQualityProfileId === "auto" &&
          settleHoldMs > 0;
        const currentPhase = getCurrentDesktopAutoPhase();
        const currentPreset = String(currentQualityTelemetryRef.current?.preset || "");
        const currentPresetAppliedAt = Number(currentQualityTelemetryRef.current?.appliedAt) || 0;
        const currentPresetAgeMs =
          currentPresetAppliedAt > 0 ? Date.now() - currentPresetAppliedAt : Number.POSITIVE_INFINITY;
        const shouldPreserveRecentIdlePhase =
          selectedDesktopQualityProfileId === "auto" &&
          currentPreset === "desktop_idle" &&
          currentPresetAgeMs < DESKTOP_AUTO_IDLE_HYSTERESIS_MS &&
          !hasRecentDesktopUserIntent(520) &&
          !desktopPointerNavigationActiveRef.current;
        const shouldSkipEarlySettleStage =
          selectedDesktopQualityProfileId === "auto" &&
          !desktopPointerNavigationActiveRef.current &&
          !hasRecentDesktopUserIntent(520) &&
          !tileLoadBurstStateRef.current.active &&
          (Number(tileLoadBurstStateRef.current.lastRemainingTiles) || 0) <= 0 &&
          Boolean(tilesetRef.current?.tilesLoaded) &&
          (currentPreset === "desktop_idle" || currentPreset === "desktop_settle");

        if (selectedDesktopQualityProfileId === "auto") {
          if (currentPhase === "moving") {
            const remainingMovingDwellMs = getDesktopAutoPhaseRemainingDwellMs("moving");
            if (remainingMovingDwellMs > 0) {
              scheduleDesktopIdleRestore(
                attemptId,
                Math.max(settleRecheckDelayMs, remainingMovingDwellMs)
              );
              return;
            }
          }
          if (currentPhase === "settle" && shouldUseDesktopSettleStage) {
            const remainingSettleDwellMs = getDesktopAutoPhaseRemainingDwellMs("settle");
            if (remainingSettleDwellMs > 0 && currentPreset === "desktop_settle") {
              scheduleDesktopIdleRestore(
                attemptId,
                Math.max(settleRecheckDelayMs, remainingSettleDwellMs)
              );
              return;
            }
          }
        }

        if (
          shouldUseDesktopSettleStage &&
          !shouldSkipEarlySettleStage &&
          !shouldPreserveRecentIdlePhase &&
          currentQualityTelemetryRef.current?.preset !== "desktop_settle"
        ) {
          applyDesktopSettleQuality(undefined, "schedule_desktop_idle_restore_early_settle");
          desktopSettleSnapshotRef.current = currentSnapshot;
        }

        if (selectedDesktopQualityProfileId === "auto") {
          const blockedRecoveryDelayMs = getAutoRecoveryBlockDelayMs();
          if (shouldSkipEarlySettleStage && blockedRecoveryDelayMs > 0) {
            if (currentPreset !== "desktop_idle") {
              applyDesktopIdleQuality(
                undefined,
                "schedule_desktop_idle_restore_skip_settle_idle"
              );
            }
            desktopSettleSnapshotRef.current = null;
            return;
          }
          if (blockedRecoveryDelayMs > 0) {
            scheduleDesktopIdleRestore(
              attemptId,
              Math.max(settleRecheckDelayMs, blockedRecoveryDelayMs)
            );
            return;
          }

          const previousSnapshot =
            desktopSettleSnapshotRef.current || currentSnapshot;
          if (!isQualityCameraSnapshotStable(previousSnapshot, currentSnapshot)) {
            desktopSettleSnapshotRef.current = currentSnapshot;
            scheduleDesktopIdleRestore(attemptId, settleRecheckDelayMs);
            return;
          }
        }

        if (shouldUseDesktopSettleStage) {
          applyDesktopSettleQuality(undefined, "schedule_desktop_idle_restore_settle");
          desktopSettleSnapshotRef.current = captureQualityCameraSnapshot(viewer);
          desktopIdleFinalizeTimeoutRef.current = window.setTimeout(() => {
            desktopIdleFinalizeTimeoutRef.current = null;
            if (cancelled) return;
            if (attemptId !== desktopIdleRestoreAttemptRef.current) return;
            if (adaptiveQualityStateRef.current.isMoving) return;

            const blockedRecoveryDelayMs = getAutoRecoveryBlockDelayMs();
            if (
              selectedDesktopQualityProfileId === "auto" &&
              blockedRecoveryDelayMs > 0
            ) {
              const delayedSnapshot = captureQualityCameraSnapshot(viewer);
              const delayedAutoStabilityProfile =
                getDesktopAutoStabilityProfile(delayedSnapshot);
              desktopSettleSnapshotRef.current = delayedSnapshot;
              scheduleDesktopIdleRestore(
                attemptId,
                Math.max(
                  delayedAutoStabilityProfile.settleRecheckDelayMs,
                  blockedRecoveryDelayMs
                )
              );
              return;
            }

            const currentSnapshot = captureQualityCameraSnapshot(viewer);
            const finalizeAutoStabilityProfile =
              selectedDesktopQualityProfileId === "auto"
                ? getDesktopAutoStabilityProfile(currentSnapshot)
                : null;
            const finalizeSettleRecheckDelayMs =
              finalizeAutoStabilityProfile?.settleRecheckDelayMs ??
              DESKTOP_AUTO_SETTLE_RECHECK_DELAY_MS;
            const previousSnapshot =
              desktopSettleSnapshotRef.current || currentSnapshot;
            if (!isQualityCameraSnapshotStable(previousSnapshot, currentSnapshot)) {
              desktopSettleSnapshotRef.current = currentSnapshot;
              scheduleDesktopIdleRestore(attemptId, finalizeSettleRecheckDelayMs);
              return;
            }

            applyDesktopIdleQuality(undefined, "schedule_desktop_idle_restore_finalize_idle");
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
              applyDesktopUltraQuality(undefined, "schedule_desktop_idle_restore_finalize_ultra");
            }, selectedDesktopQualityProfile.ultraRestoreDelayMs);
          }, settleHoldMs);
          return;
        }

        applyDesktopIdleQuality(undefined, "schedule_desktop_idle_restore_idle");
        desktopSettleSnapshotRef.current = null;

        if (!selectedDesktopQualityProfile.enableUltra || modeRef.current !== "google3d") {
          return;
        }
        desktopUltraRestoreTimeoutRef.current = window.setTimeout(() => {
          if (cancelled) return;
          if (attemptId !== desktopIdleRestoreAttemptRef.current) return;
          if (adaptiveQualityStateRef.current.isMoving) return;
          if (
            selectedDesktopQualityProfileId === "auto" &&
            getAutoRecoveryBlockDelayMs() > 0
          ) {
            scheduleDesktopIdleRestore(
              attemptId,
              settleRecheckDelayMs
            );
            return;
          }
          applyDesktopUltraQuality(undefined, "schedule_desktop_idle_restore_ultra");
        }, selectedDesktopQualityProfile.ultraRestoreDelayMs);
      }, Math.max(0, Number(delayMs) || 0));
    };

    const markDesktopNavigationIntent = (
      intentMs = DESKTOP_AUTO_INPUT_INTENT_MS,
      forceMovingQuality = false,
      { allowDuringBenchmark = false } = {}
    ) => {
      if (useTouchNavigation) return;
      if (!isUsableCesiumViewer(viewer)) return;
      if (fpsBenchmarkActiveRef.current && !allowDuringBenchmark) return;
      if (selectedDesktopQualityProfileId !== "auto") return;

      lastDesktopUserIntentAtRef.current = Date.now();

      desktopMovingVisibleUntilRef.current = Math.max(
        desktopMovingVisibleUntilRef.current,
        Date.now() + Math.max(0, Number(intentMs) || 0)
      );

      if (fpsBenchmarkQualityLockRef.current) return;

      if (!forceMovingQuality && currentQualityTelemetryRef.current?.moving === true) {
        return;
      }

      adaptiveQualityStateRef.current.isMoving = true;
      resetDesktopMovingRecoveryWatch();
      desktopSettleSnapshotRef.current = null;
      clearQualityRecoverySafetyTimeout();
      clearDesktopQualityRestoreTimeouts();
      applyDesktopMovingQuality(undefined, "mark_desktop_navigation_intent");
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
    const selectedMobileQualityProfileId = normalizeMobileQualityProfile(
      mobileQualityProfileRef.current
    );
    const selectedMobileQualityProfile = getMobileQualityProfile(
      mobileQualityProfileRef.current,
      allowMobileUltraFromDevice
    );
    const shouldScheduleTimedMobileUltraRestore = () =>
      selectedMobileQualityProfileId !== "auto" &&
      selectedMobileQualityProfile.enableUltra &&
      modeRef.current === "google3d";
    const selectedDesktopQualityProfileId = normalizeDesktopQualityProfile(
      desktopQualityProfileRef.current
    );
    const selectedDesktopQualityProfile = getDesktopQualityProfile(
      desktopQualityProfileRef.current
    );
    const getActiveDesktopQualityProfile = (viewerOrSnapshot = viewer) => {
      if (selectedDesktopQualityProfileId !== "auto") {
        return selectedDesktopQualityProfile;
      }
      return getDesktopAutoQualityProfile(viewerOrSnapshot);
    };
    const preferMaximumDesktopDetail =
      !isMobile &&
      (selectedDesktopQualityProfileId === "high" ||
        selectedDesktopQualityProfileId === "ultra");
    const hasRecentDesktopUserIntent = (withinMs = 1400) => {
      return Date.now() - lastDesktopUserIntentAtRef.current <= withinMs;
    };
    const getCurrentDesktopAutoPhase = () => {
      const phaseRefValue = String(desktopAutoPhaseRef.current.phase || "");
      if (phaseRefValue) return phaseRefValue;
      const currentPreset = String(currentQualityTelemetryRef.current?.preset || "");
      if (currentPreset === "desktop_moving") return "moving";
      if (currentPreset === "desktop_settle") return "settle";
      if (currentPreset === "desktop_idle" || currentPreset === "desktop_ultra") return "idle";
      return adaptiveQualityStateRef.current.isMoving ? "moving" : "idle";
    };
    const getDesktopAutoPhaseMinDwellMs = (phase) => {
      if (phase === "moving") return DESKTOP_AUTO_MOVING_MIN_DWELL_MS;
      if (phase === "settle") return DESKTOP_AUTO_SETTLE_MIN_DWELL_MS;
      if (phase === "idle") return DESKTOP_AUTO_IDLE_MIN_DWELL_MS;
      return 0;
    };
    const canSwitchDesktopAutoPhase = (
      nextPhase,
      { strong = false, now = Date.now() } = {}
    ) => {
      if (selectedDesktopQualityProfileId !== "auto") return true;
      const currentPhase = getCurrentDesktopAutoPhase();
      if (!currentPhase || currentPhase === nextPhase) return true;
      const enteredAt = Number(desktopAutoPhaseRef.current.enteredAt) || 0;
      if (!enteredAt) return true;
      const dwellMs = Math.max(0, now - enteredAt);
      const requiredDwellMs = getDesktopAutoPhaseMinDwellMs(currentPhase);
      if (strong) return true;
      return dwellMs >= requiredDwellMs;
    };
    const getDesktopAutoPhaseRemainingDwellMs = (phase, now = Date.now()) => {
      const enteredAt = Number(desktopAutoPhaseRef.current.enteredAt) || 0;
      if (!enteredAt) return 0;
      return Math.max(0, getDesktopAutoPhaseMinDwellMs(phase) - (now - enteredAt));
    };
    const isDesktopAutoFullySettledView = () => {
      return (
        !isMobile &&
        selectedDesktopQualityProfileId === "auto" &&
        modeRef.current === "google3d" &&
        Boolean(tilesetRef.current?.tilesLoaded) &&
        tileLoadBurstStateRef.current.lastRemainingTiles <= 0 &&
        !desktopPointerNavigationActiveRef.current &&
        !hasRecentDesktopUserIntent(1400)
      );
    };
    const canDesktopAutoRaiseUltra = () => {
      if (isMobile || selectedDesktopQualityProfileId !== "auto") {
        return getAutoRecoveryBlockDelayMs() <= 0;
      }
      const now = Date.now();
      if (!isDesktopAutoFullySettledView()) {
        return getAutoRecoveryBlockDelayMs() <= 0;
      }
      if (
        adaptiveQualityStateRef.current.lastDefensiveDropAt > 0 &&
        now - adaptiveQualityStateRef.current.lastDefensiveDropAt < 2600
      ) {
        return false;
      }
      return true;
    };
    const shouldDesktopAutoUseMovingStabilityDrop = (now = Date.now()) => {
      if (isMobile || selectedDesktopQualityProfileId !== "auto") return true;

      const hasRecentNavigationIntent =
        desktopPointerNavigationActiveRef.current ||
        hasRecentDesktopUserIntent(
          Math.max(
            DESKTOP_AUTO_INPUT_INTENT_MS + 500,
            DESKTOP_AUTO_WHEEL_INTENT_MS
          )
        );
      if (hasRecentNavigationIntent) {
        return true;
      }

      const remainingTiles =
        Number(tileLoadBurstStateRef.current.lastRemainingTiles) || 0;
      const hasRecentTilePressure =
        tileLoadBurstStateRef.current.active ||
        remainingTiles >= ADAPTIVE_QUALITY_AUTO_TILE_BUSY_THRESHOLD ||
        (!tilesetRef.current?.tilesLoaded &&
          adaptiveQualityStateRef.current.lastTileActivityAt > 0 &&
          now - adaptiveQualityStateRef.current.lastTileActivityAt <
            ADAPTIVE_QUALITY_AUTO_TILE_RECOVERY_MS + 300);

      return hasRecentTilePressure;
    };
    const getAutoRecoveryBlockDelayMs = () => {
      if (isMobile || selectedDesktopQualityProfileId !== "auto") return 0;

      const now = Date.now();
      const adaptiveState = adaptiveQualityStateRef.current;
      const cameraHeight = getCameraHeight(viewer);
      const allowCloseDetailIdleConvergence = isDesktopAutoCloseDetailHeight(cameraHeight);
      const tilesetFullyLoaded = Boolean(tilesetRef.current?.tilesLoaded);
      const hasTilePressure =
        tileLoadBurstStateRef.current.active ||
        (Number(tileLoadBurstStateRef.current.lastRemainingTiles) || 0) > 0;
      const allowSettledGrace =
        !desktopPointerNavigationActiveRef.current &&
        !hasRecentDesktopUserIntent(520) &&
        !hasTilePressure &&
        tilesetFullyLoaded;
      const allowCloseDetailGrace =
        allowCloseDetailIdleConvergence && allowSettledGrace;
      let delayMs = Math.max(0, desktopMovingVisibleUntilRef.current - now);

      if (!allowSettledGrace) {
        delayMs = Math.max(
          delayMs,
          Math.max(0, adaptiveState.stabilityHoldUntil - now)
        );
      }

      if (
        !allowCloseDetailIdleConvergence &&
        (!tilesetFullyLoaded && tileLoadBurstStateRef.current.active ||
          (!tilesetFullyLoaded &&
            tileLoadBurstStateRef.current.lastRemainingTiles >=
              ADAPTIVE_QUALITY_AUTO_TILE_BUSY_THRESHOLD))
      ) {
        delayMs = Math.max(delayMs, ADAPTIVE_QUALITY_AUTO_RECOVERY_RECHECK_MS);
      }

      if (
        !allowCloseDetailIdleConvergence &&
        !tilesetFullyLoaded &&
        adaptiveState.lastTileActivityAt > 0
      ) {
        delayMs = Math.max(
          delayMs,
          Math.max(
            0,
            ADAPTIVE_QUALITY_AUTO_TILE_RECOVERY_MS -
              (now - adaptiveState.lastTileActivityAt)
          )
        );
      }

      if (!allowSettledGrace && adaptiveState.lastLongTaskAt > 0) {
        delayMs = Math.max(
          delayMs,
          Math.max(
            0,
            ADAPTIVE_QUALITY_AUTO_LONG_TASK_RECOVERY_MS -
              (now - adaptiveState.lastLongTaskAt)
          )
        );
      }

      if (!allowSettledGrace && adaptiveState.lastOverloadAt > 0) {
        delayMs = Math.max(
          delayMs,
          Math.max(
            0,
            ADAPTIVE_QUALITY_AUTO_FRAME_RECOVERY_MS -
              (now - adaptiveState.lastOverloadAt)
          )
        );
      }

      return delayMs;
    };
    const triggerAutoStabilityDrop = ({
      holdMs = ADAPTIVE_QUALITY_AUTO_FRAME_RECOVERY_MS,
      downgrade = true,
    } = {}) => {
      if (
        isMobile ||
        selectedDesktopQualityProfileId !== "auto" ||
        !isUsableCesiumViewer(viewer)
      ) {
        return;
      }
      if (fpsBenchmarkActiveRef.current || fpsBenchmarkQualityLockRef.current) return;
      if (modeRef.current !== "google3d") return;

      const now = Date.now();
      const adaptiveState = adaptiveQualityStateRef.current;
      const cameraHeight = getCameraHeight(viewer);
      const allowCloseDetailIdleConvergence =
        isDesktopAutoCloseDetailHeight(cameraHeight);
      const isFullySettledAutoView = isDesktopAutoFullySettledView();
      const shouldUseMovingDrop =
        !isFullySettledAutoView &&
        shouldDesktopAutoUseMovingStabilityDrop(now);
      const currentPreset = String(currentQualityTelemetryRef.current?.preset || "");
      const shouldKeepCloseDetailIdle =
        allowCloseDetailIdleConvergence &&
        !desktopPointerNavigationActiveRef.current &&
        !hasRecentDesktopUserIntent(520) &&
        Boolean(tilesetRef.current?.tilesLoaded) &&
        tileLoadBurstStateRef.current.lastRemainingTiles <= 0 &&
        (isFullySettledAutoView || currentPreset === "desktop_idle");

      if (shouldKeepCloseDetailIdle) {
        adaptiveState.isMoving = false;
        desktopMovingVisibleUntilRef.current = 0;
        resetDesktopMovingRecoveryWatch();
        if (currentPreset !== "desktop_idle") {
          applyDesktopIdleQuality(
            undefined,
            "trigger_auto_stability_drop_close_detail_idle"
          );
        }
        return;
      }

      if (shouldUseMovingDrop) {
        adaptiveState.lastOverloadAt = now;
        adaptiveState.stabilityHoldUntil = Math.max(
          adaptiveState.stabilityHoldUntil,
          now + Math.max(0, Number(holdMs) || 0)
        );
        desktopMovingVisibleUntilRef.current = Math.max(
          desktopMovingVisibleUntilRef.current,
          now + Math.max(DESKTOP_AUTO_MIN_MOVING_VISIBLE_MS, Number(holdMs) || 0)
        );
      } else if (!allowCloseDetailIdleConvergence) {
        adaptiveState.lastOverloadAt = now;
        adaptiveState.stabilityHoldUntil = Math.max(
          adaptiveState.stabilityHoldUntil,
          now + Math.max(0, Number(holdMs) || 0)
        );
      }

      if (!downgrade) return;
      if (isFullySettledAutoView || !shouldUseMovingDrop) {
        adaptiveState.lastDefensiveDropAt = now;
        desktopSettleSnapshotRef.current = captureQualityCameraSnapshot(viewer);
        clearQualityRecoverySafetyTimeout();
        clearDesktopQualityRestoreTimeouts();
        adaptiveState.isMoving = false;
        desktopMovingVisibleUntilRef.current = 0;
        resetDesktopMovingRecoveryWatch();
        applyDesktopIdleQuality(
          undefined,
          isFullySettledAutoView
            ? "trigger_auto_stability_drop_idle"
            : "trigger_auto_stability_drop_idle_guard"
        );
        return;
      }
      if (
        adaptiveState.lastDefensiveDropAt &&
        now - adaptiveState.lastDefensiveDropAt <
          ADAPTIVE_QUALITY_AUTO_DROP_MIN_INTERVAL_MS
      ) {
        return;
      }
      if (
        !canSwitchDesktopAutoPhase("moving", {
          strong:
            desktopPointerNavigationActiveRef.current ||
            hasRecentDesktopUserIntent(520) ||
            tileLoadBurstStateRef.current.active,
          now,
        })
      ) {
        return;
      }

      adaptiveState.lastDefensiveDropAt = now;
      desktopSettleSnapshotRef.current = null;
      clearQualityRecoverySafetyTimeout();
      clearDesktopQualityRestoreTimeouts();
      applyDesktopMovingQuality(undefined, "trigger_auto_stability_drop_moving", {
        strategy: "defensive",
      });
    };
    const applyScenePresentationQuality = (
      activeMode = modeRef.current,
      tileset = tilesetRef.current
    ) => {
      const scene = getViewerSceneSafely(viewer);
      if (!scene?.globe) return;
      const shadowMap = getViewerShadowMapSafely(viewer);
      const cameraHeight = getCameraHeight(viewer);
      const useAutoDesktopGoogle3dScene =
        !isMobile &&
        !isIOSDevice &&
        activeMode === "google3d" &&
        selectedDesktopQualityProfileId === "auto";
      const useAutoCinematicScene =
        useAutoDesktopGoogle3dScene &&
        Number.isFinite(cameraHeight) &&
        (cameraHeight >= DESKTOP_AUTO_CINEMATIC_GLOBE_HEIGHT_METERS ||
          adaptiveQualityStateRef.current.isUltraActive);
      const useAutoSpaceBackdrop =
        useAutoDesktopGoogle3dScene &&
        Number.isFinite(cameraHeight) &&
        cameraHeight >= DESKTOP_AUTO_SPACE_BACKDROP_HEIGHT_METERS;
      const useGlobeBackdrop = false;
      const useCinematicDesktopScene = false;
      const usePremiumGlobeBackdrop = useGlobeBackdrop;
      const useDesktopFxaa = false;
      const useCleanCesiumGlobe = activeMode === "google3d";

      updateCesiumGlobeVisibilityForMode(viewer, activeMode);
      scene.globe.enableLighting = false;
      scene.globe.dynamicAtmosphereLighting = false;
      scene.globe.dynamicAtmosphereLightingFromSun = false;
      scene.globe.showGroundAtmosphere = false;
      scene.globe.atmosphereLightIntensity = 2.15;
      scene.globe.lightingFadeInDistance = 9.0e4;
      scene.globe.lightingFadeOutDistance = 7.5e6;
      scene.globe.nightFadeInDistance = 5.0e4;
      scene.globe.nightFadeOutDistance = 6.2e6;
      scene.globe.atmosphereSaturationShift = -0.06;
      scene.globe.atmosphereBrightnessShift = -0.18;
      scene.globe.showWaterEffect = false;
      scene.globe.shadows = Cesium.ShadowMode.DISABLED;
      if (scene.skyAtmosphere) {
        scene.skyAtmosphere.show = useCleanCesiumGlobe ? false : !isIOSDevice;
        scene.skyAtmosphere.atmosphereLightIntensity = 1.8;
        scene.skyAtmosphere.saturationShift = -0.05;
        scene.skyAtmosphere.brightnessShift = -0.1;
      }
      if (scene.skyBox) {
        scene.skyBox.show = false;
      }
      if (scene.fog) {
        scene.fog.enabled = false;
      }
      scene.highDynamicRange = !isIOSDevice;
      scene.sunBloom = false;
      scene.fxaa = useDesktopFxaa;

      if (scene.postProcessStages?.fxaa) {
        scene.postProcessStages.fxaa.enabled = useDesktopFxaa;
      }

      if (scene.postProcessStages?.bloom) {
        scene.postProcessStages.bloom.enabled = false;
        scene.postProcessStages.bloom.uniforms.contrast =
          DEFAULT_SCENE_BLOOM_CONTRAST;
        scene.postProcessStages.bloom.uniforms.brightness =
          DEFAULT_SCENE_BLOOM_BRIGHTNESS;
        scene.postProcessStages.bloom.uniforms.glowOnly = false;
      }

      if (scene.postProcessStages) {
        scene.postProcessStages.tonemapper = Cesium.Tonemapper.PBR_NEUTRAL;
        scene.postProcessStages.exposure = DEFAULT_SCENE_EXPOSURE;
      }

      viewer.shadows = false;
      viewer.terrainShadows = Cesium.ShadowMode.RECEIVE_ONLY;
      if (shadowMap) {
        shadowMap.enabled = false;
        shadowMap.softShadows = false;
        shadowMap.normalOffset = true;
        shadowMap.fadingEnabled = true;
        shadowMap.size = DEFAULT_SCENE_SHADOW_MAP_SIZE;
        shadowMap.maximumDistance = DEFAULT_SCENE_SHADOW_DISTANCE;
      }

      if (tileset) {
        tileset.shadows = Cesium.ShadowMode.DISABLED;
      }

      updateGoogleTilesetBackdropVisibility(
        viewer,
        tileset,
        activeMode,
        cameraHeight,
        isMobile
      );

      updateBaseImageryLayersForViewer(
        viewer,
        osmImageryLayerRef.current,
        google3dBaseImageryLayerRef.current,
        activeMode
      );

      scene.backgroundColor =
        activeMode === "google3d"
          ? Cesium.Color.TRANSPARENT
          : DEFAULT_SCENE_BACKGROUND_COLOR;
      updateSceneBackdropLightForViewer(
        viewer,
        activeMode,
        cameraHeight,
        isMobile
      );
      updateGlobalNightBackdropForViewer(
        viewer,
        globeNightCollectionRef.current,
        activeMode,
        cameraHeight,
        isMobile,
        isNightModeRef.current
      );
      updateGlobalCloudBackdropForViewer(
        viewer,
        globeCloudCollectionRef.current,
        activeMode,
        cameraHeight,
        isMobile
      );
      updateGlobalAtmosphereBackdropForViewer(
        viewer,
        globeAtmosphereCollectionRef.current,
        activeMode,
        cameraHeight,
        isMobile
      );
    };
    const getGoogle3dOverlayAlphaWhileReady = () =>
      isMobile
        ? MOBILE_GOOGLE_OSM_ALPHA
        : getDesktopGoogle3dOverlayAlpha(viewer, selectedDesktopQualityProfileId);
    const getEffectiveGoogle3dOverlayAlpha = () => {
      if (modeRef.current !== "google3d") return 1;
      if (!isSatelliteReadyRef.current) {
        return 1;
      }
      return getGoogle3dOverlayAlphaWhileReady();
    };

    const setCurrentQualityTelemetry = ({
      preset,
      moving,
      resolutionScale,
      msaaSamples,
      globeSse,
      tilesetSse,
      source,
    }) => {
      const now = Date.now();
      const debugCameraHeight = getCameraHeight(viewer);
      const debugIntentAgeMs =
        lastDesktopUserIntentAtRef.current > 0
          ? Math.max(0, now - lastDesktopUserIntentAtRef.current)
          : null;
      const debugRemainingTiles = Math.max(
        0,
        Math.round(Number(tileLoadBurstStateRef.current.lastRemainingTiles) || 0)
      );
      const debugBlockMs =
        !isMobile && selectedDesktopQualityProfileId === "auto"
          ? Math.max(0, Math.round(Number(getAutoRecoveryBlockDelayMs()) || 0))
          : 0;
      const debugReasonParts = [];
      if (source) debugReasonParts.push(String(source));
      if (!isMobile && selectedDesktopQualityProfileId === "auto") {
        if (desktopPointerNavigationActiveRef.current) {
          debugReasonParts.push("pointer_active");
        }
        if (Number.isFinite(debugIntentAgeMs)) {
          debugReasonParts.push(`intent_${Math.round(debugIntentAgeMs)}ms`);
        }
        if (debugBlockMs > 0) {
          debugReasonParts.push(`block_${debugBlockMs}ms`);
        }
        if (debugRemainingTiles > 0) {
          debugReasonParts.push(`tiles_${debugRemainingTiles}`);
        }
      }
      const debugReason = debugReasonParts.join(" | ");
      const transitionLine = `${String(preset || "n/a")} <= ${
        source ? String(source) : "n/a"
      } | intent ${
        Number.isFinite(debugIntentAgeMs) ? Math.round(debugIntentAgeMs) : "?"
      }ms | block ${debugBlockMs}ms | tiles ${debugRemainingTiles} | h ${
        Number.isFinite(debugCameraHeight) ? Math.round(debugCameraHeight) : "?"
      }`;
      qualityTransitionHistoryRef.current = [
        {
          at: now,
          line: transitionLine,
        },
        ...qualityTransitionHistoryRef.current.filter(
          (entry) => entry?.line !== transitionLine
        ),
      ].slice(0, 6);
      if (!isMobile && selectedDesktopQualityProfileId === "auto") {
        const nextPhase =
          preset === "desktop_moving"
            ? "moving"
            : preset === "desktop_settle"
              ? "settle"
              : preset === "desktop_idle" || preset === "desktop_ultra"
                ? "idle"
                : "";
        if (nextPhase) {
          const previousPhase = String(desktopAutoPhaseRef.current.phase || "");
          if (previousPhase !== nextPhase) {
            desktopAutoPhaseRef.current.phase = nextPhase;
            desktopAutoPhaseRef.current.enteredAt = now;
          } else if (!desktopAutoPhaseRef.current.enteredAt) {
            desktopAutoPhaseRef.current.enteredAt = now;
          }
        }
      }
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
        source: source ? String(source) : "",
        appliedAt: now,
        debugReason,
        debugBlockMs,
        debugIntentAgeMs,
        debugCameraHeight: Number.isFinite(debugCameraHeight) ? Number(debugCameraHeight) : null,
        debugRemainingTiles,
        debugPointerActive: Boolean(desktopPointerNavigationActiveRef.current),
        debugRecentTransitions: qualityTransitionHistoryRef.current
          .map((entry) => String(entry?.line || ""))
          .slice(0, 4),
      };
    };

    const getDesktopGoogleEarthTilesetPhaseTuning = (phase = "idle") => {
      const isAutoDesktopProfile = selectedDesktopQualityProfileId === "auto";
      const cameraHeight = getCameraHeight(viewer);
      const useCloseDetailIdle = isDesktopAutoCloseDetailHeight(cameraHeight);
      const useStreetDetailIdle = isDesktopAutoStreetDetailHeight(cameraHeight);
      const normalizedPhase =
        phase === "moving_defensive"
          ? "moving_defensive"
          : phase === "moving_cruise"
            ? "moving_cruise"
            : phase;
      if (!isAutoDesktopProfile) {
        if (normalizedPhase === "idle") {
          return {
            dynamicScreenSpaceError: false,
            foveatedScreenSpaceError: false,
            cullRequestsWhileMoving: false,
            immediatelyLoadDesiredLevelOfDetail: preferMaximumDesktopDetail,
            foveatedTimeDelay: GOOGLE_TILESET_FOVEATED_TIME_DELAY_IDLE_SECONDS,
            progressiveResolutionHeightFraction:
              GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION,
            preferLeaves: true,
          };
        }

        return {
          dynamicScreenSpaceError: !preferMaximumDesktopDetail,
          foveatedScreenSpaceError: !preferMaximumDesktopDetail,
          cullRequestsWhileMoving: false,
          immediatelyLoadDesiredLevelOfDetail: preferMaximumDesktopDetail,
          foveatedTimeDelay: GOOGLE_TILESET_FOVEATED_TIME_DELAY_IDLE_SECONDS,
          progressiveResolutionHeightFraction:
            GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION,
          preferLeaves: true,
        };
      }

      if (normalizedPhase === "moving_defensive") {
        return {
          dynamicScreenSpaceError: true,
          foveatedScreenSpaceError: true,
          cullRequestsWhileMoving: true,
          immediatelyLoadDesiredLevelOfDetail: false,
          foveatedTimeDelay: GOOGLE_TILESET_FOVEATED_TIME_DELAY_MOVING_SECONDS,
          progressiveResolutionHeightFraction:
            GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION_MOVING,
          preferLeaves: true,
        };
      }

      if (normalizedPhase === "moving" || normalizedPhase === "moving_cruise") {
        return {
          dynamicScreenSpaceError: true,
          foveatedScreenSpaceError: true,
          cullRequestsWhileMoving: true,
          immediatelyLoadDesiredLevelOfDetail: useStreetDetailIdle,
          foveatedTimeDelay: GOOGLE_TILESET_FOVEATED_TIME_DELAY_MOVING_SECONDS,
          progressiveResolutionHeightFraction: useStreetDetailIdle
            ? GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION
            : GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION_MOVING_CRUISE,
          preferLeaves: useStreetDetailIdle,
        };
      }

      if (normalizedPhase === "settle") {
        return {
          dynamicScreenSpaceError: !useStreetDetailIdle,
          foveatedScreenSpaceError: !useStreetDetailIdle,
          cullRequestsWhileMoving: false,
          immediatelyLoadDesiredLevelOfDetail: useStreetDetailIdle,
          foveatedTimeDelay: useStreetDetailIdle
            ? GOOGLE_TILESET_FOVEATED_TIME_DELAY_REFINED_SECONDS
            : GOOGLE_TILESET_FOVEATED_TIME_DELAY_SETTLE_SECONDS,
          progressiveResolutionHeightFraction:
            useStreetDetailIdle
              ? GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION
              : GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION_SETTLE,
          preferLeaves: true,
        };
      }

      return {
        dynamicScreenSpaceError: !useCloseDetailIdle,
        foveatedScreenSpaceError: !useCloseDetailIdle,
        cullRequestsWhileMoving: false,
        immediatelyLoadDesiredLevelOfDetail: useCloseDetailIdle,
        foveatedTimeDelay: useCloseDetailIdle
          ? GOOGLE_TILESET_FOVEATED_TIME_DELAY_IDLE_SECONDS
          : GOOGLE_TILESET_FOVEATED_TIME_DELAY_REFINED_SECONDS,
        progressiveResolutionHeightFraction:
          GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION,
        preferLeaves: true,
      };
    };

    const getDesktopMovingQualitySettings = (
      runtimeProfile,
      isOsmMode,
      strategy = "cruise"
    ) => {
      const safeMovingResolutionScale =
        Number(runtimeProfile?.movingResolutionScale) || DESKTOP_AUTO_DEFENSIVE_MOVING_RESOLUTION_SCALE;
      const safeSettleResolutionScale =
        Number(runtimeProfile?.settleResolutionScale) || safeMovingResolutionScale;
      const safeIdleResolutionScale =
        Number(runtimeProfile?.idleResolutionScale) || safeSettleResolutionScale;
      const safeMovingGlobeSse =
        Number(runtimeProfile?.movingGlobeSse) || DESKTOP_AUTO_DEFENSIVE_MOVING_GLOBE_SSE;
      const safeSettleGlobeSse =
        Number(runtimeProfile?.settleGlobeSse) || safeMovingGlobeSse;
      const safeMovingTilesetSse =
        Number(runtimeProfile?.movingTilesetSse) || DESKTOP_AUTO_DEFENSIVE_MOVING_TILESET_SSE;
      const safeSettleTilesetSse =
        Number(runtimeProfile?.settleTilesetSse) || safeMovingTilesetSse;
      const safeMovingMsaaSamples = Math.max(
        1,
        Math.round(Number(runtimeProfile?.movingMsaa) || DESKTOP_AUTO_DEFENSIVE_MOVING_MSAA_SAMPLES)
      );
      const safeSettleMsaaSamples = Math.max(
        safeMovingMsaaSamples,
        Math.round(Number(runtimeProfile?.settleMsaa) || safeMovingMsaaSamples)
      );
      const useAutoCruiseMoving =
        !isOsmMode &&
        selectedDesktopQualityProfileId === "auto" &&
        strategy !== "defensive";

      if (isOsmMode) {
        return {
          msaaSamples: 2,
          resolutionScale: DESKTOP_OSM_MOVING_RESOLUTION_SCALE,
          globeSse: DESKTOP_OSM_MOVING_GLOBE_SSE,
          tilesetSse: null,
          tilesetPhase: "moving",
        };
      }

      if (!useAutoCruiseMoving) {
        if (selectedDesktopQualityProfileId === "auto" && strategy === "defensive") {
          return {
            msaaSamples: DESKTOP_AUTO_DEFENSIVE_MOVING_MSAA_SAMPLES,
            resolutionScale: Math.min(
              safeMovingResolutionScale,
              DESKTOP_AUTO_DEFENSIVE_MOVING_RESOLUTION_SCALE
            ),
            globeSse: Math.max(
              safeMovingGlobeSse,
              DESKTOP_AUTO_DEFENSIVE_MOVING_GLOBE_SSE
            ),
            tilesetSse: Math.max(
              safeMovingTilesetSse,
              DESKTOP_AUTO_DEFENSIVE_MOVING_TILESET_SSE
            ),
            tilesetPhase: "moving_defensive",
          };
        }

        return {
          msaaSamples: safeMovingMsaaSamples,
          resolutionScale: safeMovingResolutionScale,
          globeSse: safeMovingGlobeSse,
          tilesetSse: safeMovingTilesetSse,
          tilesetPhase: "moving",
        };
      }

      return {
        msaaSamples: safeMovingMsaaSamples,
        resolutionScale: safeMovingResolutionScale,
        globeSse: safeMovingGlobeSse,
        tilesetSse: safeMovingTilesetSse,
        tilesetPhase: "moving_cruise",
      };
    };

    const applyDesktopMovingQuality = (
      tileset = tilesetRef.current,
      source = "apply_desktop_moving_quality",
      { strategy = "cruise" } = {}
    ) => {
      if (isMobile || !isUsableCesiumViewer(viewer)) return;
      const runtimeProfile = getActiveDesktopQualityProfile(viewer);
      const isOsmMode = modeRef.current === "osm";
      const movingQualitySettings = getDesktopMovingQualitySettings(
        runtimeProfile,
        isOsmMode,
        strategy
      );
      if (isDesktopAutoFullySettledView()) {
        adaptiveQualityStateRef.current.isMoving = false;
        desktopMovingVisibleUntilRef.current = 0;
        resetDesktopMovingRecoveryWatch();
        if (adaptiveQualityStateRef.current.isUltraActive) {
          applyDesktopUltraQuality(tileset, `${source}:settled_ultra`);
        } else {
          applyDesktopIdleQuality(tileset, `${source}:settled_idle`);
        }
        return;
      }

      applyScenePresentationQuality(modeRef.current, tileset);
      adaptiveQualityStateRef.current.isMoving = true;
      adaptiveQualityStateRef.current.isUltraActive = false;
      viewer.scene.msaaSamples = movingQualitySettings.msaaSamples;
      viewer.resolutionScale = getDesktopProfileResolutionScale(
        movingQualitySettings.resolutionScale,
        DESKTOP_MOVING_RESOLUTION_SCALE,
        preferMaximumDesktopDetail
      );
      viewer.scene.globe.maximumScreenSpaceError = movingQualitySettings.globeSse;
      updateCesiumGlobeVisibilityForMode(viewer, modeRef.current);

      if (tileset && modeRef.current === "google3d") {
        const phaseTuning = getDesktopGoogleEarthTilesetPhaseTuning(
          movingQualitySettings.tilesetPhase
        );
        tileset.maximumScreenSpaceError = movingQualitySettings.tilesetSse;
        tileset.dynamicScreenSpaceError = phaseTuning.dynamicScreenSpaceError;
        tileset.foveatedScreenSpaceError = phaseTuning.foveatedScreenSpaceError;
        tileset.cullRequestsWhileMoving = phaseTuning.cullRequestsWhileMoving;
        tileset.immediatelyLoadDesiredLevelOfDetail =
          phaseTuning.immediatelyLoadDesiredLevelOfDetail;
        tileset.foveatedTimeDelay = phaseTuning.foveatedTimeDelay;
        tileset.progressiveResolutionHeightFraction =
          phaseTuning.progressiveResolutionHeightFraction;
        tileset.preferLeaves = phaseTuning.preferLeaves;
      }

      if (osmImageryLayerRef.current && modeRef.current === "google3d") {
        osmImageryLayerRef.current.alpha = getEffectiveGoogle3dOverlayAlpha();
      }

      setCurrentQualityTelemetry({
        preset: "desktop_moving",
        moving: true,
        resolutionScale: viewer.resolutionScale,
        msaaSamples: viewer.scene.msaaSamples,
        globeSse: movingQualitySettings.globeSse,
        tilesetSse:
          tileset && modeRef.current === "google3d"
            ? movingQualitySettings.tilesetSse
            : null,
        source:
          selectedDesktopQualityProfileId === "auto"
            ? `${source}:${strategy}`
            : source,
      });

      viewer.scene.requestRender();
    };

    const applyDesktopSettleQuality = (
      tileset = tilesetRef.current,
      source = "apply_desktop_settle_quality"
    ) => {
      if (isMobile || !isUsableCesiumViewer(viewer)) return;
      const runtimeProfile = getActiveDesktopQualityProfile(viewer);
      const isOsmMode = modeRef.current === "osm";
      const settleGlobeSse = isOsmMode
        ? DESKTOP_OSM_SETTLE_GLOBE_SSE
        : runtimeProfile.settleGlobeSse;

      applyScenePresentationQuality(modeRef.current, tileset);
      adaptiveQualityStateRef.current.isMoving = false;
      adaptiveQualityStateRef.current.isUltraActive = false;
      updateCesiumGlobeVisibilityForMode(viewer, modeRef.current);
      viewer.scene.msaaSamples = isOsmMode ? 2 : runtimeProfile.settleMsaa;
      viewer.resolutionScale = getDesktopProfileResolutionScale(
        isOsmMode ? DESKTOP_OSM_SETTLE_RESOLUTION_SCALE : runtimeProfile.settleResolutionScale,
        runtimeProfile.movingResolutionScale,
        preferMaximumDesktopDetail
      );
      viewer.scene.globe.maximumScreenSpaceError = settleGlobeSse;

      if (tileset && modeRef.current === "google3d") {
        const phaseTuning = getDesktopGoogleEarthTilesetPhaseTuning("settle");
        tileset.maximumScreenSpaceError = runtimeProfile.settleTilesetSse;
        tileset.dynamicScreenSpaceError = phaseTuning.dynamicScreenSpaceError;
        tileset.foveatedScreenSpaceError = phaseTuning.foveatedScreenSpaceError;
        tileset.cullRequestsWhileMoving = phaseTuning.cullRequestsWhileMoving;
        tileset.immediatelyLoadDesiredLevelOfDetail =
          phaseTuning.immediatelyLoadDesiredLevelOfDetail;
        tileset.foveatedTimeDelay = phaseTuning.foveatedTimeDelay;
        tileset.progressiveResolutionHeightFraction =
          phaseTuning.progressiveResolutionHeightFraction;
        tileset.preferLeaves = phaseTuning.preferLeaves;
      }

      if (osmImageryLayerRef.current && modeRef.current === "google3d") {
        osmImageryLayerRef.current.alpha = getEffectiveGoogle3dOverlayAlpha();
      }

      setCurrentQualityTelemetry({
        preset: "desktop_settle",
        moving: false,
        resolutionScale: viewer.resolutionScale,
        msaaSamples: viewer.scene.msaaSamples,
        globeSse: settleGlobeSse,
        tilesetSse:
          tileset && modeRef.current === "google3d"
            ? runtimeProfile.settleTilesetSse
            : null,
        source,
      });

      viewer.scene.requestRender();
    };

    const applyDesktopIdleQuality = (
      tileset = tilesetRef.current,
      source = "apply_desktop_idle_quality"
    ) => {
      if (isMobile || !isUsableCesiumViewer(viewer)) return;
      const runtimeProfile = getActiveDesktopQualityProfile(viewer);
      const isOsmMode = modeRef.current === "osm";
      const idleGlobeSse = isOsmMode
        ? DESKTOP_OSM_IDLE_GLOBE_SSE
        : runtimeProfile.idleGlobeSse;

      applyScenePresentationQuality(modeRef.current, tileset);
      adaptiveQualityStateRef.current.isMoving = false;
      adaptiveQualityStateRef.current.isUltraActive = false;
      updateCesiumGlobeVisibilityForMode(viewer, modeRef.current);
      viewer.scene.msaaSamples = isOsmMode ? 2 : runtimeProfile.idleMsaa;
      viewer.resolutionScale = getDesktopProfileResolutionScale(
        isOsmMode ? DESKTOP_OSM_IDLE_RESOLUTION_SCALE : runtimeProfile.idleResolutionScale,
        getPreferredResolutionScale(false, isIOSDevice),
        preferMaximumDesktopDetail || runtimeProfile.idleAllowOverdrive
      );
      viewer.scene.globe.maximumScreenSpaceError = idleGlobeSse;

      if (tileset && modeRef.current === "google3d") {
        const phaseTuning = getDesktopGoogleEarthTilesetPhaseTuning("idle");
        tileset.maximumScreenSpaceError = runtimeProfile.idleTilesetSse;
        tileset.dynamicScreenSpaceError = phaseTuning.dynamicScreenSpaceError;
        tileset.foveatedScreenSpaceError = phaseTuning.foveatedScreenSpaceError;
        tileset.cullRequestsWhileMoving = phaseTuning.cullRequestsWhileMoving;
        tileset.immediatelyLoadDesiredLevelOfDetail =
          phaseTuning.immediatelyLoadDesiredLevelOfDetail;
        tileset.foveatedTimeDelay = phaseTuning.foveatedTimeDelay;
        tileset.progressiveResolutionHeightFraction =
          phaseTuning.progressiveResolutionHeightFraction;
        tileset.preferLeaves = phaseTuning.preferLeaves;
      }

      if (osmImageryLayerRef.current && modeRef.current === "google3d") {
        osmImageryLayerRef.current.alpha = getEffectiveGoogle3dOverlayAlpha();
      }

      setCurrentQualityTelemetry({
        preset: "desktop_idle",
        moving: false,
        resolutionScale: viewer.resolutionScale,
        msaaSamples: viewer.scene.msaaSamples,
        globeSse: idleGlobeSse,
        tilesetSse:
          tileset && modeRef.current === "google3d"
            ? runtimeProfile.idleTilesetSse
            : null,
        source,
      });

      viewer.scene.requestRender();
    };

    const applyDesktopUltraQuality = (
      tileset = tilesetRef.current,
      source = "apply_desktop_ultra_quality"
    ) => {
      if (isMobile || !isUsableCesiumViewer(viewer)) return;
      const runtimeProfile = getActiveDesktopQualityProfile(viewer);
      const isOsmMode = modeRef.current === "osm";
      const ultraGlobeSse = isOsmMode
        ? DESKTOP_OSM_ULTRA_GLOBE_SSE
        : runtimeProfile.ultraGlobeSse;

      applyScenePresentationQuality(modeRef.current, tileset);
      adaptiveQualityStateRef.current.isMoving = false;
      adaptiveQualityStateRef.current.isUltraActive = true;
      updateCesiumGlobeVisibilityForMode(viewer, modeRef.current);
      viewer.scene.globe.maximumScreenSpaceError = ultraGlobeSse;
      if (tileset && modeRef.current === "google3d") {
        tileset.maximumScreenSpaceError = runtimeProfile.ultraTilesetSse;
        tileset.dynamicScreenSpaceError = false;
        tileset.foveatedScreenSpaceError = false;
        tileset.cullRequestsWhileMoving = false;
        tileset.immediatelyLoadDesiredLevelOfDetail =
          preferMaximumDesktopDetail || selectedDesktopQualityProfileId === "auto";
        tileset.foveatedTimeDelay = GOOGLE_TILESET_FOVEATED_TIME_DELAY_IDLE_SECONDS;
        tileset.progressiveResolutionHeightFraction =
          GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION;
        tileset.preferLeaves = true;
      }

      if (osmImageryLayerRef.current && modeRef.current === "google3d") {
        osmImageryLayerRef.current.alpha = getEffectiveGoogle3dOverlayAlpha();
      }

      applyUltraViewerQuality();
      setCurrentQualityTelemetry({
        preset: "desktop_ultra",
        moving: false,
        resolutionScale: viewer.resolutionScale,
        msaaSamples: viewer.scene.msaaSamples,
        globeSse: ultraGlobeSse,
        tilesetSse:
          tileset && modeRef.current === "google3d"
            ? runtimeProfile.ultraTilesetSse
            : null,
        source,
      });
    };

    const applyMobileMovingQuality = (tileset = tilesetRef.current) => {
      if (!isMobile) return;
      const isOsmMode = modeRef.current === "osm";
      const movingResolutionScale = isOsmMode
        ? MOBILE_OSM_MOVING_RESOLUTION_SCALE
        : selectedMobileQualityProfile.movingResolutionScale;
      const movingGlobeSse = isOsmMode
        ? MOBILE_OSM_MOVING_GLOBE_SSE
        : selectedMobileQualityProfile.movingGlobeSse;

      applyScenePresentationQuality(modeRef.current, tileset);
      adaptiveQualityStateRef.current.isUltraActive = false;
      viewer.scene.msaaSamples = isOsmMode ? 1 : MOBILE_MOVING_MSAA_SAMPLES;
      viewer.resolutionScale = movingResolutionScale;
      viewer.scene.globe.maximumScreenSpaceError = movingGlobeSse;

      if (tileset && modeRef.current === "google3d") {
        tileset.maximumScreenSpaceError = selectedMobileQualityProfile.movingTilesetSse;
        tileset.dynamicScreenSpaceError = true;
        tileset.foveatedScreenSpaceError = true;
        tileset.cullRequestsWhileMoving = true;
        tileset.immediatelyLoadDesiredLevelOfDetail = false;
        tileset.foveatedTimeDelay = GOOGLE_TILESET_FOVEATED_TIME_DELAY_MOVING_SECONDS;
        tileset.progressiveResolutionHeightFraction =
          GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION_MOVING;
      }

      if (osmImageryLayerRef.current && modeRef.current === "google3d") {
        osmImageryLayerRef.current.alpha = getEffectiveGoogle3dOverlayAlpha();
      }

      setCurrentQualityTelemetry({
        preset: "mobile_moving",
        moving: true,
        resolutionScale: viewer.resolutionScale,
        msaaSamples: viewer.scene.msaaSamples,
        globeSse: movingGlobeSse,
        tilesetSse:
          tileset && modeRef.current === "google3d"
            ? selectedMobileQualityProfile.movingTilesetSse
            : null,
      });

      viewer.scene.requestRender();
    };

    const applyMobileIdleQuality = (tileset = tilesetRef.current) => {
      if (!isMobile) return;
      const isOsmMode = modeRef.current === "osm";
      const idleResolutionScale = isOsmMode
        ? MOBILE_OSM_IDLE_RESOLUTION_SCALE
        : selectedMobileQualityProfile.idleResolutionScale;
      const idleGlobeSse = isOsmMode
        ? MOBILE_OSM_IDLE_GLOBE_SSE
        : selectedMobileQualityProfile.idleGlobeSse;

      applyScenePresentationQuality(modeRef.current, tileset);
      adaptiveQualityStateRef.current.isUltraActive = false;
      viewer.scene.msaaSamples = isOsmMode ? 1 : MOBILE_MSAA_SAMPLES;
      viewer.resolutionScale = idleResolutionScale;
      viewer.scene.globe.maximumScreenSpaceError = idleGlobeSse;

      if (tileset && modeRef.current === "google3d") {
        tileset.maximumScreenSpaceError = selectedMobileQualityProfile.idleTilesetSse;
        tileset.dynamicScreenSpaceError = true;
        tileset.foveatedScreenSpaceError = true;
        tileset.cullRequestsWhileMoving = false;
        tileset.immediatelyLoadDesiredLevelOfDetail = false;
        tileset.foveatedTimeDelay = GOOGLE_TILESET_FOVEATED_TIME_DELAY_SETTLE_SECONDS;
        tileset.progressiveResolutionHeightFraction =
          GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION_SETTLE;
      }

      if (osmImageryLayerRef.current && modeRef.current === "google3d") {
        osmImageryLayerRef.current.alpha = getEffectiveGoogle3dOverlayAlpha();
      }

      setCurrentQualityTelemetry({
        preset: "mobile_idle",
        moving: false,
        resolutionScale: viewer.resolutionScale,
        msaaSamples: viewer.scene.msaaSamples,
        globeSse: idleGlobeSse,
        tilesetSse:
          tileset && modeRef.current === "google3d"
            ? selectedMobileQualityProfile.idleTilesetSse
            : null,
      });

      viewer.scene.requestRender();
    };

    const applyMobileUltraQuality = (tileset = tilesetRef.current) => {
      if (!isMobile || !selectedMobileQualityProfile.enableUltra) return;
      const isOsmMode = modeRef.current === "osm";
      const ultraGlobeSse = isOsmMode
        ? MOBILE_OSM_ULTRA_GLOBE_SSE
        : selectedMobileQualityProfile.ultraGlobeSse;

      applyScenePresentationQuality(modeRef.current, tileset);
      adaptiveQualityStateRef.current.isUltraActive = true;
      viewer.scene.msaaSamples = isOsmMode ? 2 : MOBILE_MSAA_SAMPLES;
      if (typeof window === "undefined") {
        viewer.resolutionScale = isOsmMode
          ? MOBILE_OSM_ULTRA_RESOLUTION_SCALE
          : selectedMobileQualityProfile.ultraResolutionScaleCap;
      } else {
        const devicePixelRatio = Number(window.devicePixelRatio) || 1;
        viewer.resolutionScale = Math.max(
          isOsmMode ? MOBILE_OSM_IDLE_RESOLUTION_SCALE : selectedMobileQualityProfile.idleResolutionScale,
          Math.min(
            isOsmMode
              ? MOBILE_OSM_ULTRA_RESOLUTION_SCALE
              : selectedMobileQualityProfile.ultraResolutionScaleCap,
            devicePixelRatio * (isOsmMode ? 0.76 : 0.86)
          )
        );
      }
      viewer.scene.globe.maximumScreenSpaceError = ultraGlobeSse;

      if (tileset && modeRef.current === "google3d") {
        tileset.maximumScreenSpaceError = selectedMobileQualityProfile.ultraTilesetSse;
        tileset.dynamicScreenSpaceError = false;
        tileset.foveatedScreenSpaceError = false;
        tileset.cullRequestsWhileMoving = false;
      }

      if (osmImageryLayerRef.current && modeRef.current === "google3d") {
        osmImageryLayerRef.current.alpha = getEffectiveGoogle3dOverlayAlpha();
      }

      setCurrentQualityTelemetry({
        preset: "mobile_ultra",
        moving: false,
        resolutionScale: viewer.resolutionScale,
        msaaSamples: viewer.scene.msaaSamples,
        globeSse: ultraGlobeSse,
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
      applyDesktopIdleQuality(undefined, "apply_balanced_viewer_quality");
    };

    const applyUltraViewerQuality = () => {
      if (isMobile) return;
      const runtimeProfile = getActiveDesktopQualityProfile(viewer);
      const isOsmMode = modeRef.current === "osm";
      viewer.scene.msaaSamples = isOsmMode ? 4 : runtimeProfile.ultraMsaa;
      viewer.resolutionScale = getDesktopProfileResolutionScale(
        isOsmMode
          ? DESKTOP_OSM_ULTRA_RESOLUTION_SCALE
          : runtimeProfile.ultraResolutionScaleCap,
        getUltraResolutionScale(isIOSDevice),
        (isOsmMode ? false : preferMaximumDesktopDetail) || runtimeProfile.ultraAllowOverdrive
      );
      viewer.scene.requestRender();
    };

    const applyBenchmarkSegmentQuality = (segmentMeta) => {
      const traceStartedAt = performance.now();
      let traceBranch = "unknown";
      if (!segmentMeta) return;

      const shouldMove =
        typeof segmentMeta.benchmarkMoving === "boolean"
          ? Boolean(segmentMeta.benchmarkMoving)
          : true;
      const shouldMirrorRealDesktopAuto =
        !isMobile && selectedDesktopQualityProfileId === "auto";
      const keepMovingQualityLocked = fpsBenchmarkQualityLockRef.current;
      const effectiveShouldMove = keepMovingQualityLocked ? true : shouldMove;
      traceBranch = effectiveShouldMove
        ? shouldMove
          ? "move"
          : "locked_settle"
        : "settle";

      try {
        if (shouldMirrorRealDesktopAuto) {
          clearQualityRecoverySafetyTimeout();
          resetAdaptiveQualityStats();

          if (shouldMove) {
            markDesktopNavigationIntent(
              Math.max(
                DESKTOP_AUTO_MIN_MOVING_VISIBLE_MS,
                Number(segmentMeta?.durationMs) || 0
              ),
              true,
              { allowDuringBenchmark: true }
            );
            return;
          }

          adaptiveQualityStateRef.current.isMoving = false;
          clearDesktopQualityRestoreTimeouts();
          const restoreAttemptId = desktopIdleRestoreAttemptRef.current;
          desktopSettleSnapshotRef.current = captureQualityCameraSnapshot(viewer);
          scheduleDesktopIdleRestore(
            restoreAttemptId,
            getActiveDesktopQualityProfile(desktopSettleSnapshotRef.current)
              .idleRestoreDelayMs,
            { allowDuringBenchmark: true }
          );
          return;
        }

        adaptiveQualityStateRef.current.isMoving = effectiveShouldMove;
        clearQualityRecoverySafetyTimeout();
        resetAdaptiveQualityStats();

        if (effectiveShouldMove) {
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
          applyDesktopMovingQuality(undefined, "apply_benchmark_segment_quality_moving");
          return;
        }

        if (isMobile) {
          clearMobileQualityRestoreTimeout();
          clearMobileUltraRestoreTimeout();
          mobileQualityRestoreTimeoutRef.current = window.setTimeout(() => {
            if (cancelled) return;
            if (adaptiveQualityStateRef.current.isMoving) return;
            applyMobileIdleQuality();
            if (!shouldScheduleTimedMobileUltraRestore()) {
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
      } finally {
        captureFpsBenchmarkHotPathEvent(
          "apply_benchmark_segment_quality",
          performance.now() - traceStartedAt,
          {
            branch: traceBranch,
            detail: String(segmentMeta?.phaseKey || segmentMeta?.key || ""),
            cooldownMs: 0,
          }
        );
      }
    };

    const applyBenchmarkMovingQualityLock = (durationMs = null) => {
      if (!isMobile && selectedDesktopQualityProfileId === "auto") {
        markDesktopNavigationIntent(
          Math.max(
            DESKTOP_AUTO_MIN_MOVING_VISIBLE_MS,
            Number(durationMs) || 0
          ),
          true,
          { allowDuringBenchmark: true }
        );
        return;
      }

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
      applyDesktopMovingQuality(undefined, "apply_benchmark_moving_quality_lock");
    };

    const releaseBenchmarkMovingQualityLock = () => {
      if (!isMobile && selectedDesktopQualityProfileId === "auto") {
        clearQualityRecoverySafetyTimeout();
        resetAdaptiveQualityStats();
        return;
      }

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
        if (!shouldScheduleTimedMobileUltraRestore()) return;
        mobileUltraRestoreTimeoutRef.current = window.setTimeout(() => {
          if (cancelled) return;
          if (adaptiveQualityStateRef.current.isMoving) return;
          if (modeRef.current !== "google3d") return;
          applyMobileUltraQuality();
        }, selectedMobileQualityProfile.ultraRestoreDelayMs);
        return;
      }

      clearDesktopQualityRestoreTimeouts();
      applyDesktopIdleQuality(undefined, "release_benchmark_moving_quality_lock_idle");
      if (!selectedDesktopQualityProfile.enableUltra) return;
      desktopUltraRestoreTimeoutRef.current = window.setTimeout(() => {
        if (cancelled) return;
        if (adaptiveQualityStateRef.current.isMoving) return;
        if (modeRef.current !== "google3d") return;
        applyDesktopUltraQuality(undefined, "release_benchmark_moving_quality_lock_ultra");
      }, selectedDesktopQualityProfile.ultraRestoreDelayMs);
    };

    applyFpsBenchmarkMovingQualityRef.current = applyBenchmarkMovingQualityLock;
    applyFpsBenchmarkInitialPauseQualityRef.current = () => {
      if (isMobile) {
        applyMobileIdleQuality();
        return;
      }
      if (selectedDesktopQualityProfileId === "auto") {
        applyDesktopIdleQuality(
          undefined,
          "apply_fps_benchmark_initial_pause_quality_idle"
        );
        return;
      }
      applyDesktopIdleQuality(undefined, "apply_fps_benchmark_initial_pause_quality_idle");
    };
    releaseFpsBenchmarkMovingQualityRef.current = releaseBenchmarkMovingQualityLock;
    applyFpsBenchmarkSegmentQualityRef.current = applyBenchmarkSegmentQuality;
    prepareFpsBenchmarkQualityRef.current = () => {
      clearQualityRecoverySafetyTimeout();
      clearGoogleQualityTimeout();
      clearDesktopQualityRestoreTimeouts();
      clearMobileQualityRestoreTimeout();
      clearMobileUltraRestoreTimeout();
      resetAdaptiveQualityStats();
      resetDesktopCameraMotionWatch();
      desktopMovingVisibleUntilRef.current = 0;
      desktopSettleSnapshotRef.current = null;
    };

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
      applyDesktopMovingQuality(tileset, "apply_fast_then_premium_google_quality_moving", {
        strategy: "cruise",
      });
      tileset.maximumScreenSpaceError = selectedDesktopQualityProfile.fastTilesetSse;
      const fastPhaseTuning = getDesktopGoogleEarthTilesetPhaseTuning("moving");
      tileset.dynamicScreenSpaceError = fastPhaseTuning.dynamicScreenSpaceError;
      tileset.foveatedScreenSpaceError = fastPhaseTuning.foveatedScreenSpaceError;
      tileset.cullRequestsWhileMoving = fastPhaseTuning.cullRequestsWhileMoving;
      tileset.immediatelyLoadDesiredLevelOfDetail =
        fastPhaseTuning.immediatelyLoadDesiredLevelOfDetail;
      tileset.foveatedTimeDelay = fastPhaseTuning.foveatedTimeDelay;
      tileset.progressiveResolutionHeightFraction =
        fastPhaseTuning.progressiveResolutionHeightFraction;
      tileset.preferLeaves = fastPhaseTuning.preferLeaves;
      viewer.scene.requestRender();
      googleQualityTimeoutRef.current = window.setTimeout(() => {
        if (cancelled || !tilesetRef.current) return;
        if (fpsBenchmarkActiveRef.current || fpsBenchmarkQualityLockRef.current) return;
        tilesetRef.current.maximumScreenSpaceError =
          selectedDesktopQualityProfile.premiumTilesetSse;
        applyDesktopIdleQuality(tilesetRef.current, "apply_fast_then_premium_google_quality_idle");
      }, GOOGLE_TILESET_FAST_PHASE_MS);

      // Defer ultra quality a bit so initial view and mode switch stay responsive.
      const sinceBootMs = Date.now() - appBootTimestampRef.current;
      const ultraDelayMs = Math.max(900, GOOGLE_TILESET_ULTRA_PHASE_MS - sinceBootMs);
      if (selectedDesktopQualityProfile.enableUltra) {
        googleUltraQualityTimeoutRef.current = window.setTimeout(() => {
          if (cancelled || !tilesetRef.current || modeRef.current !== "google3d") return;
          applyDesktopUltraQuality(tilesetRef.current, "apply_fast_then_premium_google_quality_ultra");
        }, ultraDelayMs);
      }
    };

    const handleAdaptiveFrameQuality = () => {
      const traceStartedAt = performance.now();
      let traceBranch = "skip";
      try {
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

        detectDesktopAutoCameraMotion();

        if (adaptiveQualityStateRef.current.isMoving) {
          const nowMs = Date.now();
          const hasStuckMovingTelemetry =
            currentQualityTelemetryRef.current?.preset === "desktop_moving" ||
            currentQualityTelemetryRef.current?.moving === true;
          if (
            !isMobile &&
            selectedDesktopQualityProfileId === "auto" &&
            hasStuckMovingTelemetry &&
            tilesetRef.current?.tilesLoaded &&
            tileLoadBurstStateRef.current.lastRemainingTiles <= 0 &&
            !fpsBenchmarkActiveRef.current &&
            !fpsBenchmarkQualityLockRef.current &&
            !desktopPointerNavigationActiveRef.current &&
            nowMs - lastDesktopUserIntentAtRef.current > 700
          ) {
            forceExitDesktopMovingQuality();
            resetAdaptiveQualityStats();
            return;
          }
          maybeRecoverStuckDesktopMovingState();
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

        if (!isMobile && selectedDesktopQualityProfileId === "auto") {
          if (frameDeltaMs >= ADAPTIVE_QUALITY_AUTO_SEVERE_FRAME_MS) {
            traceBranch = "auto_severe_frame";
            adaptiveQualityStateRef.current.overloadFrameStreak = 0;
            triggerAutoStabilityDrop({
              holdMs: ADAPTIVE_QUALITY_AUTO_FRAME_RECOVERY_MS + 1000,
            });
            resetAdaptiveQualityStats();
            adaptiveQualityStateRef.current.lastFrameAt = now;
            adaptiveQualityStateRef.current.sampleStartAt = now;
            return;
          }

          if (frameDeltaMs >= ADAPTIVE_QUALITY_AUTO_DROP_FRAME_MS) {
            adaptiveQualityStateRef.current.overloadFrameStreak += 1;
          } else {
            adaptiveQualityStateRef.current.overloadFrameStreak = Math.max(
              0,
              adaptiveQualityStateRef.current.overloadFrameStreak - 1
            );
          }

          if (
            adaptiveQualityStateRef.current.overloadFrameStreak >=
            ADAPTIVE_QUALITY_AUTO_DROP_STREAK_LIMIT
          ) {
            traceBranch = "auto_drop_streak";
            adaptiveQualityStateRef.current.overloadFrameStreak = 0;
            triggerAutoStabilityDrop();
            resetAdaptiveQualityStats();
            adaptiveQualityStateRef.current.lastFrameAt = now;
            adaptiveQualityStateRef.current.sampleStartAt = now;
            return;
          }
        }

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
            traceBranch = "ultra_drop_streak";
            adaptiveQualityStateRef.current.dropFrameStreak = 0;
            if (isMobile) {
              clearMobileUltraRestoreTimeout();
              applyMobileIdleQuality();
            } else if (!isMobile) {
              applyDesktopIdleQuality(undefined, "handle_adaptive_frame_quality_ultra_drop");
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

        if (
          !isMobile &&
          selectedDesktopQualityProfileId === "auto" &&
          avgFrameMs >= ADAPTIVE_QUALITY_AUTO_SLOW_AVG_FRAME_MS
        ) {
          traceBranch = "auto_slow_average";
          triggerAutoStabilityDrop({
            holdMs: ADAPTIVE_QUALITY_AUTO_FRAME_RECOVERY_MS,
          });
          return;
        }

        if (adaptiveQualityStateRef.current.isUltraActive) return;

        if (isMobile) {
          if (
            selectedMobileQualityProfile.enableUltra &&
            avgFps >= selectedMobileQualityProfile.adaptiveRaiseFps
          ) {
            traceBranch = "mobile_raise_ultra";
            applyMobileUltraQuality();
          }
          return;
        }

        if (
          !isMobile &&
          selectedDesktopQualityProfile.enableUltra &&
          avgFps >=
            selectedDesktopQualityProfile.adaptiveRaiseFps +
              (selectedDesktopQualityProfileId === "auto" ? 4 : 0) &&
          (selectedDesktopQualityProfileId !== "auto" ||
            canDesktopAutoRaiseUltra())
        ) {
          traceBranch = "desktop_raise_ultra";
          applyDesktopUltraQuality(undefined, "handle_adaptive_frame_quality_raise_ultra");
        }
      } finally {
        captureFpsBenchmarkHotPathEvent(
          "handle_adaptive_frame_quality",
          performance.now() - traceStartedAt,
          { branch: traceBranch }
        );
      }
    };

    async function ensureGoogleTileset() {
      if (tilesetRef.current) {
        setSatelliteReadySafely(true);
        return tilesetRef.current;
      }

      if (!tilesetPromiseRef.current) {
        const desktopIdlePhaseTuning = !isMobile
          ? getDesktopGoogleEarthTilesetPhaseTuning("idle")
          : null;
        tilesetPromiseRef.current = Cesium.Cesium3DTileset.fromIonAssetId(
          GOOGLE_TILES_ASSET_ID,
          {
            showCreditsOnScreen: true,
            preloadWhenHidden: true,
            preloadFlightDestinations: true,
            skipLevelOfDetail: false,
            shadows: preferMaximumDesktopDetail
              ? Cesium.ShadowMode.ENABLED
              : Cesium.ShadowMode.DISABLED,
            dynamicScreenSpaceError: isMobile
              ? isMobile && !isIOSDevice
              : desktopIdlePhaseTuning?.dynamicScreenSpaceError ?? false,
            cullRequestsWhileMoving: isMobile
              ? false
              : desktopIdlePhaseTuning?.cullRequestsWhileMoving ?? false,
            cullWithChildrenBounds: true,
            preferLeaves: true,
            foveatedScreenSpaceError: isMobile
              ? isMobile && !isIOSDevice
              : desktopIdlePhaseTuning?.foveatedScreenSpaceError ?? false,
            foveatedTimeDelay: isMobile
              ? GOOGLE_TILESET_FOVEATED_TIME_DELAY_IDLE_SECONDS
              : desktopIdlePhaseTuning?.foveatedTimeDelay ??
                GOOGLE_TILESET_FOVEATED_TIME_DELAY_IDLE_SECONDS,
            progressiveResolutionHeightFraction:
              isMobile
                ? GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION
                : desktopIdlePhaseTuning?.progressiveResolutionHeightFraction ??
                  GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION,
            immediatelyLoadDesiredLevelOfDetail:
              isMobile
                ? GOOGLE_TILESET_LOAD_DESIRED_LOD_IMMEDIATELY
                : desktopIdlePhaseTuning?.immediatelyLoadDesiredLevelOfDetail ??
                  (preferMaximumDesktopDetail
                    ? true
                    : GOOGLE_TILESET_LOAD_DESIRED_LOD_IMMEDIATELY),
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
            const settledDesktopPhaseTuning = !isMobile
              ? getDesktopGoogleEarthTilesetPhaseTuning("idle")
              : null;
            tileset.preloadWhenHidden = true;
            tileset.preloadFlightDestinations = true;
            tileset.skipLevelOfDetail = false;
            tileset.shadows = preferMaximumDesktopDetail
              ? Cesium.ShadowMode.ENABLED
              : Cesium.ShadowMode.DISABLED;
            tileset.dynamicScreenSpaceError = isMobile
              ? isMobile && !isIOSDevice
              : settledDesktopPhaseTuning?.dynamicScreenSpaceError ?? false;
            tileset.cullRequestsWhileMoving = isMobile
              ? false
              : settledDesktopPhaseTuning?.cullRequestsWhileMoving ?? false;
            tileset.preferLeaves = true;
            tileset.foveatedScreenSpaceError = isMobile
              ? isMobile && !isIOSDevice
              : settledDesktopPhaseTuning?.foveatedScreenSpaceError ?? false;
            tileset.foveatedTimeDelay =
              isMobile
                ? GOOGLE_TILESET_FOVEATED_TIME_DELAY_IDLE_SECONDS
                : settledDesktopPhaseTuning?.foveatedTimeDelay ??
                  GOOGLE_TILESET_FOVEATED_TIME_DELAY_IDLE_SECONDS;
            tileset.progressiveResolutionHeightFraction =
              isMobile
                ? GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION
                : settledDesktopPhaseTuning?.progressiveResolutionHeightFraction ??
                  GOOGLE_TILESET_PROGRESSIVE_HEIGHT_FRACTION;
            tileset.immediatelyLoadDesiredLevelOfDetail =
              isMobile
                ? GOOGLE_TILESET_LOAD_DESIRED_LOD_IMMEDIATELY
                : settledDesktopPhaseTuning?.immediatelyLoadDesiredLevelOfDetail ??
                  (preferMaximumDesktopDetail
                    ? true
                    : GOOGLE_TILESET_LOAD_DESIRED_LOD_IMMEDIATELY);
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
            const scene = getViewerSceneSafely(viewer);
            const primitives = scene?.primitives;
            if (primitives && !primitives.contains(tileset)) {
              primitives.add(tileset);
            }
            tileset.show = false;
            requestViewerRender(viewer);
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
      applyViewerRenderStrategyForMode(viewer, "osm", isMobile);
      clearGoogleLateReadyListener();
      clearSatelliteLoadWatchdogTimeout();
      clearSatelliteInitialVisualReleaseTimeout();
      clearSatelliteInitialRenderPump();
      clearGoogleQualityTimeout();
      clearDesktopQualityRestoreTimeouts();
      clearMobileQualityRestoreTimeout();
      clearMobileUltraRestoreTimeout();
      clearQualityRecoverySafetyTimeout();
      adaptiveQualityStateRef.current.isUltraActive = false;
      adaptiveQualityStateRef.current.isMoving = false;
      resetAdaptiveQualityStats();
      clearAdaptiveQualityPressure();
      applyBalancedViewerQuality();
      setViewerTerrainProviderSafely(viewer, ellipsoidTerrainProviderRef.current);
      setSceneGoogleTilesetsVisibility(viewer, false);

      updateCesiumGlobeVisibilityForMode(viewer, "osm");
      applyScenePresentationQuality("osm");

      updateBaseImageryLayersForViewer(
        viewer,
        osmImageryLayerRef.current,
        google3dBaseImageryLayerRef.current,
        "osm"
      );

      setIsTilted(false);
      tiltToggleBaseRangeRef.current = null;
      setSatelliteReadySafely(false);
      setTilesReadyVersion((value) => value + 1);
      requestViewerRender(viewer);
    }

    async function enableGoogle() {
      const tileset = await withPromiseTimeout(
        ensureGoogleTileset(),
        GOOGLE_TILESET_SWITCH_TIMEOUT_MS,
        "Le chargement initial de la vue satellite 3D est trop long.",
        "GOOGLE_TILESET_TIMEOUT"
      );
      if (cancelled) return;

      const keepMobileFallbackImageryUntilSatellitePaints = () => {
        if (!isMobile || !osmImageryLayerRef.current) return;
        if (isSatelliteReadyRef.current || tilesetRef.current?.tilesLoaded) {
          osmImageryLayerRef.current.show = false;
          osmImageryLayerRef.current.alpha = 0;
          return;
        }
        osmImageryLayerRef.current.show = true;
        osmImageryLayerRef.current.alpha = 1;
      };

      applyViewerRenderStrategyForMode(viewer, "google3d", isMobile);
      updateCesiumGlobeVisibilityForMode(viewer, "google3d");
      applyScenePresentationQuality("google3d", tileset);

      updateBaseImageryLayersForViewer(
        viewer,
        osmImageryLayerRef.current,
        google3dBaseImageryLayerRef.current,
        "google3d"
      );
      keepMobileFallbackImageryUntilSatellitePaints();
      if (worldTerrainProviderRef.current) {
        setViewerTerrainProviderSafely(viewer, worldTerrainProviderRef.current);
      }

      setSceneGoogleTilesetsVisibility(viewer, true, tileset);
      tileset.show = true;
      applyFastThenPremiumGoogleQuality(tileset);
      requestViewerRender(viewer);

      modeRef.current = "google3d";
      if (mapModeRef.current !== "google3d") {
        mapModeRef.current = "google3d";
        onSetMapModeRef.current?.("google3d");
      }
      const forceGoogleSatelliteFrame = () => {
        if (cancelled || modeRef.current !== "google3d") return;
        updateCesiumGlobeVisibilityForMode(viewer, "google3d");
        updateBaseImageryLayersForViewer(
          viewer,
          osmImageryLayerRef.current,
          google3dBaseImageryLayerRef.current,
          "google3d"
        );
        keepMobileFallbackImageryUntilSatellitePaints();
        setSceneGoogleTilesetsVisibility(viewer, true, tileset);
        tileset.show = true;
        requestViewerRender(viewer);
      };
      const nudgeSatelliteCameraForInitialTileSelection = () => {
        const camera = getViewerCameraSafely(viewer);
        if (!camera) return;
        try {
          camera.moveRight(SATELLITE_INITIAL_CAMERA_NUDGE_METERS);
          camera.moveLeft(SATELLITE_INITIAL_CAMERA_NUDGE_METERS);
        } catch {
          // A visible user movement should not be required to kick Cesium tiles.
        }
      };
      const startSatelliteInitialRenderPump = () => {
        clearSatelliteInitialRenderPump();
        const startedAt = performance.now();
        const maxPumpMs = isMobile
          ? SATELLITE_INITIAL_RENDER_PUMP_MS_MOBILE
          : SATELLITE_INITIAL_RENDER_PUMP_MS;
        let frameCount = 0;
        const pump = (now) => {
          satelliteInitialRenderPumpFrameRef.current = null;
          if (cancelled || modeRef.current !== "google3d") return;
          if (!isUsableCesiumViewer(viewer)) return;
          forceGoogleSatelliteFrame();
          if (frameCount % (isMobile ? 4 : 8) === 0 && !tileset.tilesLoaded) {
            nudgeSatelliteCameraForInitialTileSelection();
          }
          frameCount += 1;
          if (
            !tileset.tilesLoaded &&
            !isSatelliteReadyRef.current &&
            now - startedAt < maxPumpMs
          ) {
            satelliteInitialRenderPumpFrameRef.current =
              window.requestAnimationFrame(pump);
          }
        };
        satelliteInitialRenderPumpFrameRef.current =
          window.requestAnimationFrame(pump);
      };
      forceGoogleSatelliteFrame();
      window.requestAnimationFrame(forceGoogleSatelliteFrame);
      window.setTimeout(forceGoogleSatelliteFrame, 80);
      startSatelliteInitialRenderPump();
      const releaseSatelliteInitialVisual = () => {
        if (cancelled || modeRef.current !== "google3d") return;
        if (!tileset || tileset.show !== true) return;
        forceGoogleSatelliteFrame();
        finishModeTransition({ force: true });
      };
      clearSatelliteInitialVisualReleaseTimeout();
      satelliteInitialVisualReleaseTimeoutRef.current = window.setTimeout(() => {
        satelliteInitialVisualReleaseTimeoutRef.current = null;
        releaseSatelliteInitialVisual();
      }, satelliteBootCacheRef.current?.snapshotDataUrl
        ? SATELLITE_BOOT_CACHE_VISUAL_RELEASE_MS
        : SATELLITE_INITIAL_VISUAL_RELEASE_MS);
      startSatelliteLoadWatchdog();
      const markSatelliteReady = () => {
        clearSatelliteLoadWatchdogTimeout();
        clearSatelliteInitialVisualReleaseTimeout();
        clearSatelliteInitialRenderPump();
        setSatelliteIssueMessage("");
        setSatelliteReadySafely(true);
        updateBaseImageryLayersForViewer(
          viewer,
          osmImageryLayerRef.current,
          google3dBaseImageryLayerRef.current,
          "google3d"
        );
        keepMobileFallbackImageryUntilSatellitePaints();
        forceGoogleSatelliteFrame();
        finishModeTransition({ force: true });
        if (isMobile) {
          applyMobileIdleQuality(tileset);
        } else {
          adaptiveQualityStateRef.current.isMoving = false;
          desktopMovingVisibleUntilRef.current = 0;
          resetDesktopMovingRecoveryWatch();
          clearQualityRecoverySafetyTimeout();
          clearDesktopQualityRestoreTimeouts();
          const restoreAttemptId = desktopIdleRestoreAttemptRef.current;
          desktopSettleSnapshotRef.current = captureQualityCameraSnapshot(viewer);
          scheduleDesktopIdleRestore(restoreAttemptId, 0);
        }
        setTilesReadyVersion((value) => value + 1);
        requestViewerRender(viewer);
        window.requestAnimationFrame(forceGoogleSatelliteFrame);
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
        const pollFallbackReady = () => {
          if (cancelled || modeRef.current !== "google3d") return;
          if (tileset.tilesLoaded) {
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

      if (tileset.tilesLoaded) {
        clearGoogleLateReadyListener();
        markSatelliteReady();
      }

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
            try {
              const diagnostic = await diagnoseGoogleTilesetEndpointAccess(
                CESIUM_ION_TOKEN
              );
              if (diagnostic?.ok) {
                throw lastError;
              }
            } catch (diagnosticError) {
              diagnosticError.cause = lastError;
              throw diagnosticError;
            }
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
        if (requestedMode !== "google3d" || isGoogleSatelliteTransitionReady()) {
          finishModeTransition({ force: requestedMode !== "google3d" });
        }
        return;
      }
      if (!isUsableCesiumViewer(viewer)) {
        if (requestedMode !== "google3d") {
          finishModeTransition({ force: true });
        }
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
        const satelliteRenderable = isGoogleSatelliteTransitionReady();
        if (requestedMode === "google3d" && satelliteStillActive && satelliteRenderable) {
          modeRef.current = "google3d";
          mapModeRef.current = "google3d";
          setSatelliteIssueMessage("");
          setSatelliteReadySafely(true);
          finishModeTransition({ force: true });
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
          finishModeTransition({ force: true });
        }
      } finally {
        if (!cancelled) {
          restoreCamera(viewer, cameraState);
          if (requestedMode === "google3d") {
            updateCesiumGlobeVisibilityForMode(viewer, "google3d");
            updateBaseImageryLayersForViewer(
              viewer,
              osmImageryLayerRef.current,
              google3dBaseImageryLayerRef.current,
              "google3d"
            );
            if (tilesetRef.current) {
              setSceneGoogleTilesetsVisibility(viewer, true, tilesetRef.current);
              tilesetRef.current.show = true;
            }
            window.requestAnimationFrame(() => {
              if (cancelled || modeRef.current !== "google3d") return;
              if (!isUsableCesiumViewer(viewer)) return;
              updateCesiumGlobeVisibilityForMode(viewer, "google3d");
              updateBaseImageryLayersForViewer(
                viewer,
                osmImageryLayerRef.current,
                google3dBaseImageryLayerRef.current,
                "google3d"
              );
              if (tilesetRef.current) {
                setSceneGoogleTilesetsVisibility(viewer, true, tilesetRef.current);
                tilesetRef.current.show = true;
              }
              requestViewerRender(viewer);
            });
          }
          requestViewerRender(viewer);
          if (requestedMode !== "google3d") {
            finishModeTransition();
          }
        }
      }
    }

    const isDesktopPointerCandidate = (event) => {
      if (useTouchNavigation) return false;
      if (event?.pointerType === "touch") return false;
      return true;
    };

    const handleDesktopPointerDown = (event) => {
      if (!isDesktopPointerCandidate(event)) return;
      if (!isUsableCesiumViewer(viewer)) return;
      if (event?.button === 2) return;
      const buttons = Number(event?.buttons) || 0;
      if (event?.button !== 0 && !Boolean(buttons & 1) && !Boolean(buttons & 4)) {
        return;
      }
      desktopPointerNavigationActiveRef.current = true;
      markDesktopNavigationIntent(DESKTOP_AUTO_INPUT_INTENT_MS, true);
    };

    const handleDesktopPointerMove = (event) => {
      if (!isDesktopPointerCandidate(event)) return;
      if (!isUsableCesiumViewer(viewer)) return;
      const buttons = Number(event?.buttons) || 0;
      const isDragging =
        desktopPointerNavigationActiveRef.current || Boolean(buttons & 1) || Boolean(buttons & 4);
      if (!isDragging) return;
      desktopPointerNavigationActiveRef.current = true;
      markDesktopNavigationIntent(DESKTOP_AUTO_MIN_MOVING_VISIBLE_MS, false);
    };

    const handleDesktopPointerUp = (event) => {
      if (event?.pointerType === "touch") return;
      desktopPointerNavigationActiveRef.current = false;
      if (event?.type === "pointerleave") {
        hidePlacementCursorOverlay();
      }
    };

    const handleDesktopWheelIntent = () => {
      if (useTouchNavigation) return;
      if (!isUsableCesiumViewer(viewer)) return;
      const autoStabilityProfile = getDesktopAutoStabilityProfile(viewer);
      markDesktopNavigationIntent(autoStabilityProfile.wheelIntentMs, true);
    };

    const handleDesktopMoveStart = () => {
      if (useTouchNavigation) return;
      if (!isUsableCesiumViewer(viewer)) return;
      if (fpsBenchmarkActiveRef.current) {
        return;
      }
      if (fpsBenchmarkQualityLockRef.current) {
        return;
      }
      if (selectedDesktopQualityProfileId === "auto") {
        return;
      }
      if (selectedDesktopQualityProfileId === "auto") {
        const autoStabilityProfile = getDesktopAutoStabilityProfile(viewer);
        desktopMovingVisibleUntilRef.current = Math.max(
          desktopMovingVisibleUntilRef.current,
          Date.now() + autoStabilityProfile.movingVisibleMs
        );
      } else {
        desktopMovingVisibleUntilRef.current = 0;
      }
      resetDesktopMovingRecoveryWatch();
      desktopSettleSnapshotRef.current = null;
      adaptiveQualityStateRef.current.isMoving = true;
      clearMobileUltraRestoreTimeout();
      clearDesktopQualityRestoreTimeouts();
      applyDesktopMovingQuality(undefined, "handle_desktop_move_start");
      scheduleQualityRecoverySafety();
    };

    const handleDesktopMoveEnd = () => {
      if (useTouchNavigation) return;
      if (!isUsableCesiumViewer(viewer)) return;
      if (fpsBenchmarkActiveRef.current) {
        return;
      }
      if (fpsBenchmarkQualityLockRef.current) {
        return;
      }
      if (selectedDesktopQualityProfileId === "auto") {
        return;
      }
      adaptiveQualityStateRef.current.isMoving = false;
      resetDesktopMovingRecoveryWatch();
      clearQualityRecoverySafetyTimeout();
      clearDesktopQualityRestoreTimeouts();
      const restoreAttemptId = desktopIdleRestoreAttemptRef.current;
      desktopSettleSnapshotRef.current = captureQualityCameraSnapshot(viewer);
      const autoStabilityProfile =
        selectedDesktopQualityProfileId === "auto"
          ? getDesktopAutoStabilityProfile(desktopSettleSnapshotRef.current)
          : null;
      scheduleDesktopIdleRestore(
        restoreAttemptId,
        selectedDesktopQualityProfileId === "auto"
          ? DESKTOP_AUTO_MOVE_TO_SETTLE_DELAY_MS
          : autoStabilityProfile?.idleRestoreDelayMs ??
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
        if (!shouldScheduleTimedMobileUltraRestore()) return;
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
      viewer.container.addEventListener("pointerdown", handleDesktopPointerDown, {
        passive: true,
      });
      viewer.container.addEventListener("pointermove", handleDesktopPointerMove, {
        passive: true,
      });
      window.addEventListener("pointerup", handleDesktopPointerUp, {
        passive: true,
      });
      window.addEventListener("pointercancel", handleDesktopPointerUp, {
        passive: true,
      });
      viewer.container.addEventListener("pointerleave", handleDesktopPointerUp, {
        passive: true,
      });
      viewer.container.addEventListener("wheel", handleDesktopWheelIntent, {
        passive: true,
      });
      if (selectedDesktopQualityProfileId !== "auto") {
        viewer.camera.moveStart.addEventListener(handleDesktopMoveStart);
        viewer.camera.moveEnd.addEventListener(handleDesktopMoveEnd);
      }
      applyDesktopIdleQuality(undefined, "desktop_init_idle");
    }

    viewer.scene.postRender.addEventListener(handleAdaptiveFrameQuality);

    const desktopAutoMovingGuardIntervalId = !isMobile
      ? window.setInterval(() => {
          if (cancelled) return;
          if (selectedDesktopQualityProfileId !== "auto") return;
          if (modeRef.current !== "google3d") return;
          if (!tilesetRef.current?.tilesLoaded) return;
          if (tileLoadBurstStateRef.current.lastRemainingTiles > 0) return;
          if (desktopPointerNavigationActiveRef.current) return;
          if (fpsBenchmarkActiveRef.current || fpsBenchmarkQualityLockRef.current) return;

          const now = Date.now();
          const currentTelemetry = currentQualityTelemetryRef.current || {};
          const isStuckInMoving =
            currentTelemetry.preset === "desktop_moving" ||
            currentTelemetry.moving === true ||
            adaptiveQualityStateRef.current.isMoving;
          if (!isStuckInMoving) return;
          if (now - lastDesktopUserIntentAtRef.current <= 900) return;
          if (now - (Number(currentTelemetry.appliedAt) || 0) <= 700) return;

          adaptiveQualityStateRef.current.isMoving = false;
          desktopMovingVisibleUntilRef.current = 0;
          resetDesktopMovingRecoveryWatch();
          clearQualityRecoverySafetyTimeout();
          clearDesktopQualityRestoreTimeouts();
          desktopSettleSnapshotRef.current = captureQualityCameraSnapshot(viewer);
          applyDesktopIdleQuality(undefined, "desktop_auto_moving_guard_idle");
        }, 250)
      : null;

    const hasPredictiveZoneContext = Boolean(String(searchZone || "").trim()) || syncVersion > 0;
    const activeZoneKey = activeZoneCacheKeyRef.current;
    const activeZoneEntry = readZoneCacheEntry(activeZoneKey);
    const activeZoneWarmAt = Number(activeZoneEntry?.google3dWarmAt) || 0;
    const hasFreshZoneWarmup =
      activeZoneWarmAt > 0 &&
      Date.now() - activeZoneWarmAt < SATELLITE_PREDICTIVE_WARMUP_FRESH_MS;
    const shouldWarmupImmediatelyForInitialSatellite =
      canUseGoogle3D &&
      CESIUM_ION_TOKEN &&
      mapModeRef.current === "google3d" &&
      !hasFreshZoneWarmup;
    const shouldRunPredictiveWarmup =
      canUseGoogle3D &&
      CESIUM_ION_TOKEN &&
      (mapModeRef.current === "google3d" || hasPredictiveZoneContext || !isMobile) &&
      !hasFreshZoneWarmup;

    if (shouldWarmupImmediatelyForInitialSatellite) {
      Promise.resolve().then(() => {
        if (cancelled) return;
        warmupGoogleUntilReady().catch((error) => {
          console.error("Erreur prechargement Google 3D :", error);
        });
      });
    } else if (shouldRunPredictiveWarmup) {
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
      clearSatelliteInitialVisualReleaseTimeout();
      clearSatelliteInitialRenderPump();
      finishFpsBenchmarkRecording();
      if (fpsBenchmarkQualityLockTimeoutRef.current) {
        window.clearTimeout(fpsBenchmarkQualityLockTimeoutRef.current);
        fpsBenchmarkQualityLockTimeoutRef.current = null;
      }
      fpsBenchmarkActiveRef.current = false;
      adaptiveQualityStateRef.current.isMoving = false;
      adaptiveQualityStateRef.current.isUltraActive = false;
      clearAdaptiveQualityPressure();
      fpsBenchmarkQualityLockRef.current = false;
      fpsBenchmarkLastSegmentKeyRef.current = "";
      applyFpsBenchmarkMovingQualityRef.current = () => {};
      applyFpsBenchmarkInitialPauseQualityRef.current = () => {};
      releaseFpsBenchmarkMovingQualityRef.current = () => {};
      applyFpsBenchmarkSegmentQualityRef.current = () => {};
      prepareFpsBenchmarkQualityRef.current = () => {};
      resetAdaptiveQualityStats();
      resetDesktopCameraMotionWatch();
      if (!viewer.isDestroyed()) {
        viewer.scene.postRender.removeEventListener(handleAdaptiveFrameQuality);
      }
      if (modeTransitionTimeoutRef.current) {
        window.clearTimeout(modeTransitionTimeoutRef.current);
        modeTransitionTimeoutRef.current = null;
      }
      clearModeTransitionVisualTimeout();
      clearModeTransitionFailSafeTimeout();
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
        viewer.container.removeEventListener("pointerdown", handleDesktopPointerDown);
        viewer.container.removeEventListener("pointermove", handleDesktopPointerMove);
        window.removeEventListener("pointerup", handleDesktopPointerUp);
        window.removeEventListener("pointercancel", handleDesktopPointerUp);
        viewer.container.removeEventListener("pointerleave", handleDesktopPointerUp);
        viewer.container.removeEventListener("wheel", handleDesktopWheelIntent);
        hidePlacementCursorOverlay();
        if (selectedDesktopQualityProfileId !== "auto") {
          viewer.camera.moveStart.removeEventListener(handleDesktopMoveStart);
          viewer.camera.moveEnd.removeEventListener(handleDesktopMoveEnd);
        }
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (resizeRefreshFrameRef.current) {
        window.cancelAnimationFrame(resizeRefreshFrameRef.current);
        resizeRefreshFrameRef.current = null;
      }
      if (desktopAutoMovingGuardIntervalId) {
        window.clearInterval(desktopAutoMovingGuardIntervalId);
      }
      setModeTransition({
        active: false,
        target: null,
      });
    };
  }, [
    mapMode,
    canUseGoogle3D,
    isMobile,
    isIOSDevice,
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
      markerRenderContextRef.current = {
        biensAvecCoordonnees,
        customMarkers: [...customMarkers],
        addressAnchorAssignments,
      };
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
            font: "20px sans-serif",
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
  }, [markerRenderKey, customMarkers, mapMode, canUseGoogle3D]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    let cancelled = false;
    const runtime = markerRefineRuntimeRef.current;
    const clearScheduledMarkerRefine = () => {
      if (runtime.timeoutId) {
        window.clearTimeout(runtime.timeoutId);
        runtime.timeoutId = null;
      }
    };

    clearScheduledMarkerRefine();

    const isSatelliteMode = canUseGoogle3D && mapMode === "google3d";
    const shouldUseMeshClampForMarkers =
      isSatelliteMode &&
      tilesetRef.current?.tilesLoaded &&
      (SATELLITE_USE_MESH_CLAMP_FOR_MARKERS ||
        (isMobile && SATELLITE_USE_MESH_CLAMP_FOR_MARKERS_MOBILE));

    if (!shouldUseMeshClampForMarkers) {
      runtime.lastAppliedSignature = "";
      return () => {
        cancelled = true;
        clearScheduledMarkerRefine();
        runtime.requestId += 1;
      };
    }

    const renderContext = markerRenderContextRef.current || {};
    const initialBienCount = Array.isArray(renderContext.biensAvecCoordonnees)
      ? renderContext.biensAvecCoordonnees.length
      : 0;
    const initialCustomCount = Array.isArray(renderContext.customMarkers)
      ? renderContext.customMarkers.length
      : 0;

    if (initialBienCount === 0 && initialCustomCount === 0) {
      return () => {
        cancelled = true;
        clearScheduledMarkerRefine();
        runtime.requestId += 1;
      };
    }

    const refineSignature = [
      isSatelliteMode ? "sat" : "osm",
      Number(tilesReadyVersion) || 0,
      markerRenderKey,
      initialCustomCount,
      isMobile ? 1 : 0,
    ].join("|");

    const scheduleMarkerRefine = (
      delayMs = SATELLITE_MARKER_LOD_SETTLE_DELAY_MS
    ) => {
      if (cancelled) return;
      clearScheduledMarkerRefine();
      runtime.timeoutId = window.setTimeout(() => {
        runtime.timeoutId = null;
        void runMarkerRefine();
      }, Math.max(0, Number(delayMs) || 0));
    };

    const runMarkerRefine = async () => {
      if (cancelled || !viewer || viewer.isDestroyed()) return;
      if (runtime.lastAppliedSignature === refineSignature) return;

      if (
        adaptiveQualityStateRef.current.isMoving ||
        fpsBenchmarkActiveRef.current
      ) {
        scheduleMarkerRefine();
        return;
      }

      const currentContext = markerRenderContextRef.current || {};
      const biensAvecCoordonnees = Array.isArray(
        currentContext.biensAvecCoordonnees
      )
        ? currentContext.biensAvecCoordonnees
        : [];
      const customMarkersForRefine = Array.isArray(currentContext.customMarkers)
        ? currentContext.customMarkers
        : [];
      const addressAnchorAssignments =
        currentContext.addressAnchorAssignments instanceof Map
          ? currentContext.addressAnchorAssignments
          : new Map();

      if (
        biensAvecCoordonnees.length === 0 &&
        customMarkersForRefine.length === 0
      ) {
        runtime.lastAppliedSignature = refineSignature;
        return;
      }

      const bienEntitiesByIndex = entitiesRef.current;
      const customEntitiesByIndex = customMarkerEntitiesRef.current;
      if (
        bienEntitiesByIndex.length < biensAvecCoordonnees.length ||
        customEntitiesByIndex.length < customMarkersForRefine.length
      ) {
        scheduleMarkerRefine(120);
        return;
      }

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

      const rawBienPositions = biensAvecCoordonnees.map((bien) =>
        Cesium.Cartesian3.fromDegrees(bien.lon, bien.lat, 0)
      );
      const rawCustomPositions = customMarkersForRefine.map((marker) =>
        Cesium.Cartesian3.fromDegrees(marker.lon, marker.lat, 0)
      );

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
            distanceSquared: Cesium.Cartesian3.distanceSquared(
              cameraPosition,
              position
            ),
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
        customMarkersForRefine.forEach((marker, markerIndex) => {
          const entity = customEntitiesByIndex[markerIndex];
          if (!entity) return;
          const resolvedPosition =
            positions[markerIndex] || rawCustomPositions[markerIndex];
          entity.position = resolvedPosition;
          entity.markerPositionCartesian = resolvedPosition;
        });
      };

      const requestId = runtime.requestId + 1;
      runtime.requestId = requestId;
      const refineStartedAt = performance.now();
      const clampedBienPositions = biensAvecCoordonnees.map((bien, index) => {
        const existingPosition = bienEntitiesByIndex[index]?.markerPositionCartesian;
        return existingPosition || buildFallbackSatellitePosition(bien.lon, bien.lat);
      });
      const clampedCustomPositions = customMarkersForRefine.map(
        (marker, markerIndex) => {
          const existingPosition =
            customEntitiesByIndex[markerIndex]?.markerPositionCartesian;
          return (
            existingPosition ||
            buildFallbackSatellitePosition(marker.lon, marker.lat)
          );
        }
      );
      const totalClampCandidateCount =
        rawBienPositions.length + rawCustomPositions.length;

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
          if (
            cancelled ||
            viewer.isDestroyed() ||
            runtime.requestId !== requestId
          ) {
            return;
          }
          if (Array.isArray(clampedBiens)) {
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
          if (
            cancelled ||
            viewer.isDestroyed() ||
            runtime.requestId !== requestId
          ) {
            return;
          }
          if (Array.isArray(clampedCustomMarkers)) {
            clampedCustomMarkers.forEach((position, sampledIndex) => {
              const index = customIndexesToClamp[sampledIndex];
              const elevated = elevateCartesianPosition(position);
              if (elevated) {
                clampedCustomPositions[index] = elevated;
                return;
              }
              const marker = customMarkersForRefine[index];
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

      if (
        cancelled ||
        viewer.isDestroyed() ||
        runtime.requestId !== requestId
      ) {
        return;
      }

      if (
        adaptiveQualityStateRef.current.isMoving ||
        fpsBenchmarkActiveRef.current
      ) {
        scheduleMarkerRefine();
        return;
      }

      applyBienEntityPositions(clampedBienPositions);
      applyCustomEntityPositions(clampedCustomPositions);
      runtime.lastAppliedSignature = refineSignature;
      recordMapPerfEvent("marker_refine_complete", {
        durationMs: performance.now() - refineStartedAt,
        count: totalClampCandidateCount,
      });
      viewer.scene.requestRender();
    };

    scheduleMarkerRefine(0);

    return () => {
      cancelled = true;
      clearScheduledMarkerRefine();
      runtime.requestId += 1;
    };
  }, [
    canUseGoogle3D,
    isMobile,
    mapMode,
    markerRenderKey,
    customMarkers,
    tilesReadyVersion,
  ]);

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
      const traceStartedAt = performance.now();
      let traceBranch = "skip";
      let traceCameraHeight = null;
      let traceMarkerCount = 0;
      let changed = false;

      try {
        if (cancelled || !viewer || viewer.isDestroyed()) return;

        const isSatelliteMode =
          modeRef.current === "google3d" || Boolean(tilesetRef.current?.show);
        const bienEntities = entitiesRef.current;
        const customEntities = customMarkerEntitiesRef.current;
        traceMarkerCount = bienEntities.length + customEntities.length;

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

        if (!isSatelliteMode) {
          traceBranch = "osm";
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
          traceBranch = "sat-moving-hold";
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
        traceCameraHeight = cameraHeight;
        traceBranch = "sat-rank";
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
      } finally {
        captureFpsBenchmarkHotPathEvent(
          "apply_marker_lod",
          performance.now() - traceStartedAt,
          {
            branch: traceBranch,
            detail:
              traceMarkerCount > 0
                ? `${traceMarkerCount} markers${changed ? " changed" : ""}`
                : changed
                  ? "changed"
                  : "",
            cameraHeight: traceCameraHeight,
          }
        );
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

      if (
        shouldBootInSatelliteMode &&
        restoreCameraFromSatelliteBootCache(viewer)
      ) {
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

    focusOnBien(viewer, bien, 0.9, null, { preserveView: true });
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
    if (typeof window === "undefined") return undefined;
    if (!isPrivateOrLocalHostname(window.location.hostname)) {
      setRenderResolutionDebug(null);
      return undefined;
    }

    let intervalId = null;
    const updateDebugInfo = () => {
      const viewer = viewerRef.current;
      const canvas = viewer?.canvas;
      if (!viewer || !canvas) {
        setRenderResolutionDebug(null);
        return;
      }

      const clientWidth = Math.max(0, Math.round(canvas.clientWidth || 0));
      const clientHeight = Math.max(0, Math.round(canvas.clientHeight || 0));
      const bufferWidth = Math.max(0, Math.round(canvas.width || 0));
      const bufferHeight = Math.max(0, Math.round(canvas.height || 0));
      const widthRatio =
        clientWidth > 0 ? Number((bufferWidth / clientWidth).toFixed(2)) : null;
      const heightRatio =
        clientHeight > 0 ? Number((bufferHeight / clientHeight).toFixed(2)) : null;
      const qualitySnapshot = currentQualityTelemetryRef.current || {};
      const remainingTiles = Math.max(
        0,
        Math.round(Number(tileLoadBurstStateRef.current.lastRemainingTiles) || 0)
      );

      setRenderResolutionDebug({
        clientWidth,
        clientHeight,
        bufferWidth,
        bufferHeight,
        widthRatio,
        heightRatio,
        devicePixelRatio: Number((Number(window.devicePixelRatio) || 1).toFixed(2)),
        resolutionScale: Number.isFinite(Number(viewer.resolutionScale))
          ? Number(Number(viewer.resolutionScale).toFixed(2))
          : null,
        msaaSamples: Number.isFinite(Number(viewer.scene?.msaaSamples))
          ? Number(viewer.scene.msaaSamples)
          : null,
        preset: qualitySnapshot.preset ? String(qualitySnapshot.preset) : "",
        globeSse: Number.isFinite(Number(qualitySnapshot.globeSse))
          ? Number(Number(qualitySnapshot.globeSse).toFixed(2))
          : null,
        tilesetSse: Number.isFinite(Number(qualitySnapshot.tilesetSse))
          ? Number(Number(qualitySnapshot.tilesetSse).toFixed(2))
          : null,
        source: qualitySnapshot.source ? String(qualitySnapshot.source) : "",
        debugReason: qualitySnapshot.debugReason ? String(qualitySnapshot.debugReason) : "",
        debugBlockMs: Number.isFinite(Number(qualitySnapshot.debugBlockMs))
          ? Math.max(0, Math.round(Number(qualitySnapshot.debugBlockMs)))
          : 0,
        debugIntentAgeMs: Number.isFinite(Number(qualitySnapshot.debugIntentAgeMs))
          ? Math.max(0, Math.round(Number(qualitySnapshot.debugIntentAgeMs)))
          : null,
        debugCameraHeight: Number.isFinite(Number(qualitySnapshot.debugCameraHeight))
          ? Math.round(Number(qualitySnapshot.debugCameraHeight))
          : null,
        debugPointerActive: Boolean(qualitySnapshot.debugPointerActive),
        debugRecentTransitions: Array.isArray(qualitySnapshot.debugRecentTransitions)
          ? qualitySnapshot.debugRecentTransitions.map((entry) => String(entry || "")).slice(0, 4)
          : [],
        remainingTiles,
        tilesLoaded: Boolean(tilesetRef.current?.tilesLoaded),
        tilesetVisible: Boolean(tilesetRef.current?.show),
        cloudReady: Boolean(globeCloudCollectionRef.current?.textureReady),
        cloudLayerVisible: Boolean(globeCloudCollectionRef.current?.primitive?.show),
        cloudLayerPresent: Boolean(globeCloudCollectionRef.current?.primitive),
        cloudAlpha: Number.isFinite(Number(globeCloudCollectionRef.current?.alpha))
          ? Number(Number(globeCloudCollectionRef.current.alpha).toFixed(2))
          : null,
        atmosphereAlpha: Number.isFinite(
          Number(globeAtmosphereCollectionRef.current?.alpha)
        )
          ? Number(Number(globeAtmosphereCollectionRef.current.alpha).toFixed(2))
          : null,
      });
    };

    updateDebugInfo();
    intervalId = window.setInterval(updateDebugInfo, 500);

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [tilesReadyVersion, mapMode, desktopQualityProfile, isMobile]);

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
    modeTransitionVisual.visible;
  const modeTransitionVisualOpacity =
    modeTransitionVisual.visible && modeTransitionVisual.fading ? 0 : 1;
  const hasModeTransitionSnapshot = Boolean(modeTransitionVisual.snapshotDataUrl);
  const isSatelliteModeTransition = modeTransition.target === "google3d";
  const useDarkModeTransitionPill =
    hasModeTransitionSnapshot || isSatelliteModeTransition;
  const modeTransitionVisualZIndex = isSatelliteModeTransition ? 40 : 8;
  const modeTransitionSnapshotOpacity = isSatelliteModeTransition ? 0.3 : 0.16;
  const modeTransitionBackdropBackground = isSatelliteModeTransition
    ? hasModeTransitionSnapshot
      ? "rgba(0, 0, 0, 0.84)"
      : "#000"
    : hasModeTransitionSnapshot
      ? "linear-gradient(180deg, rgba(8, 15, 28, 0.10) 0%, rgba(8, 15, 28, 0.14) 100%)"
      : "linear-gradient(180deg, rgba(240, 244, 250, 0.22) 0%, rgba(225, 232, 242, 0.28) 100%)";
  const isLiveSatelliteMode =
    modeRef.current === "google3d" || Boolean(tilesetRef.current?.show);
  const requestedResolvedMode = canUseGoogle3D
    ? resolveMode(mapModeRef.current)
    : "osm";
  const currentResolvedMode =
    isLiveSatelliteMode ? "google3d" : "osm";
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
    requestedResolvedMode === "google3d" &&
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
  const showRenderResolutionDebug = Boolean(renderResolutionDebug) && !isMobile;
  const qualityDebugPresetLabel = renderResolutionDebug?.preset
    ? String(renderResolutionDebug.preset)
        .replace(/^desktop_/, "")
        .replace(/^mobile_/, "")
        .replace(/_/g, " ")
    : "n/a";
  const qualityDebugBadgeTone =
    qualityDebugPresetLabel === "moving"
      ? {
          border: "1px solid rgba(250, 204, 21, 0.45)",
          background: "rgba(120, 53, 15, 0.88)",
          color: "#fde68a",
        }
      : qualityDebugPresetLabel === "idle"
        ? {
            border: "1px solid rgba(74, 222, 128, 0.4)",
            background: "rgba(20, 83, 45, 0.86)",
            color: "#bbf7d0",
          }
        : {
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(15, 23, 42, 0.78)",
            color: "#e2e8f0",
          };
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
  const showNightModeToggle = currentResolvedMode === "google3d" && !isMobile;
  const nightModeButtonLabel = isNightMode ? "Mode jour" : "Mode nuit";
  const nightModeButtonTitle = isNightMode
    ? "Revenir au rendu jour du globe"
    : "Afficher le globe en mode nuit";
  const desktopNightModeRightInset = desktopRightInset + 118;
  const showDesktopFpsControls = currentResolvedMode === "google3d";
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
      const copied = await copyTextToClipboardWithFallback(
        fpsBenchmarkState.lastLogText
      );
      if (!copied) {
        throw new Error("clipboard_copy_failed");
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
      return {
        started: false,
        errorMessage: "Scenario FPS invalide ou point de depart manquant.",
      };
    }

    try {
      finishFpsBenchmarkRecording();
      finishFpsBenchmarkRun(viewer);
      resetFpsBenchmarkHotPathTrace();
      fpsBenchmarkActiveRef.current = true;
      prepareFpsBenchmarkQualityRef.current?.();

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
      const benchmarkDesktopQualityProfileId = normalizeDesktopQualityProfile(
        desktopQualityProfileRef.current
      );
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
      if (!(benchmarkDesktopQualityProfileId === "auto" && !isMobile)) {
        adaptiveQualityStateRef.current.isMoving = initialSegmentShouldMove;
      }
      if (initialSegmentMeta?.key) {
        fpsBenchmarkLastSegmentKeyRef.current = initialSegmentMeta.key;
      }
      if (initialSegmentShouldMove) {
        applyFpsBenchmarkMovingQualityRef.current?.(
          benchmarkTotalDurationMs + FPS_BENCHMARK_PREPARE_DELAY_MS + 120
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
        const stepStartedAt = performance.now();
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
          const cameraUpdateStartedAt = performance.now();
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
          captureFpsBenchmarkHotPathEvent(
            "fps_benchmark_camera_update",
            performance.now() - cameraUpdateStartedAt,
            {
              branch: "recorded",
              detail: `sample ${recordingSampleIndex}`,
            }
          );
        } else {
          const cameraUpdateStartedAt = performance.now();
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
          captureFpsBenchmarkHotPathEvent(
            "fps_benchmark_camera_update",
            performance.now() - cameraUpdateStartedAt,
            {
              branch: "procedural",
              detail: String(segmentMeta?.key || ""),
            }
          );
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
          captureFpsBenchmarkHotPathEvent(
            "fps_benchmark_step",
            performance.now() - stepStartedAt,
            {
              branch: recording?.samples?.length > 1 ? "recorded" : "procedural",
              detail: String(segmentMeta?.key || ""),
            }
          );
          fpsBenchmarkRafRef.current =
            window.requestAnimationFrame(stepBenchmark);
          return;
        }

        captureFpsBenchmarkHotPathEvent(
          "fps_benchmark_step",
          performance.now() - stepStartedAt,
          {
            branch: recording?.samples?.length > 1 ? "recorded" : "procedural",
            detail: String(segmentMeta?.key || ""),
            cooldownMs: 0,
          }
        );
        finishFpsBenchmarkRun(viewer);

        const telemetry = getMapPerfTelemetry();
        const benchmarkHotPathTrace = fpsBenchmarkHotPathTraceRef.current || {
          totalCount: 0,
          topEvents: [],
        };
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
        const hotPathEvents = buildBenchmarkPerfEventSamples(
          benchmarkHotPathTrace.topEvents,
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
        const sortedHotPathDurationsMs = hotPathEvents
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
            hotPathCount: Math.max(
              0,
              Number(benchmarkHotPathTrace.totalCount) || 0
            ),
            maxHotPathMs: roundBenchmarkValue(
              hotPathEvents.reduce(
                (maxDuration, event) =>
                  Math.max(maxDuration, Number(event?.durationMs) || 0),
                0
              )
            ),
            hotPathDurationsMs: sortedHotPathDurationsMs,
            hotPathEvents,
          },
          benchmarkSegmentTimeline
        );
        if (!result) {
          resetFpsBenchmarkHotPathTrace();
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
        resetFpsBenchmarkHotPathTrace();
      };

      fpsBenchmarkRafRef.current = window.requestAnimationFrame(stepBenchmark);
      }, FPS_BENCHMARK_PREPARE_DELAY_MS);

      return { started: true };
    } catch (error) {
      fpsBenchmarkActiveRef.current = false;
      finishFpsBenchmarkRun(viewer);
      resetFpsBenchmarkHotPathTrace();
      return {
        started: false,
        errorMessage:
          error instanceof Error && error.message
            ? error.message
            : "Erreur benchmark FPS inconnue.",
      };
    }
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

    const benchmarkStart = runFpsBenchmark(viewer, nextScenario);
    if (benchmarkStart?.started === false) {
      console.error(
        "Erreur lancement benchmark FPS :",
        benchmarkStart.errorMessage
      );
      persistFpsBenchmarkState((previousState) => ({
        ...previousState,
        running: false,
        message: `Le test FPS n'a pas pu demarrer. ${
          benchmarkStart.errorMessage || "Recharge la page puis reessaie."
        }`,
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
    updateGlobalNightBackdropForViewer(
      viewer,
      globeNightCollectionRef.current,
      "osm",
      getCameraHeight(viewer),
      isMobile,
      isNightModeRef.current
    );

    setIsTilted(false);
    tiltToggleBaseRangeRef.current = null;
    setSatelliteIssueMessage("");
    setIsSatelliteReady(false);
    if (!keepTransition) {
      setModeTransition({
        active: false,
        target: null,
      });
      modeTransitionTargetRef.current = null;
    }
    setTilesReadyVersion((value) => value + 1);
    viewer.scene.requestRender();
  }

  function handleToggleNightMode() {
    const nextNightMode = !isNightModeRef.current;
    isNightModeRef.current = nextNightMode;
    setIsNightMode(nextNightMode);

    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed?.()) return;
    const currentCameraHeight = getCameraHeight(viewer);
    updateGlobalNightBackdropForViewer(
      viewer,
      globeNightCollectionRef.current,
      modeRef.current,
      currentCameraHeight,
      isMobile,
      nextNightMode
    );
    updateGlobalCloudBackdropForViewer(
      viewer,
      globeCloudCollectionRef.current,
      modeRef.current,
      currentCameraHeight,
      isMobile
    );
    updateGlobalAtmosphereBackdropForViewer(
      viewer,
      globeAtmosphereCollectionRef.current,
      modeRef.current,
      currentCameraHeight,
      isMobile
    );
    viewer.scene.requestRender?.();
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
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#02040c",
        backgroundImage:
          currentResolvedMode === "google3d" ? `url("${LOCAL_STARFIELD_URL}")` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
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

      {showRenderResolutionDebug ? (
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            zIndex: 7,
            pointerEvents: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            lineHeight: 1,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.24)",
            ...qualityDebugBadgeTone,
          }}
        >
          <span>{qualityDebugPresetLabel}</span>
          <span style={{ opacity: 0.72 }}>
            {renderResolutionDebug.resolutionScale ?? "?"}x
          </span>
        </div>
      ) : null}

      {showRenderResolutionDebug ? (
        <div
          style={{
            position: "absolute",
            top: 58,
            left: 14,
            zIndex: 6,
            pointerEvents: "none",
            padding: "8px 10px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(15, 23, 42, 0.78)",
            color: "#e2e8f0",
            fontSize: 11,
            lineHeight: 1.45,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.28)",
            maxWidth: 360,
            whiteSpace: "pre-wrap",
          }}
        >
          {`Canvas ${renderResolutionDebug.bufferWidth}x${renderResolutionDebug.bufferHeight} | CSS ${renderResolutionDebug.clientWidth}x${renderResolutionDebug.clientHeight}
ratio ${renderResolutionDebug.widthRatio ?? "?"}x / ${renderResolutionDebug.heightRatio ?? "?"}x | dpr ${renderResolutionDebug.devicePixelRatio}
res ${renderResolutionDebug.resolutionScale ?? "?"} | msaa ${renderResolutionDebug.msaaSamples ?? "?"} | ${renderResolutionDebug.preset || "n/a"}
globeSse ${renderResolutionDebug.globeSse ?? "?"} | tilesetSse ${renderResolutionDebug.tilesetSse ?? "?"}
remainingTiles ${renderResolutionDebug.remainingTiles} | loaded ${renderResolutionDebug.tilesLoaded ? "yes" : "no"} | tileset ${renderResolutionDebug.tilesetVisible ? "on" : "off"}
cloud ready ${renderResolutionDebug.cloudReady ? "yes" : "no"} | layer ${renderResolutionDebug.cloudLayerPresent ? "yes" : "no"} | show ${renderResolutionDebug.cloudLayerVisible ? "yes" : "no"} | alpha ${renderResolutionDebug.cloudAlpha ?? "?"} | atmo ${renderResolutionDebug.atmosphereAlpha ?? "?"}
source ${renderResolutionDebug.source || "n/a"}
why ${renderResolutionDebug.debugReason || "n/a"}
intentAge ${renderResolutionDebug.debugIntentAgeMs ?? "?"}ms | block ${renderResolutionDebug.debugBlockMs ?? 0}ms | h ${renderResolutionDebug.debugCameraHeight ?? "?"} | pointer ${renderResolutionDebug.debugPointerActive ? "yes" : "no"}
trace ${(renderResolutionDebug.debugRecentTransitions || []).join(" || ") || "n/a"}`}
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: modeTransitionVisualZIndex,
          pointerEvents: "none",
          opacity: isModeTransitionVisualVisible ? modeTransitionVisualOpacity : 0,
          transition: modeTransitionVisual.fading
            ? `opacity ${MODE_TRANSITION_VISUAL_FADE_OUT_MS}ms ease`
            : isSatelliteModeTransition
              ? "none"
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
              filter: "none",
              transform: "none",
              opacity: modeTransitionSnapshotOpacity,
            }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: modeTransitionBackdropBackground,
            backdropFilter: "none",
            WebkitBackdropFilter: "none",
          }}
        />
        {!hasModeTransitionSnapshot && !isSatelliteModeTransition ? (
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
            border: useDarkModeTransitionPill
              ? "1px solid rgba(255,255,255,0.34)"
              : "1px solid rgba(148, 163, 184, 0.5)",
            background: useDarkModeTransitionPill
              ? "rgba(15, 23, 42, 0.72)"
              : "rgba(255, 255, 255, 0.78)",
            color: useDarkModeTransitionPill ? "#f8fafc" : "#0f172a",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.01em",
            boxShadow: useDarkModeTransitionPill
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
        <div
          ref={placementCursorOverlayRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.95)",
            background: "rgba(255,255,255,0.22)",
            boxShadow:
              "0 0 0 1px rgba(15, 23, 42, 0.08), 0 0 18px rgba(255,255,255,0.28)",
            pointerEvents: "none",
            zIndex: 7,
            opacity: 0,
            transform: "translate3d(-9999px, -9999px, 0)",
            willChange: "transform, opacity",
            backfaceVisibility: "hidden",
          }}
        />
      ) : null}

      {!isMobile ? (
        <>
          <button
            onClick={handleStartMarkerCreation}
            style={desktopMapButtonStyle(desktopPlusBottom, desktopRightInset, true, true)}
            title="Ajouter une note"
          >
            +
          </button>
          {showDesktopFpsControls ? (
            <>
              <button
                onClick={handleRecordFpsBenchmark}
                disabled={isFpsBenchmarkRecordingDisabled}
                style={desktopMapButtonStyle(
                  desktopBenchmarkRecordBottom,
                  desktopRightInset,
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
                  desktopRightInset,
                  !isFpsBenchmarkButtonDisabled
                )}
                title={fpsBenchmarkPrimaryButtonTitle}
              >
                <span style={mapModeButtonContentStyle()}>
                  {fpsBenchmarkState.running ? <LoadingSpinner size={14} /> : null}
                  <span>{fpsBenchmarkButtonLabel}</span>
                </span>
              </button>
            </>
          ) : null}
          {showNightModeToggle ? (
            <button
              onClick={handleToggleNightMode}
              style={desktopNightModeButtonStyle(
                20,
                desktopNightModeRightInset,
                isNightMode
              )}
              title={nightModeButtonTitle}
            >
              <span style={mapModeButtonContentStyle()}>
                <span>{nightModeButtonLabel}</span>
              </span>
            </button>
          ) : null}
          <button
            onClick={handleToggleMapMode}
            disabled={isMapModeToggleDisabled}
            style={desktopMapButtonStyle(
              20,
              desktopRightInset,
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

          {showNightModeToggle ? (
            <button
              onClick={handleToggleNightMode}
              style={mobileFloatingPillButtonStyle(false, isNightMode)}
              title={nightModeButtonTitle}
            >
              <span style={mapModeButtonContentStyle()}>
                <span>{nightModeButtonLabel}</span>
              </span>
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
            style={desktopMapButtonStyle(84, desktopRightInset, !isTiltToggleDisabled, true)}
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

function mobileFloatingPillButtonStyle(disabled = false, active = false) {
  return {
    minWidth: 132,
    height: 52,
    border: active
      ? "1px solid rgba(226, 232, 240, 0.32)"
      : "1px solid var(--control-border)",
    background: active
      ? "rgba(15, 23, 42, 0.82)"
      : "var(--control-bg)",
    color: active ? "#f8fafc" : "var(--text-primary)",
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

function desktopMapButtonStyle(
  bottom,
  rightInset = 20,
  enabled = true,
  circular = false
) {
  return {
    position: "absolute",
    bottom,
    right: rightInset,
    minWidth: 52,
    height: 52,
    borderRadius: circular ? "50%" : 999,
    border: "1px solid var(--control-border)",
    background: "color-mix(in srgb, var(--control-bg) 82%, transparent)",
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
    WebkitBackdropFilter: "blur(10px)",
  };
}

function desktopNightModeButtonStyle(bottom, rightInset, active = false) {
  return {
    ...desktopMapButtonStyle(bottom, rightInset, true, false),
    border: active
      ? "1px solid rgba(226, 232, 240, 0.32)"
      : "1px solid var(--control-border)",
    background: active
      ? "rgba(15, 23, 42, 0.82)"
      : "color-mix(in srgb, var(--control-bg) 82%, transparent)",
    color: active ? "#f8fafc" : "var(--text-primary)",
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

