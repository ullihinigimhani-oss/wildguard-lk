import React, { useContext } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { styles } from "../../constants/theme";
export const RangerLayoutContext = React.createContext(false);
export default function Screen({ children }) {
  const rangerLayout = useContext(RangerLayoutContext);
  return (
    <SafeAreaView style={styles.screen} edges={rangerLayout ? ["left", "right"] : ["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, rangerLayout && { padding: 20, gap: 16 }]}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
