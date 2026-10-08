// Upstream messages may contain coordinates. Extract only a bounded point index.
module.exports = function orsFailure(status, provider, { full, points, risk }) {
  const providerCode = Number.isInteger(provider?.code) ? provider.code : null;
  const match = typeof provider?.message === "string" && provider.message.match(/\b(?:point|coordinate)\s+(\d+)\b/i);
  const index = match ? Number(match[1]) : -1;
  const point = Number.isInteger(index) && index >= 0 && index < points.length ? points[index] : null;
  const error = Object.assign(new Error(), { status: 422, navigationError: true, providerCode });
  if (providerCode === 2010) {
    error.code = full ? "PATROL_POINT_UNMAPPED" : index === 0 ? "CURRENT_LOCATION_UNMAPPED" : index === 1 ? "DESTINATION_POINT_UNMAPPED" : "WALKING_POINT_UNMAPPED";
    error.message = full ? "A saved patrol waypoint has no mapped walking connection. Ask the Park Manager to review the point; saved coordinates have not been changed." : index === 0 ? "Your current GPS position has no mapped walking connection. Move to a mapped walking path and retry." : "The patrol destination has no mapped walking connection. Ask the Park Manager to review its saved coordinates.";
    if (point) error.routingPoint = { index, type: index === 0 && !full ? "CURRENT_GPS" : point.type, ...(point.id && { waypointId: point.id }) };
  } else if (risk && ([2000, 2001, 2002, 2003, 2004].includes(providerCode) || status === 413)) {
    error.code = "RISK_AVOIDANCE_UNAVAILABLE";
    error.message = "Known risk areas could not be used within walking routing limits. Contact the Park Manager.";
  } else if (!risk && [2000, 2001, 2002, 2003, 2004, 2011, 2012].includes(providerCode)) {
    error.code = "ROUTING_REQUEST_INVALID";
    error.message = "The walking routing request was rejected. Contact the Park Manager.";
  } else {
    error.code = risk ? "NO_RISK_AVOIDING_ROUTE" : "NO_WALKING_ROUTE";
    error.message = risk ? "No route avoiding the known high-risk area could be found. Contact the Park Manager." : "No mapped walking connection could be found between the requested points. Saved patrol points remain visible.";
  }
  return error;
};
