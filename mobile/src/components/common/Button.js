import React, { useContext } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { RangerVisualContext, fieldColors } from "../../constants/fieldTheme";
import { Text } from "./Typography";
import { colors } from "../../constants/theme";
export default function Button({
  title,
  onPress,
  secondary = false,
  loading = false,
  disabled = false,
  color: suppliedColor,
  icon,
  accessibilityLabel,
}) {
  const ranger = useContext(RangerVisualContext);
  const color = suppliedColor || (ranger ? fieldColors.forest : colors.green);
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
        borderRadius: ranger ? 18 : 11,
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
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, maxWidth: "100%" }}>
        {icon && <Feather accessible={false} name={icon} size={18} color={secondary ? color : colors.white} />}
        <Text
          style={{
            color: secondary ? color : colors.white,
            fontSize: 15,
            fontWeight: "700",
            textAlign: "center",
            flexShrink: 1,
          }}
        >
          {title}
        </Text>
        </View>
      )}
    </Pressable>
  );
}
