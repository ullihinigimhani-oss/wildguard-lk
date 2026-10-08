import React, { useEffect, useRef, useState } from "react";
import {
  Alert as NativeAlert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import LocationPicker from "../../components/LocationPicker";
import EvidencePicker from "../../components/EvidencePicker";
import { submitReport, uploadEvidence } from "../../services/communityReportApi";
import { buildSmsReportText, simulateSmsReport } from "../../services/smsReportApi";
import { useAuth } from "../../hooks/useAuth";
import { colors, styles } from "../../constants/theme";

const REPORT_TYPES = [
  {
    type: "WILDLIFE_SIGHTING",
    label: "Wildlife Sighting",
    description: "Spotted wild animals near boundaries or settlements",
    icon: "eye-outline",
  },
  {
    type: "HUMAN_WILDLIFE_CONFLICT",
    label: "Wildlife Conflict",
    description: "Crop damage, property destruction, or aggression",
    icon: "alert-circle-outline",
  },
  {
    type: "SUSPICIOUS_ACTIVITY",
    label: "Suspicious Activity",
    description: "Traps, snares, illegal entry, or poaching suspicion",
    icon: "shield-outline",
  },
];

const QUICK_SPECIES = ["Elephant", "Leopard", "Sloth Bear", "Wild Boar", "Crocodile"];

export default function CommunityReportScreen({ navigation, route }) {
  const { user } = useAuth();
  const submittingRef = useRef(false);

  const [reportType, setReportType] = useState(
    route?.params?.initialReportType || "WILDLIFE_SIGHTING"
  );

  useEffect(() => {
    if (route?.params?.initialReportType) {
      setReportType(route.params.initialReportType);
    }
  }, [route?.params?.initialReportType]);

  const [species, setSpecies] = useState("");
  const [description, setDescription] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const [villageArea, setVillageArea] = useState("");
  const [landmarkDescription, setLandmarkDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [evidence, setEvidence] = useState([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [showSmsSection, setShowSmsSection] = useState(false);
  const [simulatingSms, setSimulatingSms] = useState(false);

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [submittedReport, setSubmittedReport] = useState(null);

  function selectSpecies(s) {
    setSpecies(s);
  }

  function getEffectiveManualLocation() {
    if (manualLocation.trim()) return manualLocation.trim();
    return [villageArea.trim(), landmarkDescription.trim()].filter(Boolean).join(" - ");
  }

  function validate() {
    const errs = {};

    if (
      !reportType ||
      !["WILDLIFE_SIGHTING", "HUMAN_WILDLIFE_CONFLICT", "SUSPICIOUS_ACTIVITY"].includes(reportType)
    ) {
      errs.reportType = "Please select a valid report type.";
    }

    const trimmedDesc = description.trim();
    if (!trimmedDesc || trimmedDesc.length < 5) {
      errs.description = "Provide a description of at least 5 characters.";
    } else if (trimmedDesc.length > 2000) {
      errs.description = "Description must not exceed 2000 characters.";
    }

    const effectiveLoc = getEffectiveManualLocation();
    const hasManualLoc = Boolean(effectiveLoc);
    const latTrim = latitude.trim();
    const lonTrim = longitude.trim();
    const hasLat = latTrim !== "";
    const hasLon = lonTrim !== "";

    if (hasLat || hasLon) {
      const latNum = parseFloat(latTrim);
      const lonNum = parseFloat(lonTrim);

      if (!hasLat) {
        errs.latitude = "Latitude is required when longitude is provided.";
      } else if (isNaN(latNum) || latNum < -90 || latNum > 90) {
        errs.latitude = "Latitude must be between -90 and 90.";
      }

      if (!hasLon) {
        errs.longitude = "Longitude is required when latitude is provided.";
      } else if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
        errs.longitude = "Longitude must be between -180 and 180.";
      }
    }

    const hasValidCoords =
      hasLat &&
      hasLon &&
      !isNaN(parseFloat(latTrim)) &&
      !isNaN(parseFloat(lonTrim)) &&
      parseFloat(latTrim) >= -90 &&
      parseFloat(latTrim) <= 90 &&
      parseFloat(lonTrim) >= -180 &&
      parseFloat(lonTrim) <= 180;

    if (!hasManualLoc && !hasValidCoords && !errs.latitude && !errs.longitude) {
      errs.location = "Provide a location description or GPS coordinates.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (submittingRef.current || submitting) return;
    if (!validate()) return;

    submittingRef.current = true;
    setSubmitting(true);
    setErrors({});

    try {
      const latTrim = latitude.trim();
      const lonTrim = longitude.trim();
      const effectiveLoc = getEffectiveManualLocation();

      // Process and upload any pending evidence items
      const preparedEvidence = [];
      for (let i = 0; i < evidence.length; i++) {
        const item = evidence[i];
        if (item.fileUrl && (item.fileUrl.startsWith("/uploads/") || item.fileUrl.startsWith("http"))) {
          preparedEvidence.push({ fileUrl: item.fileUrl, fileType: item.fileType });
        } else if (item.base64) {
          setUploadStatus(`Uploading evidence ${i + 1} of ${evidence.length}...`);
          const uploadRes = await uploadEvidence({
            data: item.base64,
            mimeType: item.fileType,
            originalName: item.fileName,
          });
          item.fileUrl = uploadRes.fileUrl;
          preparedEvidence.push({ fileUrl: uploadRes.fileUrl, fileType: uploadRes.fileType });
        } else {
          // Local/mock URI
          preparedEvidence.push({ fileUrl: item.fileUrl, fileType: item.fileType });
        }
      }

      setUploadStatus("Submitting report...");

      const payload = {
        reportType,
        species: species.trim() || undefined,
        description: description.trim(),
        manualLocation: effectiveLoc || undefined,
        latitude: latTrim ? parseFloat(latTrim) : undefined,
        longitude: lonTrim ? parseFloat(lonTrim) : undefined,
        isAnonymous,
        reporterName: isAnonymous ? undefined : (user?.name || undefined),
        evidence: preparedEvidence.length ? preparedEvidence : undefined,
      };

      const result = await submitReport(payload);
      setSubmittedReport(result.report);
    } catch (err) {
      const serverErrors = err.response?.data?.errors;
      if (serverErrors) {
        setErrors(serverErrors);
      } else {
        setErrors({
          general:
            err.response?.data?.message ||
            err.message ||
            "Unable to submit report. Please check connection and try again.",
        });
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setUploadStatus("");
    }
  }

  function handleOpenSmsApp() {
    const effectiveLoc = getEffectiveManualLocation();
    const textBody = buildSmsReportText({
      reportType,
      location: effectiveLoc,
      description: description.trim(),
      isAnonymous,
    });

    const smsUrl = `sms:1919?body=${encodeURIComponent(textBody)}`;
    Linking.canOpenURL(smsUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(smsUrl);
        } else {
          NativeAlert.alert("SMS Reporting Format", `Send SMS to 1919:\n\n${textBody}`);
        }
      })
      .catch(() => {
        NativeAlert.alert("SMS Reporting Format", `Send SMS to 1919:\n\n${textBody}`);
      });
  }

  async function handleSimulateSms() {
    const effectiveLoc = getEffectiveManualLocation();
    const textBody = buildSmsReportText({
      reportType,
      location: effectiveLoc || "Community Buffer Zone",
      description: description.trim() || "Observed wildlife activity near settlement boundary",
      isAnonymous,
    });

    setSimulatingSms(true);
    try {
      const res = await simulateSmsReport({
        senderPhone: user?.phone || "+94771234567",
        message: textBody,
        providerMessageId: `sim-mob-${Date.now()}`,
      });

      NativeAlert.alert(
        "SMS Report Ingested",
        res.replyText || "Your SMS report has been successfully logged by the gateway."
      );
      if (res.report) {
        setSubmittedReport(res.report);
      }
    } catch (err) {
      NativeAlert.alert(
        "SMS Ingestion Failed",
        err.response?.data?.message || err.message || "Could not process SMS report."
      );
    } finally {
      setSimulatingSms(false);
    }
  }

  function resetForm() {
    setReportType("WILDLIFE_SIGHTING");
    setSpecies("");
    setDescription("");
    setManualLocation("");
    setVillageArea("");
    setLandmarkDescription("");
    setLatitude("");
    setLongitude("");
    setEvidence([]);
    setIsAnonymous(false);
    setUploadStatus("");
    setErrors({});
    setSubmittedReport(null);
  }

  if (submittedReport) {
    return (
      <Screen>
        <View style={[styles.card, { alignItems: "center", padding: 24, gap: 16, marginTop: 20 }]}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: colors.cream,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="checkmark-circle" size={40} color={colors.green} />
          </View>

          <Text style={[styles.title, { textAlign: "center", fontSize: 23 }]}>
            Report Received
          </Text>

          <Text style={[styles.text, { textAlign: "center" }]}>
            Thank you for helping safeguard our wildlife and communities. Your report has been dispatched to the local Community Liaison and coordination officers.
          </Text>

          <View style={{ backgroundColor: colors.background, padding: 12, borderRadius: 10, width: "100%", gap: 4 }}>
            <Text style={[styles.muted, { fontSize: 12 }]}>Report ID: {submittedReport.id}</Text>
            <Text style={[styles.muted, { fontSize: 12 }]}>Type: {submittedReport.reportType.replace(/_/g, " ")}</Text>
            <Text style={[styles.muted, { fontSize: 12 }]}>Status: {submittedReport.status}</Text>
            <Text style={[styles.muted, { fontSize: 12 }]}>
              Submission: {submittedReport.isAnonymous ? "Anonymous" : "Identified"}
            </Text>
            {Boolean(submittedReport.evidence?.length) && (
              <Text style={[styles.muted, { fontSize: 12 }]}>
                Attached Evidence: {submittedReport.evidence.length} file{submittedReport.evidence.length > 1 ? "s" : ""}
              </Text>
            )}
          </View>

          <View style={{ width: "100%", gap: 10, marginTop: 8 }}>
            {navigation?.navigate && (
              <>
                <Button
                  title="View My Reports"
                  onPress={() => {
                    resetForm();
                    navigation.navigate("MyReports");
                  }}
                />
                <Button
                  title="Return to Home"
                  secondary
                  onPress={() => {
                    resetForm();
                    navigation.navigate("CommunityDashboard");
                  }}
                />
              </>
            )}
            <Button
              title="Submit Another Report"
              secondary
              onPress={resetForm}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Text style={styles.eyebrow}>COMMUNITY SAFEGUARD</Text>
        <Text style={styles.title}>Report Wildlife / Conflict</Text>
        <Text style={styles.muted}>
          Submit sightings, elephant movements, or urgent incidents to wildlife liaison officers.
        </Text>
      </View>

      {errors.general && (
        <View style={{ padding: 12, backgroundColor: "#fee2e2", borderRadius: 10, borderWidth: 1, borderColor: "#fca5a5" }}>
          <Text style={{ color: colors.error, fontSize: 13 }}>{errors.general}</Text>
        </View>
      )}

      {/* 1. Report Type Selection */}
      <View style={{ gap: 8 }}>
        <Text style={styles.label}>
          Select Incident Category <Text style={{ color: colors.error }}>*</Text>
        </Text>
        <View style={{ gap: 8 }}>
          {REPORT_TYPES.map((rt) => {
            const selected = reportType === rt.type;
            return (
              <Pressable
                key={rt.type}
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => setReportType(rt.type)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: selected ? colors.green : colors.border,
                  backgroundColor: selected ? colors.cream : colors.white,
                  gap: 12,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: selected ? colors.white : colors.background,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons
                    name={rt.icon}
                    size={20}
                    color={selected ? colors.green : colors.muted}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: selected ? "700" : "600",
                      color: selected ? colors.green : colors.text,
                    }}
                  >
                    {rt.label}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>{rt.description}</Text>
                </View>
                {selected && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.green} />
                )}
              </Pressable>
            );
          })}
        </View>
        {errors.reportType && <Text style={styles.error}>{errors.reportType}</Text>}
      </View>

      {/* 2. Optional Species / Summary */}
      <View style={{ gap: 8 }}>
        <Text style={styles.label}>Wildlife Species (If known)</Text>
        <TextInput
          placeholder="e.g. Asian Elephant, Sri Lankan Leopard, Wild Boar"
          placeholderTextColor={colors.muted}
          value={species}
          onChangeText={setSpecies}
          editable={!submitting}
          maxLength={100}
          style={styles.input}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {QUICK_SPECIES.map((s) => (
            <Pressable
              key={s}
              onPress={() => selectSpecies(s)}
              disabled={submitting}
              style={{
                backgroundColor: species === s ? colors.green : colors.white,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: species === s ? colors.white : colors.text,
                }}
              >
                {s}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        {errors.species && <Text style={styles.error}>{errors.species}</Text>}
      </View>

      {/* 3. Description */}
      <View style={{ gap: 8 }}>
        <Text style={styles.label}>
          Incident Description <Text style={{ color: colors.error }}>*</Text>
        </Text>
        <TextInput
          placeholder="Describe what occurred, animal count, heading direction, behavior, or damages observed..."
          placeholderTextColor={colors.muted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!submitting}
          maxLength={2000}
          style={[styles.input, { minHeight: 96, paddingVertical: 12 }]}
        />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {errors.description ? (
            <Text style={styles.error}>{errors.description}</Text>
          ) : <View />}
          <Text style={{ fontSize: 11, color: colors.muted }}>{description.length}/2000</Text>
        </View>
      </View>

      {/* 4. Location */}
      <LocationPicker
        manualLocation={manualLocation}
        villageArea={villageArea}
        landmarkDescription={landmarkDescription}
        latitude={latitude}
        longitude={longitude}
        onChangeManualLocation={setManualLocation}
        onChangeVillageArea={setVillageArea}
        onChangeLandmarkDescription={setLandmarkDescription}
        onChangeLatitude={setLatitude}
        onChangeLongitude={setLongitude}
        error={errors.latitude || errors.longitude || errors.manualLocation || errors.location}
        disabled={submitting}
      />

      {/* 5. Photo / Video Evidence */}
      <EvidencePicker
        evidence={evidence}
        onChange={setEvidence}
        disabled={submitting}
        maxItems={5}
      />
      {errors.evidence && <Text style={styles.error}>{errors.evidence}</Text>}

      {/* 6. Anonymous Reporting Option */}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isAnonymous }}
        accessibilityLabel="Submit anonymously"
        disabled={submitting}
        onPress={() => setIsAnonymous(!isAnonymous)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: isAnonymous ? colors.cream : colors.white,
          borderWidth: 1.5,
          borderColor: isAnonymous ? colors.green : colors.border,
          borderRadius: 12,
          padding: 14,
          gap: 12,
          opacity: pressed || submitting ? 0.8 : 1,
        })}
      >
        <Ionicons
          name={isAnonymous ? "checkbox" : "square-outline"}
          size={24}
          color={isAnonymous ? colors.green : colors.muted}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: isAnonymous ? colors.green : colors.text,
            }}
          >
            Submit anonymously
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            Hide your identity on public and community-facing reports. Wildlife officers can still respond to the incident.
          </Text>
        </View>
      </Pressable>

      {/* SMS Offline Fallback Option */}
      <View style={[styles.card, { gap: 10, borderColor: "#0284c7", borderWidth: 1, backgroundColor: "#f0f9ff" }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle SMS Reporting Options"
          onPress={() => setShowSmsSection((prev) => !prev)}
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="chatbox-ellipses-outline" size={20} color="#0284c7" />
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#0369a1" }}>
              No Data? Report via SMS (1919)
            </Text>
          </View>
          <Ionicons
            name={showSmsSection ? "chevron-up" : "chevron-down"}
            size={18}
            color="#0284c7"
          />
        </Pressable>

        {showSmsSection && (
          <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: "#bae6fd", paddingTop: 8 }}>
            <Text style={{ fontSize: 12, color: "#0c4a6e", lineHeight: 18 }}>
              In rural areas with poor data connection, send an SMS to shortcode <Text style={{ fontWeight: "700" }}>1919</Text>.
            </Text>

            <View style={{ backgroundColor: "#ffffff", padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#e0f2fe" }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: "#0369a1", marginBottom: 2 }}>
                Generated SMS Preview:
              </Text>
              <Text style={{ fontSize: 12, color: colors.dark, fontStyle: "italic", lineHeight: 17 }}>
                {buildSmsReportText({
                  reportType,
                  location: getEffectiveManualLocation(),
                  description: description.trim(),
                  isAnonymous,
                })}
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Open SMS App"
                  secondary
                  onPress={handleOpenSmsApp}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title={simulatingSms ? "Simulating..." : "Test Gateway"}
                  loading={simulatingSms}
                  disabled={simulatingSms}
                  onPress={handleSimulateSms}
                />
              </View>
            </View>
          </View>
        )}
      </View>

      {/* 7. Submit Button */}
      <View style={{ gap: 8, paddingBottom: 24 }}>
        <Button
          title={submitting ? (uploadStatus || "Submitting Report...") : "Submit Incident Report"}
          loading={submitting}
          disabled={submitting}
          onPress={handleSubmit}
        />
        <Text style={[styles.muted, { textAlign: "center", fontSize: 12 }]}>
          Reports are handled according to Department of Wildlife Conservation safety protocols.
        </Text>
      </View>
    </Screen>
  );
}
