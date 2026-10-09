import React from "react";
import { View } from "react-native";
import { Text } from "../../components/common/Typography";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import { styles } from "../../constants/theme";
export default function PlaceholderScreen({ title, navigation }) {
  return (
    <Screen>
      <View style={[styles.card, { marginTop: 30, gap: 20 }]}>
        <Text style={styles.eyebrow}>COMING SOON</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Text style={styles.text}>
          This field tool will be available in a future feature. No location,
          report or operational data is collected in this preview.
        </Text>
        <Button
          title="Back to ranger home"
          onPress={() => navigation.navigate("Home")}
        />
      </View>
    </Screen>
  );
}
