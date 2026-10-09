import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../common/Typography';
import PatrolMapSurface from './PatrolMapSurface';
import { buildOfflineMapDocument } from './offlineMapDocument';
import { styles } from '../../constants/rangerTheme';
export default function OfflinePatrolMap({ points, navigationData }) {
  const surface = useRef(null), [ready,setReady] = useState(false);
  const html = useMemo(() => buildOfflineMapDocument(points),[points]);
  useEffect(() => { setReady(false); },[html]);
  useEffect(() => { if(ready) surface.current?.updateNavigation(navigationData); },[ready,navigationData]);
  return <View style={{gap:8}}>
    <Text accessibilityRole="alert" style={styles.muted}>Offline Patrol View — No Basemap</Text>
    <View style={{height:440,borderRadius:24,overflow:'hidden'}}><PatrolMapSurface ref={surface} html={html} onMessage={m => { if(m.type==='map-ready') setReady(true); }} onError={() => setReady(false)} /></View>
  </View>;
}
