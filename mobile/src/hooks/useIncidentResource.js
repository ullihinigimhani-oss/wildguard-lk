import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { incidentError } from "../utils/incident";

// Focus-scoped reads are cancelled on blur; mutations are never automatically retried.
export default function useIncidentResource(loader) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const attempt = ++generation.current;
      const controller = new AbortController();
      setState((previous) => ({ ...previous, loading: true, error: null }));
      Promise.resolve()
        .then(() => loader(controller.signal))
        .then((data) => {
          if (attempt === generation.current)
            setState({ data, loading: false, error: null });
        })
        .catch((error) => {
          if (attempt === generation.current)
            setState({
              data: null,
              loading: false,
              error: incidentError(error),
            });
        });
      return () => {
        generation.current++;
        controller.abort();
      };
    }, [loader, revision]),
  );
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  return { ...state, refresh };
}
