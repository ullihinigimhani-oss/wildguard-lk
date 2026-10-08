import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
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
import {
  listAllReports,
  updateReportStatus,
  escalateReport,
  getReportById,
} from "../../services/communityReportApi";
import { colors, styles } from "../../constants/theme";

export const STATUS_FILTERS = [
  { key: "ALL", label: "All Statuses" },
  { key: "PENDING", label: "Pending" },
  { key: "UNDER_REVIEW", label: "Under Review" },
  { key: "RESPONSE_IN_PROGRESS", label: "Operational" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "REJECTED", label: "Rejected" },
];

export const TYPE_FILTERS = [
  { key: "ALL", label: "All Types" },
  { key: "WILDLIFE_SIGHTING", label: "Sightings" },
  { key: "HUMAN_WILDLIFE_CONFLICT", label: "Conflicts" },
  { key: "SUSPICIOUS_ACTIVITY", label: "Suspicious" },
];

export const STATUS_STYLE = {
  PENDING: { bg: "#fef9c3", text: "#854d0e", border: "#facc15", label: "Pending" },
  UNDER_REVIEW: { bg: "#e0f2fe", text: "#0369a1", border: "#38bdf8", label: "Under Review" },
  RESPONSE_IN_PROGRESS: { bg: "#ffedd5", text: "#c2410c", border: "#fb923c", label: "In Progress" },
  RESOLVED: { bg: "#dcfce7", text: "#15803d", border: "#86efac", label: "Resolved" },
  REJECTED: { bg: "#f1f5f9", text: "#64748b", border: "#cbd5e1", label: "Rejected" },
};

