import * as native from 'expo-location';
import { requestLocationPermission,isLocationServicesEnabled,getCurrentDeviceLocation } from '../../src/services/locationService';
jest.mock('expo-location',()=>({requestForegroundPermissionsAsync:jest.fn(),isLocationEnabledAsync:jest.fn(),getCurrentPositionAsync:jest.fn(),Accuracy:{Balanced:3}}));
beforeEach(()=>{jest.resetAllMocks(); native.requestForegroundPermissionsAsync.mockResolvedValue({status:'granted',canAskAgain:true}); native.isLocationEnabledAsync.mockResolvedValue(true);});
afterEach(()=>jest.useRealTimers());
test('[B4-GPS-01] permission response normalizes grant and canAskAgain',async()=>{
 expect(await requestLocationPermission()).toEqual({granted:true,canAskAgain:true}); native.requestForegroundPermissionsAsync.mockResolvedValue({status:'denied',canAskAgain:0}); expect(await requestLocationPermission()).toEqual({granted:false,canAskAgain:false});
});
test('[B4-GPS-02] native permission exception returns denied recovery information',async()=>{
 native.requestForegroundPermissionsAsync.mockRejectedValue(new Error('permission unavailable')); expect(await requestLocationPermission()).toEqual({granted:false,canAskAgain:false,error:'permission unavailable'});
});
test('[B4-GPS-03] service-check exception preserves attempt-location fallback',async()=>{
 native.isLocationEnabledAsync.mockRejectedValue(new Error('native check failed')); expect(await isLocationServicesEnabled()).toBe(true);
});
test('[B4-GPS-04] disabled GPS stops before requesting permissions or position',async()=>{
 native.isLocationEnabledAsync.mockResolvedValue(false); expect(await getCurrentDeviceLocation()).toMatchObject({success:false,errorCode:'GPS_DISABLED'}); expect(native.requestForegroundPermissionsAsync).not.toHaveBeenCalled(); expect(native.getCurrentPositionAsync).not.toHaveBeenCalled();
});
test('[B4-GPS-05] denied permission stops before reading position',async()=>{
 native.requestForegroundPermissionsAsync.mockResolvedValue({status:'denied'}); expect(await getCurrentDeviceLocation()).toMatchObject({success:false,errorCode:'PERMISSION_DENIED'}); expect(native.getCurrentPositionAsync).not.toHaveBeenCalled();
});
test('[B4-GPS-06] GPS coordinates preserve six decimals and round accuracy',async()=>{
 native.getCurrentPositionAsync.mockResolvedValue({coords:{latitude:7.51234567,longitude:80.71234567,accuracy:10.6},timestamp:1000}); expect(await getCurrentDeviceLocation()).toEqual({success:true,coords:{latitude:7.512346,longitude:80.712346,accuracy:11}}); expect(native.getCurrentPositionAsync).toHaveBeenCalledWith({accuracy:3});
});
test.each([['07',-90,-180],['08',90,180],['09',0,0]])('[B4-GPS-%s] exact latitude %s longitude %s boundaries are valid',async(_id,latitude,longitude)=>{
 native.getCurrentPositionAsync.mockResolvedValue({coords:{latitude,longitude,accuracy:undefined}}); expect(await getCurrentDeviceLocation()).toEqual({success:true,coords:{latitude,longitude,accuracy:null}});
});
test.each([['10',null],['11',{}],['12',{coords:{latitude:'7',longitude:80}}],['13',{coords:{latitude:NaN,longitude:80}}],['14',{coords:{latitude:90.000001,longitude:80}}],['15',{coords:{latitude:7,longitude:-180.000001}}]])('[B4-GPS-%s] invalid GPS reading %j is unavailable',async(_id,reading)=>{
 native.getCurrentPositionAsync.mockResolvedValue(reading); expect(await getCurrentDeviceLocation()).toMatchObject({success:false,errorCode:'UNAVAILABLE'});
});
test('[B4-GPS-16] native timeout error maps safely and releases timer',async()=>{
 jest.useFakeTimers(); native.getCurrentPositionAsync.mockRejectedValue(new Error('native request timed out')); expect(await getCurrentDeviceLocation()).toMatchObject({success:false,errorCode:'TIMEOUT'}); expect(jest.getTimerCount()).toBe(0);
});
test('[B4-GPS-17] native exception returns generic unavailable without private native detail',async()=>{
 native.getCurrentPositionAsync.mockRejectedValue(new Error('fixture-private-native-info')); const result=await getCurrentDeviceLocation(); expect(result.errorCode).toBe('UNAVAILABLE'); expect(result.error).not.toContain('private');
});
test('[B4-GPS-18] pending GPS times out exactly at configured boundary and clears timer',async()=>{
 jest.useFakeTimers(); native.getCurrentPositionAsync.mockReturnValue(new Promise(()=>{})); let settled=false; const result=getCurrentDeviceLocation({timeout:1000}).then(value=>{settled=true;return value;}); await jest.advanceTimersByTimeAsync(999); expect(settled).toBe(false); await jest.advanceTimersByTimeAsync(1); expect(await result).toMatchObject({success:false,errorCode:'TIMEOUT'}); expect(jest.getTimerCount()).toBe(0);
});
test.each([['19',0,0],['20','invalid',null],['21',-1,null]])('[B4-GPS-%s] accuracy %j preserves valid zero or safely drops invalid metadata',async(_id,accuracy,expected)=>{
 native.getCurrentPositionAsync.mockResolvedValue({coords:{latitude:7,longitude:80,accuracy}}); expect(await getCurrentDeviceLocation()).toEqual({success:true,coords:{latitude:7,longitude:80,accuracy:expected}});
});
