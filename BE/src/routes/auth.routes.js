import { Router } from 'express';
import { createAuthRepository } from '../repositories/auth.repository.js';
import { createAuthService } from '../services/auth.service.js';
import { createAuthController } from '../controllers/auth.controller.js';
import { createEmailOtpService } from '../services/email-otp.service.js';

export function createAuthRouter(database, options = {}) {
  const emailOtp = createEmailOtpService(database, options);
  const service = createAuthService(createAuthRepository(database));
  const controller = createAuthController(service, emailOtp);
  const router = Router();
  router.post('/forgot-password/otp', controller.requestPasswordReset);
  router.post('/reset-password', controller.resetPassword);
  router.post('/login', controller.login);
  router.post('/login/otp', controller.requestLoginOtp);
  router.post('/login/otp/verify', controller.loginWithOtp);
  router.post('/renter/login', controller.renterLogin);
  router.post('/renter/login/otp/verify', controller.renterLoginWithOtp);
  router.get('/me', controller.me);
  router.post('/logout', controller.logout);
  return router;
}
