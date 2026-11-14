import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { connectTestDatabase, closeTestDatabase } from '../test-support/seeded-database.js';
import { createApp } from '../src/app.js';
import { createEmailOtpService } from '../src/service/email-otp.service.js';

let db, server, base;
const mailbox = new Map();
before(async () => {
  db = await connectTestDatabase();
  server = createApp(db, { sendEmail: async mail => mailbox.set(`${mail.purpose}:${mail.email}`, mail.code) }).listen(0, '127.0.0.1');
  await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } await closeTestDatabase(); });
async function post(path, body, expected = 200) {
  const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); return result.data;
}
test('registration requires emailed OTP; reset password returns account to usable login', async () => {
  const email = 'otp-flow@example.com';
  const body = { email, phone: '0987654321', full_name: 'Khách Kiểm Thử', password: 'Before123!', confirm_password: 'Before123!', agree_terms: true };
  await post('/renter/register', body, 400);
  assert.equal(await db.db.collection('users').countDocuments({ email }), 0);
  const challenge = await post('/renter/register/otp', { email });
  assert.equal(challenge.demo_code, undefined);
  await post('/renter/register/otp', { email }, 429);
  await post('/renter/register', { ...body, ...challenge, otp: 'wrong' }, 400);
  const otp = mailbox.get(`register:${email}`);
  await post('/auth/reset-password', { ...body, ...challenge, otp }, 400);
  await post('/renter/register', { ...body, ...challenge, otp }, 201);
  await post('/renter/register', { ...body, ...challenge, otp }, 400);
  await post('/renter/register/otp', { email: email.toUpperCase() }, 409);
  await post('/auth/login', { account: email, password: body.password });
  const reset = await post('/auth/forgot-password/otp', { email });
  const data = { email, ...reset, otp: mailbox.get(`reset:${email}`), password: 'After123!', confirm_password: 'After123!' };
  await post('/auth/reset-password', { ...data, email: 'different@example.com' }, 400);
  await post('/auth/reset-password', { ...data, confirm_password: 'mismatch' }, 400);
  await post('/auth/reset-password', data);
  await post('/auth/reset-password', data, 400);
  await post('/auth/login', { account: email, password: 'Before123!' }, 401);
  await post('/auth/login', { account: email, password: 'After123!' });
  await post('/auth/forgot-password/otp', { email: 'unknown@example.com' }, 400);
});
test('expiry, attempt limit and SMTP failure never authorize account creation', async () => {
  let code;
  const service = createEmailOtpService(db, { sendEmail: async mail => { code = mail.code; } });
  const email = 'otp-limits@example.com', first = await service.send({ email }, 'register');
  for (let i = 0; i < 5; i++) await assert.rejects(service.verify({ email, ...first, otp: 'invalid' }, 'register'), { status: 400 });
  await assert.rejects(service.verify({ email, ...first, otp: code }, 'register'), { status: 400 });
  const expired = await service.send({ email: 'expired@example.com' }, 'register');
  const { ObjectId } = await import('mongodb');
  await db.db.collection('email_otp_challenges').updateOne({ _id: new ObjectId(expired.challenge_id) }, { $set: { expires_at: new Date(0) } });
  await assert.rejects(service.verify({ email: 'expired@example.com', ...expired, otp: code }, 'register'), { status: 400 });
  const failed = createEmailOtpService(db, { sendEmail: async () => { throw new Error('SMTP offline'); } });
  await assert.rejects(failed.send({ email: 'failed@example.com' }, 'register'));
  assert.equal(await db.db.collection('email_otp_challenges').countDocuments({ email: 'failed@example.com' }), 0);
  await service.send({ email: 'failed@example.com' }, 'register');
});
