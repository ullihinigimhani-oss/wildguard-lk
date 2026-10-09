import React, { useCallback, useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { Text } from "../../components/common/Typography";
import Screen from "../../components/common/Screen";
import useIncidentResource from "../../hooks/useIncidentResource";
import { listPatrolIncidents } from "../../services/incidentApi";
import { readableTime, typeTitle } from "../../utils/incident";
import {
  Badge,
  Heading,
  IncidentButton,
  State,
  palette,
  ui,
} from "../../components/incident/IncidentUI";

export default function MyIncidentReportsScreen({ route, navigation }) {
  const patrolId = route.params?.patrolId;
  const [page, setPage] = useState(1),
    [history, setHistory] = useState(false);
  const loader = useCallback(
    (signal) =>
      listPatrolIncidents(patrolId, {
        page,
        includeWithdrawn: history,
        signal,
      }),
    [patrolId, page, history],
  );
  const state = useIncidentResource(loader);
  const records = (state.data?.incidents || []).filter(
    (i) => history || (!i.withdrawnAt && !i.withdrawn),
  );
  function refresh() {
    if (page !== 1) setPage(1);
    else state.refresh();
  }
  return (
    <Screen
      backgroundColor={palette.background}
      refreshControl={
        <RefreshControl
          refreshing={state.loading}
          onRefresh={refresh}
          tintColor={palette.forest}
        />
      }
    >
      <Heading
        title="My Incident Reports"
        description="Field reports for the selected patrol, newest first."
      />
      <IncidentButton
        title={history ? "Show active reports" : "Include withdrawn history"}
        secondary
        onPress={() => {
          setHistory((v) => !v);
          setPage(1);
        }}
      />
      {history && (
        <Text style={ui.muted}>
          History includes withdrawn reports retained in the system.
        </Text>
      )}
      <State {...state} retry={state.refresh} />
      {!state.loading && !state.error && (
        <>
          {!records.length && (
            <View style={ui.card}>
              <Text style={ui.section}>No incident reports</Text>
              <Text style={ui.body}>
                No reports are available for this patrol and filter.
              </Text>
            </View>
          )}
          {records.map((i) => (
            <Pressable
              key={i.id}
              accessibilityRole="button"
              accessibilityLabel={`Open report: ${i.title || typeTitle(i.incidentType)}`}
              onPress={() =>
                navigation.navigate("IncidentDetails", { incidentId: i.id })
              }
              style={({ pressed }) => [ui.card, pressed && { opacity: 0.8 }]}
            >
              <Text style={ui.eyebrow}>{typeTitle(i.incidentType)}</Text>
              <Text style={ui.title}>{i.title || "Untitled report"}</Text>
              <Badge incident={i} />
              <Text style={ui.muted}>{readableTime(i.occurredAt)}</Text>
              <Text style={ui.body}>
                {i.patrol?.routeName || "Patrol not recorded"}
              </Text>
              <Text style={ui.muted}>
                {i.latitude != null && i.longitude != null
                  ? "GPS location recorded"
                  : "Location not recorded"}{" "}
                · {i.evidenceCount || 0} evidence items
              </Text>
              <Text style={ui.muted}>View report →</Text>
            </Pressable>
          ))}
          <Text style={ui.muted}>
            {state.data?.total || 0} reports · Page {page}
          </Text>
          {page > 1 && (
            <IncidentButton
              title="Previous page"
              secondary
              onPress={() => setPage((v) => v - 1)}
            />
          )}
          {state.data && page * state.data.pageSize < state.data.total && (
            <IncidentButton
              title="Next page"
              secondary
              onPress={() => setPage((v) => v + 1)}
            />
          )}
        </>
      )}
    </Screen>
  );
}
