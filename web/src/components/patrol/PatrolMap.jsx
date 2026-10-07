import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { pointTypeLabel } from "./routePlanning";

export default function PatrolMap({
  points,
  selectedId,
  onAdd,
  onSelect,
  onMove,
  disabled = false,
  readOnly = false,
}) {
  const container = useRef(null),
    map = useRef(null),
    layers = useRef(null),
    handlers = useRef({});
  const [tileError, setTileError] = useState(false);
  handlers.current = { onAdd, onSelect, onMove, disabled, readOnly };
  useEffect(() => {
    const instance = L.map(container.current, {
      scrollWheelZoom: false,
    }).setView([7.8, 80.7], 7);
    map.current = instance;
    const tiles = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      },
    ).addTo(instance);
    // A load event also fires after failed tiles; retain the error for that batch.
    let failedTiles = false;
    tiles.on("loading", () => {
      failedTiles = false;
    });
    tiles.on("tileerror", () => {
      failedTiles = true;
      setTileError(true);
    });
    tiles.on("load", () => setTileError(failedTiles));
    layers.current = L.layerGroup().addTo(instance);
    instance.on("click", (e) => {
      const h = handlers.current;
      if (!h.disabled && !h.readOnly) h.onAdd?.(e.latlng);
    });
    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => instance.invalidateSize())
        : null;
    observer?.observe(container.current);
    return () => {
      observer?.disconnect();
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    layers.current.clearLayers();
    if (points.length > 1)
      L.polyline(
        points.map((p) => [p.latitude, p.longitude]),
        { color: "#285c49", weight: 3, dashArray: "7 5" },
      ).addTo(layers.current);
    let checkpoint = 0;
    points.forEach((point) => {
      const symbol =
        point.type === "CHECKPOINT"
          ? String(++checkpoint)
          : { START: "S", END: "E", HIGH_RISK: "!", OBSERVATION: "O" }[
              point.type
            ];
      const icon = L.divIcon({
        className: "route-marker-container",
        html: `<span class="route-marker route-marker-${point.type.toLowerCase()}${point.id === selectedId ? " is-selected" : ""}">${symbol}</span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const marker = L.marker([point.latitude, point.longitude], {
        icon,
        draggable: !disabled && !readOnly,
        title: `${point.order + 1}. ${point.label || pointTypeLabel(point.type)}`,
        keyboard: true,
      }).addTo(layers.current);
      // Text nodes avoid interpreting manager-supplied labels as HTML.
      const tooltip = document.createElement("span");
      tooltip.textContent = point.label || pointTypeLabel(point.type);
      marker.bindTooltip(tooltip);
      marker.on("click", () => handlers.current.onSelect?.(point.id));
      marker.on("dragend", () => {
        const h = handlers.current;
        if (!h.disabled && !h.readOnly)
          h.onMove?.(point.id, marker.getLatLng());
      });
    });
  }, [points, selectedId, disabled, readOnly]);
  function fitRoute() {
    if (points.length)
      map.current.fitBounds(
        L.latLngBounds(points.map((p) => [p.latitude, p.longitude])),
        { padding: [40, 40], maxZoom: 15 },
      );
  }
  return (
    <div className="route-map-wrap">
      <div
        ref={container}
        className="route-map"
        aria-label="Patrol route map"
      />
      <button
        type="button"
        className="route-fit"
        disabled={!points.length}
        onClick={fitRoute}
      >
        Fit route
      </button>
      {tileError && (
        <p role="status" className="route-tile-error">
          Map tiles are unavailable. Check your connection or use manual
          coordinates below.
        </p>
      )}
    </div>
  );
}
