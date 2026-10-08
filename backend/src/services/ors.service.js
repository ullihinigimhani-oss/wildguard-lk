const {
  validCoordinate,
  distanceMeters,
} = require("../../../shared/patrolNavigation");
const { createHash } = require("node:crypto");
const {
  combineZones,
  routeIntersectsZones,
} = require("../../../shared/riskGeometry");
const routeError = (status, code, message, retryAfterSeconds) =>
  Object.assign(new Error(message), {
    status,
    code,
    navigationError: true,
    retryAfterSeconds,
  });
const entries = new Map();
let globalCalls = [];
const COOLDOWN_MS = 10000,
  CACHE_MS = 45000,
  MAX_GLOBAL_PER_MINUTE = 30;
// Process-local budget/cache, bounded by expiry. Multi-instance deployment needs shared storage.
exports.walkingRoute = async ({
  rangerId,
  patrolId,
  destination,
  currentLocation,
  riskZones = [],
  waypoints,
}) => {
  const full = Array.isArray(waypoints);
  if (
    full &&
    (waypoints.length < 2 ||
      waypoints.length > 50 ||
      waypoints.some((p) => !validCoordinate(p)))
  )
    throw routeError(
      422,
      "INVALID_PATROL_ROUTE",
      "Full patrol navigation needs 2–50 valid required points. The saved waypoints remain visible.",
    );
  const cacheSlot = full ? "fullCached" : "cached";
  const now = Date.now();
  for (const [id, entry] of entries)
    if (
      now - entry.lastUsed > (entry.fullCached ? 600000 : 120000) &&
      !entry.pending
    )
      entries.delete(id);
  let entry = entries.get(rangerId);
  if (!entry) {
    entry = { lastUsed: now, calls: [], startedAt: -Infinity };
    entries.set(rangerId, entry);
  }
  entry.lastUsed = now;
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        destination: [destination.longitude, destination.latitude],
        ...(full && { waypoints }),
        riskZones,
      }),
    )
    .digest("hex");
  const key =
    patrolId + ":" + (full ? "full:" : "") + destination.id + ":" + fingerprint;
  const cached = entry[cacheSlot];
  if (
    cached?.key === key &&
    now - cached.at < (full ? 600000 : CACHE_MS) &&
    distanceMeters(currentLocation, cached.origin) <= 20 &&
    !routeIntersectsZones(
      {
        type: "LineString",
        coordinates: [
          [currentLocation.longitude, currentLocation.latitude],
          ...cached.route.geometry.coordinates,
        ],
      },
      riskZones,
    )
  )
    return cached.route;
  if (entry.pending) {
    if (
      entry.pendingKey === key &&
      distanceMeters(currentLocation, entry.origin) <= 20
    ) {
      const route = await entry.pending;
      if (
        routeIntersectsZones(
          {
            type: "LineString",
            coordinates: [
              [currentLocation.longitude, currentLocation.latitude],
              ...route.geometry.coordinates,
              [destination.longitude, destination.latitude],
            ],
          },
          riskZones,
        )
      )
        throw routeError(
          422,
          "NO_RISK_AVOIDING_ROUTE",
          "No route avoiding the known high-risk area could be found. Review the planned patrol route and contact the Park Manager if needed.",
        );
      return route;
    }
    throw routeError(
      429,
      "ROUTE_COOLDOWN",
      "A walking route is already being calculated. Please wait.",
      10,
    );
  }
  entry.calls = entry.calls.filter((time) => now - time < 60000);
  globalCalls = globalCalls.filter((time) => now - time < 60000);
  const retryMs = Math.max(
    COOLDOWN_MS - (now - entry.startedAt),
    entry.calls.length >= 6 ? 60000 - (now - entry.calls[0]) : 0,
    globalCalls.length >= MAX_GLOBAL_PER_MINUTE
      ? 60000 - (now - globalCalls[0])
      : 0,
  );
  if (retryMs > 0)
    throw routeError(
      429,
      "ROUTE_COOLDOWN",
      "Walking route requests are temporarily limited. Please wait before retrying.",
      Math.ceil(retryMs / 1000),
    );
  const environment = require("../config/environment");
  let base;
  try {
    base = new URL(environment.ORS_BASE_URL);
  } catch {
    throw routeError(
      503,
      "ROUTING_UNAVAILABLE",
      "Walking routing is currently unavailable. Planned patrol points remain available.",
    );
  }
  if (
    !environment.ORS_API_KEY ||
    base.protocol !== "https:" ||
    base.hostname !== "api.heigit.org" ||
    base.username ||
    base.password
  )
    throw routeError(
      503,
      "ROUTING_UNAVAILABLE",
      "Walking routing is currently unavailable. Planned patrol points remain available.",
    );
  entry.startedAt = now;
  entry.calls.push(now);
  globalCalls.push(now);
  entry.pendingKey = key;
  entry.origin = { ...currentLocation };
  entry.pending = (async () => {
    let response;
    try {
      response = await fetch(
        new URL("/openrouteservice/v2/directions/foot-walking/geojson", base),
        {
          method: "POST",
          redirect: "error",
          headers: {
            Authorization: environment.ORS_API_KEY,
            "Content-Type": "application/json",
            Accept: "application/geo+json, application/json",
          },
          body: JSON.stringify({
            coordinates: full
              ? waypoints.map((p) => [p.longitude, p.latitude])
              : [
                  [currentLocation.longitude, currentLocation.latitude],
                  [destination.longitude, destination.latitude],
                ],
            instructions: false,
            ...(riskZones.length && {
              options: { avoid_polygons: combineZones(riskZones) },
            }),
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
    } catch (error) {
      throw routeError(
        error.name === "TimeoutError" ? 504 : 503,
        "ROUTING_UNAVAILABLE",
        "Walking route is currently unavailable. Check your connection and try again.",
      );
    }
    if (response.status === 429)
      throw routeError(
        429,
        "ROUTE_RATE_LIMIT",
        "Walking routing is temporarily busy. Try again in a minute.",
        60,
      );
    if (riskZones.length && [400, 404, 413].includes(response.status)) {
      let providerCode;
      try {
        providerCode = (await response.json()).error?.code;
      } catch {
        /* Never return upstream content. */
      }
      if (full && providerCode === 2010)
        throw routeError(
          422,
          "PATROL_POINT_UNMAPPED",
          "A required patrol point has no mapped walking connection. Review the saved patrol points with the Park Manager.",
        );
      if (
        [2000, 2001, 2002, 2003, 2004].includes(providerCode) ||
        response.status === 413
      )
        throw routeError(
          422,
          "RISK_AVOIDANCE_UNAVAILABLE",
          "Known risk areas could not be used within walking routing limits. Review the planned route and contact the Park Manager.",
        );
      throw routeError(
        422,
        "NO_RISK_AVOIDING_ROUTE",
        "No route avoiding the known high-risk area could be found. Review the planned patrol route and contact the Park Manager if needed.",
      );
    }
    if ([400, 404].includes(response.status))
      throw routeError(
        422,
        "NO_WALKING_ROUTE",
        "No mapped walking route is available to this patrol point. The planned points remain visible.",
      );
    if (!response.ok)
      throw routeError(
        503,
        "ROUTING_UNAVAILABLE",
        "Walking routing is currently unavailable. Planned patrol points remain available.",
      );
    let data;
    try {
      data = await response.json();
    } catch {
      throw routeError(
        502,
        "INVALID_ROUTE",
        "Walking routing returned an unusable route. Please retry.",
      );
    }
    const feature = data.features?.[0],
      geometry = feature?.geometry,
      summary = feature?.properties?.summary;
    if (
      geometry?.type !== "LineString" ||
      !Array.isArray(geometry.coordinates) ||
      geometry.coordinates.length < 2 ||
      geometry.coordinates.length > 100000 ||
      geometry.coordinates.some(
        (pair) =>
          !Array.isArray(pair) ||
          pair.length < 2 ||
          !validCoordinate({ longitude: pair[0], latitude: pair[1] }),
      ) ||
      !Number.isFinite(summary?.distance) ||
      summary.distance < 0 ||
      !Number.isFinite(summary?.duration) ||
      summary.duration < 0
    )
      throw routeError(
        502,
        "INVALID_ROUTE",
        "Walking routing returned an unusable route. Please retry.",
      );
    const route = {
      geometry: {
        type: "LineString",
        coordinates: geometry.coordinates.map((pair) => [pair[0], pair[1]]),
      },
      distanceMeters: summary.distance,
      durationSeconds: summary.duration,
      destination: {
        waypointId: destination.id,
        type: destination.type,
        label: destination.label || destination.type.replaceAll("_", " "),
        latitude: destination.latitude,
        longitude: destination.longitude,
      },
      profile: "foot-walking",
      riskAvoidance: {
        applied: riskZones.length > 0,
        zoneCount: riskZones.length,
      },
      riskZones,
    };
    if (full) {
      const indices = feature.properties.way_points;
      if (
        !Array.isArray(indices) ||
        indices.length !== waypoints.length ||
        indices[0] !== 0 ||
        indices.at(-1) !== route.geometry.coordinates.length - 1 ||
        indices.some(
          (index, i) =>
            !Number.isInteger(index) ||
            index < 0 ||
            index >= route.geometry.coordinates.length ||
            (i > 0 && index < indices[i - 1]) ||
            distanceMeters(waypoints[i], {
              longitude: route.geometry.coordinates[index][0],
              latitude: route.geometry.coordinates[index][1],
            }) > 350,
        )
      )
        throw routeError(
          502,
          "INVALID_ROUTE",
          "Full patrol routing returned an unusable waypoint sequence. The saved waypoints remain visible.",
        );
      // Check every required point's off-network connector, including intermediate stops.
      if (
        waypoints.some((point, i) =>
          routeIntersectsZones(
            {
              type: "LineString",
              coordinates: [
                [point.longitude, point.latitude],
                route.geometry.coordinates[indices[i]],
              ],
            },
            riskZones,
          ),
        )
      )
        throw routeError(
          422,
          "NO_RISK_AVOIDING_ROUTE",
          "No full patrol route avoiding the known risk areas could be verified.",
        );
      route.waypoints = waypoints.map(
        ({ id, type, label, latitude, longitude }) => ({
          waypointId: id,
          type,
          label,
          latitude,
          longitude,
        }),
      );
      route.legs = waypoints.slice(1).map((point, i) => ({
        fromWaypointId: waypoints[i].id,
        destinationWaypointId: point.id,
        geometry: {
          type: "LineString",
          coordinates: route.geometry.coordinates.slice(
            indices[i],
            indices[i + 1] + 1,
          ),
        },
      }));
    }
    // Include off-network start/end connectors in the conservative crossing check.
    if (
      routeIntersectsZones(
        {
          type: "LineString",
          coordinates: [
            [currentLocation.longitude, currentLocation.latitude],
            ...route.geometry.coordinates,
            [destination.longitude, destination.latitude],
          ],
        },
        riskZones,
      )
    )
      throw routeError(
        422,
        "NO_RISK_AVOIDING_ROUTE",
        "No route avoiding the known high-risk area could be found. Review the planned patrol route and contact the Park Manager if needed.",
      );
    entry[cacheSlot] = {
      key,
      at: Date.now(),
      origin: { ...currentLocation },
      route,
    };
    return route;
  })();
  try {
    return await entry.pending;
  } finally {
    entry.pending = null;
  }
};
