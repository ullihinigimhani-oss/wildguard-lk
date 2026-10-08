import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert as NativeAlert,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import { getAlertById, acknowledgeAlert } from "../../services/alertApi";
import { useAuth } from "../../hooks/useAuth";
import { colors, styles } from "../../constants/theme";

const RISK_THEME = {
  CRITICAL: { bg: "#fee2e2", border: "#f87171", text: "#991b1b", icon: "warning" },
  HIGH: { bg: "#ffedd5", border: "#fb923c", text: "#c2410c", icon: "alert-circle" },
  MEDIUM: { bg: "#fef9c3", border: "#facc15", text: "#854d0e", icon: "alert" },
  LOW: { bg: "#e0f2fe", border: "#38bdf8", text: "#0369a1", icon: "information-circle" },
};

export default function AlertDetailsScreen({ route, navigation }) {
  const { user } = useAuth();
  const alertParam = route.params?.alertData;
  const alertId = route.params?.alertId || alertParam?.id;

  const [alert, setAlert] = useState(alertParam || null);
  const [loading, setLoading] = useState(!alertParam);
  const [acknowledging, setAcknowledging] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!alertParam && alertId) {
      loadAlert();
    }
  }, [alertId]);

  async function loadAlert() {
    setLoading(true);
    setError("");
    try {
      const data = await getAlertById(alertId);
      setAlert(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Could not load alert details.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAcknowledge() {
    if (!user) {
      if (navigation?.navigate) navigation.navigate("Login");
      return;
    }

    setAcknowledging(true);
    try {
      await acknowledgeAlert(alert.id);
      setAlert((prev) => ({ ...prev, isAcknowledged: true }));
      NativeAlert.alert("Acknowledged", "Your acknowledgement has been logged for this alert.");
    } catch (err) {
      NativeAlert.alert("Error", err.response?.data?.message || "Could not acknowledge alert.");
    } finally {
      setAcknowledging(false);
    }
  }

  async function handleShare() {
    if (!alert) return;
    try {
      const title = alert.title || `${alert.riskLevel} Wildlife Alert`;
      const area = alert.affectedArea || alert.riskZone?.name || "Buffer Perimeter";
      const message = `🚨 WILDGUARD SAFETY ALERT: ${title}\n${alert.message}\nArea: ${area}\nAnimal: ${alert.animal?.species || "Wildlife"}\nPlease stay alert and share with local community members!`;
      await Share.share({
        message,
        title,
      });
    } catch {
      // User cancelled share
    }
  }

  if (loading) {
    return (
      <Screen>
        <View style={{ paddingVertical: 40, alignItems: "center", gap: 10 }}>
          <ActivityIndicator size="large" color={colors.green} />
          <Text style={styles.muted}>Loading alert information...</Text>
        </View>
      </Screen>
    );
  }

  if (error || !alert) {
    return (
      <Screen>
        <View style={[styles.card, { alignItems: "center", gap: 12, padding: 24 }]}>
          <Text style={styles.error}>{error || "Alert not found."}</Text>
          <Button title="Back to Alerts" secondary onPress={() => navigation?.goBack()} />
        </View>
      </Screen>
    );
  }

  const theme = RISK_THEME[alert.riskLevel] || RISK_THEME.MEDIUM;
  const isAck = alert.isAcknowledged;
  const timeStr = alert.generatedAt ? new Date(alert.generatedAt).toLocaleString() : "";

  return (
    <Screen>
      {/* Risk Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: theme.bg,
          padding: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name={theme.icon} size={20} color={theme.text} />
          <Text style={{ fontSize: 14, fontWeight: "700", color: theme.text, letterSpacing: 0.5 }}>
            {alert.riskLevel} SAFETY ALERT
          </Text>
        </View>
        <Text style={{ fontSize: 11, fontWeight: "600", color: theme.text }}>
          STATUS: {alert.status}
        </Text>
      </View>

      {/* Main Alert Message */}
      <View style={[styles.card, { gap: 10 }]}>
        {alert.title && (
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.green, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {alert.title}
          </Text>
        )}
        <Text style={{ fontSize: 17, fontWeight: "700", color: colors.dark, lineHeight: 24 }}>
          {alert.message}
        </Text>
        <Text style={[styles.muted, { fontSize: 12 }]}>Reported / Detected: {timeStr}</Text>
        {alert.resolvedAt && (
          <Text style={{ fontSize: 12, color: "#166534", fontWeight: "600" }}>
            Resolved: {new Date(alert.resolvedAt).toLocaleString()}
          </Text>
        )}
      </View>

      {/* Animal & Tracking Info */}
      {alert.animal && (
        <View style={[styles.card, { gap: 8 }]}>
          <Text style={styles.heading}>Wildlife Subject</Text>
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 14, color: colors.text }}>
              <Text style={{ fontWeight: "600" }}>Species: </Text>
              {alert.animal.species}
            </Text>
            {alert.animal.animalCode && (
              <Text style={{ fontSize: 13, color: colors.muted }}>
                Collar Tracking Tag: {alert.animal.animalCode}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Location & Zone Info */}
      {(alert.riskZone || alert.affectedArea) && (
        <View style={[styles.card, { gap: 8 }]}>
          <Text style={styles.heading}>Affected Area & Location</Text>
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 14, color: colors.text }}>
              <Text style={{ fontWeight: "600" }}>Area: </Text>
              {alert.affectedArea || alert.riskZone?.name || "Perimeter Zone"}
            </Text>
            {alert.riskZone?.park?.name && (
              <Text style={{ fontSize: 13, color: colors.muted }}>
                Park: {alert.riskZone.park.name}
              </Text>
            )}
            {alert.riskZone?.centerLatitude && alert.riskZone?.centerLongitude && (
              <Text style={{ fontSize: 12, color: colors.muted }}>
                Coordinates: {alert.riskZone.centerLatitude.toFixed(4)}, {alert.riskZone.centerLongitude.toFixed(4)}
              </Text>
            )}
            {alert.riskZone?.radiusMeters && (
              <Text style={{ fontSize: 12, color: colors.muted }}>
                Buffer Perimeter: ~{alert.riskZone.radiusMeters}m radius
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Safety Instructions */}
      <View style={[styles.card, { gap: 10, borderColor: colors.green }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="shield" size={18} color={colors.green} />
          <Text style={[styles.heading, { color: colors.dark }]}>Safety Guidance & Action Steps</Text>
        </View>

        {alert.safetyInstructions && alert.safetyInstructions.length > 0 ? (
          <View style={{ gap: 8 }}>
            {alert.safetyInstructions.map((instruction, idx) => (
              <View key={idx} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                <Ionicons
                  name="chevron-forward-circle"
                  size={16}
                  color={colors.green}
                  style={{ marginTop: 2 }}
                />
                <Text style={{ flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 }}>
                  {instruction}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>
            Maintain distance from wildlife and report changes to local wildlife wardens.
          </Text>
        )}
      </View>

      {/* Bottom Actions: Share & Acknowledge */}
      <View style={{ gap: 10, paddingBottom: 24, marginTop: 8 }}>
        <Button
          title={isAck ? "✓ Alert Acknowledged" : "Acknowledge This Alert"}
          disabled={isAck || acknowledging}
          loading={acknowledging}
          onPress={handleAcknowledge}
        />

        <Button
          title="Share Alert with Community"
          secondary
          onPress={handleShare}
        />
      </View>
    </Screen>
  );
}
