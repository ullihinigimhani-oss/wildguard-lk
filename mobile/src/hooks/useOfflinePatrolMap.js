import { useEffect, useState } from 'react';
import { readNavigation, navigationCacheError } from '../services/offlineMaps';
export default function useOfflinePatrolMap(owner, patrol, revision = 0) {
  const [state,setState] = useState({owner:null,patrolId:null,snapshot:null,error:null});
  const identity = JSON.stringify([patrol?.plannedRoute,patrol?.actualStartTime,patrol?.parkId,patrol?.park?.id]);
  useEffect(() => {
    let cancelled = false;
    if (!owner || !patrol) return;
    setState({owner,patrolId:patrol.id,snapshot:null,error:null});
    readNavigation(owner,patrol).then(snapshot => {
      if(!cancelled) setState({owner,patrolId:patrol.id,snapshot,error:null});
    }).catch(error => { if(!cancelled) setState({owner,patrolId:patrol.id,snapshot:null,error:`Cached patrol navigation could not be verified (${navigationCacheError(error)}). Refresh the patrol online; no current route safety can be claimed.`}); });
    return () => { cancelled=true; };
  },[owner,patrol?.id,identity,revision]);
  return state.owner === owner && state.patrolId === patrol?.id ? state : {snapshot:null,error:null};
}
