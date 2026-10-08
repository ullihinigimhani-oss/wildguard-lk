import { walkingRouteError } from "../utils/walkingRouteError";
import { useEffect, useRef, useState } from "react";
import { pointInGeometry } from "../../../shared/riskGeometry";
import {
  NAVIGATION,
  shouldRecordSample,
} from "../../../shared/patrolNavigation";
import {
  advanceReached,
  destinationsFor,
  offRoute,
  remainingSummary,
  routeNeedsRefresh,
} from "../utils/liveNavigation";
import {
  sessionKey,
  reachedFor,
  saveReached,
} from "../utils/navigationSession";
import {
  getPatrolLocations,
  recordPatrolLocation,
  requestWalkingRoute,
  getPatrolRiskZones,
} from "../services/patrolApi";

export default function useLiveNavigation(patrol, points, userId, location) {
  const [state, setState] = useState({
    reached: new Set(),
    route: null,
    trail: [],
    error: null,
    trailError: null,
    offRoute: false,
    routing: false,
    riskZones: [],
    riskReady: false,
    riskError: null,
  });
  const [revision, setRevision] = useState(0);
  const context = useRef(null);
  const key = patrol ? sessionKey(userId, patrol) : null;
  const active = location.active && patrol?.status === "IN_PROGRESS";
  useEffect(() => {
    const ctx = {
      cancelled: false,
      controller: new AbortController(),
      reached: reachedFor(key),
      route: null,
      lastRoute: null,
      lastAttempt: 0,
      blockedUntil: 0,
      pending: false,
      offCount: 0,
      lastFix: 0,
      lastSample: null,
      sampling: false,
      timer: null,
      failed: false,
      trailLoaded: false,
      riskZones: [],
      riskReady: false,
      riskFailed: false,
    };
    context.current = ctx;
    setState({
      reached: ctx.reached,
      route: null,
      trail: [],
      error: null,
      trailError: null,
      offRoute: false,
      routing: false,
      riskZones: [],
      riskReady: false,
      riskError: null,
    });
    if (active && key)
      getPatrolRiskZones(patrol.id, ctx.controller.signal)
        .then((zones) => {
          if (ctx.cancelled) return;
          ctx.riskZones = zones;
          ctx.riskReady = true;
          setState((value) => ({
            ...value,
            riskZones: zones,
            riskReady: true,
            riskError: null,
          }));
          setRevision((value) => value + 1);
        })
        .catch((error) => {
          if (ctx.cancelled) return;
          ctx.riskFailed = true;
          const zones = Array.isArray(error.response?.data?.riskZones)
            ? error.response.data.riskZones
            : [];
          ctx.riskZones = zones;
          if ([401, 403, 404, 409].includes(error.response?.status)) {
            ctx.cancelled = true;
            ctx.controller.abort();
          }
          setState((value) => ({
            ...value,
            riskZones: zones,
            riskError:
              "Known risk-zone information is unavailable or invalid. Refresh the patrol or contact the Park Manager.",
            error: [401, 403, 404, 409].includes(error.response?.status)
              ? "This patrol is no longer available for navigation. Refresh the patrol."
              : null,
          }));
        });
    if (active && key)
      getPatrolLocations(patrol.id, ctx.controller.signal)
        .then((trail) => {
          if (ctx.cancelled) return;
          ctx.lastSample = trail.at(-1) || null;
          setState((value) => ({ ...value, trail }));
        })
        .catch((error) => {
          if (
            !ctx.cancelled &&
            [401, 403, 404, 409].includes(error.response?.status)
          ) {
            ctx.cancelled = true;
            ctx.controller.abort();
            setState((value) => ({
              ...value,
              error:
                "This patrol is no longer available for navigation. Refresh the patrol.",
              route: null,
            }));
            return;
          }
          if (!ctx.cancelled)
            setState((value) => ({
              ...value,
              trailError:
                "Previous GPS trail could not be loaded. New samples will still be recorded.",
            }));
        })
        .finally(() => {
          if (!ctx.cancelled) {
            ctx.trailLoaded = true;
            setRevision((value) => value + 1);
          }
        });
    return () => {
      ctx.cancelled = true;
      ctx.controller.abort();
      clearTimeout(ctx.timer);
    };
  }, [key, active, patrol?.id]);

  useEffect(() => {
    const ctx = context.current,
      position = location.position;
    if (!active || !position || !ctx || ctx.cancelled) return;
    const destinations = destinationsFor(points);
    const insideZone = ctx.riskZones.some((zone) =>
      pointInGeometry(position, zone.geometry),
    );
    const blockedDestination = destinations.find(
      (point) => !ctx.reached.has(point.waypointId),
    );
    const destinationInside =
      blockedDestination &&
      ctx.riskZones.some((zone) =>
        pointInGeometry(blockedDestination, zone.geometry),
      );
    if ((insideZone || destinationInside) && ctx.route) {
      ctx.route = null;
      ctx.failed = false;
      setState((value) => ({ ...value, route: null, offRoute: false }));
    }
    const reached =
      ctx.riskReady && !insideZone && !destinationInside
        ? advanceReached(
            destinations,
            ctx.reached,
            position,
            (point) =>
              !ctx.riskZones.some((zone) =>
                pointInGeometry(point, zone.geometry),
              ),
          )
        : new Set(ctx.reached);
    if (reached.size !== ctx.reached.size) {
      ctx.reached = reached;
      saveReached(key, reached);
      ctx.route = null;
      ctx.offCount = 0;
      ctx.failed = false;
      setState((value) => ({
        ...value,
        reached,
        route: null,
        error: null,
        offRoute: false,
      }));
    }
    const destination = destinations.find(
      (point) => !reached.has(point.waypointId),
    );
    if (position.timestamp !== ctx.lastFix) {
      ctx.lastFix = position.timestamp;
      ctx.offCount =
        ctx.route && offRoute(position, ctx.route.geometry)
          ? ctx.offCount + 1
          : 0;
      setState((value) => ({
        ...value,
        offRoute: ctx.offCount >= NAVIGATION.offRouteFixes,
      }));
    }
    const sample = {
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
      recordedAt: new Date(position.timestamp).toISOString(),
    };
    if (
      ctx.trailLoaded &&
      !ctx.sampling &&
      shouldRecordSample(ctx.lastSample, sample)
    ) {
      ctx.sampling = true;
      ctx.lastSample = sample;
      recordPatrolLocation(patrol.id, sample, ctx.controller.signal)
        .then((result) => {
          if (ctx.cancelled) return;
          if (result.accepted)
            setState((value) => ({
              ...value,
              trail: [...value.trail, result.location].slice(-1000),
              trailError: null,
            }));
        })
        .catch((error) => {
          if (ctx.cancelled) return;
          if ([401, 403, 404, 409].includes(error.response?.status)) {
            ctx.cancelled = true;
            ctx.controller.abort();
            setState((value) => ({
              ...value,
              error:
                "This patrol is no longer available for navigation. Refresh the patrol.",
              route: null,
            }));
          } else
            setState((value) => ({
              ...value,
              trailError:
                "GPS recording is temporarily unavailable. Check your connection.",
            }));
        })
        .finally(() => {
          ctx.sampling = false;
        });
    }
    if (
      !destination ||
      !ctx.riskReady ||
      insideZone ||
      destinationInside ||
      ctx.failed ||
      ctx.pending ||
      !routeNeedsRefresh(
        ctx.route,
        destination,
        position,
        ctx.lastRoute,
        Date.now(),
        ctx.offCount,
      )
    )
      return;
    const wait =
      Math.max(
        ctx.lastAttempt + NAVIGATION.rerouteCooldownMs,
        ctx.blockedUntil,
      ) - Date.now();
    if (wait > 0) {
      clearTimeout(ctx.timer);
      ctx.timer = setTimeout(() => setRevision((value) => value + 1), wait);
      return;
    }
    ctx.pending = true;
    ctx.lastAttempt = Date.now();
    setState((value) => ({ ...value, routing: true, error: null }));
    requestWalkingRoute(
      patrol.id,
      destination.waypointId,
      position,
      ctx.controller.signal,
    )
      .then((route) => {
        if (ctx.cancelled || ctx.reached.has(destination.waypointId)) return;
        ctx.route = route;
        ctx.riskZones = Array.isArray(route.riskZones)
          ? route.riskZones
          : ctx.riskZones;
        ctx.lastRoute = { position, time: Date.now() };
        ctx.offCount = 0;
        setState((value) => ({
          ...value,
          route,
          error: null,
          offRoute: false,
          riskZones: ctx.riskZones,
        }));
      })
      .catch((error) => {
        if (ctx.cancelled) return;
        ctx.route = null;
        ctx.failed = true;
        const status = error.response?.status,
          code = error.response?.data?.code;
        if (Array.isArray(error.response?.data?.riskZones))
          ctx.riskZones = error.response.data.riskZones;
        if (
          [
            "RISK_ZONE_DATA_INVALID",
            "RISK_AVOIDANCE_LIMIT",
            "RISK_ZONE_DATA_UNAVAILABLE",
          ].includes(code)
        )
          ctx.riskReady = false;
        ctx.blockedUntil =
          Date.now() +
          Math.max(
            NAVIGATION.rerouteCooldownMs,
            Number(error.response?.data?.retryAfterSeconds || 0) * 1000,
          );
        if ([401, 403, 404, 409].includes(status)) {
          ctx.cancelled = true;
          ctx.controller.abort();
        }
        const message = walkingRouteError(error.response?.data) || ([401, 403, 404, 409].includes(status)
          ? "This patrol is no longer available for navigation. Refresh the patrol."
          : code === "DESTINATION_IN_RISK_ZONE"
            ? "Next patrol point is inside a known high-risk area. Review the planned route and contact the Park Manager."
            : code === "RANGER_IN_RISK_ZONE"
              ? "You are currently inside a known high-risk area. Review your position and contact the Park Manager."
              : code === "NO_RISK_AVOIDING_ROUTE"
                ? "No route avoiding the known high-risk area could be found. Review the planned patrol route and contact the Park Manager if needed."
                : [
                      "RISK_ZONE_DATA_INVALID",
                      "RISK_AVOIDANCE_LIMIT",
                      "RISK_AVOIDANCE_UNAVAILABLE",
                      "RISK_ZONE_DATA_UNAVAILABLE",
                    ].includes(code)
                  ? "Known risk areas could not be used for navigation. Review the planned route and contact the Park Manager."
                  : code === "NO_WALKING_ROUTE"
                    ? "No mapped walking route is available. Planned patrol points remain visible."
                    : status === 429
                      ? "Routing request limit reached. Wait a little, then retry."
                      : "Walking route is currently unavailable. Planned patrol points remain visible.");
        setState((value) => ({
          ...value,
          route: null,
          error: message,
          riskZones: ctx.riskZones,
          riskReady: ctx.riskReady,
        }));
      })
      .finally(() => {
        ctx.pending = false;
        if (!ctx.cancelled) {
          setState((value) => ({ ...value, routing: false }));
          if (ctx.reached.has(destination.waypointId))
            setRevision((value) => value + 1);
        }
      });
  }, [active, location.position, key, points, patrol?.id, revision]);
  const destinations = destinationsFor(points),
    destination = destinations.find(
      (point) => !state.reached.has(point.waypointId),
    );
  const rangerInsideZone =
    location.position &&
    state.riskZones.some((zone) =>
      pointInGeometry(location.position, zone.geometry),
    );
  const destinationInsideZone =
    destination &&
    state.riskZones.some((zone) => pointInGeometry(destination, zone.geometry));
  const usableRoute =
    state.riskReady && !rangerInsideZone && !destinationInsideZone
      ? state.route
      : null;
  return {
    ...state,
    route: usableRoute,
    rangerInsideZone: !!rangerInsideZone,
    destinationInsideZone: !!destinationInsideZone,
    destinations,
    destination,
    complete: destinations.length > 0 && !destination,
    summary: remainingSummary(usableRoute, location.position),
    retry: () => {
      if (context.current) context.current.failed = false;
      setRevision((value) => value + 1);
    },
    accessLost: context.current?.cancelled && active,
  };
}
