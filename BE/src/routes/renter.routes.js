import { Router } from 'express';
import { createAuthMiddleware } from '../middleware/auth.middleware.js';
import { createRenterRepository } from '../repositories/renter.repository.js';
import { createRenterService } from '../service/renter.service.js';
import { createRenterController } from '../controller/renter.controller.js';
import { createRenterRoleMiddleware } from '../middleware/renter-role.middleware.js';
import { httpError } from '../utils/http-error.js';
export function createRenterRouter(database) {
  const router = Router(),
    c = createRenterController(createRenterService(createRenterRepository(database)));
  router.use((req, res, next) => {
    if (['POST', 'PUT'].includes(req.method) && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) return next(httpError(400, 'Dữ liệu yêu cầu phải là đối tượng JSON.'));
    next();
  });
  router.get('/config', c.config);
  router.post('/register/otp', (req, res, next) => {
    req.body = {
      ...req.body,
      purpose: 'register'
    };
    return c.challenge(req, res, next);
  });
  router.post('/register', c.register);
  router.use(createAuthMiddleware(database));
  router.use(createRenterRoleMiddleware(database));
  router.post('/otp', c.challenge);
  router.get('/profile', c.profile);
  router.put('/profile', c.updateProfile);
  router.put('/password', c.password);
  router.post('/kyc', c.ekyc);
  router.post('/files', c.upload);
  router.get('/files/:id', c.download);
  router.get('/bookings', c.bookings);
  router.post('/bookings', c.create);
  router.get('/bookings/:id', c.detail);
  router.post('/bookings/:id/voucher', c.voucher);
  router.post('/bookings/:id/sign', c.sign);
  router.post('/bookings/:id/pay', c.pay);
  router.get('/bookings/:id/cancellation', c.preview);
  router.post('/bookings/:id/cancel', c.cancel);
  router.get('/incidents', c.incidents);
  router.post('/incidents', c.report);
  return router;
}
