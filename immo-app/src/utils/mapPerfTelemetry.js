const MAP_PERF_STORAGE_KEY = "immo3d_map_perf_telemetry_v1";
const MAX_RECENT_EVENTS = 24;
const TELEMETRY_WRITE_DEBOUNCE_MS = 1200;

let telemetryCache = null;
let telemetryLoaded = false;
let telemetryWriteTimeoutId = null;
let telemetryFlushListenerAttached = false;

function nowIso() {
  return new Date().toISOString();
}

function roundMs(value) {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
}

function safeReadStorage() {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createDefaultTelemetry() {
  return {
    schemaVersion: 1,
    updatedAt: nowIso(),
    modeSwitch: {
      total: 0,
      success: 0,
      failure: 0,
      queued: 0,
      avgDurationMs: null,
      avgDurationToSatelliteMs: null,
      avgDurationToPlanMs: null,
      lastDurationMs: null,
      lastTargetMode: null,
      lastStatus: null,
    },
    satelliteReady: {
      firstReadyMs: null,
      lastReadyMs: null,
    },
    markerRefine: {
      runs: 0,
      avgDurationMs: null,
      lastDurationMs: null,
      lastCount: 0,
    },
    tileLoadBurst: {
      runs: 0,
      avgDurationMs: null,
      lastDurationMs: null,
      lastPeakRemainingTiles: 0,
      lastWasMoving: false,
      lastMode: null,
    },
    longTask: {
      count: 0,
      avgDurationMs: null,
      maxDurationMs: null,
      lastDurationMs: null,
      lastWasMoving: false,
      lastRemainingTiles: 0,
      lastMode: null,
    },
    recentEvents: [],
  };
}

function parseTelemetry(value) {
  if (!value) return createDefaultTelemetry();
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") {
      return createDefaultTelemetry();
    }
    return {
      ...createDefaultTelemetry(),
      ...parsed,
      modeSwitch: {
        ...createDefaultTelemetry().modeSwitch,
        ...(parsed.modeSwitch || {}),
      },
      satelliteReady: {
        ...createDefaultTelemetry().satelliteReady,
        ...(parsed.satelliteReady || {}),
      },
      markerRefine: {
        ...createDefaultTelemetry().markerRefine,
        ...(parsed.markerRefine || {}),
      },
      tileLoadBurst: {
        ...createDefaultTelemetry().tileLoadBurst,
        ...(parsed.tileLoadBurst || {}),
      },
      longTask: {
        ...createDefaultTelemetry().longTask,
        ...(parsed.longTask || {}),
      },
      recentEvents: Array.isArray(parsed.recentEvents) ? parsed.recentEvents : [],
    };
  } catch {
    return createDefaultTelemetry();
  }
}

function flushTelemetryToStorage() {
  const storage = safeReadStorage();
  if (!storage || !telemetryLoaded || !telemetryCache) return;
  try {
    storage.setItem(MAP_PERF_STORAGE_KEY, JSON.stringify(telemetryCache));
  } catch {
    // Non-blocking: telemetry must never break UX.
  }
}

function ensureFlushOnPageHide() {
  if (typeof window === "undefined" || telemetryFlushListenerAttached) return;
  window.addEventListener(
    "pagehide",
    () => {
      if (telemetryWriteTimeoutId) {
        window.clearTimeout(telemetryWriteTimeoutId);
        telemetryWriteTimeoutId = null;
      }
      flushTelemetryToStorage();
    },
    { capture: true }
  );
  telemetryFlushListenerAttached = true;
}

function scheduleTelemetryWrite() {
  if (typeof window === "undefined") return;
  ensureFlushOnPageHide();
  if (telemetryWriteTimeoutId) return;
  telemetryWriteTimeoutId = window.setTimeout(() => {
    telemetryWriteTimeoutId = null;
    flushTelemetryToStorage();
  }, TELEMETRY_WRITE_DEBOUNCE_MS);
}

function readTelemetry() {
  if (telemetryLoaded && telemetryCache) {
    return telemetryCache;
  }
  const storage = safeReadStorage();
  telemetryCache = storage
    ? parseTelemetry(storage.getItem(MAP_PERF_STORAGE_KEY))
    : createDefaultTelemetry();
  telemetryLoaded = true;
  ensureFlushOnPageHide();
  return telemetryCache;
}

