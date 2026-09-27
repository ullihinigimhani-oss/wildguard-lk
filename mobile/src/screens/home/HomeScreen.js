import React from "react";
import { Pressable, Text, View } from "react-native";
import Screen from "../../components/common/Screen";
import { colors, styles } from "../../constants/theme";
import { fieldActions } from "../../constants/demo";
import { useDemoAuth } from "../../hooks/useDemoAuth";
import useApiHealth from "../../hooks/useApiHealth";
export default function HomeScreen({ navigation }) {
  const { user } = useDemoAuth();
  const health = useApiHealth();
  return (
    <Screen>
      <Text style={styles.eyebrow}>YOUR FIELD WORKSPACE</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Hello, {user.name.split(" ")[0]}.
      </Text>
      <Text style={styles.muted}>A clear view of the day ahead.</Text>
      <View style={{ ...styles.card, backgroundColor: colors.dark }}>
        <Text style={{ color: "#d4e2bb", fontSize: 12 }}>
          ASSIGNED PARK · DEMO
        </Text>
        <Text style={{ color: "white", fontSize: 22, fontWeight: "700" }}>
          {user.park}
        </Text>
        <Text style={{ color: "#e3ecda", lineHeight: 23 }}>
          Patrol status: Awaiting assignment (sample)
        </Text>
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: "#e3ecda", fontSize: 13 }}
        >
          Live backend: {health}
        </Text>
      </View>
      <View style={styles.notice}>
        <Text style={styles.muted}>
          Demo workspace · Patrol and sync states are simulated. No tracking or
          reports are recorded.
        </Text>
      </View>
      <Text style={styles.heading}>Field essentials</Text>
      {fieldActions.map((action) => (
        <Pressable
          key={action.title}
          accessibilityRole="button"
          accessibilityLabel={action.title}
          onPress={() => navigation.navigate(action.screen)}
          style={({ pressed }) => [
            styles.card,
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
              opacity: pressed ? 0.65 : 1,
            },
          ]}
        >
          <Text
            style={{ fontSize: 28, color: colors.green }}
            accessible={false}
          >
            {action.symbol}
          </Text>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ ...styles.text, fontWeight: "700" }}>
              {action.title}
            </Text>
            <Text style={styles.muted}>{action.detail}</Text>
          </View>
          <Text accessible={false} style={styles.text}>
            ›
          </Text>
        </Pressable>
      ))}
    </Screen>
  );
}
