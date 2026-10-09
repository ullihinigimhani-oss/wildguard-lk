import React from "react";
import { View, Pressable } from "react-native";
import { Text } from "../components/common/Typography";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "../constants/theme";
import { RangerLayoutContext } from "../components/common/Screen";
import { RangerVisualContext, fieldColors as c } from "../constants/fieldTheme";
const tabs = [
  ["Home", "Dashboard", "grid-outline", "grid"],
  ["Patrol", "My Patrol", "map-outline", "map"],
  ["Incident", "Report Incident", "flag-outline", "flag"],
  ["Profile", "Profile", "person-outline", "person"],
];
export default function RangerShell({ navigation, route, children }) {
  const tabColors = {
        ...colors,
        background: c.background,
        green: c.forest,
        cream: c.sage,
        border: c.border,
      };
  return (
    <RangerVisualContext.Provider value={true}>
    <RangerLayoutContext.Provider value={true}>
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: tabColors.background }}
      >
        <View style={{ flex: 1 }}>{children}</View>
        <SafeAreaView
          edges={["bottom", "left", "right"]}
          style={{
            backgroundColor: colors.white,
            borderTopWidth: 1,
            borderTopColor: tabColors.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              paddingHorizontal: 12,
              paddingTop: 10,
              paddingBottom: 6,
              gap: 6,
            }}
          >
            {tabs.map(([name, label, icon, activeIcon]) => {
              const active = route.name === name;
              return (
                <Pressable
                  key={name}
                  accessibilityRole="tab"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: active }}
                  onPress={() => navigation.navigate(name)}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 56,
                    paddingVertical: 5,
                    paddingHorizontal: 2,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    opacity: pressed ? 0.65 : 1,
                    backgroundColor: active ? tabColors.cream : colors.white,
                  })}
                >
                  <Ionicons
                    accessible={false}
                    name={active ? activeIcon : icon}
                    size={22}
                    color={active ? tabColors.green : c.muted}
                  />
                  <Text
                    style={{
                      fontSize: 10,
                      lineHeight: 14,
                      fontWeight: active ? "700" : "500",
                      textAlign: "center",
                      color: active ? tabColors.green : c.muted,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      </SafeAreaView>
    </RangerLayoutContext.Provider>
    </RangerVisualContext.Provider>
  );
}
