import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../common/Typography';
import Button from '../common/Button';
import { downloadPackage, deletePackage, packagePlan, providerBlocker } from '../../services/offlineMaps';
import { approvedOfflineMapProvider } from '../../services/offlineMapProvider';
import { styles } from '../../constants/rangerTheme';
export default function OfflineMapControls({ patrol, offline, saved, refresh }) {
  const [progress,setProgress]=useState(null),[error,setError]=useState(null),[confirm,setConfirm]=useState(false), pending=useRef(null), mounted=useRef(true);
  useEffect(() => { mounted.current=true; return () => { mounted.current=false; pending.current?.abort(); }; },[]);
  useEffect(() => { if(offline && (!offline.online || offline.pending>0)) pending.current?.abort(); },[offline?.online,offline?.pending]);
  if(!offline) return null;
  let plan=null;try{if(saved.snapshot?.route)plan=packagePlan(patrol,saved.snapshot.route);}catch{}
  async function download(){
    if(pending.current)return;
    const controller=new AbortController();pending.current=controller;setError(null);setProgress(0);
    try{await downloadPackage(offline.owner,patrol,saved.snapshot,{signal:controller.signal,onProgress:value=>{if(mounted.current)setProgress(Math.max(0,Math.min(1,value)));},fieldDataPending:offline.pending>0});}
    catch(e){if(mounted.current)setError(e.message);}
    finally{pending.current=null;if(mounted.current){setProgress(null);refresh();}}
  }
  return <View style={{gap:8,padding:16,borderRadius:16,backgroundColor:'#DCEDE1'}}>
    <Text style={styles.text}>Offline patrol map</Text>
    {!approvedOfflineMapProvider && <Text style={styles.muted}>{providerBlocker}</Text>}
    <Text style={styles.muted}>{saved.metadata?.status || 'Not downloaded'}{saved.metadata?.size ? ` - ${(saved.metadata.size/1048576).toFixed(1)} MB` : ''}</Text>
    {saved.metadata?.downloadedAt && <Text style={styles.muted}>Downloaded {new Date(saved.metadata.downloadedAt).toLocaleString()}</Text>}
    {plan && <Text style={styles.muted}>Estimated {(plan.estimatedBytes/1048576).toFixed(1)} MB; zoom {plan.minZoom}-{plan.maxZoom}; {plan.marginMeters} m margin. Temporary storage requires about twice the estimate plus 10 MB.</Text>}
    <Text style={styles.muted}>{saved.snapshot?.route ? 'Cached planned route available' : 'No verified cached planned route yet. Open navigation online to load it.'}</Text>
    {progress!==null ? <><Text style={styles.muted}>Downloading: {Math.round(progress*100)}%</Text><Button title="Cancel download" secondary onPress={()=>pending.current?.abort()} /></> : <Button title={saved.metadata?.status==='READY'?'Update Offline Map':'Download Offline Map'} secondary disabled={!approvedOfflineMapProvider || !offline.online || !plan || offline.pending>0} onPress={download} />}
    {saved.metadata && !confirm && <Button title="Delete Offline Map" secondary onPress={()=>setConfirm(true)} />}
    {confirm && <><Text style={styles.muted}>Delete only the map package? GPS, incidents and evidence will stay on this device.</Text><Button title="Confirm map deletion" secondary disabled={progress!==null} onPress={async()=>{try{await deletePackage(offline.owner,patrol.id);setConfirm(false);refresh();}catch(e){setError(e.message);}}}/><Button title="Keep map" secondary onPress={()=>setConfirm(false)} /></>}
    {(error||saved.error||saved.metadata?.error) && <Text accessibilityRole="alert" style={styles.error}>{error||saved.error||saved.metadata?.error}</Text>}
  </View>;
}
