import React from "react";
import { ImageBackground, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import Button from "./common/Button";
import PhotoOverlay from "./common/PhotoOverlay";
import { colors } from "../constants/theme";

export default function OnboardingLayout({ navigation, image, title, description, page, nextRoute }) {
  const focused = useIsFocused();
  const { height } = useWindowDimensions();
  const finish = () => navigation.reset({ index: 0, routes: [{ name: "Welcome" }] });
  return <ImageBackground source={image} resizeMode="cover" style={local.screen}>
    {focused && <StatusBar barStyle="light-content" />}
    <PhotoOverlay />
    <SafeAreaView style={local.screen}>
      <ScrollView contentContainerStyle={local.content} bounces={false}>
        <View style={local.top}>
          <Text style={local.brand}>WILDGUARD LK</Text>
          {page === 1 && <Pressable accessibilityRole="button" onPress={finish} style={local.textButton}><Text style={local.action}>Skip</Text></Pressable>}
        </View>
        <View style={[local.copy, { paddingTop: Math.min(height * 0.24, 220) }]}>
          <Text style={local.eyebrow}>PROTECT • PRESERVE</Text>
          <Text accessibilityRole="header" style={local.title}>{title}</Text>
          <Text style={local.description}>{description}</Text>
        </View>
        <View style={local.footer}>
          <View accessible accessibilityLabel={`Page ${page} of 3`} style={local.dots}>
            {[1, 2, 3].map(dot => <View key={dot} style={[local.dot, dot === page && local.activeDot]} />)}
          </View>
          <Button title={page === 3 ? "Get Started" : "Next"} onPress={page === 3 ? finish : () => navigation.navigate(nextRoute)} />
          {page > 1 && <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={local.textButton}><Text style={local.action}>Back</Text></Pressable>}
        </View>
      </ScrollView>
    </SafeAreaView>
  </ImageBackground>;
}
const local = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, padding: 24, width: "100%", maxWidth: 620, alignSelf: "center" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 48 },
  brand: { color: colors.white, fontSize: 13, fontWeight: "800", letterSpacing: 2 },
  textButton: { minHeight: 48, minWidth: 48, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  action: { color: colors.white, fontWeight: "600", fontSize: 15 },
  copy: { flex: 1, justifyContent: "flex-end", gap: 18, paddingBottom: 32 },
  eyebrow: { color: "#d4e2bb", fontSize: 12, fontWeight: "700", letterSpacing: 3 },
  title: { color: colors.white, fontSize: 38, lineHeight: 45, fontWeight: "800" },
  description: { color: colors.cream, fontSize: 16, lineHeight: 25 },
  footer: { gap: 12 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#819087" },
  activeDot: { width: 28, backgroundColor: "#d4e2bb" },
});
