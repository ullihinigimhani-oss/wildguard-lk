const TYPES = ["START", "CHECKPOINT", "HIGH_RISK", "OBSERVATION", "END"];
// Validate the supplied sequence rather than silently correcting a malformed route.
module.exports = function validatePlannedRoute(route) {
  if (!Array.isArray(route) || route.length < 2 || route.length > 100)
    throw new Error(
      "Add a Start Point and an End Point (up to 100 route points).",
    );
  if (
    route.filter((p) => p?.type === "START").length !== 1 ||
    route[0]?.type !== "START"
  )
    throw new Error("Use exactly one Start Point, first in the route.");
  if (
    route.filter((p) => p?.type === "END").length !== 1 ||
    route.at(-1)?.type !== "END"
  )
    throw new Error("Use exactly one End Point, last in the route.");
  return route.map((point, index) => {
    if (!point || !TYPES.includes(point.type) || point.order !== index)
      throw new Error(
        "Route points must have a valid type and consecutive order starting at 0.",
      );
    if (
      typeof point.latitude !== "number" ||
      !Number.isFinite(point.latitude) ||
      Math.abs(point.latitude) > 90 ||
      typeof point.longitude !== "number" ||
      !Number.isFinite(point.longitude) ||
      Math.abs(point.longitude) > 180
    )
      throw new Error(
        "Each route point needs a latitude from -90 to 90 and longitude from -180 to 180.",
      );
    for (const [key, max] of [
      ["label", 200],
      ["note", 500],
    ]) {
      if (
        point[key] != null &&
        (typeof point[key] !== "string" || point[key].trim().length > max)
      )
        throw new Error(
          `Point ${index + 1}: ${key} must be text of up to ${max} characters.`,
        );
    }
    return {
      type: point.type,
      order: index,
      latitude: point.latitude,
      longitude: point.longitude,
      label: point.label?.trim() || null,
      note: point.note?.trim() || null,
    };
  });
};
