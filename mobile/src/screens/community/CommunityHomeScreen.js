import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Screen from "../../components/common/Screen";
import Avatar from "../../components/common/Avatar";
import Button from "../../components/common/Button";
import { useAuth } from "../../hooks/useAuth";
import { listAlerts } from "../../services/alertApi";
import { listMyReports } from "../../services/communityReportApi";
import { colors, styles } from "../../constants/theme";
import { rangerStyles as ui } from "../../constants/rangerTheme";

const STATUS_STYLE = {
  PENDING: { bg: "#fef9c3", text: "#854d0e", border: "#facc15" },
  UNDER_REVIEW: { bg: "#e0f2fe", text: "#0369a1", border: "#38bdf8" },
  RESPONSE_IN_PROGRESS: { bg: "#ffedd5", text: "#c2410c", border: "#fb923c" },
  RESOLVED: { bg: "#dcfce7", text: "#15803d", border: "#86efac" },
  REJECTED: { bg: "#f1f5f9", text: "#64748b", border: "#cbd5e1" },
};

function ActionCard({ title, detail, icon, iconColor = colors.green, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={detail}
      onPress={onPress}
      style={({ pressed }) => [
        ui.card,
        {
          flex: 1,
          minWidth: 140,
          padding: 14,
          gap: 6,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          backgroundColor: colors.cream,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={{ ...styles.text, fontWeight: "700", fontSize: 14, lineHeight: 19 }}>
        {title}
      </Text>
      <Text style={{ ...styles.muted, fontSize: 12, lineHeight: 16 }}>{detail}</Text>
    </Pressable>
  );
}

export default function CommunityHomeScreen({ navigation }) {
  const { user } = useAuth();
  const { width, fontScale } = useWindowDimensions();

  const [alerts, setAlerts] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const firstName = user?.name ? user.name.trim().split(/\s+/)[0] : "Neighbor";

  async function loadDashboardData(isPull = false) {
    if (isPull) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [alertRes, reportRes] = await Promise.all([
        listAlerts({ status: "ACTIVE" }).catch(() => ({ alerts: [] })),
        listMyReports({ pageSize: 5 }).catch(() => ({ reports: [] })),
      ]);
      setAlerts(alertRes.alerts || []);
      setReports(reportRes.reports || []);
    } catch (err) {
      setError("Unable to load community dashboard data. Pull down to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  const unacknowledgedCount = alerts.filter((a) => !a.isAcknowledged).length;
  const topUrgentAlert = alerts.find((a) => a.riskLevel === "CRITICAL") || alerts[0];
  const latestReport = reports[0];

  function navigateToReport(type) {
    if (navigation?.navigate) {
      navigation.navigate("Report", { initialReportType: type });
    }
  }

  function navigateToAlerts() {
    if (navigation?.navigate) {
      navigation.navigate("SafetyAlerts");
    }
  }

  function navigateToMyReports() {
    if (navigation?.navigate) {
      navigation.navigate("MyReports");
    }
  }

  return (
    <Screen>
      {/* Brand Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <Image
          source={require("../../../assets/images/wildguard-logo.png")}
          resizeMode="contain"
          accessibilityLabel="WildGuard LK logo"
          style={{ width: 36, height: 36 }}
        />
        <Text style={{ fontSize: 17, fontWeight: "700", color: colors.dark }}>
          WildGuard LK
        </Text>
      </View>

      {/* Greeting */}
      <View style={{ gap: 2 }}>
        <Text accessibilityRole="header" style={ui.title}>
          Welcome, {firstName}.
        </Text>
        <Text style={styles.muted}>Community Wildlife Coordination & Safety</Text>
      </View>

      {/* Identity Card */}
      <View style={ui.identity}>
        <Avatar user={user} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ ...styles.text, fontSize: 14, fontWeight: "600" }}>
            Community Member
          </Text>
          <Text style={{ ...styles.muted, fontSize: 12 }}>
            {user?.email || "Community User"}
          </Text>
        </View>
      </View>

      {/* Error state */}
      {error ? (
        <View style={[styles.card, { alignItems: "center", gap: 8, padding: 14 }]}>
          <Text style={styles.error}>{error}</Text>
          <Button title="Retry" secondary onPress={() => loadDashboardData()} />
        </View>
      ) : null}

      {/* Loading state */}
      {loading ? (
        <View style={{ paddingVertical: 24, alignItems: "center", gap: 8 }}>
          <ActivityIndicator size="small" color={colors.green} />
          <Text style={styles.muted}>Syncing safety status...</Text>
        </View>
      ) : null}

      {/* Safety Alert Summary Banner */}
      {!loading && (
        <View style={{ gap: 8 }}>
          <Text style={styles.eyebrow}>PERIMETER SAFETY STATUS</Text>
          {alerts.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View safety alerts"
              onPress={navigateToAlerts}
              style={[
                styles.card,
                {
                  borderLeftWidth: 5,
                  borderLeftColor: topUrgentAlert?.riskLevel === "CRITICAL" ? "#ef4444" : "#f59e0b",
                  gap: 8,
                },
              ]}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons
                    name="warning"
                    size={16}
                    color={topUrgentAlert?.riskLevel === "CRITICAL" ? "#b91c1c" : "#b45309"}
                  />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.dark }}>
                    {alerts.length} Active Wildlife {alerts.length === 1 ? "Alert" : "Alerts"}
                  </Text>
                </View>
                {unacknowledgedCount > 0 && (
                  <View style={{ backgroundColor: "#fee2e2", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#991b1b" }}>
                      {unacknowledgedCount} Unread
                    </Text>
                  </View>
                )}
              </View>

              {topUrgentAlert && (
                <Text numberOfLines={2} style={{ fontSize: 13, color: colors.text, lineHeight: 18 }}>
                  {topUrgentAlert.message}
                </Text>
              )}

              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.green }}>
                  Open Safety Advisories
                </Text>
                <Ionicons name="chevron-forward" size={13} color={colors.green} />
              </View>
            </Pressable>
          ) : (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: colors.cream,
                padding: 14,
                borderRadius: 12,
              }}
            >
              <Ionicons name="shield-checkmark" size={24} color={colors.green} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.dark }}>
                  Perimeter Normal
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  No high-risk wildlife breaches currently active.
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Incident Reporting Quick Actions */}
      <View style={{ gap: 10 }}>
        <Text style={ui.section}>Report an Incident</Text>
        <Text style={[styles.muted, { marginTop: -6 }]}>
          Choose category to notify wildlife wardens immediately
        </Text>

        <View
          style={{
            flexDirection: width < 350 || fontScale > 1.3 ? "column" : "row",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <ActionCard
            title="Wildlife Sighting"
            detail="Spotted animals near boundaries"
            icon="eye-outline"
            onPress={() => navigateToReport("WILDLIFE_SIGHTING")}
          />
          <ActionCard
            title="Wildlife Conflict"
            detail="Crop damage or elephant threat"
            icon="alert-circle-outline"
            iconColor="#ea580c"
            onPress={() => navigateToReport("HUMAN_WILDLIFE_CONFLICT")}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <ActionCard
            title="Suspicious Activity"
            detail="Illegal entry, snares or poaching"
            icon="shield-outline"
            iconColor="#dc2626"
            onPress={() => navigateToReport("SUSPICIOUS_ACTIVITY")}
          />
        </View>
      </View>

      {/* Recent Report Summary */}
      {!loading && (
        <View style={{ gap: 8, marginTop: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={ui.section}>Recent Reports</Text>
            {reports.length > 0 && (
              <Pressable accessibilityRole="button" onPress={navigateToMyReports}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.green }}>
                  View All ({reports.length})
                </Text>
              </Pressable>
            )}
          </View>

          {latestReport ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View latest report details"
              onPress={navigateToMyReports}
              style={[styles.card, { gap: 8 }]}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.dark }}>
                  {latestReport.reportType.replace(/_/g, " ")}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: 5,
                    backgroundColor: (STATUS_STYLE[latestReport.status] || STATUS_STYLE.PENDING).bg,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "700",
                      color: (STATUS_STYLE[latestReport.status] || STATUS_STYLE.PENDING).text,
                    }}
                  >
                    {latestReport.status.replace(/_/g, " ")}
                  </Text>
                </View>
              </View>

              <Text numberOfLines={2} style={{ fontSize: 13, color: colors.text, lineHeight: 18 }}>
                {latestReport.description}
              </Text>

              <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 8 }}>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  {latestReport.manualLocation || "Location recorded"}
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  {new Date(latestReport.submittedAt || latestReport.createdAt).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>
            </Pressable>
          ) : (
            <View style={[styles.card, { alignItems: "center", padding: 18, gap: 6 }]}>
              <Ionicons name="document-text-outline" size={28} color={colors.muted} />
              <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>
                You have not filed any wildlife reports yet.
              </Text>
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}
