// Actual Axios with an explicit adapter; no native/browser transport is used.
let client;
const priorWindow=global.window;
try {
 global.window={location:{hostname:'localhost'}};
 jest.isolateModules(()=>{client=require('../../src/services/api');});
} finally {global.window=priorWindow;}
beforeEach(()=>{client.api.defaults.adapter=jest.fn(); delete client.api.defaults.headers.common.Authorization;});
test('[B4-CLIENT-01] actual health client carries bearer auth and cancellation signal',async()=>{
 client.api.defaults.headers.common.Authorization='Bearer fixture-token'; const signal=new AbortController().signal;
 client.api.defaults.adapter.mockImplementation(async config=>({data:{success:true,database:'connected'},status:200,statusText:'OK',headers:{},config}));
 expect(await client.getHealth(signal)).toEqual({success:true,database:'connected'}); const config=client.api.defaults.adapter.mock.calls[0][0]; expect(config.url).toBe('/health'); expect(config.baseURL).toBe('http://localhost:5000/api'); expect(config.headers.get('Authorization')).toBe('Bearer fixture-token'); expect(config.signal).toBe(signal);
});
test('[B4-CLIENT-02] pre-aborted actual Axios request never reaches transport',async()=>{
 const controller=new AbortController(); controller.abort(); await expect(client.getHealth(controller.signal)).rejects.toMatchObject({name:'CanceledError'}); expect(client.api.defaults.adapter).not.toHaveBeenCalled();
});
test('[B4-CLIENT-03] actual client transport rejection reaches caller unchanged',async()=>{
 const error=new Error('fixture offline'); client.api.defaults.adapter.mockRejectedValue(error); await expect(client.getHealth()).rejects.toBe(error);
});
