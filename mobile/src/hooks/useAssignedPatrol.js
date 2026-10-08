import { getAssignedPatrol } from "../services/offlinePatrol";
import { useOffline } from "./useOffline";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "./useAuth";

export default function useAssignedPatrol(id) {
  const { user } = useAuth();
  const offline = useOffline();
  const [state, setState] = useState({
    patrol: null,
    loading: true,
    error: null,
  });
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const attempt = ++generation.current;
      const controller = new AbortController();
      setState({ patrol: null, loading: true, error: null });
      if (!user?.id || typeof id !== "string" || !id.trim()) {
        setState({
          patrol: null,
          loading: false,
          error: "This patrol is not available.",
        });
      } else {
        getAssignedPatrol(id, user.id, controller.signal, !!offline && !offline.online)
          .then((patrol) => {
            if (attempt === generation.current)
              setState({ patrol, loading: false, error: null });
          })
          .catch((error) => {
            if (attempt !== generation.current) return;
            const status = error.response?.status;
            const message =
              status === 404
                ? "This patrol is not available."
                : [401, 403].includes(status)
                  ? "Your session cannot access this patrol. Please sign in again."
                  : "Unable to load the patrol route. Check your connection and try again.";
            setState({ patrol: null, loading: false, error: message });
          });
      }
      return () => {
        generation.current++;
        controller.abort();
      };
    }, [id, user?.id, revision, offline?.online]),
  );
  return { ...state, refresh: () => setRevision((value) => value + 1) };
}
