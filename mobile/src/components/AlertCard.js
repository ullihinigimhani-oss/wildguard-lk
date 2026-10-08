import React from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, styles } from "../constants/theme";

const RISK_CONFIG = {
  CRITICAL: {
    bg: "#fee2e2",
    border: "#f87171",
    text: "#991b1b",
    icon: "warning",
  },
  HIGH: {
    bg: "#ffedd5",
    border: "#fb923c",
    text: "#c2410c",
    icon: "alert-circle",
  },
  MEDIUM: {
    bg: "#fef9c3",
    border: "#facc15",
    text: "#854d0e",
    icon: "alert",
  },
  LOW: {
    bg: "#e0f2fe",
    border: "#38bdf8",
    text: "#0369a1",
    icon: "information-circle",
  },
};

export default function AlertCard({
  alert,
  onPress,
  onAcknowledge,
  acknowledging = false,
}) {
  const risk = RISK_CONFIG[alert.riskLevel] || RISK_CONFIG.MEDIUM;
  const isAck = alert.isAcknowledged;

  const dateStr = alert.generatedAt
    ? new Date(alert.generatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        day: "numeric",
        month: "short",
      })
    : "";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Alert: ${alert.riskLevel} - ${alert.message}`}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: colors.white,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: alert.riskLevel === "CRITICAL" ? risk.border : colors.border,
        gap: 10,
        opacity: pressed ? 0.85 : 1,
        shadowColor: colors.dark,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
      })}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            backgroundColor: risk.bg,
            borderWidth: 1,
            borderColor: risk.border,
          }}
        >
          <Ionicons name={risk.icon} size={13} color={risk.text} />
          <Text style={{ fontSize: 11, fontWeight: "700", color: risk.text, letterSpacing: 0.5 }}>
            {alert.riskLevel} ALERT
          </Text>
        </View>

        <Text style={{ fontSize: 12, color: colors.muted }}>{dateStr}</Text>
      </View>

      <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text, lineHeight: 21 }}>
        {alert.message}
      </Text>

      {(alert.animal?.species || alert.riskZone?.name) && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {alert.animal?.species && (
            <View style={{ backgroundColor: colors.cream, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 }}>
              <Text style={{ fontSize: 11, color: colors.green, fontWeight: "600" }}>
                {alert.animal.species}
              </Text>
            </View>
          )}
          {alert.riskZone?.name && (
            <View style={{ backgroundColor: "#f1f5f9", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 }}>
              <Text style={{ fontSize: 11, color: "#475569", fontWeight: "600" }}>
                {alert.riskZone.name}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 10 }}>
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.green }}>Safety Guidance</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.green} />
        </Pressable>

        {onAcknowledge && (
          isAck ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="checkmark-circle" size={15} color={colors.green} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.green }}>Acknowledged</Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Acknowledge alert"
              disabled={acknowledging}
              onPress={onAcknowledge}
              style={{
                backgroundColor: colors.cream,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {acknowledging ? (
                <ActivityIndicator size="small" color={colors.green} />
              ) : (
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.green }}>
                  Acknowledge
                </Text>
              )}
            </Pressable>
          )
        )}
      </View>
    </Pressable>
  );
}
