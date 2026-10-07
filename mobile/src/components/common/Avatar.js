import React, { useState } from "react";
import { Image, Text, View } from "react-native";
export default function Avatar({ user, size = 80 }) {
  const [failed, setFailed] = useState(false);
  return user.profileImageUrl && !failed ? (
    <Image
      source={{ uri: user.profileImageUrl }}
      accessibilityLabel={user.name + " profile"}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#e6efdf",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.35, color: "#163e2e", fontWeight: "600" }}>
        {user.name?.slice(0, 1) || "?"}
      </Text>
    </View>
  );
}
