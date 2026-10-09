import React from "react";
import { StyleSheet, View } from "react-native";
// Native overlay bands provide a dark photo gradient without extra dependencies.
export default function PhotoOverlay() {
  return <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
    {Array.from({ length: 40 }, (_, i) => <View key={i} style={{ flex: 1, backgroundColor: `rgba(8,30,22,${0.18 + 0.76 * (i / 39) ** 1.3})` }} />)}
  </View>;
}
