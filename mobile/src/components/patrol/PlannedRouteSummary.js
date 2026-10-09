import React from "react";
import { View } from "react-native";
import { Text } from "../common/Typography";
import { styles } from "../../constants/rangerTheme";
import { rangerStyles as ui } from "../../constants/rangerTheme";
import { plannedDistanceKm } from "../../utils/plannedPatrolRoute";

export default function PlannedRouteSummary({ routeData }) {
  const { points, invalidCount } = routeData;
  const count = (type) => points.filter((point) => point.type === type).length;
  return (
    <View style={ui.card}>
      <Text accessibilityRole="header" style={ui.section}>
        Route Summary
      </Text>
      <View style={{ gap: 4 }}>
        <Text style={styles.muted}>Approx. Planned Distance</Text>
        <Text style={[styles.text, { fontSize: 22, fontWeight: "700" }]}>
          {invalidCount
            ? "Unavailable — incomplete route"
            : `${plannedDistanceKm(points).toFixed(2)} km`}
        </Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
        {[
          ["CHECKPOINT", "Checkpoints"],
          ["HIGH_RISK", "High Risk Areas"],
          ["OBSERVATION", "Observation Points"],
        ].map(([type, label]) => (
          <View key={type} style={{ minWidth: 95, gap: 3 }}>
            <Text
              style={[
                styles.text,
                {
                  fontWeight: "700",
                  color: type === "HIGH_RISK" ? "#b42332" : styles.text.color,
                },
              ]}
            >
              {count(type)}
            </Text>
            <Text style={[styles.muted, { fontSize: 11 }]}>{label}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.muted, { fontSize: 12 }]}>
        Direct distances between the manager's waypoints. Roads, trails and
        terrain may require a longer path.
      </Text>
    </View>
  );
}
