const express = require('express');
const { createHash, randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const mongoose = require('mongoose');
const HttpError = require('../utils/http-error');
const normalizePhone = require('../utils/phone');
const registration = require('./registration.routes');
const { AUTH_COLLECTIONS, AUTH_CONFIG } = require('../config/auth.constants');

const router = express.Router();
const deriveKey = promisify(scrypt);
const cookieName = AUTH_CONFIG.SESSION_COOKIE_NAME;
const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' };
const digest = (token) => createHash('sha256').update(token).digest('hex');
const sessions = () => mongoose.connection.db.collection(AUTH_COLLECTIONS.SESSIONS);
const users = () => mongoose.connection.db.collection(AUTH_COLLECTIONS.USERS);
const loginAttempts = () => mongoose.connection.db.collection(AUTH_COLLECTIONS.LOGIN_ATTEMPTS);
let loginAttemptIndex;

async function limitLogin(req, _res, next) {
  const now = Date.now();
  try {
    loginAttemptIndex ||= loginAttempts().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await loginAttemptIndex;
    const expiresAt = new Date(now + AUTH_CONFIG.LOGIN_ATTEMPT_WINDOW_MS);
    const key = digest(req.ip || req.socket.remoteAddress || 'unknown');
    const result = await loginAttempts().findOneAndUpdate({ _id: key }, [{ $set: {
      count: { $cond: [{ $gt: ['$expiresAt', new Date(now)] }, { $add: [{ $ifNull: ['$count', 0] }, 1] }, 1] },
      expiresAt: { $cond: [{ $gt: ['$expiresAt', new Date(now)] }, '$expiresAt', expiresAt] },
    } }], { upsert: true, returnDocument: 'after' });
    const attempt = result?.value && typeof result.value === 'object' ? result.value : result;
    if (attempt.count > AUTH_CONFIG.LOGIN_ATTEMPT_MAX) {
      return next(new HttpError(429, 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.'));
    }
    req.loginAttemptKey = key;
    return next();
  } catch (error) {
    loginAttemptIndex = undefined;
    return next(error);
  }
}

async function publicUser(user) {
  if (user?.status !== 'active') return null;
  const role = await mongoose.connection.db.collection('roles').findOne({ role_id: user.role_id });
  if (!role?.role_name) return null;
  return { user_id: user.user_id, role_id: user.role_id, full_name: user.full_name, status: user.status, role_name: role.role_name };
}

function readCookie(req, name) {
  const cookie = req.headers.cookie?.split(';').map((item) => item.trim()).find((item) => item.startsWith(name + '='));
  return cookie?.slice(name.length + 1);
}

function sessionId(req) {
  const token = readCookie(req, cookieName);
  return /^[a-f0-9]{64}$/.test(token || '') ? digest(token) : null;
}

async function attachUser(req, _res, next) {
  const id = sessionId(req);
  if (id) {
    const session = await sessions().findOne({ _id: id, expiresAt: { $gt: new Date() } });
    if (session) req.user = await publicUser(await users().findOne({ user_id: session.userId }));
  }
  next();
}

router.post('/login', limitLogin, async (req, res) => {
  const { identifier, password, remember } = req.body || {};
  if (typeof identifier !== 'string' || !identifier.trim() || identifier.length > 150 ||
      typeof password !== 'string' || !password || password.length > 256) {
    throw new HttpError(400, 'Vui lòng nhập email hoặc số điện thoại và mật khẩu hợp lệ.');
  }
  const login = identifier.trim();
  const exactMatch = login.includes('@') ? { email: login.toLowerCase() } : { phone: login };
  const canonicalPhone = normalizePhone(login);
  const account = await users().findOne(exactMatch) ||
    (canonicalPhone && canonicalPhone !== login ? await users().findOne({ phone: canonicalPhone }) : null);
  const hash = /^scrypt\$([^$]+)\$([\da-f]{128})$/i.exec(account?.password_hash || '');
  const key = await deriveKey(password, hash?.[1] || 'viettour-invalid-login', 64);
  const expected = hash ? Buffer.from(hash[2], 'hex') : Buffer.alloc(64);
  const user = timingSafeEqual(key, expected) && hash ? await publicUser(account) : null;
  if (!user) throw new HttpError(401, 'Email, số điện thoại hoặc mật khẩu không chính xác.');
  await startSession(req, res, user, remember === true);
});

async function startSession(req, res, user, remember = false) {
  const token = randomBytes(32).toString('hex');
  const maxAge = remember === true ? AUTH_CONFIG.REMEMBER_SESSION_DURATION_MS : AUTH_CONFIG.SESSION_DURATION_MS;
  await sessions().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await sessions().insertOne({ _id: digest(token), userId: user.user_id, expiresAt: new Date(Date.now() + maxAge) });
  const previous = sessionId(req);
  if (previous) await sessions().deleteOne({ _id: previous });
  await loginAttempts().deleteOne({ _id: req.loginAttemptKey });
  res.cookie(cookieName, token, { ...cookieOptions, ...(remember === true && { maxAge }) });
  res.json({ user });
}

router.use('/register', registration(limitLogin));

router.get('/me', attachUser, (req, res) => res.set('Cache-Control', 'no-store').json({ user: req.user || null }));
router.post('/logout', async (req, res) => {
  const id = sessionId(req);
  if (id) await sessions().deleteOne({ _id: id });
  res.clearCookie(cookieName, cookieOptions).sendStatus(204);
});

module.exports = { router, attachUser };
