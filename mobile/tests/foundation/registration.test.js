import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import RegisterScreen from '../../src/screens/auth/RegisterScreen';
import { registerAccount } from '../../src/services/authApi';
jest.mock('../../src/services/authApi',()=>({registerAccount:jest.fn()}));
beforeEach(()=>registerAccount.mockReset());
function mount(){const navigation={navigate:jest.fn()};return {...render(<RegisterScreen navigation={navigation}/>),navigation}}
function fill(ui,overrides={}){Object.entries({'Full Name':'Test User','Email Address':'test@example.com','Password':'Test1234','Confirm Password':'Test1234',...overrides}).forEach(([label,value])=>fireEvent.changeText(ui.getByLabelText(label),value))}
test('renders form and toggles password',()=>{const ui=mount();expect(ui.getByRole('header').props.children).toBe('Create Account');fireEvent.press(ui.getByLabelText('Show password'));expect(ui.getByLabelText('Password').props.secureTextEntry).toBe(false)});
test('required fields block API',()=>{const ui=mount();fireEvent.press(ui.getByRole('button',{name:'Create Account'}));expect(ui.getByText(/Enter your full name/)).toBeTruthy();expect(registerAccount).not.toHaveBeenCalled()});
test.each([
 [{'Email Address':'invalid'},'Enter a valid email address.'],
 [{'Password':'weak'},'Choose a password that meets all requirements.'],
 [{'Confirm Password':'Different123'},'Passwords must match.']
])('validates fields', (overrides,message)=>{const ui=mount();fill(ui,overrides);fireEvent.press(ui.getByRole('checkbox'));fireEvent.press(ui.getByRole('button',{name:'Create Account'}));expect(ui.getByText(message)).toBeTruthy();expect(registerAccount).not.toHaveBeenCalled()});
test('requires terms',()=>{const ui=mount();fill(ui);fireEvent.press(ui.getByRole('button',{name:'Create Account'}));expect(ui.getByText('Accept the Terms & Privacy to continue.')).toBeTruthy();expect(registerAccount).not.toHaveBeenCalled()});
test('success returns to login with feedback and locks pending submit',async()=>{let resolve;registerAccount.mockReturnValue(new Promise(r=>resolve=r));const ui=mount();fill(ui);fireEvent.press(ui.getByRole('checkbox'));fireEvent.press(ui.getByRole('button',{name:'Create Account'}));expect(ui.getByRole('button',{name:'Create Account'}).props.accessibilityState.busy).toBe(true);resolve({success:true,user:{id:'1'}});await waitFor(()=>expect(ui.navigation.navigate).toHaveBeenCalledWith('Login',{registered:true}))});
test('duplicate email does not navigate',async()=>{registerAccount.mockRejectedValue({response:{status:409}});const ui=mount();fill(ui);fireEvent.press(ui.getByRole('checkbox'));fireEvent.press(ui.getByRole('button',{name:'Create Account'}));expect(await ui.findByText('An account with this email already exists.')).toBeTruthy();expect(ui.navigation.navigate).not.toHaveBeenCalled()});
