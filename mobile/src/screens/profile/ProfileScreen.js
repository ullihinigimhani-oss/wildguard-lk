import React from "react";
import { Text, View } from "react-native";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import { useDemoAuth } from "../../hooks/useDemoAuth";
import { styles } from "../../constants/theme";
export default function ProfileScreen() {
  const { user, leaveDemo } = useDemoAuth();
  return (
    <Screen>
      <Text style={styles.eyebrow}>DEMO RANGER PROFILE</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {user.name}
      </Text>
      <View style={styles.card}>
        {Object.entries({
          Name: user.name,
          "Ranger ID": user.id,
          Email: user.email,
          "Assigned park": user.park,
          Role: user.role,
        }).map(([label, value]) => (
          <View key={label} style={{ paddingVertical: 8, gap: 5 }}>
            <Text style={styles.muted}>{label}</Text>
            <Text style={styles.text}>{value}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.muted}>
        Sample profile only. Editing and account access will be added later.
      </Text>
      <Button title="Exit demo" secondary onPress={leaveDemo} />
    </Screen>
  );
}
