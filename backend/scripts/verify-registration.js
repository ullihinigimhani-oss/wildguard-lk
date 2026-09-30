// Opt-in integration check against the configured development database. Cleans up only its own row.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/config/database');
async function main() {
 const email = 'registration-check-' + randomUUID() + '@example.test';
 const password = 'VerifyA1-' + randomUUID();
 let createdId;
 try {
  await request(app).get('/api/health').expect(200);
  const response = await request(app).post('/api/auth/register').send({ name:'  Registration Verification  ',email:'  '+email.toUpperCase()+'  ',password,role:'ADMIN',confirmPassword:password,termsAccepted:true }).expect(201);
  createdId = response.body.user.id;
  const saved = await prisma.user.findUniqueOrThrow({where:{id:createdId}});
  assert.equal(saved.email,email); assert.equal(saved.name,'Registration Verification'); assert.equal(saved.role,'COMMUNITY_USER');
  assert.equal(await bcrypt.compare(password,saved.passwordHash),true);
  assert.equal('confirmPassword' in saved,false); assert.equal('termsAccepted' in saved,false);
  assert.equal('passwordHash' in response.body.user,false); assert.equal('password' in response.body.user,false);
  await request(app).post('/api/auth/register').send({name:'Duplicate',email,password}).expect(409);
  console.log('PASS: health, real persistence, normalization, bcrypt, community role, safe response and duplicate rejection.');
 } finally {
  // The random address is owned exclusively by this verification, even if the HTTP response failed.
  await prisma.user.deleteMany({where:{email,...(createdId ? {id:createdId} : {})}});
  assert.equal(await prisma.user.count({where:{email}}),0);
  console.log('PASS: temporary verification account removed.');
  await prisma.$disconnect();
 }
}
main().catch(async()=>{console.error('Registration verification failed; inspect connectivity and rerun. No credentials printed.');await prisma.$disconnect();process.exitCode=1});
