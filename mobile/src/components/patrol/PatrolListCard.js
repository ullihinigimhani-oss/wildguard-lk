import React, { memo } from "react";
import { View } from "react-native";
import { Text } from "../common/Typography";
import Button from "../common/Button";
import { PatrolBadges, patrolTypes } from "../PatrolCard";
import { classifyPatrol, patrolDate, patrolTime } from "../../utils/rangerPatrol";
import { fieldColors as c, fieldCard } from "../../constants/fieldTheme";
import PatrolCardPreview from "./PatrolCardPreview";

function Info({ label, value }) {
  return <View style={{ flexBasis: "46%", flexGrow: 1, gap: 3 }}>
    <Text style={{ fontSize: 11, lineHeight: 16, color: c.muted }}>{label}</Text>
    <Text style={{ fontSize: 13, lineHeight: 20, fontWeight: "600", color: c.text }}>{value}</Text>
  </View>;
}
export function recordedDuration(patrol) {
  const start = Date.parse(patrol.actualStartTime), end = Date.parse(patrol.actualEndTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const minutes = Math.floor((end - start) / 60000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
export default memo(function PatrolListCard({ patrol, now, navigation, previewOpen, previewCache }) {
  const state = classifyPatrol(patrol, now);
  const duration = recordedDuration(patrol);
  return <View style={[fieldCard, { padding: 16, gap: 12, borderRadius: 22 }]}>
    <View style={{ gap: 6 }}>
      <Text accessibilityRole="header" style={{ fontSize: 19, lineHeight: 26, fontWeight: "700", color: c.forest }}>{patrol.routeName}</Text>
      <Text style={{ fontSize: 12, lineHeight: 19, color: c.muted }}>{patrol.park?.name || "Not assigned"}</Text>
      <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start", flexWrap: "wrap" }}>
        <PatrolBadges patrol={patrol} now={now} />
        <View accessibilityLabel={`Priority: ${patrol.priority}`} style={{ paddingHorizontal: 9, paddingVertical: 6, borderRadius: 16, backgroundColor: patrol.priority === "HIGH" ? "#FFF0DC" : c.sage }}>
          <Text style={{ fontSize: 10, lineHeight: 15, fontWeight: "700", color: patrol.priority === "HIGH" ? "#785018" : c.forest }}>{patrol.priority}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 12, lineHeight: 19, fontWeight: "500", color: c.secondary }}>{patrolTypes[patrol.patrolType] || patrol.patrolType?.replace(/_/g, " ")}</Text>
    </View>
    <PatrolCardPreview key={`${patrol.id}:${patrol.updatedAt || patrol.status}`} patrolId={patrol.id} open={previewOpen} cache={previewCache} cacheKey={`${patrol.id}:${patrol.updatedAt || patrol.status}`} />
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      <Info label="Date" value={patrolDate(patrol.scheduledDate)} />
      <Info label="Scheduled Start" value={patrolTime(patrol.startTime)} />
      <Info label="Expected End" value={patrolTime(patrol.endTime)} />
      {patrol.actualStartTime && <Info label="Actual Start" value={patrolTime(patrol.actualStartTime)} />}
      {patrol.actualEndTime && <Info label="Actual End" value={patrolTime(patrol.actualEndTime)} />}
      {duration && <Info label="Duration" value={duration} />}
    </View>
    {state.completionText && <View style={{ backgroundColor: c.sage, borderRadius: 14, padding: 11 }}>
      <Text style={{ color: c.forest, fontSize: 12, lineHeight: 19 }}>{state.completionText}</Text>
    </View>}
    <Button title={state.action} color={c.forest} icon="arrow-right" onPress={() => navigation.navigate("PatrolDetails", { patrolId: patrol.id })} />
  </View>;
});
