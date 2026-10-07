import React, { useEffect, useState } from "react";
import { Text, View, Pressable } from "react-native";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import PatrolCard from "../../components/PatrolCard";
import PatrolLoadState from "../../components/PatrolLoadState";
import useRangerPatrols from "../../hooks/useRangerPatrols";
import { patrolStatuses } from "../../utils/rangerPatrol";
import { styles, colors } from "../../constants/theme";
export default function MyPatrolScreen({ route }) {
  const state = useRangerPatrols();
  const [status, setStatus] = useState("SCHEDULED");
  useEffect(() => { if (patrolStatuses[route.params?.status]) setStatus(route.params.status); }, [route.params]);
  const patrols = state.patrols.filter(p => p.status === status).sort((a, b) => Number(b.id === route.params?.selectedPatrolId) - Number(a.id === route.params?.selectedPatrolId));
  return <Screen>
    <Text style={styles.eyebrow}>RANGER OPERATIONS</Text><Text accessibilityRole="header" style={styles.title}>My Patrol</Text>
    <Text style={styles.muted}>Your assigned field patrols.</Text>
    <View style={{ flexDirection: "row", gap: 6 }}>
      {Object.entries(patrolStatuses).map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: status === key }} onPress={() => setStatus(key)} style={{ flex: 1, minHeight: 48, justifyContent: "center", borderRadius: 10, backgroundColor: status === key ? colors.green : colors.cream }}>
        <Text style={{ fontSize: 12, textAlign: "center", color: status === key ? colors.white : colors.green }}>{label}</Text>
      </Pressable>)}
    </View><PatrolLoadState {...state} />
    {!state.loading && !state.error && <>
      {patrols.map(patrol => <PatrolCard key={patrol.id} patrol={patrol} />)}
      {!patrols.length && <View style={styles.card}><Text style={styles.text}>No {patrolStatuses[status].toLowerCase()} patrols assigned.</Text></View>}
      <Button title="Refresh patrols" secondary onPress={state.refresh} />
    </>}
  </Screen>;
}
