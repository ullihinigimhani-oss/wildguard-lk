import React from "react";
import { Image, Pressable, Text, View, useWindowDimensions } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Screen from "../../components/common/Screen";
import Avatar from "../../components/common/Avatar";
import Button from "../../components/common/Button";
import PatrolCard from "../../components/PatrolCard";
import PatrolLoadState from "../../components/PatrolLoadState";
import { useAuth } from "../../hooks/useAuth";
import useRangerPatrols from "../../hooks/useRangerPatrols";
import { todayPatrol, patrolAction } from "../../utils/rangerPatrol";
import { styles, colors } from "../../constants/theme";
import { rangerStyles as ui } from "../../constants/rangerTheme";
function QuickAction({ title, detail, icon, onPress }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={detail} onPress={onPress} style={({ pressed }) => [ui.card, { flex: 1, minWidth: 130, padding: 14, gap: 8, opacity: pressed ? 0.65 : 1 }]}>
    <Ionicons accessible={false} name={icon} size={23} color={colors.green} />
    <Text style={{ ...styles.text, fontWeight: "700", lineHeight: 20 }}>{title}</Text>
    <Text style={{ ...styles.muted, fontSize: 12, lineHeight: 18 }}>{detail}</Text>
  </Pressable>;
}
export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const state = useRangerPatrols();
  const patrol = todayPatrol(state.patrols);
  const { width, fontScale } = useWindowDimensions();
  return <Screen>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <Image source={require("../../../assets/images/wildguard-logo.png")} resizeMode="contain" accessibilityLabel="WildGuard LK logo" style={{ width: 36, height: 36 }} />
      <Text style={{ fontSize: 17, fontWeight: "700", color: colors.dark }}>WildGuard LK</Text>
    </View>
    <View style={{ gap: 3 }}><Text accessibilityRole="header" style={ui.title}>Hello, {user.name.trim().split(/\s+/)[0]}.</Text>
      <Text style={styles.muted}>Ready for today's patrol?</Text></View>
    <View style={ui.identity}><Avatar user={user} size={44} /><View style={{ flex: 1, gap: 3 }}>
      <Text style={{ ...styles.text, fontSize: 14, fontWeight: "600" }}>Park Ranger</Text>
      <Text style={{ ...styles.muted, fontSize: 12 }}>{user.park?.name || "Not assigned"}</Text>
    </View></View>
    <Text style={styles.eyebrow}>TODAY'S PATROL</Text><PatrolLoadState {...state} />
    {!state.loading && !state.error && (patrol ? <PatrolCard patrol={patrol}>
      <Button title={patrolAction[patrol.status]} onPress={() => navigation.navigate("Patrol", { selectedPatrolId: patrol.id, status: patrol.status })} />
    </PatrolCard> : <View style={ui.card}><Ionicons accessible={false} name="map-outline" size={25} color={colors.green} /><Text style={styles.text}>No patrol assigned for today.</Text></View>)}
    <Text style={ui.section}>Quick Actions</Text>
    <View style={{ flexDirection: width < 350 || fontScale > 1.3 ? "column" : "row", gap: 12 }}>
      <QuickAction title="My Patrols" detail="View assigned patrols" icon="map-outline" onPress={() => navigation.navigate("Patrol")} />
      <QuickAction title="Report Incident" detail="Report a field incident" icon="flag-outline" onPress={() => navigation.navigate("Incident")} />
    </View>
  </Screen>;
}
