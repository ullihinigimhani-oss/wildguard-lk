import React from "react";
import { Text, View } from "react-native";
import Screen from "../../components/common/Screen";
import { styles } from "../../constants/theme";
export default function RangerIncidentScreen() {
  return <Screen><Text style={styles.eyebrow}>RANGER OPERATIONS</Text>
    <Text accessibilityRole="header" style={styles.title}>Report Incident</Text>
    <View style={styles.card}><Text style={styles.heading}>Field incident reporting</Text>
      <Text style={styles.muted}>Incident reporting is not enabled in this release.</Text></View>
  </Screen>;
}
