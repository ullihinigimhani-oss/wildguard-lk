import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Text, TextInput } from "../common/Typography";
import Button from "../common/Button";
import { statusTitle } from "../../utils/incident";
import { fieldColors as c, fieldCard } from "../../constants/fieldTheme";
import { ScreenHeader } from "../common/FieldUI";

export const palette = {
  ...c,
  deep: c.forest,
  white: "#FFFFFF",
};
export const ui = StyleSheet.create({
  heading: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700",
    color: palette.text,
  },
  section: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600",
    color: palette.text,
  },
  title: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: palette.text,
  },
  body: { fontSize: 15, lineHeight: 23, color: palette.text },
  muted: { fontSize: 13, lineHeight: 21, color: palette.muted },
  eyebrow: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    letterSpacing: 1,
    color: palette.forest,
  },
  card: {
    ...fieldCard,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.white,
    gap: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    padding: 14,
    minHeight: 52,
    fontSize: 15,
    color: palette.text,
    backgroundColor: palette.background,
  },
  error: { fontSize: 13, lineHeight: 21, color: palette.danger },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: palette.sage,
  },
  selected: { borderColor: palette.forest, backgroundColor: palette.sage },
});
export function IncidentButton(props) {
  const icons = { "Take Photo": "camera", "Choose from Gallery": "image", "Import Camera Trap Evidence": "upload", "Choose Photo from Gallery": "image", "Choose Video from Gallery": "video", "Import Camera Trap Photo/Video": "upload", "Report New Incident": "plus", "My Incident Reports": "file-text", "Use Current GPS Location": "crosshair" };
  return <Button color={palette.forest} icon={icons[props.title]} {...props} />;
}
export function Heading({ title, description }) {
  return <ScreenHeader title={title} description={description} icon="flag" />;
}
export function State({ loading, error, retry }) {
  return (
    <>
      {loading && (
        <ActivityIndicator
          color={palette.forest}
          accessibilityLabel="Loading incident data"
        />
      )}
      {error && (
        <View style={ui.card}>
          <Text accessibilityRole="alert" style={ui.error}>
            {error}
          </Text>
          <IncidentButton secondary title="Retry" onPress={retry} />
        </View>
      )}
    </>
  );
}
export function Badge({ incident }) {
  return (
    <View style={ui.badge}>
      <Text style={[ui.muted, { color: palette.forest, fontWeight: "600" }]}>
        {statusTitle(incident)}
      </Text>
    </View>
  );
}
export function Field({ label, value }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={ui.muted}>{label}</Text>
      <Text style={ui.body}>{value ?? "Not recorded"}</Text>
    </View>
  );
}
export function Input({ label, error, ...props }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={ui.title}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[
          ui.input,
          props.multiline && { minHeight: 130, textAlignVertical: "top" },
          error && { borderColor: palette.danger },
        ]}
        placeholderTextColor={palette.muted}
        {...props}
      />
      {error && (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
export function SelectCard({
  title,
  description,
  icon,
  selected,
  onPress,
  disabled,
  style,
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        ui.card,
        selected && ui.selected,
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      <View style={ui.row}>
        <View style={{ width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: selected ? palette.white : palette.sage }}>
          <Ionicons accessible={false} name={icon} size={24} color={palette.forest} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={ui.title}>{title}</Text>
          <Text style={ui.muted}>{description}</Text>
        </View>
        <Ionicons
          name={selected ? "radio-button-on" : "radio-button-off"}
          size={22}
          color={palette.forest}
        />
      </View>
    </Pressable>
  );
}
export function EvidenceEntry({ incidentId, navigation, disabled }) {
  return (
    <View style={ui.card}>
      <Text style={ui.section}>Evidence</Text>
      <Text style={ui.muted}>
        Save the incident first, then add private photos, videos or manually
        imported camera trap media from Incident Details. Upload failures do not
        discard the incident.
      </Text>
      {incidentId && (
        <IncidentButton
          title="Manage Evidence"
          secondary
          disabled={disabled}
          onPress={() =>
            navigation.navigate("IncidentEvidence", { incidentId })
          }
        />
      )}
      <Text style={ui.muted}>
        Maximum five items per incident. Photos up to 10 MB; videos up to 50 MB.
        Text-only reporting remains available.
      </Text>
    </View>
  );
}
