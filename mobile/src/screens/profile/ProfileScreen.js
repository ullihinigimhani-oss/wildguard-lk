import React from "react";
import { Text, View } from "react-native";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import { useAuth } from "../../hooks/useAuth";
import { styles } from "../../constants/theme";
export default function ProfileScreen() {
  const { user, logout, isDemo } = useAuth();
  return (
    <Screen>
      <Text style={styles.eyebrow}>{isDemo ? "DEMO RANGER PROFILE" : "WILDGUARD LK / ACCOUNT"}</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {user.name}
      </Text>
      <View style={styles.card}>
        {Object.entries({
          Name: user.name,
          "Account ID": user.id,
          Email: user.email,
          ...(isDemo ? { "Assigned park": user.park } : {}),
          Role: user.role,
        }).map(([label, value]) => (
          <View key={label} style={{ paddingVertical: 8, gap: 5 }}>
            <Text style={styles.muted}>{label}</Text>
            <Text style={styles.text}>{value}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.muted}>
        {isDemo ? "Sample profile only. Editing and account access will be added later." : user.role === "RANGER" ? "Your authenticated account details." : `You are signed in as ${user.role.replaceAll("_", " ")}. Your role's mobile dashboard is not implemented yet.`}
      </Text>
      <Button title={isDemo ? "Exit demo" : "Logout"} secondary onPress={logout} />
    </Screen>
  );
}
