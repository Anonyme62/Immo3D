import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { CESIUM_ION_TOKEN } from "./config";
import {
  buildLabelGroupAssignments,
  buildMarkerEntityId,
  getMarkerLabelOffset,
  getMarkerRenderPriority,
  getMarkerVisualState,
} from "./utils/mapMarkerStyle";

const GOOGLE_TILES_ASSET_ID = 2275207;

if (!CESIUM_ION_TOKEN) {
  console.warn(
    "VITE_CESIUM_ION_TOKEN est absent. La vue Google 3D restera indisponible tant que le token n'est pas configure."
  );
}

Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN;

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

function optimizeTouchNavigation(viewer) {
  const controller = viewer.scene.screenSpaceCameraController;
  controller.inertiaSpin = 0.65;
  controller.inertiaTranslate = 0.65;
  controller.inertiaZoom = 0.28;
  controller.maximumMovementRatio = 0.24;
  controller.bounceAnimationTime = 0;
  controller.enableCollisionDetection = true;
  controller.zoomFactor = 8;
  controller.enableLook = false;
  controller.enableTilt = true;
  controller.lookEventTypes = [];
  controller.tiltEventTypes = [Cesium.CameraEventType.MIDDLE_DRAG];
  controller.zoomEventTypes = [Cesium.CameraEventType.PINCH];
  controller.rotateEventTypes = Cesium.CameraEventType.LEFT_DRAG;
  controller.maximumTiltAngle = Cesium.Math.PI_OVER_TWO;
}

