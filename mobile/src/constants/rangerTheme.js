import { StyleSheet } from "react-native";
import { colors } from "./theme";
export const rangerStyles = StyleSheet.create({
  title: { fontSize: 25, lineHeight: 33, fontWeight: "700", color: colors.dark },
  section: { fontSize: 16, lineHeight: 24, fontWeight: "700", color: colors.text },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 18, gap: 14, borderWidth: 1, borderColor: colors.border, shadowColor: colors.dark, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  identity: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  badge: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5, alignSelf: "flex-start", borderWidth: 1 },
  badgeText: { fontSize: 10, lineHeight: 15, letterSpacing: 0.6, fontWeight: "700" },
});
