import React from "react";
import { StyleSheet, Text, View } from "react-native";
export default function ApprovalStatus({ notice }) {
  if (!notice) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={status.panel}
    >
      <Text accessibilityRole="header" style={status.title}>
        {notice.title}
      </Text>
      <Text style={status.message}>{notice.message}</Text>
    </View>
  );
}
const status = StyleSheet.create({
  panel: {
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#c4d4bd",
    backgroundColor: "#edf2e6",
    gap: 8,
  },
  title: { fontSize: 17, fontWeight: "700", color: "#244c37", lineHeight: 23 },
  message: { fontSize: 14, color: "#465c4d", lineHeight: 22 },
});
