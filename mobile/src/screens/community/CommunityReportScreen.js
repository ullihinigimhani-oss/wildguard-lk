import React, { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import LocationPicker from "../../components/LocationPicker";
import EvidencePicker from "../../components/EvidencePicker";
import { submitReport } from "../../services/communityReportApi";
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

export default function CommunityReportScreen({ navigation }) {
  const { user } = useAuth();

  const [reportType, setReportType] = useState("WILDLIFE_SIGHTING");
  const [species, setSpecies] = useState("");
  const [description, setDescription] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [evidence, setEvidence] = useState([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [reporterName, setReporterName] = useState(user?.name || "");
  const [reporterPhone, setReporterPhone] = useState(user?.phone || "");

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedReport, setSubmittedReport] = useState(null);

  function selectSpecies(s) {
    setSpecies(s);
  }

  function handleSendSMS() {
    const loc = manualLocation || "Unknown Location";
    const body = encodeURIComponent(
      `[WildGuard] ${reportType} - ${species || "Wildlife"}. Location: ${loc}. Info: ${description || "Immediate review needed"}`
    );
    Linking.openURL(`sms:1992?body=${body}`).catch(() => {
      Alert.alert("SMS Error", "Could not open messaging client. Please dial 1992 directly.");
    });
  }

  function validate() {
    const errs = {};
    if (!reportType) errs.reportType = "Please select a report type.";
    if (!description.trim() || description.trim().length < 5) {
      errs.description = "Provide a description of at least 5 characters.";
    }
    const hasCoords = latitude && longitude;
    if (!manualLocation.trim() && !hasCoords) {
      errs.location = "Provide a location description or GPS coordinates.";
    }
    if (!isAnonymous && reporterPhone && !/^[+0-9\s\-()]{7,25}$/.test(reporterPhone.trim())) {
      errs.reporterPhone = "Provide a valid contact phone number.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate() || submitting) return;

    setSubmitting(true);
    setErrors({});

    try {
      const payload = {
        reportType,
        species: species.trim() || undefined,
        description: description.trim(),
        manualLocation: manualLocation.trim() || undefined,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        reporterName: isAnonymous ? undefined : reporterName.trim() || undefined,
        reporterPhone: isAnonymous ? undefined : reporterPhone.trim() || undefined,
        evidence: evidence.length ? evidence : undefined,
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
      setSubmitting(false);
    }
  }

  function resetForm() {
    setReportType("WILDLIFE_SIGHTING");
    setSpecies("");
    setDescription("");
    setManualLocation("");
    setLatitude("");
    setLongitude("");
    setEvidence([]);
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
          </View>

          <View style={{ width: "100%", gap: 10, marginTop: 8 }}>
            {navigation?.navigate && user && (
              <Button
                title="View My Reports"
                onPress={() => {
                  resetForm();
                  navigation.navigate("MyReports");
                }}
              />
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

      {/* SMS Hotline Notice */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 12,
          backgroundColor: "#eef6ff",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#bfdbfe",
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#1e40af" }}>
            Emergency SMS (Offline)
          </Text>
          <Text style={{ fontSize: 12, color: "#1e3a8a" }}>
            No internet? Send directly to DWC 1992
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={handleSendSMS}
          style={{
            backgroundColor: "#2563eb",
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: colors.white, fontSize: 12, fontWeight: "700" }}>Send SMS</Text>
        </Pressable>
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

      {/* 2. Species */}
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
        latitude={latitude}
        longitude={longitude}
        onChangeManualLocation={setManualLocation}
        onChangeLatitude={setLatitude}
        onChangeLongitude={setLongitude}
        error={errors.location || errors.manualLocation || errors.latitude || errors.longitude}
        disabled={submitting}
      />

      {/* 5. Photo & Evidence */}
      <EvidencePicker
        evidence={evidence}
        onChange={setEvidence}
        disabled={submitting}
      />

      {/* 6. Reporter Information / Anonymous Option */}
      <View style={[styles.card, { gap: 12 }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ gap: 2, flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              Anonymous Report
            </Text>
            <Text style={styles.muted}>Hide your name and phone from the report</Text>
          </View>
          <Switch
            value={isAnonymous}
            onValueChange={setIsAnonymous}
            trackColor={{ false: colors.border, true: colors.green }}
            thumbColor={colors.white}
            disabled={submitting}
          />
        </View>

        {!isAnonymous && (
          <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}>Your Name</Text>
              <TextInput
                placeholder="Full name"
                placeholderTextColor={colors.muted}
                value={reporterName}
                onChangeText={setReporterName}
                editable={!submitting}
                maxLength={120}
                style={[styles.input, { minHeight: 44, fontSize: 14 }]}
              />
            </View>

            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted }}>
                Contact Phone (For urgent follow-up)
              </Text>
              <TextInput
                placeholder="07X XXXXXXX"
                placeholderTextColor={colors.muted}
                value={reporterPhone}
                onChangeText={setReporterPhone}
                keyboardType="phone-pad"
                editable={!submitting}
                maxLength={25}
                style={[styles.input, { minHeight: 44, fontSize: 14 }]}
              />
              {errors.reporterPhone && <Text style={styles.error}>{errors.reporterPhone}</Text>}
            </View>
          </View>
        )}
      </View>

      {/* Submit Button */}
      <View style={{ gap: 8, paddingBottom: 24 }}>
        <Button
          title={submitting ? "Submitting Report..." : "Submit Incident Report"}
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
