import React from "react";
import { Image, ImageBackground, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import PhotoOverlay from "../../components/common/PhotoOverlay";
import { colors } from "../../constants/theme";

const home = require("../../../assets/images/home.jpg");
function Action({ title, onPress, subtle = false }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}
    style={({ pressed }) => [local.heroButton, subtle ? local.heroSecondary : local.primaryAction, { opacity: pressed ? 0.7 : 1 }]}>
    <Text style={[subtle ? local.textActionLabel : local.primaryLabel, local.heroButtonLabel]}>{title}</Text>
  </Pressable>;
}

function PhotoSection({ source, minHeight, label, title, subtitle, description, children, header }) {
  return <ImageBackground source={source} resizeMode="cover" style={[local.photo, { minHeight }]}>
    <PhotoOverlay />
    {header}
    <View style={local.imageSpace} />
    <View style={local.copy}>
      <Text style={local.label}>{label}</Text>
      <Text accessibilityRole="header" style={local.title}>{title}</Text>
      {subtitle && <Text style={local.tagline}>{subtitle}</Text>}
      <Text style={local.body}>{description}</Text>
      {children}
    </View>
  </ImageBackground>;
}

export default function WelcomeScreen({ navigation }) {
  const focused = useIsFocused();
  const { height } = useWindowDimensions();
  const onJoin = () => navigation.navigate("Register");
  const onLogin = () => navigation.navigate("Login");
  return <SafeAreaView style={local.screen}>
    {focused && <StatusBar barStyle="light-content" />}
    <ScrollView bounces={false} contentContainerStyle={local.content}>
      <PhotoSection source={home} minHeight={Math.max(640, height * 0.88)} label="PROTECT • PRESERVE" title="WildGuard LK" subtitle="A safer wilderness starts with you."
        description="Connecting communities and conservation teams to protect Sri Lanka's wildlife."
        header={<View style={local.header}>
          <View style={local.logoBacking}><Image source={require("../../../assets/images/wildguard-logo.png")} resizeMode="contain" style={local.logo} accessibilityLabel="WildGuard logo" /></View>
          <Text style={local.brand}>WILDGUARD LK</Text>
        </View>}>
        <View style={local.heroActions}><Action title="Join the Community" onPress={onJoin} /><Action title="Login" subtle onPress={onLogin} /></View>
      </PhotoSection>
    </ScrollView>
  </SafeAreaView>;
}
const local = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  content: { flexGrow: 1 },
  photo: { flexGrow: 1, width: "100%", backgroundColor: colors.dark },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 24 },
  logoBacking: { backgroundColor: colors.background, borderRadius: 12, padding: 4 },
  logo: { width: 44, height: 44 },
  brand: { flex: 1, color: colors.white, fontSize: 13, fontWeight: "800", letterSpacing: 2 },
  imageSpace: { flex: 1, minHeight: 180 },
  copy: { paddingHorizontal: 28, paddingTop: 24, paddingBottom: 36, gap: 16, width: "100%", maxWidth: 660, alignSelf: "center" },
  label: { color: "#d4e2bb", fontSize: 11, lineHeight: 18, fontWeight: "700", letterSpacing: 2 },
  title: { color: colors.white, fontSize: 36, lineHeight: 42, fontWeight: "800" },
  body: { color: "#edf2e7", fontSize: 16, lineHeight: 25 },
  tagline: { color: colors.white, fontSize: 19, lineHeight: 28, fontWeight: "500" },
  heroActions: { gap: 14, marginTop: 8 },
  heroButton: { width: "100%", minHeight: 60, padding: 16, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  heroSecondary: { backgroundColor: "rgba(24,63,50,0.35)", borderColor: "#d4e2bb", borderWidth: 1.5 },
  heroButtonLabel: { fontWeight: "700", textAlign: "center" },
  primaryAction: { backgroundColor: "#d4e2bb" },
  primaryLabel: { color: colors.dark, fontSize: 15, fontWeight: "700", textAlign: "center" },
  textActionLabel: { color: colors.white, fontSize: 15, lineHeight: 23, fontWeight: "600" },
});
