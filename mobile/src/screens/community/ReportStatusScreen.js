import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import { listMyReports } from "../../services/communityReportApi";
import { colors, styles } from "../../constants/theme";

const STATUS_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "UNDER_REVIEW", label: "Under Review" },
  { key: "RESPONSE_IN_PROGRESS", label: "In Progress" },
  { key: "RESOLVED", label: "Resolved" },
];

const STATUS_STYLE = {
  PENDING: { bg: "#fef9c3", text: "#854d0e", border: "#facc15" },
  UNDER_REVIEW: { bg: "#e0f2fe", text: "#0369a1", border: "#38bdf8" },
  RESPONSE_IN_PROGRESS: { bg: "#ffedd5", text: "#c2410c", border: "#fb923c" },
  RESOLVED: { bg: "#dcfce7", text: "#15803d", border: "#86efac" },
  REJECTED: { bg: "#f1f5f9", text: "#64748b", border: "#cbd5e1" },
};

export default function ReportStatusScreen({ navigation }) {
  const [filter, setFilter] = useState("ALL");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selectedReport, setSelectedReport] = useState(null);

  async function fetchReports(isPull = false) {
    if (isPull) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const params = filter !== "ALL" ? { status: filter } : {};
      const data = await listMyReports(params);
      setReports(data.reports || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Could not load report history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchReports();
  }, [filter]);

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Text style={styles.eyebrow}>TRACKING & RESOLUTION</Text>
        <Text style={styles.title}>My Report History</Text>
        <Text style={styles.muted}>
          View response progress on incidents and wildlife reports you submitted.
        </Text>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
      >
        {STATUS_FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(f.key)}
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
          <Button title="Retry" secondary onPress={() => fetchReports()} />
        </View>
      ) : loading ? (
        <View style={{ paddingVertical: 40, alignItems: "center", gap: 10 }}>
          <ActivityIndicator size="large" color={colors.green} />
          <Text style={styles.muted}>Loading report records...</Text>
        </View>
      ) : reports.length === 0 ? (
        <View style={[styles.card, { alignItems: "center", padding: 32, gap: 12 }]}>
          <Ionicons name="document-text-outline" size={48} color={colors.muted} />
          <Text style={[styles.heading, { textAlign: "center" }]}>No Reports Found</Text>
          <Text style={[styles.muted, { textAlign: "center", fontSize: 13 }]}>
            {filter === "ALL"
              ? "You haven't filed any wildlife reports yet."
              : `No reports currently matching "${filter.replace(/_/g, " ")}".`}
          </Text>
          {navigation?.navigate && (
            <Button
              title="Report an Incident"
              onPress={() => navigation.navigate("Report")}
            />
          )}
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {reports.map((item) => {
            const st = STATUS_STYLE[item.status] || STATUS_STYLE.PENDING;
            const dateStr = new Date(item.submittedAt || item.createdAt).toLocaleDateString([], {
              day: "numeric",
              month: "short",
              year: "numeric",
            });

            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => setSelectedReport(item)}
                style={({ pressed }) => ({
                  backgroundColor: colors.white,
                  borderRadius: 14,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 10,
                  opacity: pressed ? 0.85 : 1,
                  shadowColor: colors.dark,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 5,
                  elevation: 2,
                })}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.dark }}>
                    {item.reportType.replace(/_/g, " ")}
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                      backgroundColor: st.bg,
                      borderWidth: 1,
                      borderColor: st.border,
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: "700", color: st.text }}>
                      {item.status.replace(/_/g, " ")}
                    </Text>
                  </View>
                </View>

                {item.species && (
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.green }}>
                    Species: {item.species}
                  </Text>
                )}

                <Text
                  numberOfLines={2}
                  style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}
                >
                  {item.description}
                </Text>

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ionicons name="location-outline" size={13} color={colors.muted} />
                    <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>
                      {item.manualLocation || (item.latitude ? `${item.latitude}, ${item.longitude}` : "Location recorded")}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.muted }}>{dateStr}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Details Modal */}
      <Modal
        visible={Boolean(selectedReport)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedReport(null)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}>
          <View style={[styles.card, { maxHeight: "85%", padding: 20, gap: 14 }]}>
            {selectedReport && (
              <>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.eyebrow}>INCIDENT DETAILS</Text>
                    <Text style={styles.heading}>
                      {selectedReport.reportType.replace(/_/g, " ")}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSelectedReport(null)}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="close" size={24} color={colors.text} />
                  </Pressable>
                </View>

                <ScrollView contentContainerStyle={{ gap: 12 }}>
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <Text style={styles.label}>Status:</Text>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: (STATUS_STYLE[selectedReport.status] || STATUS_STYLE.PENDING).bg,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: (STATUS_STYLE[selectedReport.status] || STATUS_STYLE.PENDING).text,
                        }}
                      >
                        {selectedReport.status.replace(/_/g, " ")}
                      </Text>
                    </View>
                  </View>

                  {selectedReport.species && (
                    <View>
                      <Text style={styles.label}>Reported Species:</Text>
                      <Text style={styles.text}>{selectedReport.species}</Text>
                    </View>
                  )}

                  <View>
                    <Text style={styles.label}>Description:</Text>
                    <Text style={styles.text}>{selectedReport.description}</Text>
                  </View>

                  <View>
                    <Text style={styles.label}>Location:</Text>
                    <Text style={styles.text}>
                      {selectedReport.manualLocation || "Not provided"}
                      {selectedReport.latitude && ` (Lat: ${selectedReport.latitude}, Long: ${selectedReport.longitude})`}
                    </Text>
                  </View>

                  <View>
                    <Text style={styles.label}>Submitted On:</Text>
                    <Text style={styles.text}>
                      {new Date(selectedReport.submittedAt || selectedReport.createdAt).toLocaleString()}
                    </Text>
                  </View>

                  {selectedReport.evidence && selectedReport.evidence.length > 0 && (
                    <View style={{ gap: 6 }}>
                      <Text style={styles.label}>Attached Evidence ({selectedReport.evidence.length}):</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        {selectedReport.evidence.map((ev, i) => (
                          <Image
                            key={ev.id || i}
                            source={{ uri: ev.fileUrl }}
                            style={{ width: 100, height: 100, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </ScrollView>

                <Button title="Close" secondary onPress={() => setSelectedReport(null)} />
              </>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
