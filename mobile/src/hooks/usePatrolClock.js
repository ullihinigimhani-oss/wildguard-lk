import { useCallback, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
export default function usePatrolClock() {
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(useCallback(() => {
    const tick = () => setNow(new Date());
    tick();
    const interval = setInterval(tick, 15000);
    const listener = AppState.addEventListener("change", state => { if (state === "active") tick(); });
    return () => { clearInterval(interval); listener.remove(); };
  }, []));
  return now;
}
