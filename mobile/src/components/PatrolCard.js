import React from "react";
import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { styles, colors } from "../constants/theme";
import { rangerStyles as ui } from "../constants/rangerTheme";
import { patrolDate, patrolTime, patrolStatuses } from "../utils/rangerPatrol";
const types = { ROUTINE: "Routine Patrol", ANTI_POACHING: "Anti-Poaching Operation", WILDLIFE_MONITORING: "Wildlife Monitoring", CONFLICT_RESPONSE: "Conflict Response", SPECIAL: "Special Operation" };
const statusColors = { SCHEDULED: [colors.cream, colors.green], IN_PROGRESS: [colors.green, colors.white], COMPLETED: ["#edf2ed", colors.muted] };
function TimeField({ label, value }) {
  return <View style={{ flex: 1, minWidth: 120, gap: 4 }}>
    <Text style={{ ...styles.muted, fontSize: 11 }}>{label}</Text>
    <Text style={{ fontSize: 20, lineHeight: 27, fontWeight: "600", color: colors.dark }}>{patrolTime(value)}</Text>
  </View>;
}
export default function PatrolCard({ patrol, children }) {
  const [backgroundColor, color] = statusColors[patrol.status] || statusColors.SCHEDULED;
  return <View style={ui.card}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
      <View style={[ui.badge, { backgroundColor, borderColor: backgroundColor }]}><Text style={[ui.badgeText, { color }]}>{patrolStatuses[patrol.status]?.toUpperCase()}</Text></View>
      <View accessibilityLabel={`Priority: ${patrol.priority}`} style={[ui.badge, { borderColor: colors.border, backgroundColor: patrol.priority === "HIGH" ? "#f2eedc" : colors.background }]}><Text style={[ui.badgeText, { color: patrol.priority === "HIGH" ? "#66552c" : colors.muted }]}>{patrol.priority}</Text></View>
    </View>
    <View style={{ gap: 4 }}>
      <Text accessibilityRole="header" style={{ ...styles.heading, fontSize: 20, lineHeight: 27 }}>{patrol.routeName}</Text>
      <Text style={styles.muted}>{patrol.park?.name || "Not assigned"}</Text>
    </View>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Ionicons accessible={false} name="calendar-outline" size={16} color={colors.muted} /><Text style={{ ...styles.text, fontSize: 13 }}>{patrolDate(patrol.scheduledDate)}</Text></View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
      <TimeField label="Scheduled Start" value={patrol.startTime} /><TimeField label="Expected End" value={patrol.endTime} />
    </View>
    <View style={{ gap: 3 }}><Text style={{ ...styles.muted, fontSize: 11 }}>Patrol Type</Text><Text style={{ ...styles.text, fontSize: 14, fontWeight: "600" }}>{types[patrol.patrolType] || patrol.patrolType?.replace(/_/g, " ")}</Text></View>
    {children}
  </View>;
}
