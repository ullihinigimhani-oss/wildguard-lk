import React, { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import PatrolCard from "../../components/PatrolCard";
import PatrolLoadState from "../../components/PatrolLoadState";
import { getMyPatrol, startMyPatrol, completeMyPatrol } from "../../services/patrolApi";
import { actualPatrolTime, classifyPatrol } from "../../utils/rangerPatrol";
import usePatrolClock from "../../hooks/usePatrolClock";
import { useAuth } from "../../hooks/useAuth";
import { styles } from "../../constants/theme";
import { rangerStyles as ui } from "../../constants/rangerTheme";
function Field({ label, value }) {
  return <View style={{ gap: 4 }}><Text style={styles.muted}>{label}</Text><Text style={styles.text}>{value || "Not specified"}</Text></View>;
}
export default function PatrolDetailsScreen({ route, navigation }) {
  const { user } = useAuth();
  const id = route.params?.patrolId;
  const now = usePatrolClock();
  const [state, setState] = useState({ patrol: null, loading: true, error: null });
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const busyRef = useRef(false);
  const generation = useRef(0);
  const refresh = () => setRevision(value => value + 1);
  useFocusEffect(useCallback(() => {
    const attempt = ++generation.current;
    const controller = new AbortController();
    setState({ patrol: null, loading: true, error: null });
    setBusy(false); busyRef.current = false; setConfirming(false); setActionError(null);
    if (!id) setState({ patrol: null, loading: false, error: "This patrol is not available." });
    else getMyPatrol(id, controller.signal).then(patrol => {
      if (attempt === generation.current) setState({ patrol, loading: false, error: null });
    }).catch(error => {
      if (attempt === generation.current) setState({ patrol: null, loading: false, error: error.response?.status === 404 ? "This patrol is not available." : "Unable to load this patrol. Please try again." });
    });
    return () => { generation.current += 1; controller.abort(); };
  }, [id, user.id, revision]));
  async function update(action) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setActionError(null);
    const attempt = generation.current;
    try {
      const patrol = await (action === "start" ? startMyPatrol(id) : completeMyPatrol(id));
      if (attempt === generation.current) { setState({ patrol, loading: false, error: null }); setConfirming(false); }
    } catch (error) {
      if (attempt === generation.current) {
        if (error.response?.status === 404) setState({ patrol: null, loading: false, error: "This patrol is not available." });
        else setActionError(error.response?.status === 409 ? "This patrol's state or schedule has changed. Refresh it before trying again." : "Unable to update the patrol. Check your connection and try again.");
      }
    } finally {
      if (attempt === generation.current) { busyRef.current = false; setBusy(false); }
    }
  }
  const patrol = state.patrol;
  const display = patrol ? classifyPatrol(patrol, now) : null;
  return <Screen>
    <PatrolLoadState {...state} refresh={refresh} />
    {patrol && <>
      <PatrolCard patrol={patrol} now={now} showCompletion={false} />
      <View style={ui.card}>
        <Field label="Assigned Ranger" value={patrol.ranger?.name || user.name} />
        <Field label="Starting Point" value={patrol.startLocation} />
        <Field label="Instructions / Notes" value={patrol.description} />
        {(patrol.actualStartTime || display.active || display.completed) && <Field label="Actual Start" value={actualPatrolTime(patrol.actualStartTime)} />}
        {(patrol.actualEndTime || display.completed) && <Field label="Actual Completion" value={actualPatrolTime(patrol.actualEndTime)} />}
        {display.completed && <Field label="Completion Performance" value={display.completionText || "Completion timing cannot be determined from the recorded times."} />}
      </View>
      {actionError && <Text accessibilityRole="alert" style={styles.error}>{actionError}</Text>}
      {display.action === "Start Patrol" && <Button title="Start Patrol" onPress={() => update("start")} loading={busy} />}
      {display.active && (confirming ? <View style={ui.card}>
        <Text style={ui.section}>Complete this patrol?</Text><Text style={styles.muted}>Your completion time will be recorded and this patrol will move to Completed.</Text>
        <Button title="Confirm Completion" onPress={() => update("complete")} loading={busy} />
        <Button title="Keep patrolling" secondary disabled={busy} onPress={() => setConfirming(false)} />
      </View> : <Button title="Complete Patrol" onPress={() => setConfirming(true)} />)}
      {display.upcoming && <Text style={styles.muted}>You can start this patrol on its scheduled day.</Text>}
      {display.completed && <Button title="View completed patrols" secondary onPress={() => navigation.navigate("Patrol", { filter: "COMPLETED" })} />}
      <Button title="Refresh patrol" secondary disabled={busy} onPress={refresh} />
    </>}
  </Screen>;
}
