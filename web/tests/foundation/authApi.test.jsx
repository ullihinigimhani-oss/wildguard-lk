import { registerAccount } from '../../src/services/authApi';
import { api } from '../../src/services/api';
vi.mock('../../src/services/api',()=>({api:{post:vi.fn()}}));
beforeEach(()=>{api.post.mockReset()});
test('uses shared API, normalizes and sends only allowed fields',async()=>{api.post.mockResolvedValue({data:{success:true,user:{id:'1'}}});await registerAccount({name:' Test ',email:' TEST@Example.com ',phone:' ',password:'Test1234',role:'ADMIN',confirmPassword:'Test1234',termsAccepted:true});expect(api.post).toHaveBeenCalledWith('/auth/register',{name:'Test',email:'test@example.com',phone:undefined,password:'Test1234'})});
test('does not treat unconfirmed response as success',async()=>{api.post.mockResolvedValue({data:{success:false}});await expect(registerAccount({name:'Test',email:'a@b.com',phone:'',password:'Test1234'})).rejects.toThrow('Registration was not confirmed')});
