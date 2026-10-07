import React, { useEffect, useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { Text } from "../../components/common/Typography";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import PatrolCard from "../../components/PatrolCard";
import PatrolLoadState from "../../components/PatrolLoadState";
import useRangerPatrols from "../../hooks/useRangerPatrols";
import usePatrolClock from "../../hooks/usePatrolClock";
import {
  matchesFilter,
  patrolFilters,
  classifyPatrol,
} from "../../utils/rangerPatrol";
import { styles, colors } from "../../constants/theme";
import { rangerStyles as ui } from "../../constants/rangerTheme";
const emptyStates = {
  ALL: "No patrols assigned.",
  TODAY: "No patrol scheduled for today.",
  UPCOMING: "No upcoming patrols.",
  IN_PROGRESS: "No patrol currently in progress.",
  OVERDUE: "No overdue patrols.",
  COMPLETED: "No completed patrols yet.",
};
export default function MyPatrolScreen({ route, navigation }) {
  const state = useRangerPatrols();
  const now = usePatrolClock();
  const [filter, setFilter] = useState("ALL");
  useEffect(() => {
    if (patrolFilters[route.params?.filter]) setFilter(route.params.filter);
  }, [route.params]);
  const patrols = state.patrols.filter((p) => matchesFilter(p, filter, now));
  return (
    <Screen>
      <Text style={styles.eyebrow}>FIELD ASSIGNMENTS</Text>
      <Text style={styles.muted}>
        Your assigned patrols, organized by status.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 7 }}
        style={{ flexGrow: 0 }}
      >
        {Object.entries(patrolFilters).map(([key, label]) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: filter === key }}
            onPress={() => setFilter(key)}
            style={{
              minHeight: 44,
              paddingHorizontal: 13,
              justifyContent: "center",
              borderRadius: 10,
              backgroundColor: filter === key ? colors.green : colors.cream,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                lineHeight: 18,
                paddingVertical: 8,
                fontWeight: "600",
                color: filter === key ? colors.white : colors.green,
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <PatrolLoadState {...state} />
      {!state.loading && !state.error && (
        <>
          {patrols.map((patrol) => (
            <PatrolCard key={patrol.id} patrol={patrol} now={now}>
              <Button
                title={classifyPatrol(patrol, now).action}
                onPress={() =>
                  navigation.navigate("PatrolDetails", { patrolId: patrol.id })
                }
              />
            </PatrolCard>
          ))}
          {!patrols.length && (
            <View style={ui.card}>
              <Text style={styles.text}>{emptyStates[filter]}</Text>
            </View>
          )}
          <Button title="Refresh patrols" secondary onPress={state.refresh} />
        </>
      )}
    </Screen>
  );
}
