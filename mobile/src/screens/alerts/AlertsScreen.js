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

const RISK_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "CRITICAL", label: "Critical" },
  { key: "HIGH", label: "High" },
  { key: "MEDIUM", label: "Medium" },
  { key: "LOW", label: "Low" },
];

export default function AlertsScreen({ navigation }) {
  const { user } = useAuth();

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
        status: "ACTIVE",
        ...(riskFilter !== "ALL" && { riskLevel: riskFilter }),
      };
      const data = await listAlerts(params);
      setAlerts(data.alerts || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Could not load safety alerts.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchAlerts();
  }, [riskFilter]);

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

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Text style={styles.eyebrow}>REAL-TIME SAFETY NOTICES</Text>
        <Text style={styles.title}>Wildlife Safety Alerts</Text>
        <Text style={styles.muted}>
          Live perimeter warnings, geofence breaches, and human-wildlife safety advisories.
        </Text>
      </View>

      {/* Risk Filter Tabs */}
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

      {error ? (
        <View style={[styles.card, { alignItems: "center", gap: 10, padding: 20 }]}>
          <Text style={styles.error}>{error}</Text>
          <Button title="Retry" secondary onPress={() => fetchAlerts()} />
        </View>
      ) : loading ? (
        <View style={{ paddingVertical: 40, alignItems: "center", gap: 10 }}>
          <ActivityIndicator size="large" color={colors.green} />
          <Text style={styles.muted}>Checking active safety alerts...</Text>
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
            <Ionicons name="shield-checkmark" size={30} color={colors.green} />
          </View>
          <Text style={[styles.heading, { textAlign: "center" }]}>Perimeters Clear</Text>
          <Text style={[styles.muted, { textAlign: "center", fontSize: 13 }]}>
            {riskFilter === "ALL"
              ? "No critical wildlife alerts or active geofence breaches detected in this region."
              : `No active ${riskFilter.toLowerCase()} alerts at this time.`}
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
