import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import { listAllReports, updateReportStatus } from "../../services/communityReportApi";
import { colors, styles } from "../../constants/theme";

const STATUS_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "UNDER_REVIEW", label: "Under Review" },
  { key: "RESPONSE_IN_PROGRESS", label: "In Progress" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "REJECTED", label: "Rejected" },
];

const STATUS_STYLE = {
  PENDING: { bg: "#fef9c3", text: "#854d0e", border: "#facc15" },
  UNDER_REVIEW: { bg: "#e0f2fe", text: "#0369a1", border: "#38bdf8" },
  RESPONSE_IN_PROGRESS: { bg: "#ffedd5", text: "#c2410c", border: "#fb923c" },
  RESOLVED: { bg: "#dcfce7", text: "#15803d", border: "#86efac" },
  REJECTED: { bg: "#f1f5f9", text: "#64748b", border: "#cbd5e1" },
};

export default function LiaisonReviewScreen() {
  const [filter, setFilter] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");

  async function fetchReports(isPull = false) {
    if (isPull) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const params = {
        ...(filter !== "ALL" && { status: filter }),
        ...(search.trim() && { search: search.trim() }),
      };
      const data = await listAllReports(params);
      setReports(data.reports || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Could not load reports for review.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchReports();
  }, [filter]);

  async function handleStatusChange(reportId, nextStatus) {
    Alert.alert(
      "Confirm Status Update",
      `Are you sure you want to change this report status to "${nextStatus.replace(/_/g, " ")}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setUpdatingId(reportId);
            try {
              await updateReportStatus(reportId, nextStatus);
              await fetchReports();
            } catch (err) {
              Alert.alert(
                "Update Failed",
                err.response?.data?.message || err.message || "Could not update status."
              );
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]
    );
  }

  function callReporter(phone) {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert("Call Failed", `Could not place call to ${phone}`);
    });
  }

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Text style={styles.eyebrow}>COMMUNITY LIAISON DESK</Text>
        <Text style={styles.title}>Incident Report Review</Text>
        <Text style={styles.muted}>
          Review incoming sightings, dispatch conflict response, and track resolutions.
        </Text>
      </View>

      {/* Search Input */}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <TextInput
          placeholder="Search species, location, description..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => fetchReports()}
          style={[styles.input, { flex: 1, minHeight: 46, fontSize: 14 }]}
        />
        <Button
          title="Search"
          secondary
          onPress={() => fetchReports()}
        />
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
          <Text style={styles.muted}>Loading community reports...</Text>
        </View>
      ) : reports.length === 0 ? (
        <View style={[styles.card, { alignItems: "center", padding: 32, gap: 10 }]}>
          <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.green} />
          <Text style={[styles.heading, { textAlign: "center" }]}>No Reports Found</Text>
          <Text style={[styles.muted, { textAlign: "center", fontSize: 13 }]}>
            No reports matching the selected filters.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {reports.map((item) => {
            const st = STATUS_STYLE[item.status] || STATUS_STYLE.PENDING;
            const isUpdating = updatingId === item.id;
            const dateStr = new Date(item.submittedAt || item.createdAt).toLocaleString([], {
              dateStyle: "medium",
              timeStyle: "short",
            });

            return (
              <View
                key={item.id}
                style={[styles.card, { gap: 12 }]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: colors.dark }}>
                      {item.reportType.replace(/_/g, " ")}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>{dateStr}</Text>
                  </View>
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
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="paw" size={15} color={colors.green} />
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.green }}>
                      {item.species}
                    </Text>
                  </View>
                )}

                <Text style={{ fontSize: 14, color: colors.text, lineHeight: 21 }}>
                  {item.description}
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="location-outline" size={15} color={colors.muted} />
                  <Text style={{ fontSize: 13, color: colors.muted }}>
                    {item.manualLocation || (item.latitude ? `GPS: ${item.latitude}, ${item.longitude}` : "No specific location")}
                  </Text>
                </View>

                {/* Reporter Contact Info */}
                <View style={{ backgroundColor: colors.background, padding: 10, borderRadius: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ gap: 2 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
                      Reporter: {item.reporterName || (item.reporter ? item.reporter.name : "Anonymous")}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      Phone: {item.reporterPhone || "Not provided"}
                    </Text>
                  </View>
                  {item.reporterPhone && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => callReporter(item.reporterPhone)}
                      style={{
                        backgroundColor: colors.cream,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Ionicons name="call-outline" size={14} color={colors.green} />
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.green }}>Call</Text>
                    </Pressable>
                  )}
                </View>

                {/* Evidence Photos */}
                {item.evidence && item.evidence.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {item.evidence.map((ev, i) => (
                      <Image
                        key={ev.id || i}
                        source={{ uri: ev.fileUrl }}
                        style={{ width: 90, height: 90, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
                      />
                    ))}
                  </ScrollView>
                )}

                {/* Action Buttons for Triage */}
                <View style={{ borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 10, gap: 8 }}>
                  {isUpdating ? (
                    <ActivityIndicator size="small" color={colors.green} />
                  ) : (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {item.status === "PENDING" && (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => handleStatusChange(item.id, "UNDER_REVIEW")}
                          style={{
                            flex: 1,
                            backgroundColor: colors.green,
                            padding: 10,
                            borderRadius: 8,
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ color: colors.white, fontWeight: "700", fontSize: 13 }}>
                            Start Review
                          </Text>
                        </Pressable>
                      )}

                      {item.status === "UNDER_REVIEW" && (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => handleStatusChange(item.id, "RESPONSE_IN_PROGRESS")}
                          style={{
                            flex: 1,
                            backgroundColor: "#ea580c",
                            padding: 10,
                            borderRadius: 8,
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ color: colors.white, fontWeight: "700", fontSize: 13 }}>
                            Dispatch Response
                          </Text>
                        </Pressable>
                      )}

                      {(item.status === "RESPONSE_IN_PROGRESS" || item.status === "UNDER_REVIEW") && (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => handleStatusChange(item.id, "RESOLVED")}
                          style={{
                            flex: 1,
                            backgroundColor: "#16a34a",
                            padding: 10,
                            borderRadius: 8,
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ color: colors.white, fontWeight: "700", fontSize: 13 }}>
                            Mark Resolved
                          </Text>
                        </Pressable>
                      )}

                      {item.status !== "REJECTED" && item.status !== "RESOLVED" && (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => handleStatusChange(item.id, "REJECTED")}
                          style={{
                            padding: 10,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: colors.border,
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 13 }}>
                            Reject
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
