import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { listMyPatrols } from "../services/patrolApi";
import { useAuth } from "./useAuth";
export default function useRangerPatrols() {
  const { user } = useAuth();
  const [state, setState] = useState({ patrols: [], loading: true, error: null });
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    setState({ patrols: [], loading: true, error: null });
    listMyPatrols(controller.signal).then(patrols => {
      if (!controller.signal.aborted) setState({ patrols, loading: false, error: null });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ patrols: [], loading: false, error: "Unable to load your patrols. Please try again." });
    });
    return () => controller.abort();
  }, [user.id, revision]));
  return { ...state, refresh: () => setRevision(value => value + 1) };
}
