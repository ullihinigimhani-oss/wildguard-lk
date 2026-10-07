import React from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../constants/theme";
const tabs = [["Home", "Dashboard", "⌂"], ["Patrol", "My Patrol", "◇"], ["Incident", "Report Incident", "⚑"], ["Profile", "Profile", "♙"]];
export default function RangerShell({ navigation, route, children }) {
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={{ flex: 1 }}>{children}</View>
    <SafeAreaView edges={["bottom", "left", "right"]} style={{ backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border }}>
      <View style={{ flexDirection: "row" }}>
        {tabs.map(([name, label, icon]) => <Pressable key={name} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: route.name === name }} onPress={() => navigation.navigate(name)} style={{ flex: 1, minHeight: 62, paddingVertical: 8, alignItems: "center", justifyContent: "center", gap: 3, backgroundColor: route.name === name ? colors.cream : colors.white }}>
          {name === "Profile" ? <View accessible={false} style={{ height: 28, alignItems: "center", justifyContent: "center", gap: 2 }}><View style={{ width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: colors.green }} /><View style={{ width: 18, height: 10, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderWidth: 1.5, borderColor: colors.green }} /></View> : <Text accessible={false} style={{ fontSize: 23, color: colors.green }}>{icon}</Text>}
          <Text style={{ fontSize: 11, fontWeight: "600", textAlign: "center", color: colors.green }}>{label}</Text>
        </Pressable>)}
      </View>
    </SafeAreaView>
  </View>;
}
