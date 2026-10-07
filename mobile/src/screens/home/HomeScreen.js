import React from "react";
import { Text, View } from "react-native";
import Screen from "../../components/common/Screen";
import Avatar from "../../components/common/Avatar";
import Button from "../../components/common/Button";
import PatrolCard from "../../components/PatrolCard";
import PatrolLoadState from "../../components/PatrolLoadState";
import { useAuth } from "../../hooks/useAuth";
import useRangerPatrols from "../../hooks/useRangerPatrols";
import { todayPatrol, patrolAction } from "../../utils/rangerPatrol";
import { styles } from "../../constants/theme";
export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const state = useRangerPatrols();
  const patrol = todayPatrol(state.patrols);
  return <Screen>
    <Text style={styles.eyebrow}>WILDGUARD LK</Text>
    <View style={styles.row}><Avatar user={user} /><View style={{ flex: 1 }}>
      <Text style={styles.heading}>{user.name}</Text><Text style={styles.muted}>Park Ranger</Text>
      <Text style={styles.muted}>{user.park?.name || "Not assigned"}</Text>
    </View></View>
    <View><Text accessibilityRole="header" style={styles.title}>Hello, {user.name.trim().split(/\s+/)[0]}.</Text>
      <Text style={styles.muted}>Ready for today's field patrol?</Text></View>
    <Text style={styles.heading}>Today's patrol</Text><PatrolLoadState {...state} />
    {!state.loading && !state.error && (patrol ? <PatrolCard patrol={patrol}>
      <Button title={patrolAction[patrol.status]} onPress={() => navigation.navigate("Patrol", { selectedPatrolId: patrol.id, status: patrol.status })} />
    </PatrolCard> : <View style={styles.card}><Text style={styles.text}>No patrol assigned for today.</Text></View>)}
    <Text style={styles.heading}>Quick actions</Text>
    <Button title="My Patrol" secondary onPress={() => navigation.navigate("Patrol")} />
    <Button title="Report Incident" secondary onPress={() => navigation.navigate("Incident")} />
  </Screen>;
}
