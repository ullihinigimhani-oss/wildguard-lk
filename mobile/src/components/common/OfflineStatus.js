import React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from './Typography';
import { useOffline } from '../../hooks/useOffline';
export default function OfflineStatus() {
  const state = useOffline();
  if (!state) return null;
  return <View style={{
    padding: 12,
    backgroundColor: '#DCE9DD',
    gap: 4
  }}><Text accessibilityLiveRegion="polite" style={{
      color: '#174D3A'
    }}>{state.error || `${state.online ? 'Online' : 'Offline'} · ${state.syncing ? 'Syncing' : state.failed ? 'Sync failed / needs review' : state.pending || state.drafts ? 'Saved on device' : 'Synced'} · ${state.pending} pending · ${state.drafts} drafts · ${state.failed} need attention`}</Text>{state.paused && <Text>Sign in again to resume sync. Pending data is retained.</Text>}{(state.pending > 0 || state.failed > 0) && <Pressable accessibilityRole="button" accessibilityLabel="Retry Sync" disabled={!state.online || state.syncing || state.paused} onPress={() => state.retry().catch(() => {})} style={{
      minHeight: 44,
      justifyContent: 'center'
    }}><Text style={{
        color: '#174D3A'
      }}>Retry Sync</Text></Pressable>}</View>;
}
