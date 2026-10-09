import LocalDrafts from "../../components/incident/LocalDrafts";
import React, { useState } from "react";
import { RefreshControl, View } from "react-native";
import { Text } from "../../components/common/Typography";
import Screen from "../../components/common/Screen";
import useRangerPatrols from "../../hooks/useRangerPatrols";
import {
  Heading,
  IncidentButton,
  SelectCard,
  State,
  palette,
  ui,
} from "../../components/incident/IncidentUI";

export default function RangerIncidentScreen({ navigation }) {
  const state = useRangerPatrols();
  const [selected, setSelected] = useState(null);
  const active = state.patrols.filter((p) => p.status === "IN_PROGRESS");
  const patrol = active.find((p) => p.id === selected) || active[0];
  const history = state.patrols.filter((p) =>
    ["COMPLETED", "CANCELLED"].includes(p.status),
  );
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
      <Heading
        title="Field Incident Reporting"
        description="Record wildlife and conservation incidents during your active patrol."
      />
      <LocalDrafts navigation={navigation} />
      <State {...state} retry={state.refresh} />
      {!state.loading && !state.error && (
        <>
          {patrol ? (
            <>
              <Text style={ui.eyebrow}>ACTIVE PATROL</Text>
              {active.length > 1 &&
                active.map((p) => (
                  <SelectCard
                    key={p.id}
                    title={p.routeName}
                    description={p.park?.name || "Assigned park"}
                    icon="map-outline"
                    selected={patrol.id === p.id}
                    onPress={() => setSelected(p.id)}
                  />
                ))}
              <View
                style={[
                  ui.card,
                  {
                    backgroundColor: palette.forest,
                    borderColor: palette.forest,
                  },
                ]}
              >
                <Text style={[ui.heading, { color: palette.white }]}>
                  {patrol.routeName}
                </Text>
                <Text style={[ui.body, { color: palette.sage }]}>
                  {patrol.park?.name || "Assigned park"}
                </Text>
                <Text style={[ui.muted, { color: palette.sage }]}>
                  IN PROGRESS
                </Text>
                <IncidentButton
                  title="Report New Incident"
                  secondary
                  onPress={() =>
                    navigation.navigate("IncidentCreate", {
                      patrolId: patrol.id,
                    })
                  }
                />
                <IncidentButton
                  title="My Incident Reports"
                  secondary
                  onPress={() =>
                    navigation.navigate("IncidentReports", {
                      patrolId: patrol.id,
                    })
                  }
                />
              </View>
            </>
          ) : (
            <View style={ui.card}>
              <Text style={ui.section}>No active patrol</Text>
              <Text style={ui.body}>
                Start an assigned patrol before reporting a field incident.
              </Text>
              <IncidentButton
                title="Go to My Patrols"
                onPress={() => navigation.navigate("Patrol")}
              />
            </View>
          )}
          {history.length > 0 && (
            <>
              <Text style={ui.section}>Patrol report history</Text>
              <Text style={ui.muted}>
                Completed and cancelled patrol reports remain available to read.
              </Text>
              {history.map((p) => (
                <View key={p.id} style={ui.card}>
                  <Text style={ui.title}>{p.routeName}</Text>
                  <Text style={ui.muted}>
                    {p.park?.name} · {p.status}
                  </Text>
                  <IncidentButton
                    title={`View reports: ${p.routeName}`}
                    secondary
                    onPress={() =>
                      navigation.navigate("IncidentReports", { patrolId: p.id })
                    }
                  />
                </View>
              ))}
            </>
          )}
        </>
      )}
    </Screen>
  );
}
