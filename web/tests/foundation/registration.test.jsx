import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Register from '../../src/pages/Register/Register';
import { registerAccount } from '../../src/services/authApi';
vi.mock('../../src/services/authApi',()=>({registerAccount:vi.fn()}));
beforeEach(()=>{ registerAccount.mockReset(); });
function mount(){render(<MemoryRouter initialEntries={['/register']}><Routes><Route path="/register" element={<Register/>}/><Route path="/login" element={<div>Login destination</div>}/></Routes></MemoryRouter>);return userEvent.setup()}
async function fill(user,overrides={}){for(const [label,value] of Object.entries({'Full Name *':'Test User','Email Address *':'test@example.com','Password *':'Test1234','Confirm Password *':'Test1234',...overrides})){if(value)await user.type(screen.getByLabelText(label,{exact:true}),value)}}
test('renders accessible registration and password toggles',async()=>{const user=mount();expect(screen.getByRole('heading',{name:'Create your account'})).toBeVisible();await user.click(screen.getByRole('button',{name:'Show password'}));expect(screen.getByLabelText('Password *',{exact:true})).toHaveAttribute('type','text')});
test('empty fields and terms block requests',async()=>{const user=mount();await user.click(screen.getByRole('button',{name:'Create Account'}));expect(screen.getByText(/Enter your full name/)).toBeVisible();expect(screen.getByText('Accept the Terms & Privacy to continue.')).toBeVisible();expect(registerAccount).not.toHaveBeenCalled()});
test.each([
 [{'Email Address *':'invalid'},'Enter a valid email address.'],
 [{'Password *':'weak'},'Choose a password that meets all requirements.'],
 [{'Confirm Password *':'Different123'},'Passwords must match.']
])('validates fields',async(overrides,message)=>{const user=mount();await fill(user,overrides);await user.click(screen.getByRole('checkbox'));await user.click(screen.getByRole('button',{name:'Create Account'}));expect(screen.getByText(message)).toBeVisible();expect(registerAccount).not.toHaveBeenCalled()});
test('valid form requires terms',async()=>{const user=mount();await fill(user);await user.click(screen.getByRole('button',{name:'Create Account'}));expect(registerAccount).not.toHaveBeenCalled();expect(screen.getByText('Accept the Terms & Privacy to continue.')).toBeVisible()});
test('loading locks submit and API success navigates to login',async()=>{let resolve;registerAccount.mockReturnValue(new Promise(r=>resolve=r));const user=mount();await fill(user);await user.click(screen.getByRole('checkbox'));await user.click(screen.getByRole('button',{name:'Create Account'}));expect(screen.getByRole('button',{name:'Creating account…'})).toBeDisabled();resolve({success:true,user:{id:'1'}});expect(await screen.findByText('Login destination')).toBeVisible();expect(registerAccount).toHaveBeenCalledTimes(1)});
test('duplicate email stays on form',async()=>{registerAccount.mockRejectedValue({response:{status:409}});const user=mount();await fill(user);await user.click(screen.getByRole('checkbox'));await user.click(screen.getByRole('button',{name:'Create Account'}));expect(await screen.findByText('An account with this email already exists.')).toBeVisible();expect(screen.queryByText('Login destination')).not.toBeInTheDocument()});
