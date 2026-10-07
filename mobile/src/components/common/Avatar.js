import React, { useState } from "react";
import { Image, Text, View } from "react-native";
export default function Avatar({ user }) {
  const [failed, setFailed] = useState(false);
  return user.profileImageUrl && !failed ? (
    <Image
      source={{ uri: user.profileImageUrl }}
      accessibilityLabel={user.name + " profile"}
      onError={() => setFailed(true)}
      style={{ width: 80, height: 80, borderRadius: 40 }}
    />
  ) : (
    <View
      style={{
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "#e6efdf",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 28, color: "#163e2e" }}>
        {user.name?.slice(0, 1) || "?"}
      </Text>
    </View>
  );
}
