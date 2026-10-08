import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import AlertCard from "../../components/AlertCard";
import { listAlerts, acknowledgeAlert } from "../../services/alertApi";
import { useAuth } from "../../hooks/useAuth";
import { colors, styles } from "../../constants/theme";

const VIEW_MODES = [
  { key: "ACTIVE", label: "Active Alerts", icon: "shield-alert" },
  { key: "HISTORY", label: "Alert History", icon: "time" },
];

const RISK_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "CRITICAL", label: "Critical" },
  { key: "HIGH", label: "High" },
  { key: "MEDIUM", label: "Medium" },
  { key: "LOW", label: "Low" },
];

export default function AlertsScreen({ navigation }) {
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState("ACTIVE");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [error, setError] = useState("");

  async function fetchAlerts(isPull = false) {
    if (isPull) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const params = {
        status: viewMode,
        ...(riskFilter !== "ALL" && { riskLevel: riskFilter }),
      };
      const data = await listAlerts(params);
      setAlerts(data.alerts || []);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Could not connect to WildGuard alert services.";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchAlerts();
  }, [viewMode, riskFilter]);

  async function handleAcknowledge(alertId) {
    if (!user) {
      if (navigation?.navigate) navigation.navigate("Login");
      return;
    }

    setAcknowledgingId(alertId);
    try {
      await acknowledgeAlert(alertId);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, isAcknowledged: true } : a))
      );
    } catch (err) {
      setError(err.response?.data?.message || "Failed to acknowledge alert.");
    } finally {
      setAcknowledgingId(null);
    }
  }

  function openDetails(alert) {
    if (navigation?.navigate) {
      navigation.navigate("AlertDetails", { alertId: alert.id, alertData: alert });
    }
  }

  const unacknowledgedCount = alerts.filter(
    (a) => !a.isAcknowledged && a.status === "ACTIVE"
  ).length;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchAlerts(true)}
          tintColor={colors.green}
          colors={[colors.green]}
        />
      }
    >
      <View style={{ gap: 4 }}>
        <Text style={styles.eyebrow}>REAL-TIME SAFETY NOTICES</Text>
        <Text style={styles.title}>Wildlife Safety Alerts</Text>
        <Text style={styles.muted}>
          Live perimeter warnings, geofence breaches, and human-wildlife safety advisories.
        </Text>
      </View>

      {/* View Mode Switcher (Active vs History) */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#e2e8f0",
          borderRadius: 10,
          padding: 3,
        }}
      >
        {VIEW_MODES.map((mode) => {
          const active = viewMode === mode.key;
          return (
            <Pressable
              key={mode.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={mode.label}
              onPress={() => setViewMode(mode.key)}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: active ? colors.white : "transparent",
                shadowColor: active ? "#000" : "transparent",
                shadowOpacity: active ? 0.08 : 0,
                shadowRadius: 4,
                elevation: active ? 1 : 0,
              }}
            >
              <Ionicons
                name={mode.icon}
                size={16}
                color={active ? colors.green : colors.muted}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: active ? "700" : "500",
                  color: active ? colors.dark : colors.muted,
                }}
              >
                {mode.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Unread Alert Indicator Banner (For Active view) */}
      {viewMode === "ACTIVE" && unacknowledgedCount > 0 && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: "#fef2f2",
            borderColor: "#fecaca",
            borderWidth: 1,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
          }}
        >
          <Ionicons name="warning" size={16} color="#dc2626" />
          <Text style={{ fontSize: 12, fontWeight: "600", color: "#991b1b", flex: 1 }}>
            {`${unacknowledgedCount} unacknowledged safety notice${unacknowledgedCount > 1 ? "s" : ""} ${unacknowledgedCount > 1 ? "require" : "requires"} your attention.`}
          </Text>
        </View>
      )}

      {/* Severity / Risk Level Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
      >
        {RISK_FILTERS.map((f) => {
          const active = riskFilter === f.key;
          return (
            <Pressable
              key={f.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filter ${f.label}`}
              onPress={() => setRiskFilter(f.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                backgroundColor: active ? colors.green : colors.white,
                borderWidth: 1,
                borderColor: active ? colors.green : colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: active ? "700" : "500",
                  color: active ? colors.white : colors.text,
                }}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Content Area: Error / Loading / Empty / List */}
      {error ? (
        <View style={[styles.card, { alignItems: "center", gap: 10, padding: 20 }]}>
          <Ionicons name="cloud-offline" size={32} color="#dc2626" />
          <Text style={[styles.error, { textAlign: "center" }]}>{error}</Text>
          <Button title="Retry" secondary onPress={() => fetchAlerts()} />
        </View>
      ) : loading ? (
        <View style={{ paddingVertical: 40, alignItems: "center", gap: 10 }}>
          <ActivityIndicator size="large" color={colors.green} />
          <Text style={styles.muted}>
            {viewMode === "ACTIVE"
              ? "Checking active safety alerts..."
              : "Loading alert history..."}
          </Text>
        </View>
      ) : alerts.length === 0 ? (
        <View style={[styles.card, { alignItems: "center", padding: 36, gap: 12 }]}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.cream,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={viewMode === "ACTIVE" ? "shield-checkmark" : "file-tray"}
              size={30}
              color={colors.green}
            />
          </View>
          <Text style={[styles.heading, { textAlign: "center" }]}>
            {viewMode === "ACTIVE" ? "Perimeters Clear" : "No Alert History"}
          </Text>
          <Text style={[styles.muted, { textAlign: "center", fontSize: 13 }]}>
            {viewMode === "ACTIVE"
              ? riskFilter === "ALL"
                ? "No critical wildlife alerts or active geofence breaches detected in this region."
                : `No active ${riskFilter.toLowerCase()} alerts at this time.`
              : riskFilter === "ALL"
              ? "No resolved or past wildlife alerts recorded in history."
              : `No past ${riskFilter.toLowerCase()} alerts found.`}
          </Text>
          <Button title="Refresh Alerts" secondary onPress={() => fetchAlerts()} />
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {alerts.map((item) => (
            <AlertCard
              key={item.id}
              alert={item}
              onPress={() => openDetails(item)}
              onAcknowledge={() => handleAcknowledge(item.id)}
              acknowledging={acknowledgingId === item.id}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
