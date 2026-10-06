import React, { useRef } from "react";
import { Image, ImageBackground, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import PhotoOverlay from "../../components/common/PhotoOverlay";
import { colors } from "../../constants/theme";

const wildlife = require("../../../assets/images/onboarding-wildlife.jpg");
const mission = require("../../../assets/images/welcome-wildlife.jpg");
const ranger = require("../../../assets/images/onboarding-ranger.jpg");
const monitoring = require("../../../assets/images/onboarding-monitoring.jpg");
const features = [
  ["REPORT", "Share wildlife incidents and important observations quickly."],
  ["MONITOR", "Support field awareness with location-based conservation information."],
  ["RESPOND", "Help the right teams receive information when action is needed."],
];

function Action({ title, onPress, subtle = false, hero = false }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}
    style={({ pressed }) => [subtle ? local.textAction : local.primaryAction, hero && local.heroButton, hero && subtle && local.heroSecondary, { opacity: pressed ? 0.7 : 1 }]}>
    <Text style={[subtle ? local.textActionLabel : local.primaryLabel, hero && local.heroButtonLabel]}>{title}</Text>
  </Pressable>;
}

function PhotoSection({ source, minHeight, label, title, subtitle, description, children, header, stronger = false }) {
  return <ImageBackground source={source} resizeMode="cover" style={[local.photo, { minHeight }]}>
    <PhotoOverlay />
    {stronger && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(8,30,22,0.12)" }]} />}
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
  const { height, width } = useWindowDimensions();
  const scroll = useRef(null);
  const informationY = useRef(0);
  const onJoin = () => navigation.navigate("Register");
  const onLogin = () => navigation.navigate("Login");
  const photoHeight = Math.min(600, Math.max(520, width * 1.4));
  return <SafeAreaView style={local.screen}>
    {focused && <StatusBar barStyle="light-content" />}
    <ScrollView ref={scroll} bounces={false} contentContainerStyle={local.content}>
      <PhotoSection source={wildlife} minHeight={Math.max(640, height * 0.88)} label="PROTECT • PRESERVE" title="WildGuard LK" subtitle="A safer wilderness starts with you."
        description="Connecting communities and conservation teams to protect Sri Lanka's wildlife."
        header={<View style={local.header}>
          <View style={local.logoBacking}><Image source={require("../../../assets/images/wildguard-logo.png")} resizeMode="contain" style={local.logo} accessibilityLabel="WildGuard logo" /></View>
          <Text style={local.brand}>WILDGUARD LK</Text>
        </View>}>
        <View style={[local.actions, local.heroActions]}><Action title="Join the Community" hero onPress={onJoin} /><Action title="Login" hero subtle onPress={onLogin} /></View>
      </PhotoSection>
      <View style={local.divider} />
      <PhotoSection source={mission} minHeight={photoHeight} label="OUR MISSION" title="Protect what cannot be replaced."
        description="WildGuard LK brings communities, park rangers and conservation teams closer together through faster reporting and better field awareness.">
        <Action title="Learn how WildGuard works →" subtle onPress={() => scroll.current?.scrollTo({ y: informationY.current, animated: true })} />
      </PhotoSection>
      <View style={local.divider} />
      <PhotoSection source={ranger} minHeight={photoHeight} label="FOR PARK RANGERS" title="Built for the field."
        description="Record patrol activity, report incidents, capture evidence and stay connected while protecting wildlife.">
        <Action title="Login" subtle onPress={onLogin} />
      </PhotoSection>
      <View onLayout={event => { informationY.current = event.nativeEvent.layout.y; }} style={local.information}>
        <Text style={local.lightLabel}>HOW WILDGUARD WORKS</Text>
        <Text accessibilityRole="header" style={[local.title, local.darkText]}>One platform. Better conservation.</Text>
        <View style={local.rows}>
          {features.map(([label, description], index) => <View key={label} style={local.row}>
            <Text style={local.number}>0{index + 1}</Text>
            <View style={local.rowCopy}><Text style={local.lightLabel}>{label}</Text><Text style={local.lightBody}>{description}</Text></View>
          </View>)}
        </View>
      </View>
      <PhotoSection source={monitoring} minHeight={photoHeight} label="CONNECTED CONSERVATION" title="Information from the field, when it matters."
        description="Bring patrol information, wildlife alerts and field reports together in one connected conservation platform." />
      <View style={local.community}>
        <Text style={local.label}>FOR COMMUNITIES</Text>
        <Text accessibilityRole="header" style={local.title}>Your observation could make a difference.</Text>
        <Text style={local.body}>Report wildlife sightings, human-wildlife conflicts and suspicious activity responsibly through WildGuard LK.</Text>
        <Action title="Join the Community" onPress={onJoin} />
      </View>
      <PhotoSection source={wildlife} minHeight={photoHeight} stronger label="PROTECT • PRESERVE • RESPOND" title="Together for Sri Lanka's wildlife."
        description="Better information. Faster response. Stronger conservation.">
        <View style={local.actions}><Action title="Get Started" onPress={onJoin} /><Action title="Login" subtle onPress={onLogin} /></View>
      </PhotoSection>
      <View style={local.footer}><Text style={local.footerBrand}>WildGuard LK</Text><Text style={local.footerText}>Wildlife Conservation & Anti-Poaching Monitoring System</Text><Text style={local.footerText}>University Prototype</Text></View>
    </ScrollView>
  </SafeAreaView>;
}
const local = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dark },
  content: { flexGrow: 1 },
  photo: { width: "100%", backgroundColor: colors.dark },
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
  actions: { gap: 4, marginTop: 8 },
  heroActions: { gap: 14 },
  heroButton: { width: "100%", minHeight: 60, padding: 16, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  heroSecondary: { backgroundColor: "rgba(24,63,50,0.35)", borderColor: "#d4e2bb", borderWidth: 1.5 },
  heroButtonLabel: { fontWeight: "700", textAlign: "center" },
  primaryAction: { backgroundColor: "#d4e2bb", borderRadius: 10, minHeight: 54, padding: 16, alignItems: "center", justifyContent: "center" },
  primaryLabel: { color: colors.dark, fontSize: 15, fontWeight: "700", textAlign: "center" },
  textAction: { minHeight: 48, paddingVertical: 12, justifyContent: "center" },
  textActionLabel: { color: colors.white, fontSize: 15, lineHeight: 23, fontWeight: "600" },
  divider: { height: 20, backgroundColor: colors.dark },
  information: { backgroundColor: colors.background, paddingHorizontal: 28, paddingVertical: 52, gap: 16 },
  darkText: { color: colors.dark },
  lightLabel: { color: colors.green, fontSize: 11, lineHeight: 18, letterSpacing: 2, fontWeight: "700" },
  rows: { marginTop: 12 },
  row: { flexDirection: "row", gap: 20, paddingVertical: 24, borderTopWidth: 1, borderColor: colors.border },
  number: { color: colors.green, fontSize: 30, lineHeight: 38, fontWeight: "300" },
  rowCopy: { flex: 1, gap: 8 },
  lightBody: { color: colors.text, fontSize: 15, lineHeight: 24 },
  community: { backgroundColor: colors.dark, paddingHorizontal: 28, paddingVertical: 56, gap: 20 },
  footer: { padding: 28, gap: 8 },
  footerBrand: { color: colors.cream, fontWeight: "700", fontSize: 14 },
  footerText: { color: "#bbcbbb", fontSize: 12, lineHeight: 19 },
});
