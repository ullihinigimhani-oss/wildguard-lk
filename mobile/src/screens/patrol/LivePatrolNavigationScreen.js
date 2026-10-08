import React, { useMemo, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { Text } from "../../components/common/Typography";
import { useIsFocused } from "@react-navigation/native";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import PatrolLoadState from "../../components/PatrolLoadState";
import PatrolRouteMap from "../../components/patrol/PatrolRouteMap";
import { readPlannedRoute } from "../../utils/plannedPatrolRoute";
import {
  clearNavigationSession,
  sessionKey,
} from "../../utils/navigationSession";
import { destinationsFor } from "../../utils/liveNavigation";
import useAssignedPatrol from "../../hooks/useAssignedPatrol";
import useForegroundLocation from "../../hooks/useForegroundLocation";
import useLiveNavigation from "../../hooks/useLiveNavigation";
import useFullPatrolRoute from "../../hooks/useFullPatrolRoute";
import { useAuth } from "../../hooks/useAuth";
import { completeMyPatrol } from "../../services/patrolApi";
import { styles } from "../../constants/theme";
import { rangerStyles as ui } from "../../constants/rangerTheme";

export default function LivePatrolNavigationScreen({ route, navigation }) {
  const { user } = useAuth(),
    focused = useIsFocused();
  const state = useAssignedPatrol(route.params?.patrolId),
    patrol = state.patrol;
  const data = useMemo(() => readPlannedRoute(patrol?.plannedRoute), [patrol]);
  const [finished, setFinished] = useState(false),
    [accessLost, setAccessLost] = useState(false),
    [confirming, setConfirming] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const usable =
    !data.invalidCount &&
    destinationsFor(data.points).length > 0 &&
    data.points
      .filter((point) => point.type !== "HIGH_RISK")
      .every((point) => point.waypointId) &&
    data.points[0]?.type === "START" &&
    data.points.at(-1)?.type === "END";
  const location = useForegroundLocation(
    focused &&
      !finished &&
      !accessLost &&
      patrol?.status === "IN_PROGRESS" &&
      usable,
  );
  const live = useLiveNavigation(patrol, data.points, user?.id, location);
  const full = useFullPatrolRoute(
    patrol,
    data.points,
    user?.id,
    live,
    location.active && usable && !accessLost,
  );
  const approaching = live.destination?.type === "START";
  React.useEffect(() => {
    if (live.accessLost) setAccessLost(true);
  }, [live.accessLost]);
  async function complete() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await completeMyPatrol(patrol.id);
      if (result.status === "COMPLETED") {
        setFinished(true);
        clearNavigationSession(sessionKey(user.id, patrol));
        navigation.replace("PatrolDetails", { patrolId: patrol.id });
      }
    } catch {
      setError(
        "Unable to complete the patrol. Refresh its status or try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const navigationData = useMemo(
    () => ({
      currentLocation: location.position,
      geometry: live.route?.geometry || null,
      destination: live.destination || null,
      approaching,
      fullRoute: full.route,
      reachedWaypointIds: Array.from(live.reached),
      trail: live.trail,
      riskZones: live.riskZones || [],
    }),
    [
      location.position,
      live.route,
      live.destination,
      live.trail,
      live.riskZones,
      approaching,
      full.route,
      live.reached,
    ],
  );
  return (
    <Screen>
      <PatrolLoadState {...state} refresh={state.refresh} />
      {patrol && (
        <>
          <View style={ui.card}>
            <Text style={ui.section}>Patrol Navigation</Text>
            <Text style={styles.muted}>{patrol.routeName}</Text>
            <Text style={styles.text}>
              {live.complete
                ? "Patrol route completed."
                : `Next: ${live.destination?.label || "No destination available"}`}
            </Text>
            {live.destination && (
              <Text style={styles.muted}>{live.destination.typeLabel}</Text>
            )}
            {live.summary && (
              <Text style={ui.section}>
                {live.summary.distanceMeters >= 1000
                  ? `${(live.summary.distanceMeters / 1000).toFixed(1)} km`
                  : `${Math.round(live.summary.distanceMeters)} m`}{" "}
                · Approx.{" "}
                {Math.max(1, Math.ceil(live.summary.durationSeconds / 60))} min
              </Text>
            )}
            {live.summary && (
              <Text style={styles.muted}>
                Remaining to next point · estimate from the ORS walking route
              </Text>
            )}
            {live.routing && (
              <Text style={styles.muted}>Finding a walking route…</Text>
            )}
            {live.route?.riskAvoidance?.applied && (
              <Text style={styles.muted}>
                Route avoiding {live.route.riskAvoidance.zoneCount} known risk{" "}
                {live.route.riskAvoidance.zoneCount === 1 ? "zone" : "zones"}
              </Text>
            )}
          </View>
          {patrol.status !== "IN_PROGRESS" || finished ? (
            <Text style={styles.muted}>
              Live navigation is available only while this patrol is in
              progress.
            </Text>
          ) : !usable ? (
            <Text style={styles.error}>
              A complete, valid saved route is required. Ask your Park Manager
              to check this patrol.
            </Text>
          ) : (
            <>
              {accessLost && (
                <Text accessibilityRole="alert" style={styles.error}>
                  This patrol is no longer available for navigation. Refresh the
                  patrol.
                </Text>
              )}
              {location.waiting && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                  accessibilityLiveRegion="polite"
                >
                  <ActivityIndicator accessibilityLabel="Acquiring current location" />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={ui.section}>Locating you...</Text>
                    <Text style={styles.muted}>
                      Getting your current position for patrol navigation.
                    </Text>
                  </View>
                </View>
              )}
              {!live.riskReady && !live.riskError && (
                <Text style={styles.muted}>Checking known risk areas…</Text>
              )}
              {live.riskError && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {live.riskError}
                </Text>
              )}
              {live.rangerInsideZone && (
                <Text accessibilityRole="alert" style={styles.error}>
                  You are currently inside a known high-risk area. No verified
                  outward route is available. Review your position and contact
                  the Park Manager.
                </Text>
              )}
              {live.destinationInsideZone && (
                <Text accessibilityRole="alert" style={styles.error}>
                  Next patrol point is inside a known high-risk area. Review the
                  planned route and contact the Park Manager.
                </Text>
              )}
              {location.error && (
                <>
                  <Text accessibilityRole="alert" style={styles.error}>
                    {location.error}
                  </Text>
                  <Button title="Retry" secondary onPress={location.retry} />
                  {location.errorCode === "SERVICES_DISABLED" &&
                    Platform.OS === "ios" && (
                      <Text style={styles.muted}>
                        In device Settings, open Privacy &amp; Security →
                        Location Services and turn it on.
                      </Text>
                    )}
                  {location.canOpenSettings && (
                    <Button
                      title="Open Settings"
                      secondary
                      onPress={location.openSettings}
                    />
                  )}
                </>
              )}
              {live.offRoute && (
                <Text accessibilityRole="alert" style={styles.error}>
                  Off Planned Navigation Route
                </Text>
              )}
              {live.error && (
                <>
                  <Text accessibilityRole="alert" style={styles.error}>
                    {live.error}
                  </Text>
                  <Button
                    title="Retry walking route"
                    secondary
                    onPress={live.retry}
                    disabled={
                      !location.position ||
                      !live.riskReady ||
                      live.routing ||
                      accessLost
                    }
                  />
                </>
              )}
              <PatrolRouteMap
                points={data.points}
                segments={data.segments}
                live
                navigationData={navigationData}
              />
              <Text style={styles.muted}>
                Blue dot: Your Location · Blue line: Route to Patrol Start ·
                Green line: Planned Patrol Navigation · Orange line: Recorded
                GPS Trail · Red area: Known Risk Zone · Red warning pin:
                HIGH_RISK warning
              </Text>
              {full.loading && (
                <Text style={styles.muted}>
                  Loading full patrol navigation route…
                </Text>
              )}
              {full.error && (
                <>
                  <Text accessibilityRole="alert" style={styles.error}>
                    {full.error}
                  </Text>
                  <Button
                    title="Retry full patrol route"
                    secondary
                    onPress={full.retry}
                    disabled={
                      full.loading ||
                      live.routing ||
                      !live.riskReady ||
                      accessLost
                    }
                  />
                </>
              )}
              {live.riskZones?.length > 0 && (
                <Text style={styles.muted}>
                  Avoidance uses known risk areas and mapped walking paths.
                  Conditions on the ground may differ.
                </Text>
              )}
              {live.trailError && (
                <Text style={styles.error}>{live.trailError}</Text>
              )}
              <View style={ui.card}>
                <Text style={ui.section}>Patrol Progress</Text>
                {live.destinations.map((point) => (
                  <Text key={point.waypointId} style={styles.text}>
                    {live.reached.has(point.waypointId)
                      ? "✓"
                      : point.waypointId === live.destination?.waypointId
                        ? "→"
                        : "○"}{" "}
                    {point.label}
                  </Text>
                ))}
                <Text style={styles.muted}>
                  Progress is retained in this signed-in session. It resets
                  after logout or app restart.
                </Text>
              </View>
              {live.complete && !confirming && (
                <Button
                  title="Complete Patrol"
                  onPress={() => setConfirming(true)}
                />
              )}
              {confirming && (
                <View style={ui.card}>
                  <Text style={ui.section}>Complete this patrol?</Text>
                  <Text style={styles.muted}>
                    Your completion time will be recorded.
                  </Text>
                  <Button
                    title="Confirm Completion"
                    loading={busy}
                    onPress={complete}
                  />
                  <Button
                    title="Keep patrolling"
                    secondary
                    disabled={busy}
                    onPress={() => setConfirming(false)}
                  />
                </View>
              )}
            </>
          )}
          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          {patrol.status === "IN_PROGRESS" && !finished && !accessLost && (
            <Button
              title="Report Incident"
              secondary
              disabled={busy}
              onPress={() =>
                navigation.navigate("IncidentCreate", { patrolId: patrol.id })
              }
            />
          )}
          <Button
            title="View planned route"
            secondary
            onPress={() =>
              navigation.navigate("PatrolRoute", { patrolId: patrol.id })
            }
          />
          <Button
            title="Refresh patrol"
            secondary
            onPress={() => {
              setAccessLost(false);
              state.refresh();
            }}
          />
        </>
      )}
    </Screen>
  );
}
