import React from "react";
import { View } from "react-native";
import { Text } from "./common/Typography";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, colors } from "../constants/theme";
import { rangerStyles as ui } from "../constants/rangerTheme";
import { patrolDate, patrolTime, classifyPatrol } from "../utils/rangerPatrol";
export const patrolTypes = {
  ROUTINE: "Routine Patrol",
  ANTI_POACHING: "Anti-Poaching Operation",
  WILDLIFE_MONITORING: "Wildlife Monitoring",
  CONFLICT_RESPONSE: "Conflict Response",
  SPECIAL: "Special Operation",
};
const statusColors = {
  TODAY: [colors.cream, colors.green],
  UPCOMING: [colors.cream, colors.green],
  "IN PROGRESS": [colors.green, colors.white],
  OVERDUE: ["#f2eedc", "#66552c"],
  "COMPLETED LATE": ["#f2eedc", "#66552c"],
  COMPLETED: ["#edf2ed", colors.muted],
  CANCELLED: ["#edf2ed", colors.muted],
};
export function PatrolBadges({ patrol, now }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 }}>
      {classifyPatrol(patrol, now).badges.map((badge) => {
        const [backgroundColor, color] =
          statusColors[badge] || statusColors.TODAY;
        return (
          <View
            key={badge}
            style={[
              ui.badge,
              { backgroundColor, borderColor: backgroundColor },
            ]}
          >
            <Text style={[ui.badgeText, { color }]}>{badge}</Text>
          </View>
        );
      })}
    </View>
  );
}
function TimeField({ label, value }) {
  return (
    <View style={{ flex: 1, minWidth: 120, gap: 4 }}>
      <Text style={{ ...styles.muted, fontSize: 11 }}>{label}</Text>
      <Text
        style={{
          fontSize: 20,
          lineHeight: 27,
          fontWeight: "600",
          color: colors.dark,
        }}
      >
        {patrolTime(value)}
      </Text>
    </View>
  );
}
export default function PatrolCard({
  patrol,
  children,
  now,
  showCompletion = true,
}) {
  const state = classifyPatrol(patrol, now);
  return (
    <View style={ui.card}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <PatrolBadges patrol={patrol} now={now} />
        <View
          accessibilityLabel={`Priority: ${patrol.priority}`}
          style={[
            ui.badge,
            {
              borderColor: colors.border,
              backgroundColor:
                patrol.priority === "HIGH" ? "#f2eedc" : colors.background,
            },
          ]}
        >
          <Text
            style={[
              ui.badgeText,
              { color: patrol.priority === "HIGH" ? "#66552c" : colors.muted },
            ]}
          >
            {patrol.priority}
          </Text>
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <Text
          accessibilityRole="header"
          style={{ ...styles.heading, fontSize: 20, lineHeight: 27 }}
        >
          {patrol.routeName}
        </Text>
        <Text style={styles.muted}>{patrol.park?.name || "Not assigned"}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <Ionicons
          accessible={false}
          name="calendar-outline"
          size={16}
          color={colors.muted}
        />
        <Text style={{ ...styles.text, fontSize: 13 }}>
          {patrolDate(patrol.scheduledDate)}
        </Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 14,
          paddingVertical: 12,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.border,
        }}
      >
        <TimeField label="Scheduled Start" value={patrol.startTime} />
        <TimeField label="Expected End" value={patrol.endTime} />
      </View>
      <View style={{ gap: 3 }}>
        <Text style={{ ...styles.muted, fontSize: 11 }}>Patrol Type</Text>
        <Text style={{ ...styles.text, fontSize: 14, fontWeight: "600" }}>
          {patrolTypes[patrol.patrolType] ||
            patrol.patrolType?.replace(/_/g, " ")}
        </Text>
      </View>
      {showCompletion && state.completionText && (
        <Text style={styles.muted}>{state.completionText}</Text>
      )}
      {children}
    </View>
  );
}
