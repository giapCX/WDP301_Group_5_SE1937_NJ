import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { createAuthMiddleware } from '../src/middlewares/auth.middleware.js';
import { env } from '../src/config/env.js';

test('authentication middleware attaches the active user to the request', async () => {
  const user = { _id: new ObjectId(), account_status: 'active' };
  const database = { collection: () => ({ findOne: async () => user }) };
  const token = jwt.sign({ sub: user._id.toString() }, env.jwtSecret);
  const request = { headers: { authorization: `Bearer ${token}` } };
  let nextCalled = false;
  await createAuthMiddleware(database)(request, {}, error => {
    assert.equal(error, undefined);
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(request.user, user);
  assert.equal(request.tokenPayload.sub, user._id.toString());
});

test('authentication middleware forwards database failures instead of reporting invalid credentials', async () => {
  const failure = new Error('Database unavailable');
  const database = { collection: () => ({ findOne: async () => { throw failure; } }) };
  const token = jwt.sign({ sub: new ObjectId().toString() }, env.jwtSecret);
  await createAuthMiddleware(database)(
    { headers: { authorization: `Bearer ${token}` } }, {},
    error => assert.equal(error, failure),
  );
});

test('authentication middleware rejects missing and invalid tokens before querying MongoDB', async () => {
  const database = { collection: () => ({ findOne: () => assert.fail('Unexpected database query') }) };
  for (const authorization of [undefined, 'Bearer invalid']) {
    let failure;
    await createAuthMiddleware(database)(
      { headers: { authorization } }, {}, error => { failure = error; },
    );
    assert.equal(failure.status, 401);
  }
});
