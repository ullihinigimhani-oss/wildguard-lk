import OfflineStatus from "./OfflineStatus";
import React, { useContext } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { styles } from "../../constants/theme";
import { RangerVisualContext, fieldColors } from "../../constants/fieldTheme";
export const RangerLayoutContext = React.createContext(false);
export default function Screen({
  children,
  backgroundColor,
  contentStyle,
  refreshControl,
  scroll = true,
}) {
  const rangerLayout = useContext(RangerLayoutContext);
  const rangerVisual = useContext(RangerVisualContext);
  return (
    <SafeAreaView
      style={[styles.screen, rangerVisual && { backgroundColor: fieldColors.background }, backgroundColor && { backgroundColor }]}
      edges={rangerLayout ? ["left", "right"] : ["left", "right", "bottom"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <OfflineStatus />
        {scroll ? <ScrollView
          refreshControl={refreshControl}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            rangerLayout && { padding: 20, gap: 16 },
            rangerVisual && { padding: 20, gap: 20 },
            contentStyle,
          ]}
        >
          {children}
        </ScrollView> : children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
