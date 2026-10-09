import React from "react";
import { Text, Pressable } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { OnboardingProvider, useOnboarding } from "../../src/hooks/useOnboarding";
import { AuthProvider, useAuth } from "../../src/hooks/useAuth";
import { readOnboardingCompletion, saveOnboardingCompletion } from "../../src/storage/onboardingStorage";
import { loginAccount, getSessionUser } from "../../src/services/authApi";
import { createLinking } from "../../src/navigation/linking";
jest.mock("../../src/storage/onboardingStorage",()=>({readOnboardingCompletion:jest.fn(),saveOnboardingCompletion:jest.fn()}));
jest.mock("../../src/services/authApi",()=>({loginAccount:jest.fn(),getSessionUser:jest.fn()}));
jest.mock("../../src/services/api",()=>({api:{defaults:{headers:{common:{}}},interceptors:{response:{use:jest.fn(),eject:jest.fn()}}}}));
let saved;
function Harness() {
 const onboarding=useOnboarding(); const auth=useAuth();
 const linking=createLinking({...auth,...onboarding});
 const state=linking.getStateFromPath('/');
 return <><Text>{onboarding.isReady ? state.routes[0].name : 'Loading'}</Text>
 <Pressable accessibilityRole="button" accessibilityLabel="Finish" onPress={onboarding.completeOnboarding}/>
 <Pressable accessibilityRole="button" accessibilityLabel="Login" onPress={()=>auth.login({email:'test@example.test',password:'Testing123!'})}/>
 <Pressable accessibilityRole="button" accessibilityLabel="Logout" onPress={auth.logout}/></>;
}
const mount=()=>render(<OnboardingProvider><AuthProvider><Harness/></AuthProvider></OnboardingProvider>);
beforeEach(()=>{
 saved=false;
 readOnboardingCompletion.mockImplementation(async()=>saved);
 saveOnboardingCompletion.mockImplementation(async()=>{saved=true;});
 loginAccount.mockResolvedValue({token:'token',expiresAt:Date.now()+3600000});
 getSessionUser.mockResolvedValue({id:'r1',name:'Ranger',role:'RANGER'});
});
test('first entry, completion, two accounts, logout and restart keep onboarding separate',async()=>{
 let ui=mount(); await ui.findByText('Onboarding1');
 fireEvent.press(ui.getByLabelText('Finish')); await ui.findByText('Welcome'); expect(saved).toBe(true);
 fireEvent.press(ui.getByLabelText('Login')); await ui.findByText('Home');
 fireEvent.press(ui.getByLabelText('Logout')); await ui.findByText('Welcome');
 getSessionUser.mockResolvedValue({id:'c1',name:'Community',role:'COMMUNITY_USER'});
 fireEvent.press(ui.getByLabelText('Login')); await ui.findByText('Profile');
 fireEvent.press(ui.getByLabelText('Logout')); await ui.findByText('Welcome');
 expect(saveOnboardingCompletion).toHaveBeenCalledTimes(1);
 ui.unmount(); ui=mount(); await ui.findByText('Welcome');
});
test('logout after direct login returns Welcome even if onboarding was never finished',async()=>{
 const ui=mount(); await ui.findByText('Onboarding1');
 fireEvent.press(ui.getByLabelText('Login')); await ui.findByText('Home');
 fireEvent.press(ui.getByLabelText('Logout')); await ui.findByText('Welcome');
 expect(saved).toBe(false); expect(saveOnboardingCompletion).not.toHaveBeenCalled();
});
test('completed startup waits for storage and preserves explicit public deep links',async()=>{
 saved=true; const ui=mount(); expect(ui.getByText('Loading')).toBeTruthy(); await ui.findByText('Welcome');
 const linking=createLinking({hasCompletedOnboarding:true});
 expect(linking.getStateFromPath('/login').routes[0].name).toBe('Login');
 expect(linking.getStateFromPath('/onboarding/1').routes[0].name).toBe('Onboarding1');
});
