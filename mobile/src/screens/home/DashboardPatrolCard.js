import React from "react";
import { Image, Pressable, View } from "react-native";
import { Text } from "../../components/common/Typography";
import Feather from "@expo/vector-icons/Feather";
import {
  classifyPatrol,
  patrolDate,
  patrolTime,
} from "../../utils/rangerPatrol";
import { patrolTypes } from "../../components/PatrolCard";
import { dashboardColors as c, dashboardStyles as s } from "./dashboardTheme";

export default function DashboardPatrolCard({ patrol, now, onPress }) {
  const state = classifyPatrol(patrol, now),
    active = state.active;
  const ink = active ? c.white : c.text,
    secondary = active ? c.onForest : c.muted;
  return (
    <View style={[s.card, active && s.activeCard]}>
      {active && <Image accessible={false} source={require("../../../assets/images/onboarding-ranger.jpg")} resizeMode="cover" style={{ height: 120, width: "100%", borderRadius: 16 }} />}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {state.badges.map((badge) => (
          <View
            key={badge}
            style={[s.badge, { backgroundColor: active ? "#2C604C" : c.sage }]}
          >
            <Text style={[s.badgeText, { color: active ? c.white : c.forest }]}>
              {badge}
            </Text>
          </View>
        ))}
        <View
          accessibilityLabel={`Priority: ${patrol.priority}`}
          style={[
            s.badge,
            {
              backgroundColor:
                patrol.priority === "HIGH"
                  ? "#FFE1B7"
                  : active
                    ? "#2C604C"
                    : c.background,
            },
          ]}
        >
          <Text
            style={[
              s.badgeText,
              {
                color:
                  patrol.priority === "HIGH"
                    ? "#674018"
                    : active
                      ? c.white
                      : c.muted,
              },
            ]}
          >
            {patrol.priority}
          </Text>
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Text accessibilityRole="header" style={[s.cardTitle, { color: ink }]}>
          {patrol.routeName}
        </Text>
        <View
          style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}
        >
          <Feather
            accessible={false}
            name="map-pin"
            size={15}
            color={secondary}
          />
          <Text style={[s.body, { color: secondary, flex: 1 }]}>
            {patrol.park?.name || "Not assigned"}
          </Text>
        </View>
      </View>
      <View
        style={{
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: active ? "#3E6B56" : c.border,
          paddingTop: 14,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather
            accessible={false}
            name="calendar"
            size={15}
            color={secondary}
          />
          <Text style={[s.body, { color: secondary, flex: 1 }]}>
            {patrolDate(patrol.scheduledDate)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather
            accessible={false}
            name="clock"
            size={15}
            color={secondary}
          />
          <Text style={[s.body, { color: ink, fontWeight: "600", flex: 1 }]}>
            {patrolTime(patrol.startTime)} – {patrolTime(patrol.endTime)}
          </Text>
        </View>
        <Text style={[s.body, { color: secondary, fontSize: 12 }]}>
          {patrolTypes[patrol.patrolType] ||
            patrol.patrolType?.replace(/_/g, " ")}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={state.action}
        onPress={onPress}
        style={({ pressed }) => ({
          minHeight: 52,
          padding: 14,
          borderRadius: 13,
          backgroundColor: active ? c.sage : c.background,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text
          style={{
            color: c.forest,
            fontSize: 14,
            lineHeight: 21,
            fontWeight: "700",
            flex: 1,
          }}
        >
          {state.action}
        </Text>
        <Feather
          accessible={false}
          name="arrow-right"
          size={19}
          color={c.forest}
        />
      </Pressable>
    </View>
  );
}
