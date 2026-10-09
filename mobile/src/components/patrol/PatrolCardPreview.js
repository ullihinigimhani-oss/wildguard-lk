import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { Text } from "../common/Typography";
import { fieldColors as c } from "../../constants/fieldTheme";
import { getMyPatrol, getPatrolLocations } from "../../services/patrolApi";
import { readPlannedRoute } from "../../utils/plannedPatrolRoute";
import { buildPlannedMapDocument } from "./plannedMapDocument";
import PatrolMapSurface from "./PatrolMapSurface";

export function validatedTrail(locations) {
  return Array.isArray(locations) && locations.every((p) => p && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180)
    ? locations : [];
}
export default memo(function PatrolCardPreview({ patrolId, open, cache, cacheKey = patrolId }) {
  const [data, setData] = useState(() => cache?.get(cacheKey) || null), [error, setError] = useState(null), [revision, setRevision] = useState(0), [mapError, setMapError] = useState(false);
  useEffect(() => {
    if (!open || data) return;
    const controller = new AbortController();
    setError(null);
    (async () => {
      try {
        const patrol = await getMyPatrol(patrolId, controller.signal);
        if (patrol.id !== patrolId) throw new Error();
        const route = readPlannedRoute(patrol.plannedRoute);
        let trail = [], trailUnavailable = false;
        if (patrol.actualStartTime) {
          try { trail = validatedTrail(await getPatrolLocations(patrolId, controller.signal)); }
          catch { trailUnavailable = true; }
        }
        if (!controller.signal.aborted) {
          const result = { ...route, trail, trailUnavailable };
          if (cache) {
            if (cache.size >= 60) cache.delete(cache.keys().next().value);
            cache.set(cacheKey, result);
          }
          setData(result);
        }
      } catch {
        if (!controller.signal.aborted) setError("Route preview could not be loaded. Try again.");
      }
    })();
    return () => controller.abort();
  }, [open, patrolId, revision, data, cache, cacheKey]);
  const html = useMemo(() => open && data ? buildPlannedMapDocument(data.points, data.segments, false, data.trail) : "", [open, data]);
  const onMessage = useCallback((message) => { if (message?.type === "map-error" || message?.type === "tile-error") setMapError(true); }, []);
  const hasRoute = data && (data.points.length || data.trail.length);
  return <View style={{ gap: 7 }}>
    <View style={{ height: 200, borderRadius: 17, overflow: "hidden", backgroundColor: c.sage, borderWidth: 1, borderColor: c.border }}>
      {open && hasRoute ? <PatrolMapSurface html={html} onMessage={onMessage} onError={() => setMapError(true)} /> :
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16, gap: 9 }}>
          {open && !data && !error ? <ActivityIndicator color={c.forest} /> : <Feather accessible={false} name="map" size={27} color={c.secondary} />}
          <Text style={{ fontSize: 13, lineHeight: 20, fontWeight: "600", color: c.forest }}>{error || (data && !hasRoute ? "Route not available" : "Loading saved route…")}</Text>
        </View>}
    </View>
    {open && <>
      {hasRoute && <Text style={{ fontSize: 10, lineHeight: 17, color: c.muted }}>Green: saved waypoint connections · Orange: recorded GPS trail</Text>}
      {data?.invalidCount > 0 && <Text style={{ fontSize: 11, color: c.danger }}>Some saved route points are unavailable; gaps are not connected.</Text>}
      {data?.trailUnavailable && <Text style={{ fontSize: 11, color: c.muted }}>Recorded trail could not be loaded. Open patrol details to retry.</Text>}
      {mapError && <Text style={{ fontSize: 11, color: c.muted }}>Map tiles unavailable. Open patrol details to retry.</Text>}
      {error && <Pressable accessibilityRole="button" accessibilityLabel={`Retry route preview: ${patrolId}`} onPress={() => setRevision((v) => v + 1)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: c.forest, fontWeight: "600" }}>Retry route preview</Text></Pressable>}
    </>}
  </View>;
});
