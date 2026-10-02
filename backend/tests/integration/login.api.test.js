const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
jest.mock('../../src/config/database', () => ({ user: { findUnique: jest.fn() } }));
const db = require('../../src/config/database');
const app = require('../../src/app');
const user = { id:'login-test', name:'Test Ranger', email:'ranger@example.test', phone:null, role:'RANGER', isActive:true };
beforeAll(async () => { user.passwordHash = await bcrypt.hash('Testing123!', 12); });
beforeEach(() => { process.env.JWT_SECRET = 'isolated-test-secret-at-least-32-characters'; db.user.findUnique.mockReset().mockResolvedValue(user); });
test('login normalizes email, verifies bcrypt, returns safe profile and usable session',async()=>{
 const {body} = await request(app).post('/api/auth/login').send({email:' Ranger@Example.test ',password:'Testing123!'}).expect(200);
 expect(db.user.findUnique.mock.calls[0][0].where.email).toBe(user.email);
 expect(body.user).toEqual({id:user.id,name:user.name,email:user.email,phone:null,role:'RANGER'});
 expect(JSON.stringify(body)).not.toMatch(/password|Testing123|isActive/);
 const session=await request(app).get('/api/auth/me').set('Authorization',`Bearer ${body.token}`).expect(200);
 expect(session.body.user).toEqual(body.user);
});
test.each(['wrong','unknown','inactive'])('safe failure for %s credentials',async(kind)=>{
 if(kind==='unknown')db.user.findUnique.mockResolvedValue(null);
 if(kind==='inactive')db.user.findUnique.mockResolvedValue({...user,isActive:false});
 const {body}=await request(app).post('/api/auth/login').send({email:user.email,password:kind==='wrong'?'incorrect':'Testing123!'}).expect(401);
 expect(body).toEqual({success:false,message:'Invalid email or password.'});
});
test.each([{}, {email:'invalid',password:'abc'}, {email:user.email}, {password:'Testing123!'}, {email:user.email,password:123}, {email:user.email,password:'a'.repeat(73)}])('rejects malformed input',async input=>{await request(app).post('/api/auth/login').send(input).expect(400);expect(db.user.findUnique).not.toHaveBeenCalled();});
test('rejects malformed JSON',async()=>{await request(app).post('/api/auth/login').set('Content-Type','application/json').send('{').expect(400);});
test('requires valid unexpired session',async()=>{
 await request(app).get('/api/auth/me').expect(401);
 await request(app).get('/api/auth/me').set('Authorization','Bearer invalid').expect(401);
 const token=jwt.sign({},process.env.JWT_SECRET,{subject:user.id,expiresIn:-1,issuer:'wildguard-lk',audience:'wildguard-web'});
 await request(app).get('/api/auth/me').set('Authorization',`Bearer ${token}`).expect(401);
});
test('database errors stay private',async()=>{db.user.findUnique.mockRejectedValue(new Error('private database info'));const {body}=await request(app).post('/api/auth/login').send({email:user.email,password:'Testing123!'}).expect(500);expect(body.message).toBe('Internal server error');});
