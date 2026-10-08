import React from "react";
import { Image, Pressable, View, useWindowDimensions } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import Screen from "../../components/common/Screen";
import Avatar from "../../components/common/Avatar";
import PatrolLoadState from "../../components/PatrolLoadState";
import { Text } from "../../components/common/Typography";
import { useAuth } from "../../hooks/useAuth";
import useRangerPatrols from "../../hooks/useRangerPatrols";
import {
  dashboardPatrols,
  classifyPatrol,
  PATROL_TIME_ZONE,
  patrolDate,
} from "../../utils/rangerPatrol";
import usePatrolClock from "../../hooks/usePatrolClock";
import DashboardPatrolCard from "./DashboardPatrolCard";
import { dashboardColors as c, dashboardStyles as s } from "./dashboardTheme";
function QuickAction({ title, detail, icon, amber, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={detail}
      onPress={onPress}
      style={({ pressed }) => [
        s.card,
        {
          flex: 1,
          minWidth: 0,
          padding: 16,
          gap: 12,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View style={[s.iconTile, amber && { backgroundColor: "#FFF0DB" }]}>
          <Feather
            accessible={false}
            name={icon}
            size={21}
            color={amber ? "#8A5119" : c.forest}
          />
        </View>
        <Feather
          accessible={false}
          name="arrow-up-right"
          size={17}
          color={c.muted}
        />
      </View>
      <View style={{ gap: 4 }}>
        <Text style={[s.section, { fontSize: 15, lineHeight: 23 }]}>
          {title}
        </Text>
        <Text style={[s.body, { fontSize: 12, lineHeight: 19 }]}>{detail}</Text>
      </View>
    </Pressable>
  );
}
export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const state = useRangerPatrols();
  const now = usePatrolClock();
  const summary = dashboardPatrols(state.patrols, now);
  const patrol = summary.selected;
  const upcoming = dashboardPatrols(
    state.patrols.filter((p) => classifyPatrol(p, now).upcoming),
    now,
  ).selected;
  const { width, fontScale } = useWindowDimensions();
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: PATROL_TIME_ZONE,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user.name.trim().split(/\s+/)[0];
  const recent = state.patrols
    .filter((item) => ["COMPLETED", "CANCELLED"].includes(item.status))
    .sort((a, b) => (Date.parse(b.actualEndTime || b.scheduledDate) || 0) - (Date.parse(a.actualEndTime || a.scheduledDate) || 0))
    .slice(0, 3);
  return (
    <Screen backgroundColor={c.background} contentStyle={s.content}>
      <View style={s.header}>
        <View
          style={{
            height: 46,
            width: 46,
            backgroundColor: c.white,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: c.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={require("../../../assets/images/wildguard-logo.png")}
            resizeMode="contain"
            accessibilityLabel="WildGuard LK logo"
            style={{ height: 37, width: 37 }}
          />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.brand}>WildGuard LK</Text>
          <Text style={s.eyebrow}>FIELD OPERATIONS</Text>
        </View>
        <View style={[s.badge, { backgroundColor: c.sage }]}>
          <Text style={s.badgeText}>RANGER</Text>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Avatar user={user} size={48} />
          <View style={{ flex: 1, gap: 4 }}>
        <Text accessibilityRole="header" style={s.title}>
          {greeting}, {firstName}
        </Text>
        <Text style={s.body}>Ready for your next patrol?</Text>
          </View>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
          }}
        >
          <Feather accessible={false} name="map-pin" size={15} color={c.secondary} />
          <Text style={[s.body, { fontSize: 12, flex: 1 }]}>
            {user.park?.name || "Not assigned"}
          </Text>
        </View>
      </View>
      <PatrolLoadState {...state} />
      {!state.loading && !state.error && (
        <>
          {summary.allTodayCompleted && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View today's completed patrols"
              onPress={() =>
                navigation.navigate("Patrol", { filter: "COMPLETED" })
              }
              style={[
                s.notice,
                { backgroundColor: c.sage, borderColor: c.sage },
              ]}
            >
              <Feather
                accessible={false}
                name="check-circle"
                size={18}
                color={c.forest}
              />
              <Text style={[s.body, { color: c.forest, flex: 1 }]}>
                Today's patrols are completed.
              </Text>
              <Feather
                accessible={false}
                name="arrow-right"
                size={17}
                color={c.forest}
              />
            </Pressable>
          )}
          {summary.overdueCount > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${summary.overdueCount} overdue ${summary.overdueCount === 1 ? "patrol requires" : "patrols require"} attention`}
              onPress={() =>
                navigation.navigate("Patrol", { filter: "OVERDUE" })
              }
              style={s.notice}
            >
              <Feather
                accessible={false}
                name="alert-triangle"
                size={18}
                color={c.danger}
              />
              <Text
                style={[s.body, { fontSize: 13, color: "#674018", flex: 1 }]}
              >
                {summary.overdueCount} overdue{" "}
                {summary.overdueCount === 1
                  ? "patrol requires"
                  : "patrols require"}{" "}
                attention
              </Text>
              <Feather
                accessible={false}
                name="chevron-right"
                size={17}
                color="#674018"
              />
            </Pressable>
          )}
          {!summary.hasPatrolToday && (
            <View
              style={[
                s.card,
                {
                  padding: 18,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                },
              ]}
            >
              <View style={s.iconTile}>
                <Feather
                  accessible={false}
                  name="compass"
                  size={23}
                  color={c.forest}
                />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[s.section, { fontSize: 15 }]}>
                  Your next field assignment
                </Text>
                <Text style={[s.body, { fontSize: 13 }]}>
                  No patrol scheduled for today.
                </Text>
              </View>
            </View>
          )}
          {patrol && (
            <View style={{ gap: 10 }}>
              <Text style={s.eyebrow}>{summary.heading}</Text>
              <DashboardPatrolCard
                patrol={patrol}
                now={now}
                onPress={() =>
                  navigation.navigate("PatrolDetails", { patrolId: patrol.id })
                }
              />
            </View>
          )}
          {upcoming && upcoming.id !== patrol?.id && (
            <View style={{ gap: 10 }}>
              <Text style={s.eyebrow}>NEXT PATROL</Text>
              <DashboardPatrolCard
                patrol={upcoming}
                now={now}
                onPress={() =>
                  navigation.navigate("PatrolDetails", {
                    patrolId: upcoming.id,
                  })
                }
              />
            </View>
          )}
          {!upcoming && (
            <Text style={[s.body, { fontSize: 12 }]}>
              No upcoming patrols assigned.
            </Text>
          )}
        </>
      )}
      <View style={{ gap: 12 }}>
        <Text style={s.section}>Quick Actions</Text>
        <View
          style={{
            flexDirection: width < 350 || fontScale > 1.3 ? "column" : "row",
            gap: 12,
          }}
        >
          <QuickAction
            title="My Patrols"
            detail="Your assignments & history"
            icon="map"
            onPress={() => navigation.navigate("Patrol")}
          />
          <QuickAction
            title="Report Incident"
            detail="Record a field observation"
            icon="flag"
            amber
            onPress={() => navigation.navigate("Incident")}
          />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Patrol History" onPress={() => navigation.navigate("Patrol", { filter: "COMPLETED" })} style={({ pressed }) => [s.card, { flexDirection: "row", alignItems: "center", padding: 16, opacity: pressed ? 0.7 : 1 }]}>
          <View style={s.iconTile}><Feather accessible={false} name="clock" size={21} color={c.forest} /></View>
          <View style={{ flex: 1, gap: 3 }}><Text style={[s.section, { fontSize: 15 }]}>Patrol History</Text><Text style={[s.body, { fontSize: 12 }]}>Review completed assignments</Text></View>
          <Feather accessible={false} name="chevron-right" size={18} color={c.forest} />
        </Pressable>
      </View>
      {!state.loading && !state.error && <View style={{ gap: 12 }}>
        <Text style={s.section}>Recent Activity</Text>
        {recent.length ? recent.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`View activity: ${item.routeName}`} onPress={() => navigation.navigate("PatrolDetails", { patrolId: item.id })} style={({ pressed }) => [s.card, { flexDirection: "row", alignItems: "center", padding: 16, opacity: pressed ? 0.7 : 1 }]}>
          <View style={s.iconTile}><Feather accessible={false} name={item.status === "COMPLETED" ? "check-circle" : "slash"} size={20} color={c.forest} /></View>
          <View style={{ flex: 1, gap: 4 }}><Text style={[s.section, { fontSize: 14 }]}>{item.routeName}</Text><Text style={[s.body, { fontSize: 12 }]}>{item.status === "COMPLETED" ? "Completed" : "Cancelled"} · {patrolDate(item.scheduledDate)}</Text></View>
          <Feather accessible={false} name="chevron-right" size={17} color={c.muted} />
        </Pressable>) : <View style={s.card}><Text style={s.body}>No recent patrol activity yet.</Text></View>}
      </View>}
    </Screen>
  );
}