function writeTelemetry(nextTelemetry) {
  telemetryCache = nextTelemetry || createDefaultTelemetry();
  telemetryLoaded = true;
  scheduleTelemetryWrite();
}

function updateAverage(previousAverage, nextValue, previousCount) {
  if (!Number.isFinite(nextValue)) return previousAverage;
  if (!Number.isFinite(previousAverage) || previousCount <= 0) {
    return nextValue;
  }
  return (previousAverage * previousCount + nextValue) / (previousCount + 1);
}

function appendEvent(nextTelemetry, type, payload = {}) {
  const nextEvents = [
    {
      type,
      at: nowIso(),
      ...payload,
    },
    ...(nextTelemetry.recentEvents || []),
  ].slice(0, MAX_RECENT_EVENTS);
  nextTelemetry.recentEvents = nextEvents;
}

export function recordMapPerfEvent(type, payload = {}) {
  const telemetry = readTelemetry();
  telemetry.updatedAt = nowIso();

  switch (type) {
    case "mode_switch_success": {
      const durationMs = roundMs(payload.durationMs);
      const targetMode = payload.targetMode === "google3d" ? "google3d" : "osm";
      const previousTotal = telemetry.modeSwitch.total;
      const previousToSatellite =
        Number(telemetry.modeSwitch.toSatelliteCount || 0);
      const previousToPlan = Number(telemetry.modeSwitch.toPlanCount || 0);

      telemetry.modeSwitch.total = previousTotal + 1;
      telemetry.modeSwitch.success += 1;
      telemetry.modeSwitch.lastDurationMs = durationMs;
      telemetry.modeSwitch.lastTargetMode = targetMode;
      telemetry.modeSwitch.lastStatus = "success";
      telemetry.modeSwitch.avgDurationMs = roundMs(
        updateAverage(telemetry.modeSwitch.avgDurationMs, durationMs, previousTotal)
      );

      if (targetMode === "google3d") {
        telemetry.modeSwitch.avgDurationToSatelliteMs = roundMs(
          updateAverage(
            telemetry.modeSwitch.avgDurationToSatelliteMs,
            durationMs,
            previousToSatellite
          )
        );
        telemetry.modeSwitch.toSatelliteCount = previousToSatellite + 1;
      } else {
        telemetry.modeSwitch.avgDurationToPlanMs = roundMs(
          updateAverage(
            telemetry.modeSwitch.avgDurationToPlanMs,
            durationMs,
            previousToPlan
          )
        );
        telemetry.modeSwitch.toPlanCount = previousToPlan + 1;
      }

      appendEvent(telemetry, type, { durationMs, targetMode });
      break;
    }
    case "mode_switch_failure": {
      const durationMs = roundMs(payload.durationMs);
      const targetMode = payload.targetMode === "google3d" ? "google3d" : "osm";
      telemetry.modeSwitch.total += 1;
      telemetry.modeSwitch.failure += 1;
      telemetry.modeSwitch.lastDurationMs = durationMs;
      telemetry.modeSwitch.lastTargetMode = targetMode;
      telemetry.modeSwitch.lastStatus = "failure";
      appendEvent(telemetry, type, {
        durationMs,
        targetMode,
        reason: String(payload.reason || ""),
      });
      break;
    }
    case "mode_switch_queued": {
      telemetry.modeSwitch.queued += 1;
      appendEvent(telemetry, type, {
        targetMode: payload.targetMode === "google3d" ? "google3d" : "osm",
      });
      break;
    }
    case "satellite_ready_first": {
      const durationMs = roundMs(payload.durationMs);
      telemetry.satelliteReady.firstReadyMs = durationMs;
      telemetry.satelliteReady.lastReadyMs = durationMs;
      appendEvent(telemetry, type, { durationMs });
      break;
    }
    case "satellite_ready": {
      const durationMs = roundMs(payload.durationMs);
      telemetry.satelliteReady.lastReadyMs = durationMs;
      appendEvent(telemetry, type, { durationMs });
      break;
    }
    case "marker_refine_complete": {
      const durationMs = roundMs(payload.durationMs);
      const count = Math.max(0, Number(payload.count || 0));
      const previousRuns = telemetry.markerRefine.runs;
      telemetry.markerRefine.runs = previousRuns + 1;
      telemetry.markerRefine.lastDurationMs = durationMs;
      telemetry.markerRefine.lastCount = count;
      telemetry.markerRefine.avgDurationMs = roundMs(
        updateAverage(telemetry.markerRefine.avgDurationMs, durationMs, previousRuns)
      );
      appendEvent(telemetry, type, { durationMs, count });
      break;
    }
    case "tile_load_burst_complete": {
      const durationMs = roundMs(payload.durationMs);
      const peakRemainingTiles = Math.max(0, Number(payload.peakRemainingTiles || 0));
      const previousRuns = telemetry.tileLoadBurst.runs;
      telemetry.tileLoadBurst.runs = previousRuns + 1;
      telemetry.tileLoadBurst.lastDurationMs = durationMs;
      telemetry.tileLoadBurst.lastPeakRemainingTiles = peakRemainingTiles;
      telemetry.tileLoadBurst.lastWasMoving = Boolean(payload.moving);
      telemetry.tileLoadBurst.lastMode = String(payload.mode || "");
      telemetry.tileLoadBurst.avgDurationMs = roundMs(
        updateAverage(telemetry.tileLoadBurst.avgDurationMs, durationMs, previousRuns)
      );
      appendEvent(telemetry, type, {
        durationMs,
        peakRemainingTiles,
        moving: Boolean(payload.moving),
        mode: String(payload.mode || ""),
        qualityPreset: String(payload.qualityPreset || ""),
        qualityMoving:
          typeof payload.qualityMoving === "boolean"
            ? Boolean(payload.qualityMoving)
            : null,
        resolutionScale: roundMs(Number(payload.resolutionScale) * 100) / 100,
        msaaSamples: Number.isFinite(Number(payload.msaaSamples))
          ? Number(payload.msaaSamples)
          : null,
        globeSse: roundMs(Number(payload.globeSse) * 100) / 100,
        tilesetSse: roundMs(Number(payload.tilesetSse) * 100) / 100,
      });
      break;
    }
    case "long_task": {
      const durationMs = roundMs(payload.durationMs);
      const remainingTiles = Math.max(0, Number(payload.remainingTiles || 0));
      const previousCount = telemetry.longTask.count;
      telemetry.longTask.count = previousCount + 1;
      telemetry.longTask.lastDurationMs = durationMs;
      telemetry.longTask.lastWasMoving = Boolean(payload.moving);
      telemetry.longTask.lastRemainingTiles = remainingTiles;
      telemetry.longTask.lastMode = String(payload.mode || "");
      telemetry.longTask.maxDurationMs = Math.max(
        Number(telemetry.longTask.maxDurationMs || 0),
        Number(durationMs || 0)
      );
      telemetry.longTask.avgDurationMs = roundMs(
        updateAverage(telemetry.longTask.avgDurationMs, durationMs, previousCount)
      );
      appendEvent(telemetry, type, {
        durationMs,
        moving: Boolean(payload.moving),
        remainingTiles,
        mode: String(payload.mode || ""),
        qualityPreset: String(payload.qualityPreset || ""),
        qualityMoving:
          typeof payload.qualityMoving === "boolean"
            ? Boolean(payload.qualityMoving)
            : null,
        resolutionScale: roundMs(Number(payload.resolutionScale) * 100) / 100,
        msaaSamples: Number.isFinite(Number(payload.msaaSamples))
          ? Number(payload.msaaSamples)
          : null,
        globeSse: roundMs(Number(payload.globeSse) * 100) / 100,
        tilesetSse: roundMs(Number(payload.tilesetSse) * 100) / 100,
      });
      break;
    }
    default: {
      appendEvent(telemetry, type, payload);
      break;
    }
  }

  writeTelemetry(telemetry);
  return telemetry;
}

export function getMapPerfTelemetry() {
  return readTelemetry();
}
