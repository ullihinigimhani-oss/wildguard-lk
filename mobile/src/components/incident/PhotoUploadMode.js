import React from "react";
import { View } from "react-native";
import { Text } from "../common/Typography";
import { IncidentButton, ui } from "./IncidentUI";

export default function PhotoUploadMode({ value, onChange, disabled }) {
  return <View style={{ gap: 8 }}>
    <Text style={ui.muted}>Photo quality applies to new selections. Original preserves the selected file. Optimized creates a JPEG up to 1600px at 80% quality; embedded metadata may be removed. Videos are unchanged. Keep originals for evidentiary requirements.</Text>
    <IncidentButton title={value === "original" ? "Original quality · selected" : "Use original quality"} secondary disabled={disabled} onPress={() => onChange("original")} />
    <IncidentButton title={value === "optimized" ? "Optimized photo · selected" : "Use optimized photos (faster)"} secondary disabled={disabled} onPress={() => onChange("optimized")} />
  </View>;
}
