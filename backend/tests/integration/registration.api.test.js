const request = require('supertest');
const bcrypt = require('bcryptjs');
jest.mock('../../src/config/database', () => ({ user: { findUnique: jest.fn(), create: jest.fn() } }));
const prisma = require('../../src/config/database');
const app = require('../../src/app');
const valid = { name: '  Test User  ', email: '  Test@Example.com  ', phone: ' 0771234567 ', password: 'Test1234' };
beforeEach(() => {
 prisma.user.findUnique.mockReset().mockResolvedValue(null);
 prisma.user.create.mockReset().mockImplementation(async ({data}) => ({id:'test-id',...data}));
});
test('persists through the complete layers, normalizes fields, hashes and returns only safe data', async () => {
 const {body} = await request(app).post('/api/auth/register').send({...valid,confirmPassword:valid.password,termsAccepted:true,parkId:'attack',isActive:false}).expect(201);
 const data = prisma.user.create.mock.calls[0][0].data;
 expect(data).toEqual({name:'Test User',email:'test@example.com',phone:'0771234567',passwordHash:expect.any(String),role:'COMMUNITY_USER'});
 expect(await bcrypt.compare(valid.password,data.passwordHash)).toBe(true);
 expect(data.passwordHash).not.toBe(valid.password);
 expect(prisma.user.findUnique).toHaveBeenCalledWith({where:{email:'test@example.com'},select:{id:true}});
 expect(body).toEqual({success:true,message:'Account created successfully',user:{id:'test-id',name:'Test User',email:'test@example.com',phone:'0771234567',role:'COMMUNITY_USER'}});
 expect(JSON.stringify(body)).not.toMatch(/password|Test1234|termsAccepted|confirmPassword/);
});
test.each(['ADMIN','PARK_RANGER','RANGER','PARK_MANAGER','COMMUNITY_LIAISON','RESEARCHER'])('cannot self-assign %s',async role => {
 const {body}=await request(app).post('/api/auth/register').send({...valid,role}).expect(201);
 expect(body.user.role).toBe('COMMUNITY_USER');
 expect(prisma.user.create.mock.calls[0][0].data.role).toBe('COMMUNITY_USER');
});
test.each([
 ['name',''],['name','   '],['name',123],['email','invalid'],['email',null],
 ['password','short'],['password','lowercase1'],['password','UPPERCASE1'],['password','NoNumbers'],['password','A1'+ 'a'.repeat(71)],['password','A1a'+'😀'.repeat(18)],['phone',12],['phone','abc']
])('rejects invalid %s (%s)',async (field,value) => {
 const {body}=await request(app).post('/api/auth/register').send({...valid,[field]:value}).expect(400);
 expect(body.errors[field]).toBeTruthy(); expect(prisma.user.create).not.toHaveBeenCalled();
});
test('missing body rejected',async()=>{await request(app).post('/api/auth/register').expect(400)});
test('optional phone omitted',async()=>{await request(app).post('/api/auth/register').send({...valid,phone:undefined}).expect(201);expect(prisma.user.create.mock.calls[0][0].data.phone).toBeNull()});
test('duplicate email rejected',async()=>{prisma.user.findUnique.mockResolvedValue({id:'existing'});await request(app).post('/api/auth/register').send(valid).expect(409);expect(prisma.user.create).not.toHaveBeenCalled()});
test('concurrent unique violation becomes 409',async()=>{prisma.user.create.mockRejectedValue({code:'P2002'});await request(app).post('/api/auth/register').send(valid).expect(409)});
test.each(['findUnique','create'])('safe database failure from %s',async method=>{prisma.user[method].mockRejectedValue(new Error('secret database credentials'));const {body}=await request(app).post('/api/auth/register').send(valid).expect(500);expect(body).toEqual({success:false,message:'Internal server error'})});
