import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library/legacy";
import Ionicons from "@expo/vector-icons/Ionicons";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import {
  listMyReports,
  getReportById,
  resolveEvidenceUrl,
} from "../../services/communityReportApi";
import { colors, styles } from "../../constants/theme";

export const STATUS_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "UNDER_REVIEW", label: "Under Review" },
  { key: "RESPONSE_IN_PROGRESS", label: "In Progress" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "REJECTED", label: "Rejected" },
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

export default function ReportStatusScreen({ navigation }) {
  const [filter, setFilter] = useState("ALL");
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selectedReport, setSelectedReport] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [previewEvidence, setPreviewEvidence] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [downloadMessage, setDownloadMessage] = useState("");
  const [downloadingEvidence, setDownloadingEvidence] = useState(false);

  async function fetchReports(targetPage = 1, isPull = false) {
    if (isPull) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const params = {
        ...(filter !== "ALL" && { status: filter }),
        page: targetPage,
        pageSize,
      };
      const data = await listMyReports(params);
      setReports(data.reports || []);
      setTotal(data.total != null ? data.total : (data.reports || []).length);
      setPage(targetPage);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Could not load report history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchReports(1);
  }, [filter]);

  async function handleOpenDetails(item) {
    setSelectedReport(item);
    setPreviewEvidence(null);
    setLoadingDetails(true);
    setDetailsError("");

    try {
      const fresh = await getReportById(item.id);
      if (fresh) {
        setSelectedReport(fresh);
      }
    } catch (err) {
      setDetailsError(err.response?.data?.message || err.message || "Could not refresh report details.");
    } finally {
      setLoadingDetails(false);
    }
  }

  function openEvidencePreview(evidence, index) {
    setDownloadMessage("");
    setPreviewError("");
    try {
      setPreviewEvidence({
        ...evidence,
        index,
        url: resolveEvidenceUrl(evidence.fileUrl),
      });
    } catch (failure) {
      setPreviewEvidence({ ...evidence, index, url: null });
      setPreviewError(
        failure.message || "The evidence image could not be opened.",
      );
    }
  }

  async function downloadEvidence() {
    if (!previewEvidence?.url || downloadingEvidence) return;

    const fileType = (previewEvidence.fileType || "").toLowerCase();
    const extension = fileType.includes("png")
      ? "png"
      : fileType.includes("webp")
        ? "webp"
        : fileType.includes("gif")
          ? "gif"
          : "jpg";
    const filename = `wildguard-evidence-${previewEvidence.index + 1}-${Date.now()}.${extension}`;
    setDownloadingEvidence(true);
    setDownloadMessage("");

    try {
      if (Platform.OS === "web") {
        if (typeof document === "undefined") {
          throw new Error("Image downloads are unavailable in this browser.");
        }
        const link = document.createElement("a");
        link.href = previewEvidence.url;
        link.download = filename;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setDownloadMessage("Image download started.");
      } else {
        const permission = await MediaLibrary.requestPermissionsAsync(
          true,
          ["photo"],
        );
        if (!permission.granted) {
          throw new Error("Photo library permission is needed to save this image.");
        }
        const destination = new File(Paths.cache, filename);
        const downloaded = await File.downloadFileAsync(
          previewEvidence.url,
          destination,
          { idempotent: true },
        );
        await MediaLibrary.saveToLibraryAsync(downloaded.uri);
        setDownloadMessage("Image saved to your photo library.");
      }
    } catch (failure) {
      setDownloadMessage(
        failure.message || "Could not download this evidence image.",
      );
    } finally {
      setDownloadingEvidence(false);
    }
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
        <Text style={styles.eyebrow}>COMMUNITY REPORT TRACKING</Text>
        <Text style={styles.title}>My Reports</Text>
        <Text style={styles.muted}>
          Track response progress, status updates, and ranger actions on reports you filed.
        </Text>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 6,
          paddingHorizontal: 2,
        }}
      >
        {STATUS_FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              accessibilityRole="tab"
              accessibilityLabel={`Filter ${f.label}`}
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(f.key)}
              style={({ pressed }) => ({
                height: 36,
                paddingHorizontal: 16,
                borderRadius: 18,
                backgroundColor: active ? colors.green : colors.white,
                borderWidth: 1.5,
                borderColor: active ? colors.green : colors.border,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                alignSelf: "flex-start",
                opacity: pressed ? 0.8 : 1,
                ...Platform.select({
                  web: {
                    cursor: "pointer",
                    boxShadow: active ? "0 2px 4px rgba(36, 91, 68, 0.15)" : "none",
                  },
                  default: {
                    elevation: active ? 2 : 0,
                  },
                }),
              })}
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
          <Text style={styles.muted}>Loading report records...</Text>
        </View>
      ) : reports.length === 0 ? (
        /* Empty state */
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
        /* Report List */
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}>
              Showing {reports.length} of {total} {total === 1 ? "report" : "reports"}
            </Text>
          </View>

          {reports.map((item) => {
            const st = STATUS_STYLE[item.status] || STATUS_STYLE.PENDING;
            const formattedDate = formatDateTime(item.submittedAt || item.createdAt);
            const locationSummary = formatLocationSummary(item);
            const evidenceCount = item.evidence?.length || 0;

            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Open report: ${item.reportType}`}
                onPress={() => handleOpenDetails(item)}
                style={({ pressed }) => ({
                  backgroundColor: colors.white,
                  borderRadius: 14,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 10,
                  opacity: pressed ? 0.85 : 1,
                  ...Platform.select({
                    web: {
                      boxShadow: "0px 2px 5px rgba(0, 0, 0, 0.04)",
                    },
                    default: {
                      shadowColor: colors.dark,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.04,
                      shadowRadius: 5,
                      elevation: 2,
                    },
                  }),
                })}
              >
                {/* Header: Report Type, Anonymous Chip, Status */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, flexWrap: "wrap" }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.dark }}>
                      {item.reportType.replace(/_/g, " ")}
                    </Text>
                    {item.isAnonymous && (
                      <View style={{ backgroundColor: "#f1f5f9", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: colors.muted }}>ANONYMOUS</Text>
                      </View>
                    )}
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
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.green }}>
                    Species: {item.species}
                  </Text>
                ) : null}

                {/* Description */}
                <Text
                  numberOfLines={2}
                  style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}
                >
                  {item.description}
                </Text>

                {/* Evidence Indicator & Previews */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons
                    name={evidenceCount > 0 ? "images-outline" : "image-outline"}
                    size={14}
                    color={evidenceCount > 0 ? colors.green : colors.muted}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: evidenceCount > 0 ? "600" : "400",
                      color: evidenceCount > 0 ? colors.green : colors.muted,
                    }}
                  >
                    {evidenceCount > 0
                      ? `${evidenceCount} ${evidenceCount === 1 ? "evidence item" : "evidence items"}`
                      : "No evidence attached"}
                  </Text>
                </View>

                {/* Location Summary and Date/Time */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderTopWidth: 1,
                    borderTopColor: "#f1f5f9",
                    paddingTop: 8,
                    gap: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1 }}>
                    <Ionicons name="location-outline" size={13} color={colors.muted} />
                    <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>
                      {locationSummary}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.muted }}>{formattedDate}</Text>
                </View>
              </Pressable>
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

      {/* Details Modal */}
      <Modal
        visible={Boolean(selectedReport && !previewEvidence)}
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
                    <Text style={styles.eyebrow}>REPORT DETAILS</Text>
                    <Text style={styles.heading}>
                      {selectedReport.reportType.replace(/_/g, " ")}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close details modal"
                    onPress={() => setSelectedReport(null)}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="close" size={24} color={colors.text} />
                  </Pressable>
                </View>

                {loadingDetails && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <ActivityIndicator size="small" color={colors.green} />
                    <Text style={{ fontSize: 11, color: colors.muted }}>Refreshing latest status...</Text>
                  </View>
                )}

                {detailsError ? (
                  <Text style={[styles.error, { fontSize: 12 }]}>{detailsError}</Text>
                ) : null}

                <ScrollView contentContainerStyle={{ gap: 12 }}>
                  {/* Status Badge */}
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                    <Text style={styles.label}>Current Status:</Text>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: (STATUS_STYLE[selectedReport.status] || STATUS_STYLE.PENDING).bg,
                        borderWidth: 1,
                        borderColor: (STATUS_STYLE[selectedReport.status] || STATUS_STYLE.PENDING).border,
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

                  {/* Species */}
                  {selectedReport.species ? (
                    <View>
                      <Text style={styles.label}>Reported Species:</Text>
                      <Text style={styles.text}>{selectedReport.species}</Text>
                    </View>
                  ) : null}

                  {/* Description */}
                  <View>
                    <Text style={styles.label}>Description:</Text>
                    <Text style={styles.text}>{selectedReport.description}</Text>
                  </View>

                  {/* Location Summary */}
                  <View>
                    <Text style={styles.label}>Location Summary:</Text>
                    <Text style={styles.text}>{formatLocationSummary(selectedReport)}</Text>
                  </View>

                  {/* Submitted Date & Time */}
                  <View>
                    <Text style={styles.label}>Submitted Date/Time:</Text>
                    <Text style={styles.text}>
                      {formatDateTime(selectedReport.submittedAt || selectedReport.createdAt)}
                    </Text>
                  </View>

                  {/* Submission Mode */}
                  <View>
                    <Text style={styles.label}>Submission Mode:</Text>
                    <Text style={styles.text}>
                      {selectedReport.isAnonymous
                        ? "Anonymous Report (Identity protected)"
                        : "Standard Submission (Identified)"}
                    </Text>
                  </View>

                  {/* Evidence Section */}
                  <View style={{ gap: 6 }}>
                    <Text style={styles.label}>
                      Evidence Indicator ({selectedReport.evidence?.length || 0}):
                    </Text>
                    {selectedReport.evidence && selectedReport.evidence.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                        {selectedReport.evidence.map((ev, i) => {
                          let thumbnailUrl;
                          let thumbnailError = "";
                          try {
                            thumbnailUrl = resolveEvidenceUrl(ev.fileUrl);
                          } catch (failure) {
                            thumbnailUrl = null;
                            thumbnailError =
                              failure.message || "Evidence image unavailable.";
                          }
                          return (
                            <View key={ev.id || i} style={{ gap: 4 }}>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`View evidence image ${i + 1}`}
                                onPress={() => openEvidencePreview(ev, i)}
                              >
                                {thumbnailUrl ? (
                                  <Image
                                    source={{ uri: thumbnailUrl }}
                                    accessibilityLabel={`Evidence thumbnail ${i + 1}`}
                                    style={{ width: 100, height: 100, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
                                  />
                                ) : (
                                  <View
                                    style={{
                                      width: 100,
                                      height: 100,
                                      borderRadius: 10,
                                      borderWidth: 1,
                                      borderColor: colors.border,
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    <Ionicons
                                      name="image-outline"
                                      size={28}
                                      color={colors.muted}
                                    />
                                  </View>
                                )}
                              </Pressable>
                              <Text
                                style={{
                                  fontSize: 10,
                                  color: thumbnailError
                                    ? colors.red || "#dc2626"
                                    : colors.muted,
                                  textAlign: "center",
                                  maxWidth: 100,
                                }}
                              >
                                {thumbnailError || ev.fileType || "image/jpeg"}
                              </Text>
                            </View>
                          );
                        })}
                      </ScrollView>
                    ) : (
                      <Text style={styles.muted}>No evidence attached to this report.</Text>
                    )}
                  </View>
                </ScrollView>

                <Button title="Close" secondary onPress={() => setSelectedReport(null)} />
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(previewEvidence)}
        animationType="fade"
        onRequestClose={() => setPreviewEvidence(null)}
      >
        <View style={{ flex: 1, backgroundColor: "#101512", padding: 20 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: colors.white, fontSize: 16, fontWeight: "700" }}>
              {previewEvidence
                ? `Evidence image ${previewEvidence.index + 1}`
                : "Evidence image"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close evidence preview"
              onPress={() => setPreviewEvidence(null)}
              hitSlop={12}
            >
              <Ionicons name="close" size={28} color={colors.white} />
            </Pressable>
          </View>

          <View
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              marginVertical: 16,
            }}
          >
            {previewEvidence?.url && !previewError ? (
              <Image
                source={{ uri: previewEvidence.url }}
                accessibilityLabel={`Evidence image ${previewEvidence.index + 1}`}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
                onError={() =>
                  setPreviewError("Could not load this evidence image.")
                }
              />
            ) : (
              <Text
                accessibilityRole="alert"
                style={{ color: colors.white, textAlign: "center" }}
              >
                {previewError || "Evidence image unavailable."}
              </Text>
            )}
          </View>

          {downloadMessage ? (
            <Text
              accessibilityRole="alert"
              style={{
                color: colors.white,
                textAlign: "center",
                marginBottom: 10,
              }}
            >
              {downloadMessage}
            </Text>
          ) : null}
          <View style={{ gap: 10 }}>
            <Button
              title="Download image"
              loading={downloadingEvidence}
              disabled={!previewEvidence?.url || Boolean(previewError)}
              onPress={downloadEvidence}
            />
            <Button
              title="Close"
              secondary
              onPress={() => setPreviewEvidence(null)}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
