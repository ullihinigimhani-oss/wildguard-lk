import { StyleSheet } from "react-native";
import { colors as baseColors, styles as baseStyles } from "./theme";
import { fieldColors as c, fieldCard } from "./fieldTheme";
export const colors = { ...baseColors, green: c.forest, dark: c.forest, text: c.text, muted: c.muted, background: c.background, border: c.border, cream: c.sage, error: c.danger };
export const styles = { ...baseStyles, title: { ...baseStyles.title, color: c.forest }, heading: { ...baseStyles.heading, color: c.text }, text: { ...baseStyles.text, color: c.text }, muted: { ...baseStyles.muted, color: c.muted }, error: { ...baseStyles.error, color: c.danger }, card: fieldCard, eyebrow: { ...baseStyles.eyebrow, color: c.secondary } };
export const rangerStyles = StyleSheet.create({
  title: { fontSize: 25, lineHeight: 33, fontWeight: "700", color: colors.dark },
  section: { fontSize: 16, lineHeight: 24, fontWeight: "700", color: colors.text },
  card: fieldCard,
  identity: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start", borderWidth: 1 },
  badgeText: { fontSize: 10, lineHeight: 15, letterSpacing: 0.6, fontWeight: "700" },
});
