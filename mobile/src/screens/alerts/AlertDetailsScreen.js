import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert as NativeAlert,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { WebView } from "react-native-webview";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import {
  getAlertById,
  acknowledgeAlert,
  markAlertAsRead,
  respondToAlert,
  forwardAlert,
  escalateAlert,
} from "../../services/alertApi";
import { useAuth } from "../../hooks/useAuth";
import { colors, styles } from "../../constants/theme";
import { buildReportMapDocument } from "../../components/reportMapDocument";
import { shareSafetyAlert } from "../../utils/shareAlert";

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

  const isAuthorizedResponder =
    user?.role === "COMMUNITY_LIAISON" || user?.role === "PARK_MANAGER";

  const [responseNote, setResponseNote] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("ACKNOWLEDGED");
  const [selectedForwardTarget, setSelectedForwardTarget] = useState("RANGER");
  const [forwardNote, setForwardNote] = useState("");
  const [responding, setResponding] = useState(false);
  const [forwarding, setForwarding] = useState(false);
  const [handoffData, setHandoffData] = useState(null);
  const [escalationReason, setEscalationReason] = useState("");
  const [escalating, setEscalating] = useState(false);
  const [escalationHandoffData, setEscalationHandoffData] = useState(null);

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

  // When viewing details of an unread active alert, automatically mark as read
  useEffect(() => {
    let isMounted = true;
    if (user && alert && !alert.isRead && alert.status === "ACTIVE") {
      markAlertAsRead(alert.id)
        .then((res) => {
          if (isMounted) {
            setAlert((prev) =>
              prev
                ? {
                    ...prev,
                    isRead: true,
                    readAt: res?.readAt || new Date().toISOString(),
                  }
                : prev
            );
          }
        })
        .catch(() => {
          // Silent background failure, user can still acknowledge manually
        });
    }
    return () => {
      isMounted = false;
    };
  }, [user?.id, alert?.id, alert?.isRead]);

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

    if (isResolved || isExpired) {
      NativeAlert.alert("Not Applicable", "Acknowledgement is not applicable for resolved or expired alerts.");
      return;
    }

    if (isAck) {
      NativeAlert.alert("Already Acknowledged", "You have already acknowledged this safety alert.");
      return;
    }

    const previousAlert = { ...alert };
    const nowIso = new Date().toISOString();
    setAcknowledging(true);

    // Optimistically update UI immediately
    setAlert((prev) => ({
      ...prev,
      isAcknowledged: true,
      acknowledgedAt: nowIso,
      isRead: true,
      readAt: prev?.readAt || nowIso,
      userState: "ACKNOWLEDGED",
    }));

    try {
      const res = await acknowledgeAlert(alert.id);
      NativeAlert.alert(
        "Acknowledged",
        res?.message || "Your acknowledgement has been logged for this alert."
      );
    } catch (err) {
      // Revert optimistic update on failure
      setAlert(previousAlert);
      NativeAlert.alert(
        "Error",
        err.response?.data?.message || err.message || "Could not acknowledge alert."
      );
    } finally {
      setAcknowledging(false);
    }
  }

  async function handleShare() {
    await shareSafetyAlert(alert);
  }

  async function handleOperationalResponse() {
    if (!isAuthorizedResponder) return;
    if (isResolved || isExpired) {
      NativeAlert.alert("Closed", "Operational response is closed for resolved or expired alerts.");
      return;
    }

    const trimmed = responseNote.trim();
    if (trimmed && (trimmed.length < 5 || trimmed.length > 1000)) {
      NativeAlert.alert("Invalid Note", "Response note must be between 5 and 1000 characters.");
      return;
    }

    if (!trimmed && selectedStatus === alert.status) {
      NativeAlert.alert("Required", "Please provide a response note or select a status transition.");
      return;
    }

    setResponding(true);
    try {
      const res = await respondToAlert(alert.id, {
        status: selectedStatus,
        responseNote: trimmed || undefined,
      });

      if (res.alert) {
        setAlert(res.alert);
      }
      setResponseNote("");
      NativeAlert.alert(
        "Response Recorded",
        res.message || "Operational response recorded successfully."
      );
    } catch (err) {
      NativeAlert.alert(
        "Response Failed",
        err.response?.data?.message || err.message || "Could not record operational response."
      );
    } finally {
      setResponding(false);
    }
  }

  async function handleForwardAlert() {
    if (!isAuthorizedResponder) return;
    if (isResolved || isExpired) {
      NativeAlert.alert("Closed", "Cannot forward resolved or expired alerts.");
      return;
    }

    const noteToUse = (forwardNote || responseNote).trim();
    if (noteToUse && (noteToUse.length < 5 || noteToUse.length > 1000)) {
      NativeAlert.alert("Invalid Note", "Forwarding note must be between 5 and 1000 characters.");
      return;
    }

    setForwarding(true);
    try {
      const res = await forwardAlert(alert.id, {
        forwardTo: selectedForwardTarget,
        note: noteToUse || undefined,
      });

      if (res.alert) {
        setAlert(res.alert);
      }
      if (res.handoff) {
        setHandoffData(res.handoff);
      }
      setForwardNote("");
      NativeAlert.alert(
        "Alert Forwarded",
        res.message || `Alert forwarded to ${selectedForwardTarget} successfully.`
      );
    } catch (err) {
      NativeAlert.alert(
        "Forward Failed",
        err.response?.data?.message || err.message || "Could not forward alert."
      );
    } finally {
      setForwarding(false);
    }
  }

  function handleConfirmEscalation() {
    if (!isAuthorizedResponder) return;
    if (isResolved || isExpired) {
      NativeAlert.alert("Closed", "Cannot escalate resolved or expired alerts.");
      return;
    }

    if (!isHighOrCritical) {
      NativeAlert.alert("Invalid Severity", "Only HIGH or CRITICAL severity alerts can be escalated.");
      return;
    }

    const trimmed = escalationReason.trim();
    if (!trimmed || trimmed.length < 10 || trimmed.length > 1000) {
      NativeAlert.alert("Invalid Reason", "Escalation reason must be between 10 and 1000 characters.");
      return;
    }

    NativeAlert.alert(
      "Confirm Escalation",
      `Are you sure you want to escalate this ${alert.riskLevel} alert to Conservation Operations & Incident Response?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Escalate",
          style: "destructive",
          onPress: () => performEscalate(trimmed),
        },
      ]
    );
  }

  async function performEscalate(trimmedReason) {
    setEscalating(true);
    try {
      const res = await escalateAlert(alert.id, {
        reason: trimmedReason,
        targetDepartment: "INCIDENT_RESPONSE",
      });

      if (res.alreadyEscalated) {
        NativeAlert.alert(
          "Already Escalated",
          res.message || "Alert already has an active escalation."
        );
      } else {
        NativeAlert.alert(
          "Alert Escalated",
          res.message || "Alert escalated to Conservation Operations & Incident Response successfully."
        );
      }

      if (res.alert) {
        setAlert(res.alert);
      } else if (res.escalation) {
        setAlert((prev) => ({
          ...prev,
          isEscalated: true,
          escalation: res.escalation,
          status: prev.status === "ACTIVE" ? "ACKNOWLEDGED" : prev.status,
        }));
      }

      if (res.incidentHandoff) {
        setEscalationHandoffData(res.incidentHandoff);
      }

      setEscalationReason("");
    } catch (err) {
      NativeAlert.alert(
        "Escalation Failed",
        err.response?.data?.message || err.message || "Could not escalate alert."
      );
    } finally {
      setEscalating(false);
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
  const isRead = Boolean(alert.isRead || alert.isAcknowledged);
  const isResolved = alert.status === "RESOLVED" || Boolean(alert.isResolved);
  const isExpired = Boolean(alert.isExpired) && !isResolved;
  const isHighOrCritical = alert.riskLevel === "HIGH" || alert.riskLevel === "CRITICAL";
  const activeEscalation =
    alert.escalation && (alert.escalation.status === "PENDING" || alert.escalation.status === "ACKNOWLEDGED");
  const isAlreadyEscalated = Boolean(alert.isEscalated || activeEscalation);

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
          ) : isRead ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                backgroundColor: colors.cream,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
              }}
            >
              <Ionicons name="eye-outline" size={13} color={colors.green} />
              <Text style={{ fontSize: 10, fontWeight: "700", color: colors.green }}>
                READ
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
          {alert.acknowledgedAt && (
            <Text style={[styles.muted, { fontSize: 12, color: colors.green, fontWeight: "600" }]}>
              Acknowledged: {formatAlertDetailTime(alert.acknowledgedAt)}
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

      {/* Acknowledged State Feedback Banner */}
      {isAck && (
        <View
          style={{
            backgroundColor: "#f0fdf4",
            borderColor: "#86efac",
            borderWidth: 1,
            borderRadius: 10,
            padding: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Ionicons name="checkmark-done-circle" size={24} color="#16a34a" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#166534" }}>
              SAFETY INSTRUCTIONS ACKNOWLEDGED
            </Text>
            <Text style={{ fontSize: 12, color: "#15803d" }}>
              {alert.acknowledgedAt
                ? `You confirmed understanding on ${formatAlertDetailTime(alert.acknowledgedAt)}.`
                : "You have confirmed and logged understanding of these safety instructions."}
            </Text>
          </View>
        </View>
      )}

      {/* Existing Operational Response Record (if logged) */}
      {(alert.responseNote || alert.respondedAt || alert.forwardedTo) && (
        <View style={[styles.card, { gap: 10, borderColor: "#3b82f6", borderWidth: 1 }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="clipboard-outline" size={18} color="#2563eb" />
              <Text style={[styles.heading, { fontSize: 15, color: "#1e40af" }]}>
                Operational Action Record
              </Text>
            </View>
            {alert.forwardedTo ? (
              <View style={{ backgroundColor: "#dbeafe", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#1e40af" }}>
                  FORWARDED TO {alert.forwardedTo}
                </Text>
              </View>
            ) : alert.status === "RESOLVED" ? (
              <View style={{ backgroundColor: "#dcfce7", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#15803d" }}>
                  RESOLVED
                </Text>
              </View>
            ) : (
              <View style={{ backgroundColor: "#fef3c7", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#92400e" }}>
                  OPERATIONAL NOTE
                </Text>
              </View>
            )}
          </View>

          {alert.responder && (
            <Text style={{ fontSize: 13, color: colors.text }}>
              <Text style={{ fontWeight: "600" }}>Responder: </Text>
              {alert.responder.name} ({alert.responder.role?.replace(/_/g, " ")})
            </Text>
          )}

          {alert.respondedAt && (
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Response logged: {formatAlertDetailTime(alert.respondedAt)}
            </Text>
          )}

          {alert.responseNote && (
            <View style={{ backgroundColor: "#eff6ff", padding: 10, borderRadius: 8 }}>
              <Text style={{ fontSize: 13, color: "#1e3a8a", fontStyle: "italic", lineHeight: 18 }}>
                "{alert.responseNote}"
              </Text>
            </View>
          )}

          {alert.forwardedTo && (
            <View style={{ gap: 2, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 8 }}>
              <Text style={{ fontSize: 12, color: "#1e40af", fontWeight: "600" }}>
                Forwarded to {alert.forwardedTo === "RANGER" ? "Ranger Patrol Division" : "Park Manager Office"}
              </Text>
              {alert.forwardedAt && (
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  Handoff timestamp: {formatAlertDetailTime(alert.forwardedAt)}
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* Immediate Session Handoff Feedback */}
      {handoffData && (
        <View style={{ backgroundColor: "#ecfdf5", borderColor: "#6ee7b7", borderWidth: 1, borderRadius: 10, padding: 12, gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="checkmark-done" size={18} color="#059669" />
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#065f46" }}>
              Handoff Confirmed ({handoffData.handoffTarget})
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: "#047857" }}>
            Recommended Action: {handoffData.recommendedAction}
          </Text>
        </View>
      )}

      {/* Existing Management Escalation Record (if logged) */}
      {(alert.escalation || alert.isEscalated || escalationHandoffData) && (
        <View style={[styles.card, { gap: 10, borderColor: "#dc2626", borderWidth: 1.5, backgroundColor: "#fff5f5" }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="warning" size={18} color="#dc2626" />
              <Text style={[styles.heading, { fontSize: 15, color: "#991b1b" }]}>
                Management Escalation Record
              </Text>
            </View>
            <View
              style={{
                backgroundColor: "#fee2e2",
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: "#fca5a5",
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "800", color: "#991b1b" }}>
                {alert.escalation?.status
                  ? `ESCALATED: ${alert.escalation.status}`
                  : "ESCALATED: PENDING"}
              </Text>
            </View>
          </View>

          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 13, color: colors.text }}>
              <Text style={{ fontWeight: "700", color: "#991b1b" }}>Target Division: </Text>
              {alert.escalation?.targetDepartment || "Conservation Operations (Incident Response)"}
            </Text>
            <Text style={{ fontSize: 13, color: colors.text }}>
              <Text style={{ fontWeight: "600" }}>Priority Level: </Text>
              {alert.escalation?.priority || alert.riskLevel}
            </Text>
            {alert.escalation?.escalatedBy && (
              <Text style={{ fontSize: 13, color: colors.text }}>
                <Text style={{ fontWeight: "600" }}>Escalated By: </Text>
                {alert.escalation.escalatedBy.name} ({alert.escalation.escalatedBy.role?.replace(/_/g, " ")})
              </Text>
            )}
            {alert.escalation?.escalatedAt && (
              <Text style={{ fontSize: 12, color: colors.muted }}>
                Escalation logged: {formatAlertDetailTime(alert.escalation.escalatedAt)}
              </Text>
            )}
          </View>

          {(alert.escalation?.reason || escalationHandoffData?.reason) && (
            <View style={{ backgroundColor: "#fef2f2", padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#fecaca" }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#991b1b", marginBottom: 2 }}>
                Escalation Justification:
              </Text>
              <Text style={{ fontSize: 13, color: "#7f1d1d", fontStyle: "italic", lineHeight: 18 }}>
                "{alert.escalation?.reason || escalationHandoffData?.reason}"
              </Text>
            </View>
          )}

          {escalationHandoffData?.recommendedOperationalAction && (
            <View style={{ gap: 2, borderTopWidth: 1, borderTopColor: "#fecaca", paddingTop: 8 }}>
              <Text style={{ fontSize: 12, color: "#991b1b", fontWeight: "700" }}>
                Recommended Operational Action:
              </Text>
              <Text style={{ fontSize: 12, color: "#7f1d1d" }}>
                {escalationHandoffData.recommendedOperationalAction}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Authorized Liaison Response Controls (Role Protected: only COMMUNITY_LIAISON or PARK_MANAGER) */}
      {isAuthorizedResponder && !isResolved && !isExpired && (
        <View style={[styles.card, { gap: 14, borderColor: "#3b82f6", borderWidth: 1.5 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: "#dbeafe",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="shield" size={18} color="#2563eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heading, { fontSize: 16, color: "#1e3a8a" }]}>
                Authorized Liaison Response
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                Operational controls for Community Liaison & Park Manager
              </Text>
            </View>
          </View>

          {/* Status Transition Selector */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text }}>
              Target Alert Status:
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Status: Acknowledged"
                onPress={() => setSelectedStatus("ACKNOWLEDGED")}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: selectedStatus === "ACKNOWLEDGED" ? "#2563eb" : colors.border,
                  backgroundColor: selectedStatus === "ACKNOWLEDGED" ? "#eff6ff" : colors.white,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: selectedStatus === "ACKNOWLEDGED" ? "700" : "500",
                    color: selectedStatus === "ACKNOWLEDGED" ? "#1d4ed8" : colors.text,
                  }}
                >
                  Acknowledged
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Status: Resolved"
                onPress={() => setSelectedStatus("RESOLVED")}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: selectedStatus === "RESOLVED" ? "#16a34a" : colors.border,
                  backgroundColor: selectedStatus === "RESOLVED" ? "#f0fdf4" : colors.white,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: selectedStatus === "RESOLVED" ? "700" : "500",
                    color: selectedStatus === "RESOLVED" ? "#15803d" : colors.text,
                  }}
                >
                  Mark Resolved
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Operational Response Note Input */}
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text }}>
                Response Note:
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                {responseNote.length}/1000
              </Text>
            </View>

            <TextInput
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                padding: 10,
                fontSize: 13,
                color: colors.dark,
                backgroundColor: "#f8fafc",
                minHeight: 70,
                textAlignVertical: "top",
              }}
              multiline
              numberOfLines={3}
              placeholder="e.g. Liaison contacted Grama Niladhari; flares and loudspeakers deployed..."
              placeholderTextColor="#94a3b8"
              value={responseNote}
              onChangeText={setResponseNote}
              maxLength={1000}
            />
          </View>

          {/* Button: Submit Response Note / Status Update */}
          <Button
            title="Submit Operational Response"
            loading={responding}
            disabled={responding}
            onPress={handleOperationalResponse}
          />

          {/* Forward / Escalation Section */}
          <View style={{ borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 12, gap: 10 }}>
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: colors.dark }}>
                Forward Alert (Handoff)
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                Escalate requiring Ranger patrol mobilization or Park Manager action
              </Text>
            </View>

            {/* Target Select */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Forward to Ranger"
                onPress={() => setSelectedForwardTarget("RANGER")}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: selectedForwardTarget === "RANGER" ? colors.green : colors.border,
                  backgroundColor: selectedForwardTarget === "RANGER" ? colors.cream : colors.white,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: selectedForwardTarget === "RANGER" ? "700" : "500",
                    color: selectedForwardTarget === "RANGER" ? colors.green : colors.text,
                  }}
                >
                  Ranger Patrol
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Forward to Park Manager"
                onPress={() => setSelectedForwardTarget("PARK_MANAGER")}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: selectedForwardTarget === "PARK_MANAGER" ? colors.green : colors.border,
                  backgroundColor: selectedForwardTarget === "PARK_MANAGER" ? colors.cream : colors.white,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: selectedForwardTarget === "PARK_MANAGER" ? "700" : "500",
                    color: selectedForwardTarget === "PARK_MANAGER" ? colors.green : colors.text,
                  }}
                >
                  Park Manager
                </Text>
              </Pressable>
            </View>

            <Button
              title={`Forward to ${selectedForwardTarget === "RANGER" ? "Ranger" : "Manager"}`}
              secondary
              loading={forwarding}
              disabled={forwarding}
              onPress={handleForwardAlert}
            />
          </View>

          {/* High-Priority Alert Escalation Section */}
          <View style={{ borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 14, gap: 10 }}>
            <View style={{ gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="megaphone" size={17} color="#dc2626" />
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#991b1b" }}>
                  High-Priority Management Escalation
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                Escalate HIGH or CRITICAL alert to Conservation Operations & Incident Response
              </Text>
            </View>

            {!isHighOrCritical ? (
              <View
                style={{
                  backgroundColor: "#f8fafc",
                  padding: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: "#e2e8f0",
                }}
              >
                <Text style={{ fontSize: 12, color: colors.muted, fontStyle: "italic" }}>
                  Management escalation to Incident Response is restricted to HIGH and CRITICAL alerts only. (Current: {alert.riskLevel})
                </Text>
              </View>
            ) : isAlreadyEscalated ? (
              <View
                style={{
                  backgroundColor: "#fff7ed",
                  borderColor: "#fed7aa",
                  borderWidth: 1,
                  borderRadius: 8,
                  padding: 10,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="checkmark-circle" size={16} color="#c2410c" />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#9a3412" }}>
                    Active Escalation in Progress
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: "#c2410c" }}>
                  This alert has already been escalated to Incident Response. Duplicate active escalation is locked.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text }}>
                      Escalation Reason:
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: escalationReason.trim().length >= 10 ? colors.green : colors.muted,
                      }}
                    >
                      {escalationReason.length}/1000 (min 10)
                    </Text>
                  </View>

                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 8,
                      padding: 10,
                      fontSize: 13,
                      color: colors.dark,
                      backgroundColor: "#fff",
                      minHeight: 70,
                      textAlignVertical: "top",
                    }}
                    multiline
                    numberOfLines={3}
                    placeholder="Provide justification for Conservation Operations & Incident Response dispatch (min 10 chars)..."
                    placeholderTextColor="#94a3b8"
                    value={escalationReason}
                    onChangeText={setEscalationReason}
                    maxLength={1000}
                  />
                </View>

                <Button
                  title="Escalate to Incident Response"
                  color="#dc2626"
                  loading={escalating}
                  disabled={escalating}
                  onPress={handleConfirmEscalation}
                />
              </View>
            )}
          </View>
        </View>
      )}

      {/* Bottom Actions: Share & Acknowledge */}
      <View style={{ gap: 10, paddingBottom: 24, marginTop: 8 }}>
        <Button
          title={
            isResolved
              ? "Alert Resolved (No Action Needed)"
              : isExpired
              ? "Notice Expired"
              : isAck
              ? "✓ Alert Acknowledged"
              : "Acknowledge This Alert"
          }
          disabled={isAck || isResolved || isExpired || acknowledging}
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
