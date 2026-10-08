import { walkingRouteError } from "../utils/walkingRouteError";
import { useEffect, useRef, useState } from "react";
import { getFullPatrolRoute } from "../services/patrolApi";
import { sessionKey } from "../utils/navigationSession";

// Presentation context only: never participates in arrival, ETA or GPS recording.
export default function useFullPatrolRoute(
  patrol,
  points,
  userId,
  live,
  active,
) {
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
    };
    context.current = ctx;
    setState({ route: null, error: null, loading: false, signature });
    return () => {
      ctx.cancelled = true;
      ctx.controller.abort();
      clearTimeout(ctx.timer);
    };
  }, [signature, active]);
  const canRequest = !!(
    active &&
    live.riskReady &&
    !live.routing &&
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
    setState((value) => ({ ...value, loading: true, error: null }));
    getFullPatrolRoute(patrol.id, ctx.controller.signal)
      .then((route) => {
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
        setState((value) => ({ ...value, route, error: null }));
      })
      .catch((error) => {
        if (ctx.cancelled) return;
        const status = error.response?.status,
          code = error.response?.data?.code;
        if (status === 429 && ctx.retries < 3) {
          ctx.retries++;
          const seconds = Number(error.response?.data?.retryAfterSeconds);
          ctx.timer = setTimeout(
            () => {
              ctx.started = false;
              setRevision((value) => value + 1);
            },
            Math.max(20, Number.isFinite(seconds) ? seconds : 20) * 1000,
          );
          setState((value) => ({
            ...value,
            error:
              "Full patrol route is waiting for the routing request limit.",
          }));
        } else
          setState((value) => ({
            ...value,
            route: null,
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
      })
      .finally(() => {
        if (!ctx.cancelled) setState((value) => ({ ...value, loading: false }));
      });
  }, [canRequest, signature, active, revision, patrol?.id]);
  return {
    ...state,
    route: state.signature === signature && active ? state.route : null,
    retry: () => {
      if (context.current) {
        clearTimeout(context.current.timer);
        context.current.started = false;
        context.current.retries = 0;
      }
      setRevision((value) => value + 1);
    },
  };
}
