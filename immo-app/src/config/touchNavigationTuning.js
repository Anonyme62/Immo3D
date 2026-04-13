// Reglages tactiles de la carte (version simplifiee).
// Toutes les vitesses se reglent ici, puis sont exposées dans le menu de l'app.
export const TOUCH_NAV_TUNING = {
  controller: {
    inertiaSpin: 0.65,
    inertiaTranslate: 0.65,
    inertiaZoom: 0.28,
    maximumMovementRatio: 0.24,
    bounceAnimationTime: 0,
    zoomFactor: 8,
  },
  pan: {
    // Ignore les micro-mouvements du doigt.
    minPixelDelta: 0.5,
    // Vitesse appliquee au moment de la synchronisation.
    // 10 = base recommandee.
    plan: {
      syncSpeed: 10,
      // Reduction progressive au zoom max.
      // Exemple: 50 => la vitesse descend de 10 a 5 au zoom max.
      zoomReductionPercent: 50,
    },
    satellite: {
      syncSpeed: 10,
      zoomReductionPercent: 50,
    },
  },
  zoomLimits: {
    // Limite de zoom-in (plus grand => moins de zoom max possible)
    // pour garder un comportement utile et stable.
    planMinHeight: 220,
    satelliteMinHeight: 120,
  },
  rotate: {
    enableInPlan: false,
    pinchDominantThresholdPx: 4.2,
    minAngleDeltaRad: 0.016,
    orbitGain: 0.34,
    initialRangeFactor: 0.35,
    initialRangeMin: 20,
    initialRangeMax: 260,
  },
};

function readNumber(value, fallbackValue) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallbackValue;
}

function readBoolean(value, fallbackValue) {
  if (typeof value === "boolean") return value;
  return fallbackValue;
}

function clampNumber(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
}

export function mergeTouchNavTuning(candidate = {}) {
  const defaults = TOUCH_NAV_TUNING;

  return {
    controller: {
      inertiaSpin: readNumber(
        candidate?.controller?.inertiaSpin,
        defaults.controller.inertiaSpin
      ),
      inertiaTranslate: readNumber(
        candidate?.controller?.inertiaTranslate,
        defaults.controller.inertiaTranslate
      ),
      inertiaZoom: readNumber(
        candidate?.controller?.inertiaZoom,
        defaults.controller.inertiaZoom
      ),
      maximumMovementRatio: readNumber(
        candidate?.controller?.maximumMovementRatio,
        defaults.controller.maximumMovementRatio
      ),
      bounceAnimationTime: readNumber(
        candidate?.controller?.bounceAnimationTime,
        defaults.controller.bounceAnimationTime
      ),
      zoomFactor: readNumber(
        candidate?.controller?.zoomFactor,
        defaults.controller.zoomFactor
      ),
    },
    pan: {
      minPixelDelta: readNumber(
        candidate?.pan?.minPixelDelta,
        defaults.pan.minPixelDelta
      ),
      plan: {
        syncSpeed: clampNumber(
          readNumber(candidate?.pan?.plan?.syncSpeed, defaults.pan.plan.syncSpeed),
          0.1,
          80
        ),
        zoomReductionPercent: clampNumber(
          readNumber(
            candidate?.pan?.plan?.zoomReductionPercent,
            defaults.pan.plan.zoomReductionPercent
          ),
          0,
          100
        ),
      },
      satellite: {
        syncSpeed: clampNumber(
          readNumber(
            candidate?.pan?.satellite?.syncSpeed,
            defaults.pan.satellite.syncSpeed
          ),
          0.1,
          80
        ),
        zoomReductionPercent: clampNumber(
          readNumber(
            candidate?.pan?.satellite?.zoomReductionPercent,
            defaults.pan.satellite.zoomReductionPercent
          ),
          0,
          100
        ),
      },
    },
    zoomLimits: {
      planMinHeight: readNumber(
        candidate?.zoomLimits?.planMinHeight,
        defaults.zoomLimits.planMinHeight
      ),
      satelliteMinHeight: readNumber(
        candidate?.zoomLimits?.satelliteMinHeight,
        defaults.zoomLimits.satelliteMinHeight
      ),
    },
    rotate: {
      enableInPlan: readBoolean(
        candidate?.rotate?.enableInPlan,
        defaults.rotate.enableInPlan
      ),
      pinchDominantThresholdPx: readNumber(
        candidate?.rotate?.pinchDominantThresholdPx,
        defaults.rotate.pinchDominantThresholdPx
      ),
      minAngleDeltaRad: readNumber(
        candidate?.rotate?.minAngleDeltaRad,
        defaults.rotate.minAngleDeltaRad
      ),
      orbitGain: readNumber(
        candidate?.rotate?.orbitGain,
        defaults.rotate.orbitGain
      ),
      initialRangeFactor: readNumber(
        candidate?.rotate?.initialRangeFactor,
        defaults.rotate.initialRangeFactor
      ),
      initialRangeMin: readNumber(
        candidate?.rotate?.initialRangeMin,
        defaults.rotate.initialRangeMin
      ),
      initialRangeMax: readNumber(
        candidate?.rotate?.initialRangeMax,
        defaults.rotate.initialRangeMax
      ),
    },
  };
}
