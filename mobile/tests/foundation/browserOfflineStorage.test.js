import * as store from '../../src/storage/offlineStorage.web';
test.each([['01','database',[]],['02','enqueueGps',['r','p',{}]],['03','saveDraft',['r','p',null,{},null,[]]],['04','pending',['r','gps']],['05','retryAfter',['r']]])('[B4-WEB-%s] browser %s explicitly rejects unsupported durable storage',async(_id,method,args)=>{
 await expect(store[method](...args)).rejects.toThrow('native iPhone/Android app');
});
test('[B4-WEB-06] browser trail transform deduplicates equivalent timestamps and lets server replace local',()=>{
 const local={latitude:7,longitude:80,recordedAt:'2026-01-01T05:30:00+05:30',source:'local'},server={...local,recordedAt:'2026-01-01T00:00:00Z',source:'server'},earlier={...local,recordedAt:'2025-12-31T23:59:59Z'};
 expect(store.mergeTrail([server],[local,earlier])).toEqual([earlier,server]); expect(local.source).toBe('local');
});
