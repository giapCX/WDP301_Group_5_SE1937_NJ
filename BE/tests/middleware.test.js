import mongoose from 'mongoose';
import { getModels } from '../src/models/index.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { createAuthMiddleware } from '../src/middleware/auth.middleware.js';
import { env } from '../src/config/env.js';
import { errorHandler } from '../src/middleware/error.middleware.js';
import { httpError } from '../src/utils/http-error.js';

const { ObjectId } = Types;

test('error middleware preserves safe garage blockers and service-unavailable responses', () => {
  const details = { blockers: [{ code: 'INVALID_PHYSICAL_STATUS' }] };
  const response = {
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; },
  };
  errorHandler(httpError(409, 'Blocked', details), {}, response, () => {});
  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.body.error.details, details);
  errorHandler(httpError(503, 'Replica set required'), {}, response, () => {});
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error.message, 'Replica set required');
});

test('error middleware hides unexpected server error details', (t) => {
  t.mock.method(console, 'error', () => {});
  const response = {
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; },
  };
  errorHandler(httpError(500, 'Private database information', { secret: true }), {}, response, () => {});
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { error: { message: 'Internal server error.' } });
});

test('Mongoose validation and duplicate-key errors use safe HTTP responses', () => {
  const response = {
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; },
  };
  for (const error of [new mongoose.Error.ValidationError(), new mongoose.Error.CastError('ObjectId', 'private-value', 'vehicle_id'), new mongoose.Error.StrictModeError('private-field')]) {
    errorHandler(error, {}, response, () => {});
    assert.equal(response.statusCode, 400);
    assert.equal(JSON.stringify(response.body).includes('private'), false);
  }
  errorHandler({ code: 11000, keyValue: { email: 'private@example.com' } }, {}, response, () => {});
  assert.equal(response.statusCode, 409);
  assert.equal(JSON.stringify(response.body).includes('private'), false);
});

test('authentication middleware attaches the active user to the request', async () => {
  const user = { _id: new ObjectId(), account_status: 'active' };
  const database = mongoose.createConnection();
  getModels(database).User.findOne = () => ({ lean: async () => user });
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
  const database = mongoose.createConnection();
  getModels(database).User.findOne = () => ({ lean: async () => { throw failure; } });
  const token = jwt.sign({ sub: new ObjectId().toString() }, env.jwtSecret);
  await createAuthMiddleware(database)(
    { headers: { authorization: `Bearer ${token}` } }, {},
    error => assert.equal(error, failure),
  );
});

test('authentication middleware rejects missing and invalid tokens before querying MongoDB', async () => {
  const database = mongoose.createConnection();
  getModels(database).User.findOne = () => assert.fail('Unexpected database query');
  for (const authorization of [undefined, 'Bearer invalid']) {
    let failure;
    await createAuthMiddleware(database)(
      { headers: { authorization } }, {}, error => { failure = error; },
    );
    assert.equal(failure.status, 401);
  }
});
