import React, { useState } from "react";
import { Text } from "react-native";
import Screen from "../../components/common/Screen";
import Button from "../../components/common/Button";
import SyncStatus from "../../components/SyncStatus";
import { styles } from "../../constants/theme";
export default function SyncScreen() {
  const [state, setState] = useState("Online");
  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        Offline / Sync Status
      </Text>
      <Text style={styles.text}>
        Preview how field connectivity will be presented.
      </Text>
      <SyncStatus state={state} />
      {["Online", "Offline", "Pending Sync"].map((item) => (
        <Button
          key={item}
          title={`Preview ${item}`}
          secondary={state !== item}
          onPress={() => setState(item)}
        />
      ))}
      <Text style={styles.muted}>
        These controls only change this screen’s sample state. Network
        detection, local storage and synchronization are not implemented.
      </Text>
    </Screen>
  );
}