export default function CesiumMap({
  biens,
  customMarkers = [],
  selectedBienId,
  setSelectedBien,
  onAddCustomMarker,
  onUpdateCustomMarker,
  onDeleteCustomMarker,
  mapMode,
  canUseGoogle3D,
  onToggleMapMode,
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
  const placingBienIdRef = useRef(placingBienId);
  const markerTextareaRef = useRef(null);
  const tilesetRef = useRef(null);
  const tilesetPromiseRef = useRef(null);
  const boundaryDataSourceRef = useRef(null);
  const entitiesRef = useRef([]);
  const markerDataByIdRef = useRef(new Map());
  const modeRef = useRef(null);
  const hasInitialFlyRef = useRef(false);
  const [isTilted, setIsTilted] = useState(false);
  const [selectedCustomMarkerId, setSelectedCustomMarkerId] = useState(null);
  const [pendingMarkerPosition, setPendingMarkerPosition] = useState(null);
  const [markerDraftNote, setMarkerDraftNote] = useState("");
  const [markerError, setMarkerError] = useState("");
  const [markerSaving, setMarkerSaving] = useState(false);
  const [tilesReadyVersion, setTilesReadyVersion] = useState(0);

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
    placingBienIdRef.current = placingBienId;
  }, [placingBienId]);

  function applyEntityVisualState(entity) {
    const bien = entity.bienData;
    if (!bien) return;

    const markerState = getMarkerVisualState(bien, selectedBienId);
    entity.show = true;
    entity.point.show = true;
    entity.label.show = true;
    entity.point.pixelSize = markerState.pixelSize;
    entity.point.color = Cesium.Color[markerState.color.toUpperCase()];
    entity.point.outlineWidth = markerState.outlineWidth;
    entity.label.font = markerState.font;
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

  function focusOnBien(viewer, bien, duration = 1) {
    if (!viewer || !bien || bien.lat == null || bien.lon == null) return;

    const currentMode = resolveMode(mapMode);
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
    });
  }

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    containerRef.current.style.touchAction = "none";

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
    viewer.selectedEntity = undefined;
    viewer.scene.globe.depthTestAgainstTerrain = false;
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.skyBox.show = false;
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#dbeafe");
    viewer.targetFrameRate = 60;
    if (isMobile) {
      optimizeTouchNavigation(viewer);
      viewer.useBrowserRecommendedResolution = false;
      viewer.resolutionScale = 1;
    }
    viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
      Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(
      new Cesium.OpenStreetMapImageryProvider({
        url: "https://tile.openstreetmap.org/",
      })
    );

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click) => {
      const pickedObject = viewer.scene.pick(click.position);
      viewer.selectedEntity = undefined;
      setMarkerError("");

      if (Cesium.defined(pickedObject) && pickedObject.id) {
        if (pickedObject.id.customMarkerData) {
          const marker = pickedObject.id.customMarkerData;
          setPendingMarkerPosition(null);
          setSelectedCustomMarkerId(marker.id);
          setMarkerDraftNote(marker.note || "");
          return;
        }

        const bienClique = pickedObject.id.bienData;
        if (bienClique) {
          setPendingMarkerPosition(null);
          setSelectedCustomMarkerId(null);
          onSelectBienRef.current?.(bienClique);
          return;
        }
      }

      const cartesian = getClickPosition(viewer.scene, click.position);
      if (!cartesian) return;

      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);

      if (placingBienIdRef.current) {
        onPlaceBienRef.current?.(
          placingBienIdRef.current,
          Cesium.Math.toDegrees(cartographic.latitude),
          Cesium.Math.toDegrees(cartographic.longitude)
        );
        setPendingMarkerPosition(null);
        setSelectedCustomMarkerId(null);
        return;
      }

      setSelectedCustomMarkerId(null);
      setPendingMarkerPosition({
        lat: Cesium.Math.toDegrees(cartographic.latitude),
        lon: Cesium.Math.toDegrees(cartographic.longitude),
      });
      setMarkerDraftNote("");
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
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

    async function ensureGoogleTileset() {
      if (tilesetRef.current) {
        return tilesetRef.current;
      }

      if (!tilesetPromiseRef.current) {
        tilesetPromiseRef.current = Cesium.Cesium3DTileset.fromIonAssetId(
          GOOGLE_TILES_ASSET_ID
        )
          .then((tileset) => {
            tilesetRef.current = tileset;
            if (!viewer.scene.primitives.contains(tileset)) {
              viewer.scene.primitives.add(tileset);
            }
            tileset.show = false;
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
      if (tilesetRef.current) {
        tilesetRef.current.show = false;
      }

      viewer.scene.globe.show = true;
      viewer.scene.skyBox.show = false;
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#dbeafe");
      viewer.imageryLayers.removeAll();
      viewer.imageryLayers.addImageryProvider(
        new Cesium.OpenStreetMapImageryProvider({
          url: "https://tile.openstreetmap.org/",
        })
      );
      modeRef.current = "osm";
      setTilesReadyVersion((value) => value + 1);
    }

    async function enableGoogle() {
      const tileset = await ensureGoogleTileset();
      if (cancelled) return;

      viewer.scene.globe.show = true;
      viewer.scene.skyBox.show = false;
      viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#dbeafe");
      viewer.imageryLayers.removeAll();
      tileset.show = true;
      modeRef.current = "google3d";
      setTilesReadyVersion((value) => value + 1);
    }

    async function applyMode() {
      const requestedMode = resolveMode(mapMode);
      if (modeRef.current === requestedMode) return;

      const cameraState = captureCamera(viewer);

      try {
        if (requestedMode === "google3d") {
          await enableGoogle();
        } else {
          enableOsm();
        }
      } catch (error) {
        console.error("Erreur changement de mode carte :", error);
        enableOsm();
      } finally {
        if (!cancelled) {
          restoreCamera(viewer, cameraState);
          viewer.scene.requestRender();
        }
      }
    }

    applyMode();

    return () => {
      cancelled = true;
    };
  }, [mapMode]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    let cancelled = false;

    async function renderMarkers() {
      viewer.entities.removeAll();
      entitiesRef.current = [];
      markerDataByIdRef.current = new Map();

      const biensAvecCoordonnees = biens
        .filter((bien) => bien.lat != null && bien.lon != null)
        .sort(
          (a, b) =>
            getMarkerRenderPriority(a, selectedBienId) -
            getMarkerRenderPriority(b, selectedBienId)
        );

      const labelGroupAssignments =
        biensAvecCoordonnees.length > 0
          ? buildLabelGroupAssignments(biensAvecCoordonnees)
          : new Map();

      const rawBienPositions = biensAvecCoordonnees.map((bien) =>
        Cesium.Cartesian3.fromDegrees(bien.lon, bien.lat, 0)
      );
      const rawCustomPositions = customMarkers.map((marker) =>
        Cesium.Cartesian3.fromDegrees(marker.lon, marker.lat, 0)
      );

      let finalBienPositions = rawBienPositions;
      let finalCustomPositions = rawCustomPositions;

      try {
        if (modeRef.current === "google3d" && tilesetRef.current) {
          if (rawBienPositions.length > 0) {
            const clampedBiens = await viewer.scene.clampToHeightMostDetailed(
              rawBienPositions
            );

            if (!cancelled && clampedBiens && clampedBiens.length === rawBienPositions.length) {
              finalBienPositions = clampedBiens.map((position, index) => {
                const basePosition = position || rawBienPositions[index];
                const cartographic = Cesium.Cartographic.fromCartesian(basePosition);

                return Cesium.Cartesian3.fromRadians(
                  cartographic.longitude,
                  cartographic.latitude,
                  (cartographic.height || 0) + 3
                );
              });
            }
          }

          if (rawCustomPositions.length > 0) {
            const clampedMarkers = await viewer.scene.clampToHeightMostDetailed(
              rawCustomPositions
            );

            if (
              !cancelled &&
              clampedMarkers &&
              clampedMarkers.length === rawCustomPositions.length
            ) {
              finalCustomPositions = clampedMarkers.map((position, index) => {
                const basePosition = position || rawCustomPositions[index];
                const cartographic = Cesium.Cartographic.fromCartesian(basePosition);

                return Cesium.Cartesian3.fromRadians(
                  cartographic.longitude,
                  cartographic.latitude,
                  (cartographic.height || 0) + 3
                );
              });
            }
          }
        }
      } catch (error) {
        console.error("Erreur clamp des reperes sur les 3D tiles :", error);
      }

      if (cancelled) return;

      biensAvecCoordonnees.forEach((bien, index) => {
        const labelGroup = labelGroupAssignments.get(bien.id) ?? { index: 0 };
        const labelOffset = getMarkerLabelOffset(labelGroup.index);
        const markerState = getMarkerVisualState(bien, selectedBienId);

        const entity = viewer.entities.add({
          id: buildMarkerEntityId(bien.id, index),
          position: finalBienPositions[index] || rawBienPositions[index],
          point: {
            pixelSize: markerState.pixelSize,
            color: Cesium.Color[markerState.color.toUpperCase()],
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: markerState.outlineWidth,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: `${bien.prix} EUR`,
            font: markerState.font,
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(labelOffset.x, labelOffset.y),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });

        entity.bienData = bien;
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
            heightReference:
              modeRef.current === "osm"
                ? Cesium.HeightReference.CLAMP_TO_GROUND
                : Cesium.HeightReference.NONE,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: truncateMarkerNote(marker.note),
            font: "15px sans-serif",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -22),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            heightReference:
              modeRef.current === "osm"
                ? Cesium.HeightReference.CLAMP_TO_GROUND
                : Cesium.HeightReference.NONE,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
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
  }, [markerRenderKey, customMarkers, selectedBienId, tilesReadyVersion]);

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

    const bounds = getBiensBounds();
    if (bounds) {
      viewer.camera.flyTo({
        destination: bounds,
        duration: 1.1,
      });
      return;
    }

    const bien = getReferenceBien();
    if (bien) {
      focusOnBien(viewer, bien, 1);
    }
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
    } else if (!pendingMarkerPosition) {
      setMarkerDraftNote("");
    }
  }, [selectedCustomMarker, pendingMarkerPosition]);

  useEffect(() => {
    if (!pendingMarkerPosition && !selectedCustomMarker) return;

    const focusTimeout = window.setTimeout(() => {
      markerTextareaRef.current?.focus();
      markerTextareaRef.current?.setSelectionRange(
        markerTextareaRef.current.value.length,
        markerTextareaRef.current.value.length
      );
    }, 20);

    return () => window.clearTimeout(focusTimeout);
  }, [pendingMarkerPosition, selectedCustomMarker]);

  async function submitCustomMarker() {
    const note = markerDraftNote.trim();
    if (!note) {
      setMarkerError("Renseigne une note pour ce repere.");
      return;
    }

    setMarkerSaving(true);
    setMarkerError("");

    try {
      if (pendingMarkerPosition) {
        await onAddCustomMarker?.({
          lat: pendingMarkerPosition.lat,
          lon: pendingMarkerPosition.lon,
          note,
        });
        setPendingMarkerPosition(null);
      } else if (selectedCustomMarker) {
        await onUpdateCustomMarker?.(selectedCustomMarker.id, note);
      }

      setSelectedCustomMarkerId(null);
      setMarkerDraftNote("");
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
      setSelectedCustomMarkerId(null);
      setMarkerDraftNote("");
    } catch (error) {
      console.error("Erreur suppression repere perso :", error);
      setMarkerError(error.message || "Impossible de supprimer ce repere.");
    } finally {
      setMarkerSaving(false);
    }
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

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

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

      {!isMobile ? (
        <button
          onClick={onToggleMapMode}
          disabled={!canUseGoogle3D}
          style={desktopMapButtonStyle(84, canUseGoogle3D)}
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

      {pendingMarkerPosition || selectedCustomMarker ? (
        <div style={markerPanelStyle(isMobile)}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>
            {pendingMarkerPosition ? "Nouveau repere" : "Repere perso"}
          </div>
          <textarea
            ref={markerTextareaRef}
            value={markerDraftNote}
            onChange={(event) => setMarkerDraftNote(event.target.value)}
            placeholder="Ex : visite mercredi a 14h"
            style={{
              width: "100%",
              minHeight: 96,
              borderRadius: 12,
              border: "1px solid #d1d5db",
              padding: 10,
              fontFamily: "Arial, sans-serif",
              fontSize: 14,
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
          {markerError ? (
            <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 13 }}>{markerError}</div>
          ) : null}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
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
                  setPendingMarkerPosition(null);
                  setMarkerDraftNote("");
                  setMarkerError("");
                }}
                disabled={markerSaving}
                style={markerActionButtonStyle("#ffffff", "#111827", "#e5e7eb")}
              >
                Annuler
              </button>
            )}
          </div>
        </div>
      ) : null}

      {isMobile ? (
        <div style={mobileMapToolbarStyle()}>
          <button
            onClick={onToggleMapMode}
            disabled={!canUseGoogle3D}
            style={mobileMapToolbarButtonStyle(
              mapMode === "google3d",
              !canUseGoogle3D
            )}
            title={
              canUseGoogle3D
                ? mapMode === "google3d"
                  ? "Revenir a la vue plan"
                  : "Passer a la vue satellite"
                : "Ajoute un token Cesium ion pour activer Google 3D"
            }
          >
            {mapMode === "google3d" ? "Plan" : "Satellite"}
          </button>

          <button
            onClick={toggleTilt}
            style={mobileMapToolbarButtonStyle(isTilted)}
            title="Changer l'inclinaison"
          >
            {isTilted ? "2D" : "3D"}
          </button>

          <button
            onClick={onToggleMobileMapExpanded}
            style={mobileMapToolbarIconButtonStyle(isMobileMapExpanded)}
            title="Plein ecran"
          >
            <FullscreenIcon expanded={isMobileMapExpanded} />
          </button>
        </div>
      ) : (
        <button
          onClick={toggleTilt}
          style={desktopMapButtonStyle(20, true, true)}
          title="Changer l'inclinaison"
        >
          {isTilted ? "2D" : "3D"}
        </button>
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

function markerPanelStyle(isMobile) {
  return {
    position: "absolute",
    left: isMobile ? 14 : 20,
    bottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 78px)" : 84,
    width: isMobile ? "calc(100% - 140px)" : 280,
    maxWidth: 320,
    background: "var(--overlay-bg)",
    border: "1px solid var(--border-color)",
    borderRadius: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
    padding: 14,
    backdropFilter: "blur(8px)",
  };
}

function mobileMapToolbarStyle() {
  return {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
    display: "flex",
    gap: 8,
    padding: 8,
    background: "var(--overlay-bg)",
    border: "1px solid var(--border-color)",
    borderRadius: 20,
    boxShadow: "0 10px 30px rgba(17, 24, 39, 0.12)",
    backdropFilter: "blur(10px)",
    zIndex: 5,
  };
}

function mobileMapToolbarButtonStyle(active, disabled = false) {
  return {
    flex: 1,
    minWidth: 0,
    height: 42,
    border: active ? "1px solid var(--text-primary)" : "1px solid transparent",
    background: active ? "var(--text-primary)" : "transparent",
    color: active ? "var(--panel-bg)" : "var(--text-primary)",
    opacity: disabled ? 0.45 : 1,
    borderRadius: 14,
    fontWeight: 700,
    fontSize: 12,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 10px",
  };
}

function mobileMapToolbarIconButtonStyle(active) {
  return {
    width: 42,
    minWidth: 42,
    height: 42,
    border: active ? "1px solid var(--text-primary)" : "1px solid transparent",
    background: active ? "var(--text-primary)" : "transparent",
    color: active ? "var(--panel-bg)" : "var(--text-primary)",
    borderRadius: 14,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
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
