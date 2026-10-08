import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Network from 'expo-network';
import { useAuth } from './useAuth';
import * as store from '../storage/offlineStorage';
import { configureSync, subscribeSync, syncState, kickSync, retrySync } from '../services/offlineSync';
const Context = createContext(null);
export const useOffline = () => useContext(Context);
export function OfflineProvider({
  children
}) {
  const auth = useAuth();
  const owner = auth?.isAuthenticated && !auth?.isDemo && auth.user?.role === 'RANGER' ? auth.user.id : null;
  const [status, setStatus] = useState({
    online: false,
    pending: 0,
    failed: 0,
    drafts: 0,
    syncing: false,
    error: null
  });
  useEffect(() => {
    let cancelled = false;
    setStatus({
      owner,
      online: false,
      pending: 0,
      failed: 0,
      drafts: 0,
      syncing: false,
      error: null
    });
    async function refresh() {
      try {
        const current = owner ? await store.counts(owner) : {
          pending: 0,
          failed: 0,
          drafts: 0
        };
        if (!cancelled) setStatus(value => ({
          ...value,
          ...current,
          ...syncState()
        }));
      } catch {
        if (!cancelled) setStatus(value => ({
          ...value,
          error: 'Local field storage is unavailable. Pending data has not been deleted.'
        }));
      }
    }
    if (Platform.OS === 'web' || !owner) {
      configureSync(null, false).catch(() => {});
      return;
    }
    async function networkChanged(network) {
      if (cancelled) return;
      const connected = network.isConnected === true && network.isInternetReachable !== false;
      try {
        await configureSync(owner, connected);
        await refresh();
      } catch {
        if (!cancelled) setStatus(value => ({
          ...value,
          error: 'Local field storage could not be initialized.'
        }));
      }
    }
    Network.getNetworkStateAsync().then(networkChanged).catch(() => networkChanged({
      isConnected: false
    }));
    const subscription = Network.addNetworkStateListener(networkChanged);
    const unsubscribe = subscribeSync(refresh);
    const app = AppState.addEventListener('change', state => {
      if (state === 'active') Network.getNetworkStateAsync().then(networkChanged).catch(() => {});
    });
    const timer = setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      subscription?.remove?.();
      unsubscribe();
      app.remove();
      clearInterval(timer);
      configureSync(null, false).catch(() => {});
    };
  }, [owner]);
  return <Context.Provider value={owner && Platform.OS !== 'web' ? {
    ...(status.owner === owner ? status : {
      online: false,
      pending: 0,
      failed: 0,
      drafts: 0,
      syncing: false,
      error: null
    }),
    owner,
    retry: retrySync,
    wake: kickSync
  } : null}>{children}</Context.Provider>;
}
