export const routePointTypes = {
  START: { label: "Start Point", symbol: "S", color: "#24744c" },
  CHECKPOINT: { label: "Checkpoint", symbol: "#", color: "#416b9b" },
  HIGH_RISK: { label: "High Risk Area", symbol: "!", color: "#b42332" },
  OBSERVATION: { label: "Observation Point", symbol: "O", color: "#63558b" },
  END: { label: "End Point", symbol: "E", color: "#293d35" },
};

// Read-only presentation. Coordinates and persisted order are never rewritten.
// A malformed point breaks the line so we do not invent a shortcut around it.
export function readPlannedRoute(route) {
  if (route == null) return { points: [], segments: [], invalidCount: 0 };
  if (!Array.isArray(route))
    return { points: [], segments: [], invalidCount: 1 };
  const sorted = [...route].sort(
    (a, b) =>
      (Number.isInteger(a?.order) ? a.order : Infinity) -
      (Number.isInteger(b?.order) ? b.order : Infinity),
  );
  const points = [],
    segments = [],
    orders = new Set();
  let segment = [],
    invalidCount = 0,
    checkpoint = 0,
    previousOrder = null;
  for (const point of sorted) {
    if (point?.type === "CHECKPOINT") checkpoint++;
    const valid =
      point &&
      Object.hasOwn(routePointTypes, point.type) &&
      Number.isInteger(point.order) &&
      point.order >= 0 &&
      !orders.has(point.order) &&
      typeof point.latitude === "number" &&
      Number.isFinite(point.latitude) &&
      Math.abs(point.latitude) <= 90 &&
      typeof point.longitude === "number" &&
      Number.isFinite(point.longitude) &&
      Math.abs(point.longitude) <= 180;
    if (!valid) {
      invalidCount++;
      if (segment.length) segments.push(segment);
      segment = [];
      previousOrder = null;
      continue;
    }
    orders.add(point.order);
    const presentation = routePointTypes[point.type];
    const fallback =
      point.type === "CHECKPOINT"
        ? `Checkpoint ${checkpoint}`
        : presentation.label;
    const item = {
      ...(typeof point.id === "string" ? { waypointId: point.id } : {}),
      type: point.type,
      order: point.order,
      latitude: point.latitude,
      longitude: point.longitude,
      label:
        typeof point.label === "string" && point.label.trim()
          ? point.label
          : fallback,
      note: typeof point.note === "string" ? point.note : "",
      typeLabel: presentation.label,
      symbol:
        point.type === "CHECKPOINT" ? String(checkpoint) : presentation.symbol,
      color: presentation.color,
    };
    if (previousOrder !== null && point.order !== previousOrder + 1) {
      if (segment.length) segments.push(segment);
      segment = [];
      invalidCount++;
    }
    points.push(item);
    segment.push(item);
    previousOrder = point.order;
  }
  if (segment.length) segments.push(segment);
  return { points, segments, invalidCount };
}

export function plannedDistanceKm(points) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  return points.slice(1).reduce((distance, point, index) => {
    const previous = points[index];
    const a =
      Math.sin(radians(point.latitude - previous.latitude) / 2) ** 2 +
      Math.cos(radians(previous.latitude)) *
        Math.cos(radians(point.latitude)) *
        Math.sin(radians(point.longitude - previous.longitude) / 2) ** 2;
    return (
      distance +
      6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))
    );
  }, 0);
}
