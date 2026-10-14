import {act,renderHook,waitFor} from '@testing-library/react-native';
import useApiHealth from '../../src/hooks/useApiHealth';
import useIncidentResource from '../../src/hooks/useIncidentResource';
import {getHealth} from '../../src/services/api';
jest.mock('../../src/services/api',()=>({getHealth:jest.fn()}));
jest.mock('@react-navigation/native',()=>({useFocusEffect:callback=>require('react').useEffect(callback,[callback])}));
beforeEach(()=>jest.resetAllMocks());
test('[B4-HEALTH-01] healthy API transitions Checking to connected with signal',async()=>{
 getHealth.mockResolvedValue({success:true,database:'connected'}); const view=renderHook(useApiHealth); expect(view.result.current).toBe('Checking API'); await waitFor(()=>expect(view.result.current).toBe('API connected')); expect(getHealth).toHaveBeenCalledWith(expect.any(AbortSignal)); view.unmount();
});
test.each([['02',{success:false,database:'connected'},'API unavailable'],['03',{success:true,database:'disconnected'},'API unavailable'],['04',null,'API unavailable or not configured']])('[B4-HEALTH-%s] malformed or unhealthy %j returns safe state',async(_id,data,state)=>{
 getHealth.mockResolvedValue(data); const view=renderHook(useApiHealth); await waitFor(()=>expect(view.result.current).toBe(state)); view.unmount();
});
test('[B4-HEALTH-05] health transport error gives recoverable unavailable state',async()=>{
 getHealth.mockRejectedValue(new Error('offline')); const view=renderHook(useApiHealth); await waitFor(()=>expect(view.result.current).toBe('API unavailable or not configured')); view.unmount();
});
test('[B4-HEALTH-06] unmount aborts request and ignores late health success',async()=>{
 let resolve; getHealth.mockReturnValue(new Promise(r=>{resolve=r;})); const view=renderHook(useApiHealth); const signal=getHealth.mock.calls[0][0]; view.unmount(); await act(async()=>resolve({success:true,database:'connected'})); expect(signal.aborted).toBe(true); expect(view.result.current).toBe('Checking API');
});
test('[B4-RES-01] focus resource publishes confirmed data and finishes loading',async()=>{
 const loader=jest.fn(async()=>({id:'i'})),view=renderHook(()=>useIncidentResource(loader)); await waitFor(()=>expect(view.result.current.data).toEqual({id:'i'})); expect(view.result.current.loading).toBe(false); expect(loader).toHaveBeenCalledWith(expect.any(AbortSignal)); view.unmount();
});
test('[B4-RES-02] refresh aborts previous request and ignores its late success',async()=>{
 let resolve; const loader=jest.fn().mockReturnValueOnce(new Promise(r=>{resolve=r;})).mockResolvedValue({id:'new'}); const view=renderHook(()=>useIncidentResource(loader)); await waitFor(()=>expect(loader).toHaveBeenCalledTimes(1)); const signal=loader.mock.calls[0][0]; act(()=>view.result.current.refresh()); await waitFor(()=>expect(view.result.current.data).toEqual({id:'new'})); await act(async()=>resolve({id:'old'})); expect(signal.aborted).toBe(true); expect(view.result.current.data.id).toBe('new'); view.unmount();
});
test('[B4-RES-03] old failure after refresh cannot overwrite successful current data',async()=>{
 let reject; const loader=jest.fn().mockReturnValueOnce(new Promise((_r,r)=>{reject=r;})).mockResolvedValue({id:'new'}); const view=renderHook(()=>useIncidentResource(loader)); await waitFor(()=>expect(loader).toHaveBeenCalledTimes(1)); act(()=>view.result.current.refresh()); await waitFor(()=>expect(view.result.current.data.id).toBe('new')); await act(async()=>reject(new Error('old failure'))); expect(view.result.current.error).toBeNull(); expect(view.result.current.data.id).toBe('new'); view.unmount();
});
test('[B4-RES-04] synchronous loader exception is sanitized and refresh recovers',async()=>{
 const loader=jest.fn().mockImplementationOnce(()=>{throw new Error('fixture-private');}).mockResolvedValue({id:'i'}); const view=renderHook(()=>useIncidentResource(loader)); await waitFor(()=>expect(view.result.current.error).toBeTruthy()); expect(view.result.current.error).not.toContain('private'); act(()=>view.result.current.refresh()); await waitFor(()=>expect(view.result.current.data.id).toBe('i')); expect(view.result.current.error).toBeNull(); view.unmount();
});
test('[B4-RES-05] unmount aborts pending focus resource and late failure stays ignored',async()=>{
 let reject; const loader=jest.fn(()=>new Promise((_r,r)=>{reject=r;})),view=renderHook(()=>useIncidentResource(loader)); await waitFor(()=>expect(loader).toHaveBeenCalled()); const signal=loader.mock.calls[0][0]; view.unmount(); await act(async()=>reject(new Error('late'))); expect(signal.aborted).toBe(true); expect(view.result.current.error).toBeNull();
});
