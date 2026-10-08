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

export function formatAlertDate(dateString) {
  if (!dateString) return "Date not recorded";
  const parsed = new Date(dateString);
  if (isNaN(parsed.getTime())) return "Date not recorded";
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatAffectedArea(alert) {
  if (!alert) return "Unspecified Perimeter";
  if (alert.affectedArea) return alert.affectedArea;
  if (alert.riskZone?.name) {
    const park = alert.riskZone.park?.name ? ` (${alert.riskZone.park.name})` : "";
    return `${alert.riskZone.name}${park}`;
  }
  if (alert.riskZone?.centerLatitude && alert.riskZone?.centerLongitude) {
    return `GPS: ${alert.riskZone.centerLatitude.toFixed(4)}, ${alert.riskZone.centerLongitude.toFixed(4)}`;
  }
  return "General Buffer Perimeter";
}

export default function AlertCard({
  alert,
  onPress,
  onAcknowledge,
  acknowledging = false,
}) {
  const risk = RISK_CONFIG[alert.riskLevel] || RISK_CONFIG.MEDIUM;
  const isAck = Boolean(alert.isAcknowledged);
  const isResolved = alert.status === "RESOLVED";

  const dateStr = formatAlertDate(alert.generatedAt || alert.createdAt);
  const areaStr = formatAffectedArea(alert);
  const titleStr = alert.title || `${alert.riskLevel} Wildlife Alert`;
  const messageStr = alert.shortMessage || alert.message;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Alert: ${alert.riskLevel} - ${titleStr}`}
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
      {/* Top Header: Severity Pill + Unread Badge + Date */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
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

          {isResolved ? (
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                backgroundColor: "#f1f5f9",
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "700", color: "#475569" }}>RESOLVED</Text>
            </View>
          ) : !isAck ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                backgroundColor: "#fee2e2",
              }}
            >
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#dc2626" }} />
              <Text style={{ fontSize: 10, fontWeight: "800", color: "#b91c1c" }}>UNREAD</Text>
            </View>
          ) : (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                backgroundColor: colors.cream,
              }}
            >
              <Ionicons name="checkmark" size={11} color={colors.green} />
              <Text style={{ fontSize: 10, fontWeight: "700", color: colors.green }}>READ</Text>
            </View>
          )}
        </View>

        <Text style={{ fontSize: 12, color: colors.muted }}>{dateStr}</Text>
      </View>

      {/* Title */}
      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.dark, lineHeight: 22 }}>
        {titleStr}
      </Text>

      {/* Message / Short Message */}
      <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>
        {messageStr}
      </Text>

      {/* Affected Area & Wildlife Tags */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor: "#f8fafc",
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="location-sharp" size={12} color={colors.green} />
          <Text style={{ fontSize: 11, color: colors.dark, fontWeight: "600" }}>
            {areaStr}
          </Text>
        </View>

        {alert.animal?.species && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: colors.cream,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6,
            }}
          >
            <Ionicons name="paw" size={11} color={colors.green} />
            <Text style={{ fontSize: 11, color: colors.green, fontWeight: "600" }}>
              {alert.animal.species}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Actions: Safety Guidance & Acknowledge */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          borderTopWidth: 1,
          borderTopColor: "#f1f5f9",
          paddingTop: 10,
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.green }}>Safety Guidance</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.green} />
        </Pressable>

        {isAck ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="checkmark-circle" size={16} color={colors.green} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.green }}>Acknowledged</Text>
          </View>
        ) : onAcknowledge ? (
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
        ) : null}
      </View>
    </Pressable>
  );
}
