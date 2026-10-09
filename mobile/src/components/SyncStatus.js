import React from "react";
import { View } from "react-native";
import { Text } from "./common/Typography";
import { styles } from "../constants/theme";
export default function SyncStatus({ state }) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>SIMULATED SYNC STATUS</Text>
      <Text accessibilityLiveRegion="polite" style={styles.heading}>
        {state}
      </Text>
      <Text style={styles.muted}>
        Pending Sync:{" "}
        {state === "Pending Sync" ? "3 sample items" : "0 sample items"}
      </Text>
      <Text style={styles.muted}>
        Last Synced: Not synced in this prototype
      </Text>
    </View>
  );
}
