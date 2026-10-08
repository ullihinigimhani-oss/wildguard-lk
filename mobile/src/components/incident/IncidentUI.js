import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Text, TextInput } from "../common/Typography";
import Button from "../common/Button";
import { statusTitle } from "../../utils/incident";

export const palette = {
  forest: "#174D3A",
  deep: "#103B2E",
  background: "#F5F6F0",
  sage: "#DCE9DD",
  text: "#20372E",
  muted: "#5F7066",
  danger: "#B63B3B",
  border: "#DCE3D9",
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
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.white,
    gap: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 14,
    minHeight: 52,
    fontSize: 15,
    color: palette.text,
    backgroundColor: palette.white,
  },
  error: { fontSize: 13, lineHeight: 21, color: palette.danger },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: palette.sage,
  },
  selected: { borderColor: palette.forest, backgroundColor: "#EDF4EC" },
});
export function IncidentButton(props) {
  return <Button color={palette.forest} {...props} />;
}
export function Heading({ title, description }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={ui.eyebrow}>WILDGUARD LK · FIELD OPERATIONS</Text>
      <Text accessibilityRole="header" style={ui.heading}>
        {title}
      </Text>
      {description && <Text style={ui.body}>{description}</Text>}
    </View>
  );
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
      ]}
    >
      <View style={ui.row}>
        <Ionicons name={icon} size={24} color={palette.forest} />
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
export function EvidenceUnavailable() {
  return (
    <View style={ui.card}>
      <Text style={ui.section}>Evidence</Text>
      <Text style={ui.muted}>
        Evidence uploads will be available after secure media storage is
        connected. Text-only reports can be submitted now.
      </Text>
      {[
        ["camera-outline", "Take Photo"],
        ["images-outline", "Choose from Gallery"],
        ["videocam-outline", "Camera Trap Evidence"],
      ].map(([icon, title]) => (
        <View key={title} style={ui.row}>
          <Ionicons name={icon} size={20} color={palette.muted} />
          <View style={{ flex: 1 }}>
            <IncidentButton title={title} secondary disabled />
          </View>
        </View>
      ))}
      <Text style={ui.muted}>
        Future evidence support: multiple photos and videos, camera trap ID,
        capture date/time and notes.
      </Text>
    </View>
  );
}
