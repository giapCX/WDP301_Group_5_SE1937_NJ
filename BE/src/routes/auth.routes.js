import { Router } from 'express';
import { createAuthRepository } from '../repositories/auth.repository.js';
import { createAuthService } from '../service/auth.service.js';
import { createAuthController } from '../controller/auth.controller.js';
import { Types } from 'mongoose';
import { getModels } from '../models/index.js';
const { ObjectId } = Types;

function maskAccount(value) {
  if (typeof value !== 'string') return null;
  const account = value.trim();
  if (account.includes('@')) {
    const [name, domain] = account.split('@');
    return `${name.slice(0, 1)}***@${domain}`;
  }
  return account.length > 2 ? `***${account.slice(-2)}` : '***';
}

function maskedIp(request) {
  const ip = request.ip || '';
  const mappedIpv4 = ip.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)?.[1];
  if (mappedIpv4) return mappedIpv4.split('.').slice(0, 2).concat(['*', '*']).join('.');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip.split('.').slice(0, 2).concat(['*', '*']).join('.');
  return ip.split(':').slice(0, 4).join(':') || null;
}

export function createAuthRouter(database) {
  const service = createAuthService(createAuthRepository(database));
  const controller = createAuthController(service);
  const router = Router();
  router.post('/login', async (request, response, next) => {
    try {
      const result = await service.login(request.body);
      const userId = new ObjectId(result.data.user._id);
      try {
        await getModels(database).AuditLog.create({
          actor_user_id: userId, action: 'auth.login_success', entity_type: 'users', entity_id: userId,
          sanitized_changes: { roles: result.data.user.roles || [] }, ip_address_masked: maskedIp(request), created_at: new Date(),
        });
      } catch (auditError) {
        console.warn('Unable to record successful login audit event:', auditError.message);
      }
      return response.json(result);
    } catch (error) {
      if ([401, 403].includes(error.status)) {
        try {
          await getModels(database).AuditLog.create({
            actor_user_id: null, action: 'auth.login_failed', entity_type: 'authentication', entity_id: null,
            sanitized_changes: { account: maskAccount(request.body?.account ?? request.body?.email ?? request.body?.phone) },
            ip_address_masked: maskedIp(request), created_at: new Date(),
          });
        } catch (auditError) {
          console.warn('Unable to record failed login audit event:', auditError.message);
        }
      }
      return next(error);
    }
  });
  router.get('/me', controller.me);
  router.post('/logout', controller.logout);
  return router;
}
