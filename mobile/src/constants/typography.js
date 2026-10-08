import { Platform } from "react-native";
export const fontFamily = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
};
export const fallbackFont = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "system-ui",
});
export function fontForWeight(weight = "400") {
  if (weight === "bold" || Number(weight) >= 700) return fontFamily.bold;
  if (Number(weight) >= 600) return fontFamily.semibold;
  if (Number(weight) >= 500) return fontFamily.medium;
  return fontFamily.regular;
}
const token = (fontSize, lineHeight, fontWeight) => ({
  fontSize,
  lineHeight,
  fontWeight,
  fontFamily: fontForWeight(fontWeight),
});
export const typography = {
  display: token(28, 36, "700"),
  heading: token(24, 32, "700"),
  section: token(18, 26, "600"),
  cardTitle: token(16, 24, "600"),
  body: token(15, 23, "400"),
  secondary: token(13, 20, "500"),
  caption: token(12, 18, "500"),
  button: token(15, 22, "600"),
};
