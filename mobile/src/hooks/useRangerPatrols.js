import { useCallback, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { listMyPatrols } from "../services/patrolApi";
import { useOffline } from "./useOffline";
import { useAuth } from "./useAuth";
import {cachePatrols,cachedPatrols} from '../storage/offlineStorage';
export default function useRangerPatrols() {
  const { user } = useAuth();
  const offline = useOffline();
  const [state, setState] = useState({ patrols: [], loading: true, error: null });
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    let pending = false;
    setState({ patrols: [], loading: true, error: null });
    function load() {
      if (pending || controller.signal.aborted) return;
      pending = true;
      const local = !!offline && !offline.online;
      (local ? cachedPatrols(user.id) : listMyPatrols(controller.signal)).then(patrols => {
        if (!local) cachePatrols(user.id,patrols).catch(()=>{});
        if (!controller.signal.aborted) setState({ patrols, loading: false, offline: local, error: local && !patrols.length ? "Open your assigned patrols online once to save a field snapshot." : null });
      }).catch(async error => {
        if (!error.response) {
          try { const patrols=await cachedPatrols(user.id);if(!controller.signal.aborted&&patrols.length){setState({patrols,loading:false,error:null,offline:true});return;} }catch { /* Normal error remains available. */ }
        }
        if (!controller.signal.aborted) setState({ patrols: [], loading: false, error: "Unable to load your patrols. Please try again." });
      }).finally(() => { pending = false; });
    }
    load();
    const interval = setInterval(() => { if (AppState.currentState === "active") load(); }, 30000);
    const listener = AppState.addEventListener("change", status => { if (status === "active") load(); });
    return () => { clearInterval(interval); listener.remove(); controller.abort(); };
  }, [user.id, revision, offline?.online]));
  return { ...state, refresh: () => setRevision(value => value + 1) };
}
