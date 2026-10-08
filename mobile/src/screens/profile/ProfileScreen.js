import React from "react";
import { View } from "react-native";
import { Text } from "../../components/common/Typography";
import Avatar from "../../components/common/Avatar";
import { roleLabel } from "../../constants/registrationRoles";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import { useAuth } from "../../hooks/useAuth";
import { styles } from "../../constants/theme";
import { rangerStyles as ui } from "../../constants/rangerTheme";
export default function ProfileScreen() {
  const { user, logout, isDemo } = useAuth();
  if (!isDemo && user.role === "RANGER")
    return (
      <Screen>
        <Text style={styles.eyebrow}>YOUR ACCOUNT</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Avatar user={user} size={56} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text accessibilityRole="header" style={ui.section}>
              {user.name}
            </Text>
            <Text style={styles.muted}>Park Ranger</Text>
          </View>
        </View>
        <View style={ui.card}>
          {Object.entries({
            Email: user.email,
            "Assigned Park / Ranger Area": user.park?.name || "Not assigned",
            "Approval status": user.approvalStatus,
          }).map(([label, value], index) => (
            <View
              key={label}
              style={{
                gap: 5,
                paddingTop: index ? 12 : 0,
                borderTopWidth: index ? 1 : 0,
                borderColor: "#dce4d7",
              }}
            >
              <Text style={styles.muted}>{label}</Text>
              <Text style={styles.text}>{value}</Text>
            </View>
          ))}
        </View>
        <Button title="Logout" secondary onPress={logout} />
      </Screen>
    );
  return (
    <Screen>
      <Avatar user={user} />
      <Text style={styles.eyebrow}>
        {isDemo ? "DEMO RANGER PROFILE" : "WILDGUARD LK / ACCOUNT"}
      </Text>
      <Text accessibilityRole="header" style={styles.title}>
        {user.name}
      </Text>
      <View style={styles.card}>
        {Object.entries({
          Name: user.name,
          "Account ID": user.id,
          Email: user.email,
          ...(isDemo ? { "Assigned park": user.park } : {}),
          Role: roleLabel(user.role),
          ...(!isDemo && user.role === "RANGER"
            ? {
                "Assigned Park / Ranger Area":
                  user.park?.name || "Not assigned",
                "Approval status": user.approvalStatus,
              }
            : {}),
        }).map(([label, value]) => (
          <View key={label} style={{ paddingVertical: 8, gap: 5 }}>
            <Text style={styles.muted}>{label}</Text>
            <Text style={styles.text}>{value}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.muted}>
        {isDemo
          ? "Sample profile only. Editing and account access will be added later."
          : user.role === "RANGER"
            ? "Your authenticated account details."
            : ["COMMUNITY_USER", "COMMUNITY_LIAISON"].includes(user.role)
              ? "Your authenticated community account details."
              : `You are signed in as ${roleLabel(user.role)}. Your role's mobile dashboard is not implemented yet.`}
      </Text>
      <Button
        title={isDemo ? "Exit demo" : "Logout"}
        secondary
        onPress={logout}
      />
    </Screen>
  );
}
