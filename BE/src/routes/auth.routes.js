import { Router } from 'express';
import { createAuthRepository } from '../repositories/auth.repository.js';
import { createAuthService } from '../service/auth.service.js';
import { createAuthController } from '../controller/auth.controller.js';
import { createEmailOtpService } from '../service/email-otp.service.js';

export function createAuthRouter(database, options = {}) {
  const emailOtp = createEmailOtpService(database, options);
  const service = createAuthService(createAuthRepository(database));
  const controller = createAuthController(service);
  const router = Router();
  router.post('/forgot-password/otp', async (req, res, next) => {
    try { res.json({ data: await emailOtp.send(req.body || {}, 'reset') }); }
    catch (error) { next(error); }
  });
  router.post('/reset-password', async (req, res, next) => {
    try { res.json({ data: await emailOtp.reset(req.body || {}) }); }
    catch (error) { next(error); }
  });
  router.post('/login', controller.login);
  router.get('/me', controller.me);
  router.post('/logout', controller.logout);
  return router;
}
