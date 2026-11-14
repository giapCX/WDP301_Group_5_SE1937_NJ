import nodemailer from 'nodemailer';
import { randomInt, createHmac } from 'node:crypto';
import { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { httpError } from '../utils/http-error.js';

export function createEmailOtpService(connection, { sendEmail } = {}) {
  const codes = connection.db.collection('email_otp_challenges');
  const limits = connection.db.collection('email_otp_limits');
  const users = connection.db.collection('users');
  let ready;
  const emailOf = value => {
    if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw httpError(400, 'Email không hợp lệ.');
    return value.trim().toLowerCase();
  };
  const digest = (id, code) => createHmac('sha256', env.jwtSecret).update(`${id}:${code}`).digest('hex');
  const account = email => users.findOne({ email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
  const deliver = sendEmail || (async ({ email, code, purpose }) => {
    const SMTP_HOST = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
    const SMTP_PORT = process.env.SMTP_PORT?.trim() || '587';
    const SMTP_USER = process.env.SMTP_USER?.trim();
    const SMTP_PASS = process.env.SMTP_PASS;
    const MAIL_FROM = process.env.MAIL_FROM?.trim() || SMTP_USER;
    if (!SMTP_USER || !SMTP_PASS?.trim()) throw httpError(503, 'Chưa có tài khoản gửi email: cần điền SMTP_USER và SMTP_PASS (mật khẩu ứng dụng) trong BE/.env, sau đó khởi động lại backend.');
    const transport = nodemailer.createTransport({ host: SMTP_HOST, port: Number(SMTP_PORT), secure: Number(SMTP_PORT) === 465, requireTLS: Number(SMTP_PORT) !== 465, auth: { user: SMTP_USER, pass: SMTP_PASS }, connectionTimeout: 10000, socketTimeout: 15000 });
    try {
      const result = await transport.sendMail({ from: MAIL_FROM, to: email, subject: `XeDi - Mã xác nhận ${purpose === 'register' ? 'đăng ký' : 'đặt lại mật khẩu'}`, text: `Mã OTP của bạn là ${code}. Mã có hiệu lực 5 phút. Không chia sẻ mã này với bất kỳ ai.` });
      if (!result.accepted?.length) throw new Error('Email rejected');
    } catch (error) {
      if (error.code === 'EAUTH') throw httpError(503, 'Máy chủ email từ chối đăng nhập SMTP. Nếu dùng Gmail, hãy điền App Password vào SMTP_PASS (không dùng mật khẩu đăng nhập Gmail), kiểm tra SMTP_USER rồi khởi động lại backend.');
      if (['EDNS', 'ECONNECTION', 'ETIMEDOUT', 'ESOCKET'].includes(error.code)) throw httpError(503, 'Không kết nối được máy chủ gửi email. Kiểm tra mạng, SMTP_HOST và SMTP_PORT rồi thử lại.');
      throw httpError(503, 'Không gửi được email OTP. Kiểm tra cấu hình SMTP và thử lại.');
    } finally { transport.close(); }
  });
  return {
    async send(body, purpose) {
      const email = emailOf(body.email);
      const user = await account(email);
      if (purpose === 'register' && user) throw httpError(409, 'Email đã có tài khoản.');
      if (purpose === 'reset' && (!user || user.account_status !== 'active')) throw httpError(400, 'Không tìm thấy tài khoản đang hoạt động với email này.');
      await (ready ||= Promise.all([codes.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }), limits.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 })]).catch(error => { ready = undefined; throw error; }));
      const now = new Date(), key = `${purpose}:${email}`, id = new Types.ObjectId();
      try {
        await limits.updateOne({ _id: key, next_at: { $lte: now } }, { $set: { next_at: new Date(+now + 60000), expires_at: new Date(+now + 3600000), request_id: id } }, { upsert: true });
      } catch (error) { if (error.code === 11000) throw httpError(429, 'Vui lòng chờ 60 giây trước khi gửi lại OTP.'); throw error; }
      const code = String(randomInt(100000, 1000000)), expires_at = new Date(+now + 300000);
      await codes.insertOne({ _id: id, email, purpose, user_id: user?._id, account_email: user?.email, code_hash: digest(id, code), attempts: 0, used: false, delivered: false, expires_at });
      try {
        await deliver({ email, code, purpose });
        await codes.updateOne({ _id: id }, { $set: { delivered: true } });
      } catch (error) {
        await codes.deleteOne({ _id: id });
        await limits.deleteOne({ _id: key, request_id: id });
        throw error;
      }
      return { challenge_id: String(id), expires_at };
    },
    async verify(body, purpose) {
      const email = emailOf(body.email);
      if (!/^[a-f\d]{24}$/i.test(String(body.challenge_id || ''))) throw httpError(400, 'Vui lòng gửi mã OTP qua email trước.');
      const filter = { _id: new Types.ObjectId(body.challenge_id), email, purpose, delivered: true, used: false, expires_at: { $gt: new Date() }, attempts: { $lt: 5 } };
      // Reserve an attempt atomically, including concurrent requests.
      const challenge = await codes.findOneAndUpdate(filter, { $inc: { attempts: 1 } }, { returnDocument: 'before' });
      if (!challenge || !/^\d{6}$/.test(String(body.otp)) || challenge.code_hash !== digest(challenge._id, body.otp)) throw httpError(400, 'OTP không đúng, hết hạn hoặc đã bị khóa.');
      return async session => {
        const result = await codes.updateOne({ ...filter, expires_at: { $gt: new Date() }, attempts: { $lte: 5 } }, { $set: { used: true } }, { session });
        if (result.modifiedCount !== 1) throw httpError(400, 'OTP đã sử dụng hoặc hết hạn.');
        return challenge;
      };
    },
    async reset(body) {
      if (typeof body.password !== 'string' || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,32}$/.test(body.password) || body.password !== body.confirm_password) throw httpError(400, 'Mật khẩu 8–32 ký tự gồm hoa, thường, số, ký tự đặc biệt và xác nhận phải trùng nhau.');
      const consume = await this.verify(body, 'reset');
      const password_hash = await bcrypt.hash(body.password, 12);
      const session = await connection.startSession();
      try {
        await session.withTransaction(async () => {
          const challenge = await consume(session);
          const result = await users.updateOne({ _id: challenge.user_id, email: challenge.account_email, account_status: 'active' }, { $set: { password_hash, updated_at: new Date() } }, { session });
          if (!result.matchedCount) throw httpError(400, 'Tài khoản đã thay đổi. Vui lòng yêu cầu mã mới.');
        });
      } finally { await session.endSession(); }
      return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.' };
    }
  };
}
