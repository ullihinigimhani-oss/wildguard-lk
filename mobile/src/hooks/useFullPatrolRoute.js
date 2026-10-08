import { useOffline } from "./useOffline";
import { cacheNavigation } from "../services/offlineMaps";
import { walkingRouteError } from "../utils/walkingRouteError";
import { useEffect, useRef, useState } from "react";
import { getFullPatrolRoute } from "../services/patrolApi";
import { sessionKey } from "../utils/navigationSession";
const routeCache = new Map();
export const clearFullRouteCache = () => routeCache.clear();
function retryDelay(error, attempt) {
  const header = error.response?.headers?.['retry-after'] ?? error.response?.headers?.get?.('retry-after');
  const numeric = header != null ? Number(header) : NaN;
  const headerSeconds = Number.isFinite(numeric) ? numeric : (Date.parse(header) - Date.now()) / 1000;
  const bodySeconds = Number(error.response?.data?.retryAfterSeconds);
  return Math.max(5 * 2 ** attempt, Number.isFinite(headerSeconds) ? headerSeconds : 0, Number.isFinite(bodySeconds) ? bodySeconds : 0) * 1000;
}

// Presentation context only: never participates in arrival, ETA or GPS recording.
export default function useFullPatrolRoute(
  patrol,
  points,
  userId,
  live,
  active,
) {
  const offline = useOffline();
  active = active && (!offline || offline.online);
  const signature = JSON.stringify({
    session: patrol ? sessionKey(userId, patrol) : null,
    points: points.map(({ waypointId, type, order, latitude, longitude }) => ({
      waypointId,
      type,
      order,
      latitude,
      longitude,
    })),
    riskZones: live.riskZones || [],
    ready: !!live.riskReady,
  });
  const context = useRef(null);
  const [state, setState] = useState({
    route: null,
    error: null,
    loading: false,
    signature: null,
  });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const ctx = {
      cancelled: false,
      started: false,
      retries: 0,
      timer: null,
      controller: new AbortController(),
      inFlight: false,
      notBefore: 0,
    };
    context.current = ctx;
    const cached = routeCache.get(signature);
    if (active && live.riskReady && cached && Date.now() - cached.at < 300000) {
      ctx.started = true;
      setState({ route: cached.route, error: null, loading: false, waiting: false, signature });
    } else setState({ route: null, error: null, loading: false, waiting: false, signature });
    return () => {
      ctx.cancelled = true;
      ctx.controller.abort();
      clearTimeout(ctx.timer);
    };
  }, [signature, active]);
  const canRequest = !!(
    active &&
    live.riskReady &&
    (!live.routing || context.current?.retries > 0) &&
    (live.route ||
      live.error ||
      live.rangerInsideZone ||
      live.destinationInsideZone ||
      live.complete)
  );
  useEffect(() => {
    const ctx = context.current;
    if (!canRequest || !ctx || ctx.cancelled || ctx.started) return;
    ctx.started = true;
    ctx.inFlight = true;
    setState((value) => ({ ...value, loading: true, error: null }));
    getFullPatrolRoute(patrol.id, ctx.controller.signal)
      .then(async (route) => {
        if (ctx.cancelled) return;
        if (
          JSON.stringify(route.riskZones || []) !==
          JSON.stringify(live.riskZones || [])
        ) {
          setState((value) => ({
            ...value,
            route: null,
            error:
              "Known risk areas changed. Refresh the patrol to update both routes.",
          }));
          return;
        }
        if (offline) await cacheNavigation(userId,patrol,live.riskZones || [],route).catch(() => {});
        if (ctx.cancelled) return;
        setState((value) => ({ ...value, route, error: null }));
        routeCache.set(signature, { route, at: Date.now() });

        while (routeCache.size > 20) routeCache.delete(routeCache.keys().next().value);
      })
      .catch((error) => {
        if (ctx.cancelled) return;
        const status = error.response?.status,
          code = error.response?.data?.code;
        const transient = status === 429 || status === 503 || status === 504 || (!error.response && error.code !== 'ERR_CANCELED');
        if (transient && ctx.retries < 3) {
          const delay = retryDelay(error, ctx.retries++);
          ctx.notBefore = Date.now() + delay;
          ctx.timer = setTimeout(
            () => {
              ctx.started = false;
              setState(value => ({ ...value, waiting: false }));
              setRevision((value) => value + 1);
            },
            delay,
          );
          setState((value) => ({
            ...value,
            error:
              code === 'ROUTE_RATE_LIMIT' ? 'Walking provider is rate limited. The planned route will retry automatically.' : code === 'ROUTE_COOLDOWN' ? 'Another route request is finishing. The planned route will retry automatically.' : 'Planned route temporarily unavailable. Retrying automatically.',
            waiting: true,
          }));
        } else {
          if (status === 429) {
            const delay = retryDelay(error, ctx.retries);
            ctx.notBefore = Date.now() + delay;
            ctx.timer = setTimeout(() => {
              if (!ctx.cancelled) setState(value => ({ ...value, waiting: false }));
            }, delay);
          }
          setState((value) => ({
            ...value,
            route: null,
            waiting: status === 429,
            error:
              walkingRouteError(error.response?.data) || (code === "DESTINATION_IN_RISK_ZONE"
                ? "A required patrol point is inside a known risk zone. Contact the Park Manager; it has not been skipped."
                : code === "PATROL_POINT_UNMAPPED"
                  ? "Full patrol navigation route cannot be calculated: a required patrol point has no mapped walking connection. Review the saved points with the Park Manager."
                  : code === "INVALID_PATROL_ROUTE"
                    ? "Full patrol navigation requires a valid saved route with at most 50 required points. Review the route with the Park Manager."
                    : [401, 403, 404, 409].includes(status)
                      ? "This patrol is no longer available for full-route navigation. Refresh the patrol."
                      : "Full patrol navigation route cannot currently be calculated. Saved waypoints and available live navigation remain visible."),
          }));
        }
      })
      .finally(() => {
        ctx.inFlight = false;
        if (!ctx.cancelled) setState((value) => ({ ...value, loading: false }));
      });
  }, [canRequest, signature, active, revision, patrol?.id]);
  return {
    ...state,
    route: state.signature === signature && active ? state.route : null,
    retry: () => {
      if (context.current) {
        if (context.current.cancelled || context.current.inFlight || Date.now() < context.current.notBefore || state.route) return;
        clearTimeout(context.current.timer);
        context.current.started = false;
        context.current.retries = 0;
      }
      setRevision((value) => value + 1);
    },
  };
}
