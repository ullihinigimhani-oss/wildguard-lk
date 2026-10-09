import { readOnboardingCompletion, saveOnboardingCompletion } from '../../src/storage/onboardingStorage';
import * as webStorage from '../../src/storage/onboardingStorage.web';
let mockContent;
jest.mock('expo-file-system',()=>({Paths:{document:'documents'},File:class {
 get exists(){return mockContent !== undefined;}
 create(){mockContent='';}
 write(value){mockContent=value;}
 async text(){return mockContent;}
}}));
test('native document storage persists only the completion flag',async()=>{
 mockContent=undefined; expect(await readOnboardingCompletion()).toBe(false);
 await saveOnboardingCompletion(); expect(mockContent).toBe('true'); expect(await readOnboardingCompletion()).toBe(true);
});
test('web local storage persists completion',async()=>{
 const original=global.window;
 const values={};
 global.window={localStorage:{getItem:key=>values[key],setItem:(key,value)=>{values[key]=value;}}};
 try {
  expect(await webStorage.readOnboardingCompletion()).toBe(false);
  await webStorage.saveOnboardingCompletion(); expect(await webStorage.readOnboardingCompletion()).toBe(true);
  expect(values).toEqual({'wildguard.onboarding.completed.v1':'true'});
 } finally {global.window=original;}
});
