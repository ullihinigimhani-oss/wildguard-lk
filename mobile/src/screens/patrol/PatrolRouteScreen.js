import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { Text } from "../../components/common/Typography";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import PatrolLoadState from "../../components/PatrolLoadState";
import PatrolRouteMap from "../../components/patrol/PatrolRouteMap";
import PlannedRouteSummary from "../../components/patrol/PlannedRouteSummary";
import useAssignedPatrol from "../../hooks/useAssignedPatrol";
import { readPlannedRoute } from "../../utils/plannedPatrolRoute";
import { styles } from "../../constants/rangerTheme";
import { rangerStyles as ui } from "../../constants/rangerTheme";

export default function PatrolRouteScreen({ route }) {
  const state = useAssignedPatrol(route?.params?.patrolId);
  const data = useMemo(
    () => readPlannedRoute(state.patrol?.plannedRoute),
    [state.patrol],
  );
  const [selectedOrder, setSelectedOrder] = useState(null);
  return (
    <Screen>
      <PatrolLoadState {...state} />
      {state.patrol && (
        <>
          <View style={{ gap: 4 }}>
            <Text accessibilityRole="header" style={ui.title}>
              {state.patrol.routeName}
            </Text>
            <Text style={styles.muted}>
              {state.patrol.park?.name || "Not assigned"}
            </Text>
            <Text style={[styles.muted, { fontSize: 12 }]}>
              Manager-planned route
            </Text>
          </View>
          {data.invalidCount > 0 && (
            <Text accessibilityRole="alert" style={styles.error}>
              Some saved route points cannot be displayed. The route is
              incomplete; ask your Park Manager to check it.
            </Text>
          )}
          {!data.points.length ? (
            <View style={ui.card}>
              <Text accessibilityRole="header" style={ui.section}>
                No Planned Route
              </Text>
              <Text style={styles.muted}>
                {data.invalidCount
                  ? "No valid route points are available for this patrol."
                  : "No planned route has been added to this patrol."}
              </Text>
            </View>
          ) : (
            <>
              <PatrolRouteMap
                key={state.patrol.id}
                points={data.points}
                segments={data.segments}
                onSelect={setSelectedOrder}
              />
              <PlannedRouteSummary routeData={data} />
              <View style={ui.card}>
                <Text accessibilityRole="header" style={ui.section}>
                  Planned Route
                </Text>
                {data.points.map((point) => (
                  <View
                    key={point.order}
                    accessibilityLabel={`${point.order + 1}. ${point.typeLabel}: ${point.label}${point.note ? `. ${point.note}` : ""}`}
                    style={{
                      flexDirection: "row",
                      gap: 12,
                      paddingVertical: 12,
                      borderTopWidth: 1,
                      borderColor:
                        selectedOrder === point.order ? point.color : "#e1e9e3",
                      backgroundColor:
                        point.type === "HIGH_RISK" ? "#fff1f2" : "transparent",
                      borderRadius: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: point.type === "CHECKPOINT" ? 17 : 7,
                        backgroundColor: point.color,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: "white",
                          fontWeight: "700",
                          fontSize: 16,
                        }}
                      >
                        {point.symbol}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text
                        style={[
                          styles.muted,
                          {
                            fontSize: 11,
                            fontWeight: "700",
                            color:
                              point.type === "HIGH_RISK"
                                ? "#b42332"
                                : styles.muted.color,
                          },
                        ]}
                      >
                        {point.order + 1}. {point.typeLabel}
                      </Text>
                      <Text style={[styles.text, { fontWeight: "600" }]}>
                        {point.label}
                      </Text>
                      {!!point.note && (
                        <Text style={[styles.muted, { fontSize: 13 }]}>
                          {point.note}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
          <Button title="Refresh route" secondary onPress={state.refresh} />
        </>
      )}
    </Screen>
  );
}
