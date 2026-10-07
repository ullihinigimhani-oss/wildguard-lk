import { useCallback, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { listMyPatrols } from "../services/patrolApi";
import { useAuth } from "./useAuth";
export default function useRangerPatrols() {
  const { user } = useAuth();
  const [state, setState] = useState({ patrols: [], loading: true, error: null });
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    let pending = false;
    setState({ patrols: [], loading: true, error: null });
    function load() {
      if (pending || controller.signal.aborted) return;
      pending = true;
      listMyPatrols(controller.signal).then(patrols => {
        if (!controller.signal.aborted) setState({ patrols, loading: false, error: null });
      }).catch(() => {
        if (!controller.signal.aborted) setState({ patrols: [], loading: false, error: "Unable to load your patrols. Please try again." });
      }).finally(() => { pending = false; });
    }
    load();
    const interval = setInterval(() => { if (AppState.currentState === "active") load(); }, 30000);
    const listener = AppState.addEventListener("change", status => { if (status === "active") load(); });
    return () => { clearInterval(interval); listener.remove(); controller.abort(); };
  }, [user.id, revision]));
  return { ...state, refresh: () => setRevision(value => value + 1) };
}
