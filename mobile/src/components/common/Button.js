import React from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { colors } from "../../constants/theme";
export default function Button({
  title,
  onPress,
  secondary = false,
  loading = false,
  disabled = false,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 54,
        padding: 16,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: colors.green,
        backgroundColor: secondary ? colors.white : colors.green,
        justifyContent: "center",
        alignItems: "center",
        opacity: pressed || disabled ? 0.65 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? colors.green : colors.white} />
      ) : (
        <Text
          style={{
            color: secondary ? colors.green : colors.white,
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
