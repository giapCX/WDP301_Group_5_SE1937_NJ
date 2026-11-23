const express = require('express');
const mongoose = require('mongoose');
const { createHmac, randomBytes, randomInt, scrypt } = require('node:crypto');
const { promisify } = require('node:util');
const mail = require('../services/registration-mail.service');
const HttpError = require('../utils/http-error');
const normalizePhone = require('../utils/phone');

const deriveKey = promisify(scrypt);
const otpSecret = process.env.OTP_SECRET || randomBytes(32);
const otpLifetime = 10 * 60 * 1000;
const resendDelay = 60 * 1000;
const normalize = (value) => typeof value === 'string' ? value.trim() : '';
const hashOtp = (email, id, code) => createHmac('sha256', otpSecret).update(JSON.stringify([email, id, code])).digest('hex');

function readEmail(value) {
  const email = normalize(value).toLowerCase();
  if (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Vui lòng nhập email hợp lệ.');
  }
  return email;
}

module.exports = function registrationRoutes(limitRequests) {
  const router = express.Router();
  router.post('/otp', limitRequests, async (req, res) => {
    const { db } = mongoose.connection;
    const email = readEmail(req.body?.email);
    const fullName = normalize(req.body?.fullName);
    const phone = normalizePhone(req.body?.phone);
    const password = req.body?.password;
    if (!fullName || fullName.length > 120 || typeof password !== 'string' || password.length < 8 || password.length > 256) {
      throw new HttpError(400, 'Nhập họ tên và mật khẩu từ 8 đến 256 ký tự.');
    }
    if (!phone) throw new HttpError(400, 'Vui lòng nhập số điện thoại hợp lệ, ví dụ 0912345678.');
    if (password !== req.body.confirmPassword) throw new HttpError(400, 'Mật khẩu xác nhận không khớp.');
    const users = db.collection('users');
    if (await users.findOne({ email }, { projection: { _id: 1 } })) {
      throw new HttpError(409, 'Email này đã có tài khoản VietTour.');
    }
    const challenges = db.collection('registration_otps');
    await challenges.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    const now = Date.now();
    const id = randomBytes(24).toString('hex');
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const salt = randomBytes(16).toString('hex');
    const key = await deriveKey(password, salt, 64);
    try {
      await challenges.updateOne({ _id: email, resendAt: { $lte: new Date(now) } }, {
        $set: { id, fullName, phone, passwordHash: 'scrypt$' + salt + '$' + key.toString('hex'),
          digest: hashOtp(email, id, code), attempts: 0,
          expiresAt: new Date(now + otpLifetime), resendAt: new Date(now + resendDelay) },
      }, { upsert: true });
    } catch (error) {
      if (error.code === 11000) throw new HttpError(429, 'Vui lòng chờ 60 giây trước khi gửi lại mã.');
      throw error;
    }
    try {
      await mail.sendRegistrationOtp(email, code);
    } catch (error) {
      await challenges.deleteOne({ _id: email, id });
      throw error;
    }
    res.status(202).json({ challengeId: id });
  });

  router.post('/verify', limitRequests, async (req, res) => {
    const { db } = mongoose.connection;
    const email = readEmail(req.body?.email);
    const { challengeId, code } = req.body;
    if (typeof challengeId !== 'string' || !/^[a-f0-9]{48}$/.test(challengeId) ||
        typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      throw new HttpError(400, 'Vui lòng nhập mã xác nhận gồm 6 chữ số.');
    }
    const role = await db.collection('roles').findOne({ role_name: 'renter' });
    if (!role) throw new HttpError(503, 'Chưa cấu hình vai trò Người thuê trong cơ sở dữ liệu.');
    const challenges = db.collection('registration_otps');
    const eligible = { _id: email, id: challengeId, phone: { $type: 'string' },
      expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } };
    const challenge = await challenges.findOneAndDelete({ ...eligible, digest: hashOtp(email, challengeId, code) });
    if (!challenge) {
      await challenges.updateOne(eligible, { $inc: { attempts: 1 } });
      throw new HttpError(400, 'Mã không đúng, đã hết hạn hoặc đã vượt quá số lần thử.');
    }

    const users = db.collection('users');
    const latest = await users.findOne({ user_id: { $type: 'number' } }, { sort: { user_id: -1 }, projection: { user_id: 1 } });
    const sequences = db.collection('sequences');
    await sequences.updateOne({ _id: 'users' }, { $max: { value: latest?.user_id || 0 } }, { upsert: true });
    const sequence = await sequences.findOneAndUpdate({ _id: 'users' }, { $inc: { value: 1 } }, { returnDocument: 'after' });
    try {
      await users.insertOne({ user_id: sequence.value, role_id: role.role_id, full_name: challenge.fullName,
        email, phone: challenge.phone, password_hash: challenge.passwordHash, status: 'active', created_at: new Date() });
    } catch (error) {
      if (error.code === 11000 && error.keyPattern?.email) throw new HttpError(409, 'Email này đã có tài khoản VietTour.');
      throw error;
    }
    res.status(201).json({ message: 'Đăng ký thành công. Bạn có thể đăng nhập VietTour.' });
  });
  return router;
};
