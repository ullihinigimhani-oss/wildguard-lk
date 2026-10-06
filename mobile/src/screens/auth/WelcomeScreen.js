import React from "react";
import { Image, ImageBackground, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import Button from "../../components/common/Button";
import PhotoOverlay from "../../components/common/PhotoOverlay";
import { colors, styles } from "../../constants/theme";
export default function WelcomeScreen({ navigation }) {
  const focused = useIsFocused();
  const { height } = useWindowDimensions();
  return <SafeAreaView style={styles.screen}>
    {focused && <StatusBar barStyle="dark-content" />}
    <ScrollView contentContainerStyle={local.content} bounces={false}>
      <View style={local.header}>
        <Image source={require("../../../assets/images/wildguard-logo.png")} style={local.logo} resizeMode="contain" accessibilityLabel="WildGuard logo" />
        <View style={{ flex: 1 }}><Text style={local.brand}>WildGuard LK</Text><Text style={styles.eyebrow}>FOR A WILDER TOMORROW</Text></View>
      </View>
      <ImageBackground source={require("../../../assets/images/welcome-wildlife.jpg")} resizeMode="cover" style={[local.hero, { minHeight: Math.min(400, Math.max(240, height * 0.38)) }]}>
        <PhotoOverlay />
        <View style={local.heroCopy}>
          <Text style={local.eyebrow}>PROTECT • PRESERVE</Text>
          <Text accessibilityRole="header" style={local.heroTitle}>WildGuard LK</Text>
          <Text style={local.tagline}>A safer wilderness starts with you.</Text>
        </View>
      </ImageBackground>
      <View style={local.introduction}>
        <Text accessibilityRole="header" style={styles.title}>Connected in the field.</Text>
        <Text style={styles.text}>A conservation companion for Sri Lanka's park rangers. One place for your patrol, wildlife alerts and field reports.</Text>
      </View>
      <View style={local.actions}>
        <Button title="Join the Community" onPress={() => navigation.navigate("Register")} />
        <Button title="Continue to Ranger Login" secondary onPress={() => navigation.navigate("Login")} />
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const local = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, gap: 24, maxWidth: 620, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 56, height: 56 },
  brand: { color: colors.dark, fontSize: 22, fontWeight: "800", marginBottom: 4 },
  hero: { borderRadius: 24, overflow: "hidden", justifyContent: "flex-end" },
  heroCopy: { padding: 24, gap: 12 },
  eyebrow: { color: "#d4e2bb", fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  heroTitle: { color: colors.white, fontSize: 36, fontWeight: "800" },
  tagline: { color: colors.cream, fontSize: 17, lineHeight: 26 },
  introduction: { gap: 12 },
  actions: { gap: 12, marginTop: "auto" },
});
