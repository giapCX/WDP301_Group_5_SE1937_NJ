import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { httpError } from '../utils/http-error.js';

const { ObjectId } = Types;
const ALLOWED_DEFAULT_PASSWORDS = new Set([env.defaultUserPassword, '123456', '12345678', 'password', 'password123', 'xedi123']);
function maskAccount(value) {
  if (typeof value !== 'string') return null;
  const account = value.trim();
  if (account.includes('@')) {
    const [name, domain] = account.split('@');
    return `${name.slice(0, 1)}***@${domain}`;
  }
  return account.length > 2 ? `***${account.slice(-2)}` : '***';
}
function maskedIp(value) {
  const ip = typeof value === 'string' ? value : '';
  const mappedIpv4 = ip.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)?.[1];
  if (mappedIpv4) return mappedIpv4.split('.').slice(0, 2).concat(['*', '*']).join('.');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip.split('.').slice(0, 2).concat(['*', '*']).join('.');
  return ip.split(':').slice(0, 4).join(':') || null;
}
async function populateUserRoles(repository, user) {
  let primaryRole = null;
  if (user.primary_role_id) {
    primaryRole = await repository.findRoleById(user.primary_role_id);
  }
  let additionalRoles = [];
  if (Array.isArray(user.additional_role_ids) && user.additional_role_ids.length > 0) {
    additionalRoles = await repository.findRolesByIds(user.additional_role_ids);
  }
  const roleCodes = [primaryRole?.code, ...additionalRoles.map(r => r.code)].filter(Boolean);
  const permissions = Array.from(new Set([...(primaryRole?.permissions || []), ...additionalRoles.flatMap(r => r.permissions || [])]));
  return {
    primaryRole,
    additionalRoles,
    roleCodes,
    permissions
  };
}
function sanitizeUser(user, rolesInfo) {
  return {
    _id: user._id.toString(),
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    account_status: user.account_status,
    primary_role_id: user.primary_role_id ? user.primary_role_id.toString() : null,
    role: rolesInfo.primaryRole ? {
      id: rolesInfo.primaryRole._id.toString(),
      code: rolesInfo.primaryRole.code,
      display_name: rolesInfo.primaryRole.display_name,
      permissions: rolesInfo.primaryRole.permissions || []
    } : null,
    roles: rolesInfo.roleCodes,
    permissions: rolesInfo.permissions,
    contact_profile: user.contact_profile || null,
    identity_kyc: user.identity_kyc ? {
      status: user.identity_kyc.status,
      id_masked: user.identity_kyc.id_masked,
      verified_at: user.identity_kyc.verified_at
    } : null,
    driver_license: user.driver_license || null,
    created_at: user.created_at,
    updated_at: user.updated_at
  };
}
export function createAuthService(repository) {
  async function recordLoginAudit({ actorId = null, action, account, roles, ip }) {
    try {
      await repository.createAudit({
        actor_user_id: actorId,
        action,
        entity_type: actorId ? 'users' : 'authentication',
        entity_id: actorId,
        sanitized_changes: actorId ? { roles: roles || [] } : { account: maskAccount(account) },
        ip_address_masked: maskedIp(ip),
        created_at: new Date(),
      });
    } catch (error) {
      console.warn('Unable to record login audit event:', error.message);
    }
  }
  return {
    async login(body, metadata = {}) {
      const rawAccount = body?.account ?? body?.email ?? body?.phone;
      const rawPassword = body?.password;
      if (!rawAccount || typeof rawAccount !== 'string' || !rawAccount.trim()) {
        throw httpError(400, 'Vui lòng nhập email hoặc số điện thoại.');
      }
      if (!rawPassword || typeof rawPassword !== 'string') {
        throw httpError(400, 'Vui lòng nhập mật khẩu.');
      }
      const account = rawAccount.trim();
      const password = rawPassword;

      // Find user in MongoDB users collection
      try {
        const user = await repository.findByAccount(account);
        if (!user) {
          throw httpError(401, 'Email/Số điện thoại hoặc mật khẩu không chính xác.');
        }

      // Check account status
        if (user.account_status !== 'active') {
          throw httpError(403, 'Tài khoản của bạn đang bị khóa hoặc chưa được kích hoạt. Vui lòng liên hệ hỗ trợ.');
        }

      // Verify password
        let isPasswordValid = false;
        if (user.password_hash) {
          isPasswordValid = await bcrypt.compare(password, user.password_hash);
        } else {
        // Seeded mock users have password_hash: null in MongoDB
          if (ALLOWED_DEFAULT_PASSWORDS.has(password)) {
            isPasswordValid = true;
          // Optionally update MongoDB with hashed password for security
            try {
              const hashedPassword = await bcrypt.hash(password, 10);
              await repository.updatePassword(user._id, hashedPassword);
            } catch (err) {
              console.warn('Failed to auto-hash password for user:', err.message);
            }
          }
        }
        if (!isPasswordValid) {
          throw httpError(401, 'Email/Số điện thoại hoặc mật khẩu không chính xác.');
        }

      // Load roles and permissions
        const rolesInfo = await populateUserRoles(repository, user);
        const safeUser = sanitizeUser(user, rolesInfo);

      // Create JWT token
        const token = jwt.sign({
        sub: user._id.toString(),
        email: user.email,
        phone: user.phone,
        role: rolesInfo.primaryRole?.code || 'RENTER',
        roles: rolesInfo.roleCodes,
        permissions: rolesInfo.permissions
        }, env.jwtSecret, {
          expiresIn: env.jwtExpiresIn
        });
        await recordLoginAudit({ actorId: user._id, action: 'auth.login_success', roles: safeUser.roles, ip: metadata.ip });
        return {
          data: {
            token,
            user: safeUser
          },
          message: 'Đăng nhập thành công.'
        };
      } catch (error) {
        if ([401, 403].includes(error.status)) await recordLoginAudit({ action: 'auth.login_failed', account, ip: metadata.ip });
        throw error;
      }
    },
    async getCurrentUser(authHeaderValue) {
      const authHeader = authHeaderValue;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw httpError(401, 'Yêu cầu token xác thực hợp lệ.');
      }
      const token = authHeader.slice(7).trim();
      let decoded;
      try {
        decoded = jwt.verify(token, env.jwtSecret);
      } catch {
        throw httpError(401, 'Token xác thực không hợp lệ hoặc đã hết hạn.');
      }
      let userId;
      try {
        userId = new ObjectId(decoded.sub);
      } catch {
        throw httpError(401, 'Thông tin xác thực không hợp lệ.');
      }
      const user = await repository.findById(userId);
      if (!user) {
        throw httpError(404, 'Không tìm thấy thông tin người dùng.');
      }
      if (user.account_status !== 'active') {
        throw httpError(403, 'Tài khoản đang bị khóa hoặc ngừng hoạt động.');
      }
      const rolesInfo = await populateUserRoles(repository, user);
      const safeUser = sanitizeUser(user, rolesInfo);
      return {
        data: safeUser
      };
    },
    async authenticate(authHeader) {
      if (!authHeader || !authHeader.startsWith('Bearer ')) throw httpError(401, 'Chưa cung cấp token xác thực.');
      let decoded;
      let userId;
      try {
        decoded = jwt.verify(authHeader.slice(7).trim(), env.jwtSecret);
        userId = new ObjectId(decoded.sub);
      } catch {
        throw httpError(401, 'Token không hợp lệ hoặc đã hết hạn.');
      }
      const user = await repository.findById(userId);
      if (!user || user.account_status !== 'active') throw httpError(401, 'Tài khoản không hợp lệ hoặc đã bị khóa.');
      return {
        user,
        tokenPayload: decoded
      };
    }
  };
}
