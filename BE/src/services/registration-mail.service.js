const nodemailer = require('nodemailer');
const HttpError = require('../utils/http-error');

function createTransport() {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s/g, '');
  if (!user || !pass) throw new HttpError(503, 'Dịch vụ email VietTour chưa được cấu hình.');
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

async function sendRegistrationOtp(email, code) {
  const transport = createTransport();
  try {
    await transport.sendMail({
      from: { name: 'VietTour', address: process.env.SMTP_USER.trim() },
      to: email,
      subject: 'VietTour | Mã xác nhận đăng ký tài khoản',
      text: 'Mã xác nhận đăng ký tài khoản VietTour của bạn là ' + code +
        '. Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu đăng ký, hãy bỏ qua email này.',
    });
  } catch (error) {
    console.error('VietTour SMTP:', error.code || error.name);
    throw new HttpError(502, 'Chưa gửi được email xác nhận. Vui lòng thử lại sau.');
  } finally {
    transport.close();
  }
}

module.exports = { createTransport, sendRegistrationOtp };
