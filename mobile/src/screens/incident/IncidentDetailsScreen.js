import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, View } from "react-native";
import { Text } from "../../components/common/Typography";
import Screen from "../../components/common/Screen";
import { useAuth } from "../../hooks/useAuth";
import useIncidentResource from "../../hooks/useIncidentResource";
import { getIncident, withdrawIncident } from "../../services/incidentApi";
import {
  canChangeIncident,
  incidentError,
  readableTime,
  typeTitle,
} from "../../utils/incident";
import {
  Badge,
  Field,
  Heading,
  IncidentButton,
  State,
  palette,
  ui,
} from "../../components/incident/IncidentUI";

export default function IncidentDetailsScreen({ route, navigation }) {
  const { user } = useAuth(),
    id = route.params?.incidentId;
  const loader = useCallback((signal) => getIncident(id, signal), [id]);
  const state = useIncidentResource(loader),
    incident = state.data;
  const [confirming, setConfirming] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [withdrawn, setWithdrawn] = useState(null);
  const pending = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setWithdrawn(null);
    setConfirming(false);
  }, [incident]);
  const shown = withdrawn || incident;
  const editable =
    !state.loading && !state.error && canChangeIncident(shown, user?.id);
  async function withdraw() {
    if (pending.current || !editable) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await withdrawIncident(id);
      if (mounted.current) {
        setWithdrawn(result);
        setConfirming(false);
        state.refresh();
      }
    } catch (failure) {
      if (mounted.current) {
        setError(incidentError(failure));
        setConfirming(false);
        if ([403, 404, 409].includes(failure.response?.status)) state.refresh();
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <Screen
      backgroundColor={palette.background}
      refreshControl={
        <RefreshControl
          refreshing={state.loading}
          onRefresh={state.refresh}
          tintColor={palette.forest}
        />
      }
    >
      <Heading title="Incident Details" />
      {route.params?.confirmation && (
        <View style={ui.card}>
          <Text accessibilityLiveRegion="polite" style={ui.title}>
            {route.params.confirmation === "created"
              ? "Incident submitted"
              : "Changes saved"}
          </Text>
          <Text selectable style={ui.muted}>
            Reference: {id}
          </Text>
        </View>
      )}
      <State {...state} retry={state.refresh} />
      {error && (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      )}
      {shown && !state.error && (
        <>
          <View style={ui.card}>
            <Text style={ui.eyebrow}>{typeTitle(shown.incidentType)}</Text>
            <Text style={ui.heading}>{shown.title || "Untitled report"}</Text>
            <Badge incident={shown} />
            <Field label="Description" value={shown.description} />
            <Field label="Occurred" value={readableTime(shown.occurredAt)} />
            <Field label="Latitude" value={shown.latitude} />
            <Field label="Longitude" value={shown.longitude} />
            {shown.manualLocation && (
              <Field
                label="Location description"
                value={shown.manualLocation}
              />
            )}
          </View>
          <View style={ui.card}>
            <Field label="Patrol" value={shown.patrol?.routeName} />
            <Field label="Patrol status" value={shown.patrol?.status} />
            <Field label="Park" value={shown.park?.name} />
            <Field label="Reporting Ranger" value={shown.reporter?.name} />
            <Field label="Created" value={readableTime(shown.createdAt)} />
            <Field label="Updated" value={readableTime(shown.updatedAt)} />
            {shown.withdrawnAt && (
              <Field
                label="Withdrawn"
                value={readableTime(shown.withdrawnAt)}
              />
            )}
          </View>
          <View style={ui.card}>
            <Text style={ui.section}>
              Evidence · {shown.evidenceCount || 0}
            </Text>
            {!shown.evidence?.length && (
              <Text style={ui.muted}>
                No evidence attached. Secure uploads are not available yet.
              </Text>
            )}
            {shown.evidence?.map((item) => (
              <View key={item.id} style={ui.card}>
                <Field label="Media type" value={item.fileType} />
                {item.caption && <Field label="Caption" value={item.caption} />}
                {Object.entries(item.metadata || {}).map(([key, value]) => (
                  <Field key={key} label={key} value={String(value)} />
                ))}
                <Field label="Added" value={readableTime(item.createdAt)} />
              </View>
            ))}
          </View>
          {editable ? (
            <>
              <IncidentButton
                title="Edit Incident"
                disabled={busy}
                onPress={() =>
                  navigation.navigate("IncidentEdit", { incidentId: shown.id })
                }
              />
              {confirming ? (
                <View style={ui.card}>
                  <Text style={ui.section}>Withdraw this incident?</Text>
                  <Text style={ui.body}>
                    This report will be removed from your active incident list
                    but retained in the system's records.
                  </Text>
                  <IncidentButton
                    title="Keep Report"
                    secondary
                    disabled={busy}
                    onPress={() => setConfirming(false)}
                  />
                  <IncidentButton
                    title="Withdraw Incident"
                    color={palette.danger}
                    loading={busy}
                    onPress={withdraw}
                  />
                </View>
              ) : (
                <IncidentButton
                  title="Withdraw Incident"
                  color={palette.danger}
                  secondary
                  onPress={() => setConfirming(true)}
                />
              )}
            </>
          ) : (
            !state.loading && (
              <View style={ui.card}>
                <Text style={ui.title}>Read-only report</Text>
                <Text style={ui.muted}>
                  Reports can be changed only by the assigned reporting Ranger
                  while the patrol is in progress and the report is pending.
                  Withdrawn and reviewed reports remain in history.
                </Text>
              </View>
            )
          )}
          {shown.patrolId && (
            <IncidentButton
              title="My Incident Reports"
              secondary
              onPress={() =>
                navigation.navigate("IncidentReports", {
                  patrolId: shown.patrolId,
                })
              }
            />
          )}
          {editable && (
            <IncidentButton
              title="Report Another Incident"
              secondary
              onPress={() =>
                navigation.navigate("IncidentCreate", {
                  patrolId: shown.patrolId,
                })
              }
            />
          )}
        </>
      )}
    </Screen>
  );
}
