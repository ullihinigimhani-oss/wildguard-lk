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
import { WebView } from "react-native-webview";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import { getAlertById, acknowledgeAlert } from "../../services/alertApi";
import { useAuth } from "../../hooks/useAuth";
import { colors, styles } from "../../constants/theme";
import { buildReportMapDocument } from "../../components/reportMapDocument";

const RISK_THEME = {
  CRITICAL: { bg: "#fee2e2", border: "#f87171", text: "#991b1b", icon: "warning" },
  HIGH: { bg: "#ffedd5", border: "#fb923c", text: "#c2410c", icon: "alert-circle" },
  MEDIUM: { bg: "#fef9c3", border: "#facc15", text: "#854d0e", icon: "alert" },
  LOW: { bg: "#e0f2fe", border: "#38bdf8", text: "#0369a1", icon: "information-circle" },
};

export function formatAlertDetailTime(dateString) {
  if (!dateString) return "Date not recorded";
  const parsed = new Date(dateString);
  if (isNaN(parsed.getTime())) return "Date not recorded";
  return parsed.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getAlertTypeLabel(type) {
  switch (type) {
    case "WILDLIFE_PROXIMITY":
      return "Wildlife Proximity Notice";
    case "ZONE_PERIMETER_BREACH":
    case "ZONE_ADVISORY":
      return "Perimeter Zone Advisory";
    case "HUMAN_WILDLIFE_CONFLICT":
      return "Active Conflict Warning";
    default:
      return type ? type.replace(/_/g, " ") : "Community Safety Notice";
  }
}

export default function AlertDetailsScreen({ route, navigation }) {
  const { user } = useAuth();
  const alertParam = route.params?.alertData;
  const rawId = route.params?.alertId || alertParam?.id;
  const alertId = typeof rawId === "string" ? rawId.trim() : "";

  const [alert, setAlert] = useState(alertParam || null);
  const [loading, setLoading] = useState(!alertParam);
  const [acknowledging, setAcknowledging] = useState(false);
  const [error, setError] = useState("");
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    if (!alertParam) {
      if (!alertId) {
        setError("Invalid alert identifier provided.");
        setLoading(false);
      } else {
        loadAlert();
      }
    }
  }, [alertId]);

  async function loadAlert() {
    if (!alertId) {
      setError("Invalid alert identifier provided.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await getAlertById(alertId);
      setAlert(data);
    } catch (err) {
      const message =
        err.response?.status === 404
          ? "Alert not found. This safety notice may have been removed."
          : err.response?.status === 400
          ? "Invalid alert identifier."
          : err.response?.data?.message ||
            err.message ||
            "Unable to connect to alert service. Please check your network.";
      setError(message);
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
          <Text style={styles.muted}>Loading alert details...</Text>
        </View>
      </Screen>
    );
  }

  if (error || !alert) {
    return (
      <Screen>
        <View style={[styles.card, { alignItems: "center", gap: 12, padding: 24 }]}>
          <Ionicons name="alert-circle" size={40} color="#dc2626" />
          <Text style={[styles.heading, { textAlign: "center" }]}>
            {error.includes("Invalid")
              ? "Invalid Alert Reference"
              : error.includes("not found")
              ? "Safety Alert Not Found"
              : "Unable to Load Alert"}
          </Text>
          <Text style={[styles.muted, { textAlign: "center" }]}>
            {error || "Alert details could not be retrieved at this time."}
          </Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            <Button title="Back to Alerts" secondary onPress={() => navigation?.goBack()} />
            {alertId ? <Button title="Retry" onPress={() => loadAlert()} /> : null}
          </View>
        </View>
      </Screen>
    );
  }

  const theme = RISK_THEME[alert.riskLevel] || RISK_THEME.MEDIUM;
  const isAck = Boolean(alert.isAcknowledged);
  const isResolved = alert.status === "RESOLVED" || Boolean(alert.isResolved);
  const isExpired = Boolean(alert.isExpired) && !isResolved;

  const lat = alert.location?.latitude ?? alert.riskZone?.centerLatitude;
  const lon = alert.location?.longitude ?? alert.riskZone?.centerLongitude;
  const hasCoordinates = Boolean(lat != null && lon != null && !isNaN(Number(lat)) && !isNaN(Number(lon)));

  const instructions =
    alert.safetyInstructions && alert.safetyInstructions.length > 0
      ? alert.safetyInstructions
      : [
          "Stay away from the designated buffer area until park authorities confirm it is safe.",
          "Do not approach, tease, or shine flashlights directly at wildlife.",
          "Keep children and elderly individuals indoors or in safe elevated structures.",
          "Shelter cattle and domestic livestock in secure enclosures.",
        ];

  return (
    <Screen>
      {/* Top Risk & Status Header Banner */}
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
            {alert.riskLevel || alert.severity} SAFETY ALERT
          </Text>
        </View>

        <View
          style={{
            backgroundColor: isResolved ? "#166534" : isExpired ? "#b45309" : theme.text,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: colors.white }}>
            STATUS: {isResolved ? "RESOLVED" : isExpired ? "EXPIRED" : alert.status}
          </Text>
        </View>
      </View>

      {/* Resolved State Notice */}
      {isResolved && (
        <View
          style={{
            backgroundColor: "#dcfce7",
            borderColor: "#86efac",
            borderWidth: 1,
            borderRadius: 10,
            padding: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Ionicons name="checkmark-circle" size={22} color="#15803d" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#166534" }}>
              ALL CLEAR — ALERT RESOLVED
            </Text>
            <Text style={{ fontSize: 12, color: "#15803d" }}>
              {alert.resolvedAt
                ? `Wildlife risk has subsided. Resolved on ${formatAlertDetailTime(alert.resolvedAt)}.`
                : "Wildlife risk has subsided and the perimeter is confirmed safe."}
            </Text>
          </View>
        </View>
      )}

      {/* Expired State Notice */}
      {isExpired && (
        <View
          style={{
            backgroundColor: "#fef3c7",
            borderColor: "#fde68a",
            borderWidth: 1,
            borderRadius: 10,
            padding: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Ionicons name="time" size={22} color="#b45309" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#92400e" }}>
              NOTICE EXPIRED
            </Text>
            <Text style={{ fontSize: 12, color: "#b45309" }}>
              This alert is older than 72 hours and is retained for community records.
            </Text>
          </View>
        </View>
      )}

      {/* Main Alert Message & Timestamps */}
      <View style={[styles.card, { gap: 10 }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View
            style={{
              backgroundColor: colors.cream,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.green }}>
              {getAlertTypeLabel(alert.alertType)}
            </Text>
          </View>

          {isAck ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="checkmark-circle" size={15} color={colors.green} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.green }}>
                ACKNOWLEDGED
              </Text>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: "#fee2e2",
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "800", color: "#b91c1c" }}>
                UNREAD NOTICE
              </Text>
            </View>
          )}
        </View>

        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.dark, lineHeight: 24 }}>
          {alert.title || `${alert.riskLevel} Wildlife Alert`}
        </Text>

        <Text style={{ fontSize: 15, color: colors.text, lineHeight: 22 }}>
          {alert.message}
        </Text>

        <View style={{ borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 8, gap: 3 }}>
          <Text style={[styles.muted, { fontSize: 12 }]}>
            Generated: {formatAlertDetailTime(alert.generatedAt || alert.createdAt)}
          </Text>
          {alert.updatedAt && (
            <Text style={[styles.muted, { fontSize: 12 }]}>
              Last updated: {formatAlertDetailTime(alert.updatedAt)}
            </Text>
          )}
        </View>
      </View>

      {/* Wildlife Subject (if animal involved) */}
      {alert.animal && (
        <View style={[styles.card, { gap: 8 }]}>
          <Text style={styles.heading}>Wildlife Subject</Text>
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 14, color: colors.text }}>
              <Text style={{ fontWeight: "600" }}>Species: </Text>
              {alert.animal.species}
            </Text>
            {alert.animal.name && (
              <Text style={{ fontSize: 13, color: colors.muted }}>
                Known Name: {alert.animal.name}
              </Text>
            )}
            {alert.animal.animalCode && (
              <Text style={{ fontSize: 13, color: colors.muted }}>
                Collar Tracking Tag: {alert.animal.animalCode}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Affected Area & Location / Map */}
      <View style={[styles.card, { gap: 10 }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.heading}>Affected Area & Location</Text>
          {hasCoordinates && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showMap ? "Hide Map" : "View on Map"}
              onPress={() => setShowMap((prev) => !prev)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: colors.cream,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 6,
              }}
            >
              <Ionicons name={showMap ? "map" : "map-outline"} size={14} color={colors.green} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.green }}>
                {showMap ? "Hide Map" : "View on Map"}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 14, color: colors.text }}>
            <Text style={{ fontWeight: "600" }}>Area: </Text>
            {alert.affectedArea || alert.location?.areaName || alert.riskZone?.name || "General Community Buffer"}
          </Text>

          {(alert.location?.parkName || alert.riskZone?.park?.name) && (
            <Text style={{ fontSize: 13, color: colors.muted }}>
              Park: {alert.location?.parkName || alert.riskZone?.park?.name}
            </Text>
          )}

          {hasCoordinates && (
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Coordinates: {Number(lat).toFixed(4)}, {Number(lon).toFixed(4)}
            </Text>
          )}

          {(alert.location?.radiusMeters || alert.riskZone?.radiusMeters) && (
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Buffer Perimeter: ~{alert.location?.radiusMeters || alert.riskZone?.radiusMeters}m radius
            </Text>
          )}
        </View>

        {/* Map Preview when coordinates are available and toggled on */}
        {hasCoordinates && showMap && (
          <View
            style={{
              height: 200,
              borderRadius: 10,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: colors.border,
              marginTop: 6,
            }}
          >
            <WebView
              source={{ html: buildReportMapDocument(Number(lat), Number(lon), false) }}
              style={{ flex: 1 }}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled={false}
            />
          </View>
        )}
      </View>

      {/* Safety Instructions & Guidance */}
      <View style={[styles.card, { gap: 12, borderColor: colors.green, borderWidth: 1.5 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.cream,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="shield-checkmark" size={18} color={colors.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heading, { fontSize: 16, color: colors.dark }]}>
              Safety Instructions & Guidance
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Official instructions issued by park authorities
            </Text>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          {instructions.map((instruction, idx) => (
            <View
              key={idx}
              style={{
                flexDirection: "row",
                gap: 10,
                alignItems: "flex-start",
                backgroundColor: "#f8fafc",
                padding: 10,
                borderRadius: 8,
                borderLeftWidth: 3,
                borderLeftColor: colors.green,
              }}
            >
              <Ionicons
                name="alert-circle"
                size={18}
                color={colors.green}
                style={{ marginTop: 2 }}
              />
              <Text style={{ flex: 1, fontSize: 13, color: colors.text, lineHeight: 19, fontWeight: "500" }}>
                {instruction}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Bottom Actions: Share & Acknowledge */}
      <View style={{ gap: 10, paddingBottom: 24, marginTop: 8 }}>
        <Button
          title={
            isResolved
              ? "Alert Resolved (No Action Needed)"
              : isAck
              ? "✓ Alert Acknowledged"
              : "Acknowledge This Alert"
          }
          disabled={isAck || isResolved || acknowledging}
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
