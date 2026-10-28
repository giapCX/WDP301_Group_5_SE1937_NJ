import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { env } from '../config/env.js';

const ALLOWED_DEFAULT_PASSWORDS = new Set([
  env.defaultUserPassword,
  '123456',
  '12345678',
  'password',
  'password123',
  'xedi123',
]);

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function buildAccountQuery(account) {
  const trimmed = account.trim();
  const orConditions = [
    { email: { $regex: `^${escapeRegex(trimmed)}$`, $options: 'i' } },
    { phone: trimmed },
  ];

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 6) {
    const flexiblePattern = digits.split('').join('[- ]?');
    orConditions.push({ phone: { $regex: flexiblePattern } });
  }

  return { $or: orConditions };
}

async function populateUserRoles(database, user) {
  let primaryRole = null;
  if (user.primary_role_id) {
    primaryRole = await database.collection('roles').findOne({ _id: user.primary_role_id });
  }

  let additionalRoles = [];
  if (Array.isArray(user.additional_role_ids) && user.additional_role_ids.length > 0) {
    additionalRoles = await database
      .collection('roles')
      .find({ _id: { $in: user.additional_role_ids } })
      .toArray();
  }

  const roleCodes = [
    primaryRole?.code,
    ...additionalRoles.map((r) => r.code),
  ].filter(Boolean);

  const permissions = Array.from(
    new Set([
      ...(primaryRole?.permissions || []),
      ...additionalRoles.flatMap((r) => r.permissions || []),
    ]),
  );

  return {
    primaryRole,
    additionalRoles,
    roleCodes,
    permissions,
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
    role: rolesInfo.primaryRole
      ? {
          id: rolesInfo.primaryRole._id.toString(),
          code: rolesInfo.primaryRole.code,
          display_name: rolesInfo.primaryRole.display_name,
          permissions: rolesInfo.primaryRole.permissions || [],
        }
      : null,
    roles: rolesInfo.roleCodes,
    permissions: rolesInfo.permissions,
    contact_profile: user.contact_profile || null,
    identity_kyc: user.identity_kyc
      ? {
          status: user.identity_kyc.status,
          id_masked: user.identity_kyc.id_masked,
          verified_at: user.identity_kyc.verified_at,
        }
      : null,
    driver_license: user.driver_license || null,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export function createAuthRouter(database) {
  const router = Router();

  // POST /api/auth/login
  router.post('/login', async (request, response) => {
    const rawAccount = request.body?.account ?? request.body?.email ?? request.body?.phone;
    const rawPassword = request.body?.password;

    if (!rawAccount || typeof rawAccount !== 'string' || !rawAccount.trim()) {
      return response.status(400).json({
        error: { message: 'Vui lòng nhập email hoặc số điện thoại.' },
      });
    }

    if (!rawPassword || typeof rawPassword !== 'string') {
      return response.status(400).json({
        error: { message: 'Vui lòng nhập mật khẩu.' },
      });
    }

    const account = rawAccount.trim();
    const password = rawPassword;

    // Find user in MongoDB users collection
    const user = await database.collection('users').findOne(buildAccountQuery(account));

    if (!user) {
      return response.status(401).json({
        error: { message: 'Email/Số điện thoại hoặc mật khẩu không chính xác.' },
      });
    }

    // Check account status
    if (user.account_status !== 'active') {
      return response.status(403).json({
        error: {
          message: 'Tài khoản của bạn đang bị khóa hoặc chưa được kích hoạt. Vui lòng liên hệ hỗ trợ.',
        },
      });
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
          await database.collection('users').updateOne(
            { _id: user._id },
            {
              $set: {
                password_hash: hashedPassword,
                updated_at: new Date(),
              },
            },
          );
        } catch (err) {
          console.warn('Failed to auto-hash password for user:', err.message);
        }
      }
    }

    if (!isPasswordValid) {
      return response.status(401).json({
        error: { message: 'Email/Số điện thoại hoặc mật khẩu không chính xác.' },
      });
    }

    // Load roles and permissions
    const rolesInfo = await populateUserRoles(database, user);
    const safeUser = sanitizeUser(user, rolesInfo);

    // Create JWT token
    const token = jwt.sign(
      {
        sub: user._id.toString(),
        email: user.email,
        phone: user.phone,
        role: rolesInfo.primaryRole?.code || 'RENTER',
        roles: rolesInfo.roleCodes,
        permissions: rolesInfo.permissions,
      },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn },
    );

    return response.status(200).json({
      data: {
        token,
        user: safeUser,
      },
      message: 'Đăng nhập thành công.',
    });
  });

  // GET /api/auth/me
  router.get('/me', async (request, response) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return response.status(401).json({
        error: { message: 'Yêu cầu token xác thực hợp lệ.' },
      });
    }

    const token = authHeader.slice(7).trim();
    let decoded;
    try {
      decoded = jwt.verify(token, env.jwtSecret);
    } catch {
      return response.status(401).json({
        error: { message: 'Token xác thực không hợp lệ hoặc đã hết hạn.' },
      });
    }

    let userId;
    try {
      userId = new ObjectId(decoded.sub);
    } catch {
      return response.status(401).json({
        error: { message: 'Thông tin xác thực không hợp lệ.' },
      });
    }

    const user = await database.collection('users').findOne({ _id: userId });
    if (!user) {
      return response.status(404).json({
        error: { message: 'Không tìm thấy thông tin người dùng.' },
      });
    }

    if (user.account_status !== 'active') {
      return response.status(403).json({
        error: { message: 'Tài khoản đang bị khóa hoặc ngừng hoạt động.' },
      });
    }

    const rolesInfo = await populateUserRoles(database, user);
    const safeUser = sanitizeUser(user, rolesInfo);

    return response.status(200).json({
      data: safeUser,
    });
  });

  // POST /api/auth/logout
  router.post('/logout', (_request, response) => {
    return response.status(200).json({
      message: 'Đăng xuất thành công.',
    });
  });

  return router;
}

export function createAuthMiddleware(database) {
  return async (request, response, next) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return response.status(401).json({
        error: { message: 'Chưa cung cấp token xác thực.' },
      });
    }

    const token = authHeader.slice(7).trim();
    try {
      const decoded = jwt.verify(token, env.jwtSecret);
      const user = await database.collection('users').findOne({
        _id: new ObjectId(decoded.sub),
      });

      if (!user || user.account_status !== 'active') {
        return response.status(401).json({
          error: { message: 'Tài khoản không hợp lệ hoặc đã bị khóa.' },
        });
      }

      request.user = user;
      request.tokenPayload = decoded;
      next();
    } catch {
      return response.status(401).json({
        error: { message: 'Token không hợp lệ hoặc đã hết hạn.' },
      });
    }
  };
}
