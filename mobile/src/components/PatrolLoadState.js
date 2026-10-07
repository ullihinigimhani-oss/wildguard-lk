import React from "react";
import { ActivityIndicator, Text } from "react-native";
import Button from "./common/Button";
import { styles, colors } from "../constants/theme";
export default function PatrolLoadState({ loading, error, refresh }) {
  if (loading) return <ActivityIndicator color={colors.green} accessibilityLabel="Loading assigned patrols" />;
  if (error) return <><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Button title="Retry" onPress={refresh} secondary /></>;
  return null;
}
