import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { createApp } from '../src/app.js';
import { connectDatabase, closeDatabase } from '../src/config/database.js';

let database;
let server;
let baseUrl;

before(async () => {
  database = await connectDatabase();
  server = createApp(database).listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
  await closeDatabase();
});

test('login requires account and password inputs', async () => {
  const emptyBodyRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(emptyBodyRes.status, 400);
  const emptyBody = await emptyBodyRes.json();
  assert.ok(emptyBody.error?.message);

  const missingPwRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: 'owner01@example.com' }),
  });
  assert.equal(missingPwRes.status, 400);
});

test('login rejects non-existent account and wrong password', async () => {
  const notFoundRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: 'nonexistent@example.com', password: 'password123' }),
  });
  assert.equal(notFoundRes.status, 401);

  const wrongPwRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: 'owner01@example.com', password: 'wrong-password' }),
  });
  assert.equal(wrongPwRes.status, 401);
});

test('login succeeds with email and seeded user in MongoDB', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: 'owner01@example.com', password: '123456' }),
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.data?.token, 'Response should contain a JWT token');
  assert.equal(body.data.user.email, 'owner01@example.com');
  assert.equal(body.data.user.full_name, 'Nguyễn Minh An');
  assert.equal(body.data.user.account_status, 'active');
  assert.equal(body.data.user.role?.code, 'OWNER');
  assert.ok(body.data.user.permissions?.includes('vehicle.register'));
  assert.equal(body.data.user.password_hash, undefined, 'Password hash must never be returned');

  // Verify GET /api/auth/me using the token
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${body.data.token}` },
  });
  assert.equal(meRes.status, 200);
  const meBody = await meRes.json();
  assert.equal(meBody.data.email, 'owner01@example.com');
  assert.equal(meBody.data.role?.code, 'OWNER');
});

test('login succeeds with phone number and case-insensitive email', async () => {
  // Case-insensitive email
  const emailRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: 'RENTER08@EXAMPLE.COM', password: '123456' }),
  });
  assert.equal(emailRes.status, 200);
  const emailData = await emailRes.json();
  assert.equal(emailData.data.user.role?.code, 'RENTER');

  // Exact phone number
  const phoneRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: '+84-000-0001', password: '123456' }),
  });
  assert.equal(phoneRes.status, 200);
  const phoneData = await phoneRes.json();
  assert.equal(phoneData.data.user.email, 'owner01@example.com');

  // Flexible phone with stripped dashes
  const strippedPhoneRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: '840000001', password: '123456' }),
  });
  assert.equal(strippedPhoneRes.status, 200);
});

test('login supports manager and admin roles with appropriate permissions', async () => {
  const adminRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: 'admin20@example.com', password: '123456' }),
  });
  assert.equal(adminRes.status, 200);
  const adminData = await adminRes.json();
  assert.equal(adminData.data.user.role?.code, 'ADMIN');

  const managerRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: 'manager19@example.com', password: '123456' }),
  });
  assert.equal(managerRes.status, 200);
  const managerData = await managerRes.json();
  assert.equal(managerData.data.user.role?.code, 'MANAGER');
});

test('login rejects suspended or inactive accounts', async () => {
  // Insert a temporary suspended user
  const tempUser = {
    email: 'suspended_test@example.com',
    phone: '+84-999-9999',
    password_hash: null,
    account_status: 'suspended',
    full_name: 'Khách hàng bị khóa',
    created_at: new Date(),
    updated_at: new Date(),
  };
  const insertResult = await database.collection('users').insertOne(tempUser);

  try {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: 'suspended_test@example.com', password: '123456' }),
    });
    assert.equal(res.status, 403);
  } finally {
    await database.collection('users').deleteOne({ _id: insertResult.insertedId });
  }
});
