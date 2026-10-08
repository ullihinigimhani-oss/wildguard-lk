import React, { useRef, useEffect, useState } from "react";
import { View, Pressable, ScrollView, FlatList } from "react-native";
import { Text } from "../../components/common/Typography";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import PatrolListCard from "../../components/patrol/PatrolListCard";
import PatrolLoadState from "../../components/PatrolLoadState";
import useRangerPatrols from "../../hooks/useRangerPatrols";
import usePatrolClock from "../../hooks/usePatrolClock";
import { EmptyState } from "../../components/common/FieldUI";
import {
  matchesFilter,
  patrolFilters,
} from "../../utils/rangerPatrol";
import { colors } from "../../constants/rangerTheme";
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
  const cache = useRef(new Map()).current;
  const [visibleIds, setVisibleIds] = useState([]);
  const [focused, setFocused] = useState(true);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 10, minimumViewTime: 150 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    setVisibleIds(viewableItems.filter((item) => item.isViewable).map((item) => item.item.id));
  }).current;
  useEffect(() => {
    const blur = navigation.addListener?.("blur", () => setFocused(false));
    const focus = navigation.addListener?.("focus", () => setFocused(true));
    return () => { blur?.(); focus?.(); };
  }, [navigation]);
  useEffect(() => {
    if (patrolFilters[route.params?.filter]) setFilter(route.params.filter);
  }, [route.params]);
  const patrols = state.patrols.filter((p) => matchesFilter(p, filter, now));
  return (
    <Screen scroll={false}>
      <FlatList
        testID="patrol-list"
        data={!state.loading && !state.error ? patrols : []}
        keyExtractor={(patrol) => patrol.id}
        extraData={{ visibleIds, focused, now }}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        contentContainerStyle={{ padding: 20, gap: 20 }}
        renderItem={({ item: patrol }) => <PatrolListCard patrol={patrol} now={now} navigation={navigation} previewOpen={focused && visibleIds.includes(patrol.id)} previewCache={cache} />}
        ListHeaderComponent={<View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <Text accessibilityRole="header" style={{ fontSize: 23, lineHeight: 30, fontWeight: "700", color: colors.green }}>My Patrol</Text>
        <Text style={{ fontSize: 12, lineHeight: 19, color: colors.muted }}>Your assigned patrols, organized by status.</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 7, alignItems: "center" }}
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
              justifyContent: "center",
            }}
          >
            <View style={{ paddingHorizontal: 13, paddingVertical: 6, borderRadius: 18, backgroundColor: filter === key ? colors.green : colors.cream }}><Text
              style={{
                fontSize: 12,
                lineHeight: 18,
                fontWeight: "600",
                color: filter === key ? colors.white : colors.green,
              }}
            >
              {label}
            </Text></View>
          </Pressable>
        ))}
      </ScrollView>
      <PatrolLoadState {...state} />
      </View>}
        ListEmptyComponent={!state.loading && !state.error ? <EmptyState message={emptyStates[filter]} detail="Your assignments will appear here when they are available." /> : null}
        ListFooterComponent={!state.loading && !state.error ? <Button title="Refresh patrols" secondary onPress={state.refresh} /> : null}
      />
    </Screen>
  );
}
