export const pointTypes = [
  ["START", "Start Point", "S"],
  ["CHECKPOINT", "Checkpoint", "#"],
  ["HIGH_RISK", "High Risk Area", "!"],
  ["OBSERVATION", "Observation Point", "O"],
  ["END", "End Point", "E"],
];
export const pointTypeLabel = (type) =>
  pointTypes.find((p) => p[0] === type)?.[1] || type;
export function normalizeRoute(points) {
  let checkpoint = 0;
  return points.map((point, order) => {
    if (point.type === "CHECKPOINT") checkpoint++;
    const label = point.autoLabel
      ? point.type === "CHECKPOINT"
        ? `Checkpoint ${checkpoint}`
        : pointTypeLabel(point.type)
      : point.label;
    return { ...point, order, label };
  });
}
export function routeError(points) {
  if (!Array.isArray(points) || points.length < 2)
    return "Add a Start Point and an End Point.";
  if (points.length > 100) return "Use up to 100 route points.";
  if (
    points.filter((p) => p.type === "START").length !== 1 ||
    points[0].type !== "START"
  )
    return "Use exactly one Start Point, first in the route.";
  if (
    points.filter((p) => p.type === "END").length !== 1 ||
    points.at(-1).type !== "END"
  )
    return "Use exactly one End Point, last in the route.";
  if (
    points.some(
      (p, i) =>
        !pointTypes.some((t) => t[0] === p.type) ||
        p.order !== i ||
        !Number.isFinite(p.latitude) ||
        Math.abs(p.latitude) > 90 ||
        !Number.isFinite(p.longitude) ||
        Math.abs(p.longitude) > 180,
    )
  )
    return "Check route point coordinates and order.";
  if (
    points.some(
      (p) => (p.label || "").length > 200 || (p.note || "").length > 500,
    )
  )
    return "Use up to 200 characters for labels and 500 for point notes.";
  return "";
}
export function routeDistanceKm(points) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    const a =
      Math.sin(radians(point.latitude - previous.latitude) / 2) ** 2 +
      Math.cos(radians(previous.latitude)) *
        Math.cos(radians(point.latitude)) *
        Math.sin(radians(point.longitude - previous.longitude) / 2) ** 2;
    return (
      total +
      6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)))
    );
  }, 0);
}
export const routePayload = (points) =>
  points.map(({ type, latitude, longitude, order, label, note }) => ({
    type,
    latitude,
    longitude,
    order,
    label: label?.trim() || null,
    note: note?.trim() || null,
  }));
