import React from "react";
import { Text, View } from "react-native";
import { styles, colors } from "../constants/theme";
import { patrolDate, patrolTime, patrolStatuses } from "../utils/rangerPatrol";
export default function PatrolCard({ patrol, children }) {
  return <View style={styles.card}>
    <Text style={styles.eyebrow}>{patrolStatuses[patrol.status]}</Text>
    <Text accessibilityRole="header" style={styles.heading}>{patrol.routeName}</Text>
    <Text style={styles.muted}>{patrol.park?.name || "Not assigned"}</Text>
    <Text style={styles.text}>{patrolDate(patrol.scheduledDate)}</Text>
    <View style={{ flexDirection: "row", gap: 20, flexWrap: "wrap" }}>
      <View><Text style={styles.muted}>Scheduled start</Text><Text style={styles.text}>{patrolTime(patrol.startTime)}</Text></View>
      <View><Text style={styles.muted}>Expected end</Text><Text style={styles.text}>{patrolTime(patrol.endTime)}</Text></View>
    </View>
    <Text style={{ ...styles.text, color: colors.green }}>{patrol.patrolType?.replace(/_/g, " ")} · {patrol.priority} priority</Text>
    {children}
  </View>;
}
