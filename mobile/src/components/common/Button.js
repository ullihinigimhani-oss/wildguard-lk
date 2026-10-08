import React from "react";
import { ActivityIndicator, Pressable } from "react-native";
import { Text } from "./Typography";
import { colors } from "../../constants/theme";
export default function Button({
  title,
  onPress,
  secondary = false,
  loading = false,
  disabled = false,
  color = colors.green,
  accessibilityLabel,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 54,
        padding: 16,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: color,
        backgroundColor: secondary ? colors.white : color,
        justifyContent: "center",
        alignItems: "center",
        opacity: pressed || disabled ? 0.65 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? color : colors.white} />
      ) : (
        <Text
          style={{
            color: secondary ? color : colors.white,
            fontSize: 15,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}
