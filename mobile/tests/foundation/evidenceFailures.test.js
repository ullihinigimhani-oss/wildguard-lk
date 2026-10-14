import {api} from '../../src/services/api';
import {uploadIncidentEvidence,getEvidenceAccess,evidenceError} from '../../src/services/incidentEvidenceApi';
import {ensureEvidencePrepared,discardEvidenceFile} from '../../src/utils/incidentEvidence';
jest.mock('../../src/services/api',()=>({api:{get:jest.fn(),post:jest.fn(),defaults:{baseURL:'https://fixture.example/api'}}}));
jest.mock('../../src/utils/incidentEvidence',()=>({ensureEvidencePrepared:jest.fn(async item=>item),discardEvidenceFile:jest.fn()}));
const item={uri:'file:///fixture-owned/photo.jpg',name:'photo.jpg',mimeType:'image/jpeg',size:100,source:'GALLERY_UPLOAD',uploadKey:'stable-fixture-upload-key'};
const OriginalFormData=global.FormData;
beforeEach(()=>{jest.resetAllMocks(); jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z')); ensureEvidencePrepared.mockImplementation(async value=>value); global.FormData=class{constructor(){this.parts=[];}append(...args){this.parts.push(args);}};});
afterEach(()=>{global.FormData=OriginalFormData; jest.useRealTimers();});
test('[B4-EVID-01] missing local file fails preparation before any HTTP and retains local metadata',async()=>{
 const error=Object.assign(new Error('fixture local file missing'),{code:'LOCAL_MEDIA_UNAVAILABLE'}); ensureEvidencePrepared.mockRejectedValue(error); await expect(uploadIncidentEvidence('i',item)).rejects.toBe(error); expect(api.post).not.toHaveBeenCalled(); expect(discardEvidenceFile).not.toHaveBeenCalled(); expect(evidenceError(error)).toMatch(/select it again/);
});
test.each([['02',null],['03',{success:true,evidence:{}}],['04',{success:false,evidence:{id:'e'}}]])('[B4-EVID-%s] malformed confirmation %j never discards local evidence',async(_id,data)=>{
 api.post.mockResolvedValue({data}); await expect(uploadIncidentEvidence('i',item)).rejects.toThrow('did not confirm'); expect(discardEvidenceFile).not.toHaveBeenCalled();
});
test('[B4-EVID-05] invalid receipt identifier fails before status polling',async()=>{
 api.post.mockResolvedValue({data:{success:true,upload:{status:'PROCESSING',id:'../other'}}}); await expect(uploadIncidentEvidence('i',item)).rejects.toThrow('upload receipt'); expect(api.get).not.toHaveBeenCalled(); expect(discardEvidenceFile).not.toHaveBeenCalled();
});
test('[B4-EVID-06] expired receipt rejection retains item and supports stable-key retry',async()=>{
 const error={response:{status:404,data:{code:'UPLOAD_RECEIPT_UNAVAILABLE',message:'fixture-private'}}}; api.post.mockResolvedValueOnce({data:{success:true,upload:{status:'PROCESSING',id:'receipt'}}}).mockResolvedValue({data:{success:true,evidence:{id:'e'}}}); api.get.mockRejectedValue(error);
 const outcome=uploadIncidentEvidence('i',item).catch(value=>value); await jest.advanceTimersByTimeAsync(1000); expect(await outcome).toBe(error); expect(discardEvidenceFile).not.toHaveBeenCalled(); expect(evidenceError(error)).toMatch(/Retry the same evidence/);
 expect(await uploadIncidentEvidence('i',item)).toEqual({id:'e'}); for(const [_path,body] of api.post.mock.calls) expect(body.parts).toContainEqual(['uploadKey',item.uploadKey]); expect(discardEvidenceFile).toHaveBeenCalledTimes(1);
});
test('[B4-EVID-07] status network interruption rejects once and preserves item for retry',async()=>{
 api.post.mockResolvedValue({data:{success:true,upload:{status:'PROCESSING',id:'receipt'}}}); const error=new Error('connection interrupted'); api.get.mockRejectedValue(error);
 const outcome=uploadIncidentEvidence('i',item).catch(value=>value); await jest.advanceTimersByTimeAsync(1000); expect(await outcome).toBe(error); expect(api.get).toHaveBeenCalledTimes(1); expect(error.evidenceDiagnostic.stage).toBe('client_transport'); expect(discardEvidenceFile).not.toHaveBeenCalled();
});
test('[B4-EVID-08] malformed polling response rejects without invented evidence ID',async()=>{
 api.post.mockResolvedValue({data:{success:true,upload:{status:'PROCESSING',id:'receipt'}}}); api.get.mockResolvedValue({data:{success:true,upload:{status:'COMPLETE'}}}); const outcome=uploadIncidentEvidence('i',item).catch(value=>value); await jest.advanceTimersByTimeAsync(1000); expect(await outcome).toEqual(expect.any(Error)); expect(discardEvidenceFile).not.toHaveBeenCalled();
});
test.each([['09','2025-12-31T23:59:59.999Z'],['10','2026-01-01T00:00:00.000Z']])('[B4-EVID-%s] expired ticket at %s cannot be returned as accessible',async(_id,expiresAt)=>{
 api.get.mockResolvedValue({data:{success:true,access:{path:'/incidents/i/evidence/e/media?ticket=fixture',expiresAt}}}); await expect(getEvidenceAccess('i','e')).rejects.toThrow('could not be confirmed');
});
test('[B4-EVID-11] abort during receipt wait settles promptly without polling or discarding',async()=>{
 const controller=new AbortController(); api.post.mockResolvedValue({data:{success:true,upload:{status:'PROCESSING',id:'receipt'}}}); api.get.mockRejectedValue(Object.assign(new Error('cancelled'),{name:'CanceledError'})); let settled=false;
 const outcome=uploadIncidentEvidence('i',item,undefined,{signal:controller.signal}).catch(error=>{settled=true;return error;}); await jest.advanceTimersByTimeAsync(0); controller.abort(); await jest.advanceTimersByTimeAsync(0);
 try {expect(settled).toBe(true); expect(api.get).not.toHaveBeenCalled(); expect(discardEvidenceFile).not.toHaveBeenCalled();}
 finally {await jest.advanceTimersByTimeAsync(1000); await outcome;}
});
test('[B4-EVID-12] retainLocal success keeps queued media and safe diagnostics exclude raw provider text',async()=>{
 api.post.mockResolvedValue({data:{success:true,evidence:{id:'e'}}}); expect(await uploadIncidentEvidence('i',item,undefined,{retainLocal:true})).toEqual({id:'e'}); expect(discardEvidenceFile).not.toHaveBeenCalled();
 const message=evidenceError({response:{status:503,data:{code:'UNKNOWN_PROVIDER',message:'fixture-private provider detail',diagnostic:{requestId:'invalid/reference',stage:'private'}}}}); expect(message).not.toMatch(/fixture-private|invalid\/reference|private provider/);
});
test('[B4-EVID-13] processing deadline stops polling with timeout and retains local file',async()=>{
 api.post.mockResolvedValue({data:{success:true,upload:{status:'PROCESSING',id:'receipt'}}}); api.get.mockResolvedValue({data:{success:true,upload:{status:'PROCESSING',id:'receipt'}}});
 const outcome=uploadIncidentEvidence('i',item).catch(error=>error); await jest.advanceTimersByTimeAsync(240000); const error=await outcome;
 expect(error).toMatchObject({code:'ETIMEDOUT',evidenceDiagnostic:{stage:'client_transport'}}); expect(discardEvidenceFile).not.toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
});
