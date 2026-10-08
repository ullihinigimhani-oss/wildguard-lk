import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useOffline } from "../../hooks/useOffline";
import { listDrafts } from "../../storage/offlineStorage";
import { Text } from "../common/Typography";
import { IncidentButton, ui } from "./IncidentUI";
export default function LocalDrafts({
  navigation
}) {
  const offline = useOffline(),
    focused = useIsFocused();
  const [snapshot, setDrafts] = useState({ owner: null, rows: [] });
  const drafts = snapshot.owner === offline?.owner ? snapshot.rows : [];
  useEffect(() => {
    let cancelled = false;
    if (!offline || !focused) {
      setDrafts({ owner: null, rows: [] });
      return;
    }
    const load = () => listDrafts(offline.owner).then(rows => {
      if (!cancelled) setDrafts({ owner: offline.owner, rows });
    }).catch(() => {
      if (!cancelled) setDrafts({ owner: null, rows: [] });
    });
    load();
    const timer = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [offline?.owner, focused]);
  if (!offline || !drafts.length) return null;
  return <View style={ui.card}><Text style={ui.section}>Reports saved on this device</Text>{drafts.map(draft => <View key={draft.id} style={{
      gap: 6,
      marginTop: 12
    }}><Text style={ui.title}>{draft.form.title || "Untitled field draft"}</Text><Text style={ui.muted}>{draft.status.replaceAll("_", " ")}{draft.server_id ? " - Incident saved" : " - Not yet submitted"}</Text>{draft.error && <Text style={ui.error}>{draft.error}</Text>}<IncidentButton secondary title={draft.server_id ? "View Saved Incident" : "Open Draft"} onPress={() => navigation.navigate(draft.server_id ? "IncidentDetails" : "IncidentCreate", draft.server_id ? {
        incidentId: draft.server_id
      } : {
        patrolId: draft.patrol_id,
        localDraftId: draft.id
      })} /></View>)}</View>;
}