export function formatDateTime(isoString) {
  if (!isoString) return "Date not recorded";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "Date not recorded";
    const dateStr = d.toLocaleDateString([], {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timeStr = d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dateStr} · ${timeStr}`;
  } catch (_) {
    return "Date not recorded";
  }
}

export function formatLocationSummary(item) {
  if (!item) return "Location not recorded";
  if (item.manualLocation && item.latitude != null && item.longitude != null) {
    return `${item.manualLocation} (${Number(item.latitude).toFixed(4)}, ${Number(item.longitude).toFixed(4)})`;
  }
  if (item.manualLocation) {
    return item.manualLocation;
  }
  if (item.latitude != null && item.longitude != null) {
    return `GPS: ${Number(item.latitude).toFixed(4)}, ${Number(item.longitude).toFixed(4)}`;
  }
  return "Location not recorded";
}

export default function LiaisonReviewScreen() {
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");

  // Detailed Modal View
  const [selectedReport, setSelectedReport] = useState(null);

  // Escalation Modal
  const [escalatingReport, setEscalatingReport] = useState(null);
  const [escalationUrgency, setEscalationUrgency] = useState("HIGH");
  const [escalationNotes, setEscalationNotes] = useState("");
  const [escalating, setEscalating] = useState(false);

  async function fetchReports(targetPage = 1, isPull = false) {
    if (isPull) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const params = {
        ...(statusFilter !== "ALL" && { status: statusFilter }),
        ...(typeFilter !== "ALL" && { reportType: typeFilter }),
        ...(search.trim() && { search: search.trim() }),
        page: targetPage,
        pageSize,
      };
      const data = (await listAllReports(params)) || {};
      setReports(data.reports || []);
      setTotal(data.total != null ? data.total : (data.reports || []).length);
      setPage(targetPage);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Could not load reports for review.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchReports(1);
  }, [statusFilter, typeFilter]);

  async function handleStatusChange(reportId, nextStatus, label = null) {
    const displayLabel = label || nextStatus.replace(/_/g, " ");
    Alert.alert(
      "Confirm Status Update",
      `Are you sure you want to change this report status to "${displayLabel}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setUpdatingId(reportId);
            try {
              await updateReportStatus(reportId, nextStatus);
              if (selectedReport && selectedReport.id === reportId) {
                setSelectedReport((prev) => (prev ? { ...prev, status: nextStatus } : null));
              }
              await fetchReports(page);
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

  async function handleConfirmEscalation() {
    if (!escalatingReport) return;
    setEscalating(true);
    try {
      await escalateReport(escalatingReport.id, {
        urgency: escalationUrgency,
        notes: escalationNotes.trim() || undefined,
      });
      Alert.alert(
        "Escalated Successfully",
        `Report has been dispatched for operational response (${escalationUrgency} priority).`
      );
      setEscalatingReport(null);
      setEscalationNotes("");
      if (selectedReport && selectedReport.id === escalatingReport.id) {
        setSelectedReport((prev) => (prev ? { ...prev, status: "RESPONSE_IN_PROGRESS" } : null));
      }
      await fetchReports(page);
    } catch (err) {
      Alert.alert(
        "Escalation Failed",
        err.response?.data?.message || err.message || "Could not escalate report."
      );
    } finally {
      setEscalating(false);
    }
  }

  function callReporter(phone) {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert("Call Failed", `Could not place call to ${phone}`);
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchReports(1, true)}
          tintColor={colors.green}
          colors={[colors.green]}
        />
      }
    >
      <View style={{ gap: 4 }}>
        <Text style={styles.eyebrow}>COMMUNITY LIAISON DESK</Text>
        <Text style={styles.title}>Community Report Review</Text>
        <Text style={styles.muted}>
          Review incoming sightings, dispatch operational conflict responses, and manage report triage.
        </Text>
      </View>

      {/* Search Input */}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <View style={{ flex: 1, position: "relative", justifyContent: "center" }}>
          <TextInput
            placeholder="Search species, location, description..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => fetchReports(1)}
            style={[styles.input, { minHeight: 46, fontSize: 14, paddingRight: search ? 36 : 12 }]}
          />
          {search ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => {
                setSearch("");
                fetchReports(1);
              }}
              style={{ position: "absolute", right: 10, padding: 4 }}
            >
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <Button
          title="Search"
          secondary
          onPress={() => fetchReports(1)}
        />
      </View>

      {/* Status Filter Tabs */}
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase" }}>
          Status Filter
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
        >
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.key;
            return (
              <Pressable
                key={f.key}
                accessibilityRole="tab"
                accessibilityLabel={`Status ${f.label}`}
                accessibilityState={{ selected: active }}
                onPress={() => setStatusFilter(f.key)}
                style={{
                  paddingHorizontal: 13,
                  paddingVertical: 6,
                  borderRadius: 18,
                  backgroundColor: active ? colors.green : colors.white,
                  borderWidth: 1,
                  borderColor: active ? colors.green : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
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
      </View>

      {/* Report Type Filter Chips */}
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase" }}>
          Category Filter
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
        >
          {TYPE_FILTERS.map((t) => {
            const active = typeFilter === t.key;
            return (
              <Pressable
                key={t.key}
                accessibilityRole="tab"
                accessibilityLabel={`Category ${t.label}`}
                accessibilityState={{ selected: active }}
                onPress={() => setTypeFilter(t.key)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 14,
                  backgroundColor: active ? colors.dark : "#f1f5f9",
                  borderWidth: 1,
                  borderColor: active ? colors.dark : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: active ? "700" : "500",
                    color: active ? colors.white : colors.text,
                  }}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Error state */}
      {error ? (
        <View style={[styles.card, { alignItems: "center", gap: 10, padding: 20 }]}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.red || "#dc2626"} />
          <Text style={[styles.error, { textAlign: "center" }]}>{error}</Text>
          <Button title="Retry" secondary onPress={() => fetchReports(page)} />
        </View>
      ) : loading ? (
        /* Loading state */
        <View style={{ paddingVertical: 40, alignItems: "center", gap: 10 }}>
          <ActivityIndicator size="large" color={colors.green} testID="loading-indicator" />
          <Text style={styles.muted}>Loading community reports for review...</Text>
        </View>
      ) : reports.length === 0 ? (
        /* Empty state */
        <View style={[styles.card, { alignItems: "center", padding: 32, gap: 10 }]}>
          <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.green} />
          <Text style={[styles.heading, { textAlign: "center" }]}>No Reports Found</Text>
          <Text style={[styles.muted, { textAlign: "center", fontSize: 13 }]}>
            No reports currently matching the selected filters.
          </Text>
          {(statusFilter !== "ALL" || typeFilter !== "ALL" || search) && (
            <Button
              title="Reset Filters"
              secondary
              onPress={() => {
                setStatusFilter("ALL");
                setTypeFilter("ALL");
                setSearch("");
              }}
            />
          )}
        </View>
      ) : (
        /* Report List */
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}>
              Showing {reports.length} of {total} {total === 1 ? "report" : "reports"}
            </Text>
          </View>

          {reports.map((item) => {
            const st = STATUS_STYLE[item.status] || STATUS_STYLE.PENDING;
            const isUpdating = updatingId === item.id;
            const formattedDate = formatDateTime(item.submittedAt || item.createdAt);
            const locationSummary = formatLocationSummary(item);
            const isConflict = item.reportType === "HUMAN_WILDLIFE_CONFLICT";
            const isSuspicious = item.reportType === "SUSPICIOUS_ACTIVITY";
            const evidenceCount = item.evidence?.length || 0;

            return (
              <View
                key={item.id}
                style={[
                  styles.card,
                  {
                    gap: 12,
                    borderLeftWidth: isConflict ? 4 : isSuspicious ? 4 : 1,
                    borderLeftColor: isConflict ? "#ea580c" : isSuspicious ? "#dc2626" : colors.border,
                  },
                ]}
              >
                {/* Header: Report Type, Urgency Badge, Status */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.dark }}>
                        {item.reportType.replace(/_/g, " ")}
                      </Text>
                      {item.isAnonymous && (
                        <View style={{ backgroundColor: "#f1f5f9", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ fontSize: 10, fontWeight: "700", color: colors.muted }}>ANONYMOUS</Text>
                        </View>
                      )}
                      {isConflict && (
                        <View style={{ backgroundColor: "#ffedd5", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ fontSize: 10, fontWeight: "700", color: "#c2410c" }}>CONFLICT RESPONSE</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 11, color: colors.muted }}>{formattedDate}</Text>
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

                {/* Species */}
                {item.species ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="paw" size={15} color={colors.green} />
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.green }}>
                      Species: {item.species}
                    </Text>
                  </View>
                ) : null}

                {/* Description */}
                <Text style={{ fontSize: 14, color: colors.text, lineHeight: 21 }}>
                  {item.description}
                </Text>

                {/* Location Summary */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="location-outline" size={15} color={colors.muted} />
                  <Text style={{ fontSize: 13, color: colors.muted }} numberOfLines={2}>
                    {locationSummary}
                  </Text>
                </View>

                {/* Reporter Contact Info — Privacy Preserved */}
                <View
                  style={{
                    backgroundColor: colors.background,
                    padding: 10,
                    borderRadius: 8,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View style={{ gap: 2, flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons
                        name={item.isAnonymous ? "shield-checkmark-outline" : "person-outline"}
                        size={13}
                        color={item.isAnonymous ? colors.green : colors.muted}
                      />
                      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
                        Reporter: {item.isAnonymous ? "Anonymous Community Member" : (item.reporterName || (item.reporter ? item.reporter.name : "Community Member"))}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: colors.muted }}>
                      Phone: {item.isAnonymous ? "Protected (Anonymous Report)" : (item.reporterPhone || "Not provided")}
                    </Text>
                  </View>
                  {!item.isAnonymous && item.reporterPhone ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Call reporter"
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
                  ) : null}
                </View>

                {/* Evidence Indicator & Thumbnails */}
                {evidenceCount > 0 ? (
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>
                      Evidence Files ({evidenceCount}):
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {item.evidence.map((ev, i) => (
                        <Image
                          key={ev.id || i}
                          source={{ uri: ev.fileUrl }}
                          accessibilityLabel={`Evidence file ${i + 1}`}
                          style={{ width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
                        />
                      ))}
                    </ScrollView>
                  </View>
                ) : null}

                {/* Action Buttons for Triage & Operational Escalation */}
                <View style={{ borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 10, gap: 8 }}>
                  {isUpdating ? (
                    <ActivityIndicator size="small" color={colors.green} />
                  ) : (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {/* Step 1: Start Review */}
                      {item.status === "PENDING" && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Start Review"
                          onPress={() => handleStatusChange(item.id, "UNDER_REVIEW")}
                          style={{
                            flex: 1,
                            minWidth: 110,
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

                      {/* Step 2: Dispatch / Escalate Response */}
                      {(item.status === "PENDING" || item.status === "UNDER_REVIEW") && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Dispatch Response"
                          onPress={() => {
                            setEscalatingReport(item);
                            setEscalationUrgency(isConflict ? "HIGH" : "MEDIUM");
                            setEscalationNotes("");
                          }}
                          style={{
                            flex: 1,
                            minWidth: 130,
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

                      {/* Step 3: Mark Resolved */}
                      {(item.status === "RESPONSE_IN_PROGRESS" || item.status === "UNDER_REVIEW") && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Mark Resolved"
                          onPress={() => handleStatusChange(item.id, "RESOLVED")}
                          style={{
                            flex: 1,
                            minWidth: 110,
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

                      {/* Step 4: Reject / Invalidate */}
                      {item.status !== "REJECTED" && item.status !== "RESOLVED" && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Reject Report"
                          onPress={() => handleStatusChange(item.id, "REJECTED", "Invalid / Duplicate")}
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 12,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                marginTop: 4,
              }}
            >
              <Button
                title="Previous"
                secondary
                disabled={page <= 1}
                onPress={() => fetchReports(page - 1)}
              />
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>
                Page {page} of {totalPages}
              </Text>
              <Button
                title="Next"
                secondary
                disabled={page >= totalPages}
                onPress={() => fetchReports(page + 1)}
              />
            </View>
          )}
        </View>
      )}

      {/* Escalation Modal */}
      <Modal
        visible={Boolean(escalatingReport)}
        transparent
        animationType="fade"
        onRequestClose={() => setEscalatingReport(null)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}>
          <View style={[styles.card, { padding: 20, gap: 14 }]}>
            {escalatingReport && (
              <>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.eyebrow}>OPERATIONAL ESCALATION</Text>
                    <Text style={styles.heading}>Dispatch Response</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close escalation modal"
                    onPress={() => setEscalatingReport(null)}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="close" size={24} color={colors.text} />
                  </Pressable>
                </View>

                <Text style={{ fontSize: 13, color: colors.text }}>
                  Escalate this report to activate wildlife response teams and change status to In Progress.
                </Text>

                <View style={{ gap: 6 }}>
                  <Text style={styles.label}>Dispatch Urgency:</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {["HIGH", "MEDIUM", "LOW"].map((u) => {
                      const active = escalationUrgency === u;
                      return (
                        <Pressable
                          key={u}
                          accessibilityRole="button"
                          onPress={() => setEscalationUrgency(u)}
                          style={{
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 8,
                            backgroundColor: active ? (u === "HIGH" ? "#dc2626" : colors.dark) : "#f1f5f9",
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ color: active ? colors.white : colors.text, fontWeight: "700", fontSize: 12 }}>
                            {u}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={styles.label}>Review Notes (Optional):</Text>
                  <TextInput
                    placeholder="E.g. Sent patrol unit, contacted area ranger..."
                    placeholderTextColor={colors.muted}
                    value={escalationNotes}
                    onChangeText={setEscalationNotes}
                    multiline
                    numberOfLines={3}
                    style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]}
                  />
                </View>

                <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Cancel"
                      secondary
                      onPress={() => setEscalatingReport(null)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={escalating ? "Dispatching..." : "Confirm Dispatch"}
                      disabled={escalating}
                      onPress={handleConfirmEscalation}
                    />
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
