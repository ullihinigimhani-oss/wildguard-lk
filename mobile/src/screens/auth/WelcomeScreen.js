import React from "react";
import { Text, View } from "react-native";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import { colors, styles } from "../../constants/theme";
export default function WelcomeScreen({ navigation }) {
  return (
    <Screen>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          gap: 24,
          paddingVertical: 32,
        }}
      >
        <View
          style={{
            backgroundColor: colors.dark,
            padding: 32,
            borderRadius: 24,
            minHeight: 260,
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: "#d4e2bb", fontSize: 14, letterSpacing: 3 }}>
            PROTECT • PRESERVE
          </Text>
          <Text
            accessibilityRole="header"
            style={{ color: "white", fontSize: 38, fontWeight: "800" }}
          >
            WildGuard LK
          </Text>
          <Text style={{ color: "#d4e2bb", fontSize: 17, lineHeight: 26 }}>
            A safer wilderness starts with you.
          </Text>
        </View>
        <Text style={styles.title}>Connected in the field.</Text>
        <Text style={styles.text}>
          A conservation companion for Sri Lanka’s park rangers. One place for
          your patrol, wildlife alerts and field reports.
        </Text>
        <View style={styles.notice}>
          <Text style={styles.muted}>
            University prototype · Community registration is available. Field actions are not
            available yet.
          </Text>
        </View>
        <Button title="Join the community" onPress={() => navigation.navigate("Register")} />
        <Button
          title="Continue to ranger login"
          onPress={() => navigation.navigate("Login")}
        />
      </View>
    </Screen>
  );
}
