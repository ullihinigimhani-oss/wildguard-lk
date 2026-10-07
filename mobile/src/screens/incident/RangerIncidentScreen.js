import React from "react";
import { Text, View } from "react-native";
import Screen from "../../components/common/Screen";
import { styles } from "../../constants/theme";
import { rangerStyles as ui } from "../../constants/rangerTheme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "../../constants/theme";
export default function RangerIncidentScreen() {
  return <Screen><Text style={styles.eyebrow}>FIELD REPORTING</Text>
    <View style={ui.card}><Ionicons accessible={false} name="flag-outline" size={28} color={colors.green} /><Text accessibilityRole="header" style={ui.section}>Field incident reporting</Text>
      <Text style={styles.muted}>Incident reporting is not enabled in this release.</Text></View>
  </Screen>;
}
