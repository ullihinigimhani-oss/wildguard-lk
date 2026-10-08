const pointNames = { START: "Start Point", CHECKPOINT: "Checkpoint", OBSERVATION: "Observation Point", END: "End Point" };
export function walkingRouteError(data) {
  if (data?.code === "CURRENT_LOCATION_UNMAPPED") return "Your current GPS position could not connect to a mapped walking path. Move to a mapped walking path and retry; GPS recording continues.";
  if (["PATROL_POINT_UNMAPPED", "DESTINATION_POINT_UNMAPPED"].includes(data?.code)) {
    const point = data.routingPoint;
    const name = pointNames[point?.type] || "A required patrol point";
    const number = data.code === "PATROL_POINT_UNMAPPED" && Number.isInteger(point?.index) && point.index >= 0 && point.index < 50 ? ` (waypoint ${point.index + 1})` : "";
    return `${name}${number} has no mapped walking connection. Ask the Park Manager to review the saved waypoint. Active patrols cannot be edited; coordinates have not been moved or skipped.`;
  }
  if (data?.code === "ROUTING_REQUEST_INVALID") return "Walking routing rejected the request. Contact the Park Manager; saved patrol points remain visible.";
  return null;
}
