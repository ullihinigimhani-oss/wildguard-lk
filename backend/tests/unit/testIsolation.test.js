const net = require('node:net');
const http = require('node:http');
const https = require('node:https');
const tls = require('node:tls');
const dns = require('node:dns');

test.each(['../../src/config/database', 'pg', '@prisma/adapter-pg', 'dotenv', 'dotenv/config'])(
  'unmocked %s fails before opening a connection or loading environment files', module => {
    expect(() => jest.requireActual(module)).toThrow('TEST_DATABASE_BLOCKED');
  },
);
test('requireActual and direct generated-client imports cannot initialize Prisma', () => {
  for (const module of ['@prisma/client', '@prisma/client/edge', '../../node_modules/.prisma/client/index.js']) {
    const { PrismaClient, Prisma } = jest.requireActual(module);
    expect(Prisma.dmmf.datamodel.models.length).toBeGreaterThan(0);
    expect(() => new PrismaClient()).toThrow('TEST_DATABASE_BLOCKED');
  }
  const runtime = jest.requireActual('@prisma/client/runtime/client.js');
  const Client = runtime.getPrismaClient({});
  expect(() => new Client()).toThrow('TEST_DATABASE_BLOCKED');
});
test('application environment import does not invoke dotenv or restore a real URL', () => {
  const environment = jest.requireActual('../../src/config/environment');
  expect(environment.DATABASE_URL).toBe('postgresql://test:test@127.0.0.1:1/blocked_test_database');
});
test('changing NODE_ENV or DATABASE_URL cannot bypass the resolver guards', () => {
  const previousMode = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://fixture:fixture@database.example.test:5432/fixture';
    jest.isolateModules(() => {
      expect(() => jest.requireActual('../../src/config/database')).toThrow('TEST_DATABASE_BLOCKED');
      expect(() => new (jest.requireActual('@prisma/client').PrismaClient)()).toThrow('TEST_DATABASE_BLOCKED');
      expect(() => jest.requireActual('dotenv/config')).toThrow('TEST_DATABASE_BLOCKED');
    });
  } finally {
    process.env.NODE_ENV = previousMode;
    process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/blocked_test_database';
  }
});
test('an explicit database mock works, while requireActual still fails closed', () => {
  jest.isolateModules(() => {
    jest.doMock('../../src/config/database', () => ({ user: { findUnique: jest.fn() } }));
    expect(jest.isMockFunction(require('../../src/config/database').user.findUnique)).toBe(true);
    expect(() => jest.requireActual('../../src/config/database')).toThrow('TEST_DATABASE_BLOCKED');
    // Database mocks must not accidentally mock the driver or dotenv guards.
    expect(() => jest.requireActual('pg')).toThrow('TEST_DATABASE_BLOCKED');
    expect(() => jest.requireActual('dotenv')).toThrow('TEST_DATABASE_BLOCKED');
  });
});
test.each([() => http.get('http://example.test'), () => https.get('https://example.test'),
  () => net.connect(5432, '127.0.0.1'), () => net.connect(5432, 'example.test'),
  () => tls.connect(443, 'example.test'), () => dns.lookup('example.test'), () => dns.resolveTxt('example.test')])(
  'unit transport %# fails before any network IO', operation => expect(operation).toThrow('TEST_NETWORK_BLOCKED'),
);
test('unit fetch is blocked', async () => {
  await expect(fetch('https://example.test')).rejects.toThrow('TEST_NETWORK_BLOCKED');
});
test('unit tests cannot start a local server to bypass isolation', () => {
  expect(() => http.createServer().listen(0)).toThrow('TEST_NETWORK_BLOCKED');
});
