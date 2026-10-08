import React from "react";
import { View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { Text } from "./Typography";
import { typography } from "../../constants/typography";
import { fieldColors as c, fieldCard } from "../../constants/fieldTheme";

export function ModernCard({ children, style, ...props }) {
  return <View {...props} style={[fieldCard, style]}>{children}</View>;
}

export function FieldIcon({ name, amber = false }) {
  return <View style={{ width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: amber ? "#FFF0DC" : c.sage }}>
    <Feather accessible={false} name={name} size={21} color={amber ? "#875214" : c.forest} />
  </View>;
}

export function ScreenHeader({ title, description, icon, eyebrow = "WILDGUARD LK · FIELD OPERATIONS" }) {
  return <View style={{ gap: 12, paddingVertical: 6 }}>
    <Text style={{ fontSize: 10, lineHeight: 16, letterSpacing: 1.6, fontWeight: "700", color: c.secondary }}>{eyebrow}</Text>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      {icon && <FieldIcon name={icon} />}
      <Text accessibilityRole="header" style={{ ...typography.display, color: c.forest, flex: 1, letterSpacing: -0.7 }}>{title}</Text>
    </View>
    {description && <Text style={{ ...typography.body, color: c.muted }}>{description}</Text>}
  </View>;
}

export function EmptyState({ message, detail, icon = "compass", children }) {
  return <ModernCard style={{ paddingVertical: 26 }}>
    <FieldIcon name={icon} />
    <Text style={{ ...typography.cardTitle, color: c.text }}>{message}</Text>
    {detail && <Text style={{ ...typography.secondary, color: c.muted }}>{detail}</Text>}
    {children}
  </ModernCard>;
}
