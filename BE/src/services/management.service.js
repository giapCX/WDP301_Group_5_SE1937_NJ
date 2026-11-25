const { randomBytes, scrypt } = require('node:crypto');
const { promisify } = require('node:util');
const HttpError = require('../utils/http-error');
const repository = require('../repositories/management.repository');

const deriveKey = promisify(scrypt);
const ADMIN_RESOURCES = new Set(['users', 'roles', 'audit_logs']);
const MANAGER_RESOURCES = new Set(['pricing_rules', 'service_policies', 'promotions', 'audit_logs', 'reports']);
const ID_FIELDS = { users: 'user_id', roles: 'role_id', vehicles: 'vehicle_id', driver_profiles: 'driver_id', pricing_rules: 'rule_id', service_policies: 'policy_id', promotions: 'promotion_id' };
const clean = (data) => data && typeof data === 'object' && !Array.isArray(data) ? data : {};
const text = (value, field, max) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new HttpError(400, `${field} không hợp lệ.`);
  return value.trim();
};
const positive = (value, field) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new HttpError(400, `${field} phải lớn hơn 0.`);
  return number;
};
const parseDateEndOfDay = (value) => {
  const date = new Date(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) date.setUTCHours(23, 59, 59, 999);
  return date;
};

function ensureResource(resource, actor) {
  const allowed = actor === 'admin' ? ADMIN_RESOURCES : MANAGER_RESOURCES;
  if (!allowed.has(resource)) throw new HttpError(403, 'Bạn không có quyền truy cập dữ liệu này.');
}

async function listResource(resource, actor) {
  ensureResource(resource, actor);
  if (resource === 'reports') return repository.managementReports();
  const docs = await repository.list(resource);
  if (resource === 'roles') {
    const defaults = require('../config/role-permissions');
    return docs.map((role) => ({ ...role, permissions: Array.isArray(role.permissions) ? role.permissions : defaults[role.role_name] || [] }));
  }
  if (resource === 'users') return Promise.all(docs.map(async ({ password_hash, ...user }) => ({
    ...user,
    role: await repository.findOne('roles', { role_id: user.role_id }),
  })));
  if (resource === 'driver_profiles') return Promise.all(docs.map(async (driver) => ({
    ...driver,
    user: await repository.findOne('users', { user_id: driver.user_id }, { projection: { password_hash: 0 } }),
  })));
  return docs;
}

async function createResource(resource, actor, actorId, input) {
  ensureResource(resource, actor);
  const body = clean(input);
  const now = new Date();
  let document;

  if (resource === 'users' && actor === 'admin') {
    const email = text(body.email, 'Email', 150).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Email không hợp lệ.');
    if (await repository.findOne('users', { email })) throw new HttpError(409, 'Email đã được sử dụng.');
    const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null;
    if (phone && await repository.findOne('users', { phone })) throw new HttpError(409, 'Số điện thoại đã được sử dụng.');
    const roleId = Number(body.role_id);
    if (!Number.isSafeInteger(roleId) || !(await repository.findOne('roles', { role_id: roleId }))) throw new HttpError(400, 'Vai trò không hợp lệ.');
    const password = text(body.password, 'Mật khẩu khởi tạo', 128);
    if (password.length < 12) throw new HttpError(400, 'Mật khẩu khởi tạo cần ít nhất 12 ký tự.');
    const salt = randomBytes(16).toString('hex');
    const hash = (await deriveKey(password, salt, 64)).toString('hex');
    document = { user_id: await repository.nextId('users'), full_name: text(body.full_name, 'Họ tên', 120), email,
      phone,
      role_id: roleId, password_hash: `scrypt$${salt}$${hash}`, status: 'active', created_at: now };
  } else if (resource === 'roles' && actor === 'admin') {
    const roleName = text(body.role_name, 'Tên vai trò', 40).toLowerCase();
    if (await repository.findOne('roles', { role_name: roleName })) throw new HttpError(409, 'Vai trò đã tồn tại.');
    document = { role_id: await repository.nextId('roles'), role_name: roleName,
      permissions: Array.isArray(body.permissions) ? [...new Set(body.permissions.filter((permission) => typeof permission === 'string'))] : [],
      created_at: now, updated_at: now };
  } else if (resource === 'vehicles') {
    const plate = text(body.plate_number, 'Biển số', 20).toUpperCase();
    if (await repository.findOne('vehicles', { plate_number: plate })) throw new HttpError(409, 'Biển số đã tồn tại.');
    document = { vehicle_id: await repository.nextId('vehicles'), plate_number: plate,
      brand: text(body.brand, 'Hãng xe', 60), model: text(body.model, 'Dòng xe', 60),
      seat_count: Math.round(positive(body.seat_count, 'Số chỗ')),
      price_per_day: positive(body.price_per_day, 'Giá thuê/ngày'), status: 'pending', approval_status: 'pending',
      photos: Array.isArray(body.photos) ? body.photos.filter((item) => typeof item === 'string') : [],
      documents: clean(body.documents), created_at: now, updated_at: now };
  } else if (resource === 'pricing_rules') {
    const serviceType = text(body.service_type, 'Loại dịch vụ', 40);
    const amount = positive(body.base_price, 'Giá cơ bản');
    const surcharge = Number(body.surcharge_per_unit || 0);
    if (!Number.isFinite(surcharge) || surcharge < 0) throw new HttpError(400, 'Phụ phí không hợp lệ.');
    document = { rule_id: await repository.nextId('pricing_rules'), name: text(body.name, 'Tên bảng giá', 120),
      service_type: serviceType, vehicle_type: text(body.vehicle_type, 'Loại xe', 60), base_price: amount,
      unit: text(body.unit, 'Đơn vị tính', 30), route: typeof body.route === 'string' ? body.route.trim() : '',
      distance_limit_km: body.distance_limit_km == null ? null : positive(body.distance_limit_km, 'Giới hạn km'),
      surcharge_per_unit: surcharge, status: 'draft', created_by: actorId, created_at: now, updated_at: now };
  } else if (resource === 'driver_profiles') {
    const userId = Number(body.user_id);
    const user = Number.isSafeInteger(userId) ? await repository.findOne('users', { user_id: userId }) : null;
    const role = user && await repository.findOne('roles', { role_id: user.role_id });
    if (!user || role?.role_name !== 'driver' || user.status !== 'active') throw new HttpError(400, 'Tài khoản phải đang hoạt động và có vai trò tài xế.');
    if (await repository.findOne('driver_profiles', { user_id: userId })) throw new HttpError(409, 'Tài khoản đã có hồ sơ tài xế.');
    const expiry = new Date(body.license_expiry);
    if (!Number.isFinite(expiry.getTime()) || expiry <= now) throw new HttpError(400, 'Giấy phép tài xế đã hết hạn hoặc không hợp lệ.');
    const licenseNumber = text(body.license_number, 'Số giấy phép', 60);
    if (await repository.findOne('driver_profiles', { license_number: licenseNumber })) throw new HttpError(409, 'Số giấy phép đã được sử dụng.');
    document = { driver_id: await repository.nextId('driver_profiles'), user_id: userId,
      license_number: licenseNumber, license_type: text(body.license_type, 'Loại giấy phép', 30),
      license_expiry: expiry, availability_status: 'unavailable', approval_status: 'pending', approved_at: null,
      created_at: now, updated_at: now };
  } else if (resource === 'service_policies') {
    const policyValues = ['cancellation_fee_percent', 'waiting_fee_per_hour', 'overtime_fee_per_hour', 'extra_km_fee', 'refund_days', 'free_cancellation_hours'];
    const policyData = Object.fromEntries(policyValues.map((key) => [key, Number(body[key] || 0)]));
    if (Object.values(policyData).some((value) => !Number.isFinite(value) || value < 0) || policyData.cancellation_fee_percent > 100) throw new HttpError(400, 'Các khoản phí và thời hạn chính sách không hợp lệ.');
    document = { policy_id: await repository.nextId('service_policies'), name: text(body.name, 'Tên chính sách', 120),
      ...policyData, status: 'draft', created_by: actorId, created_at: now, updated_at: now };
  } else if (resource === 'promotions') {
    const code = text(body.code, 'Mã khuyến mãi', 40).toUpperCase();
    if (await repository.findOne('promotions', { code })) throw new HttpError(409, 'Mã khuyến mãi đã tồn tại.');
    const discount = positive(body.discount_percent, 'Phần trăm giảm giá');
    const expires = parseDateEndOfDay(body.valid_until);
    if (discount > 100 || !Number.isFinite(expires.getTime()) || expires <= now) throw new HttpError(400, 'Mức giảm hoặc thời hạn khuyến mãi không hợp lệ.');
    document = { promotion_id: await repository.nextId('promotions'), code, discount_percent: discount,
      valid_until: expires, status: 'active', created_by: actorId, created_at: now, updated_at: now };
  } else {
    throw new HttpError(403, 'Bạn không được phép tạo dữ liệu này.');
  }

  await repository.insert(resource, document);
  await repository.audit({ actor_id: actorId, actor_role: actor, action: 'create', resource, resource_id: document[ID_FIELDS[resource]],
    changed_fields: Object.keys(document).filter((field) => !['password_hash', 'created_at', 'updated_at'].includes(field)), summary: `Tạo ${resource}` });
  const { password_hash, ...safeDocument } = document;
  return safeDocument;
}

async function updateResource(resource, actor, actorId, rawId, input) {
  ensureResource(resource, actor);
  const field = ID_FIELDS[resource];
  if (!field) throw new HttpError(403, 'Dữ liệu này không hỗ trợ cập nhật.');
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, 'Mã dữ liệu không hợp lệ.');
  const existing = await repository.findOne(resource, { [field]: id });
  if (!existing) throw new HttpError(404, 'Không tìm thấy dữ liệu.');
  const body = clean(input);
  const changes = { updated_at: new Date() };

  if (resource === 'users' && actor === 'admin') {
    if (body.status !== undefined) {
      if (!['active', 'locked', 'inactive'].includes(body.status)) throw new HttpError(400, 'Trạng thái tài khoản không hợp lệ.');
      if (id === actorId && body.status !== 'active') throw new HttpError(409, 'Không thể khóa hoặc vô hiệu hóa tài khoản đang đăng nhập.');
      const currentRole = await repository.findOne('roles', { role_id: existing.role_id });
      if (currentRole?.role_name === 'admin' && existing.status === 'active' && body.status !== 'active') {
        const activeAdmins = await repository.list('users', { role_id: existing.role_id, status: 'active' });
        if (activeAdmins.length <= 1) throw new HttpError(409, 'Cần giữ lại ít nhất một tài khoản Admin đang hoạt động.');
      }
      changes.status = body.status;
    }
    if (body.role_id !== undefined) {
      const roleId = Number(body.role_id);
      if (!Number.isSafeInteger(roleId) || !(await repository.findOne('roles', { role_id: roleId }))) throw new HttpError(400, 'Vai trò không hợp lệ.');
      const currentRole = await repository.findOne('roles', { role_id: existing.role_id });
      const targetRole = await repository.findOne('roles', { role_id: roleId });
      if (currentRole?.role_name === 'admin' && targetRole?.role_name !== 'admin' && existing.status === 'active') {
        const activeAdmins = await repository.list('users', { role_id: existing.role_id, status: 'active' });
        if (activeAdmins.length <= 1) throw new HttpError(409, 'Cần giữ lại ít nhất một tài khoản Admin đang hoạt động.');
      }
      changes.role_id = roleId;
    }
    if (body.full_name !== undefined) changes.full_name = text(body.full_name, 'Họ tên', 120);
    if (body.email !== undefined) {
      const email = text(body.email, 'Email', 150).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Email không hợp lệ.');
      if (await repository.findOne('users', { email, user_id: { $ne: id } })) throw new HttpError(409, 'Email đã được sử dụng.');
      changes.email = email;
    }
    if (body.phone !== undefined) {
      const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null;
      if (phone && await repository.findOne('users', { phone, user_id: { $ne: id } })) throw new HttpError(409, 'Số điện thoại đã được sử dụng.');
      changes.phone = phone;
    }
  } else if (resource === 'roles' && actor === 'admin') {
    if (body.permissions !== undefined) {
      if (!Array.isArray(body.permissions) || body.permissions.some((permission) => typeof permission !== 'string')) throw new HttpError(400, 'Danh sách quyền không hợp lệ.');
      changes.permissions = [...new Set(body.permissions)];
    }
  } else if (resource === 'vehicles') {
    if (body.plate_number !== undefined) {
      const plate = text(body.plate_number, 'Biển số', 20).toUpperCase();
      const duplicate = await repository.findOne('vehicles', { plate_number: plate, vehicle_id: { $ne: id } });
      if (duplicate) throw new HttpError(409, 'Biển số đã tồn tại.');
      changes.plate_number = plate;
    }
    for (const key of ['brand', 'model']) if (body[key] !== undefined) changes[key] = text(body[key], key, 60);
    if (body.seat_count !== undefined) changes.seat_count = Math.round(positive(body.seat_count, 'Số chỗ'));
    if (body.price_per_day !== undefined) changes.price_per_day = positive(body.price_per_day, 'Giá thuê/ngày');
    if (body.photos !== undefined) {
      if (!Array.isArray(body.photos) || body.photos.some((photo) => typeof photo !== 'string')) throw new HttpError(400, 'Danh sách ảnh không hợp lệ.');
      changes.photos = body.photos;
    }
    if (body.documents !== undefined) changes.documents = clean(body.documents);
    if (body.status !== undefined) {
      if (!['available', 'maintenance', 'withdrawn', 'pending'].includes(body.status)) throw new HttpError(400, 'Trạng thái xe không hợp lệ.');
      if (body.status === 'available' && !['approved', 'available'].includes(existing.approval_status || existing.status)) throw new HttpError(409, 'Xe chưa được phê duyệt nên không thể đưa vào hoạt động.');
      changes.status = body.status;
    }
    if (body.approval_status !== undefined) {
      if (actor !== 'manager' && actor !== 'admin') throw new HttpError(403, 'Chỉ Manager hoặc Admin được phê duyệt xe.');
      if (!['approved', 'rejected'].includes(body.approval_status)) throw new HttpError(400, 'Kết quả phê duyệt không hợp lệ.');
      if (body.approval_status === 'approved' && resource === 'vehicles') {
        const documents = clean(existing.documents);
        if (['registration', 'insurance', 'inspection'].some((key) => !documents[key])) throw new HttpError(409, 'Xe thiếu giấy đăng ký, bảo hiểm hoặc đăng kiểm hợp lệ.');
      }
      changes.approval_status = body.approval_status;
      changes.status = body.approval_status === 'approved' ? 'available' : 'pending';
      changes.reviewed_by = actorId;
      changes.reviewed_at = new Date();
    }
  } else if (resource === 'driver_profiles') {
    if (body.license_number !== undefined) {
      const licenseNumber = text(body.license_number, 'Số giấy phép', 60);
      if (await repository.findOne('driver_profiles', { license_number: licenseNumber, driver_id: { $ne: id } })) throw new HttpError(409, 'Số giấy phép đã được sử dụng.');
      changes.license_number = licenseNumber;
    }
    if (body.license_type !== undefined) changes.license_type = text(body.license_type, 'Loại giấy phép', 30);
    if (body.license_expiry !== undefined) {
      const expiry = new Date(body.license_expiry);
      if (!Number.isFinite(expiry.getTime())) throw new HttpError(400, 'Ngày hết hạn giấy phép không hợp lệ.');
      changes.license_expiry = expiry;
      if (expiry <= new Date()) {
        changes.approval_status = 'expired';
        changes.availability_status = 'unavailable';
        changes.approved_at = null;
      }
    }
    if (body.approval_status !== undefined) {
      const expiry = existing.license_expiry && new Date(existing.license_expiry);
      if (body.approval_status === 'approved' && (!expiry || expiry <= new Date())) throw new HttpError(409, 'Giấy phép tài xế đã hết hạn hoặc chưa hợp lệ.');
      if (!['approved', 'rejected'].includes(body.approval_status)) throw new HttpError(400, 'Kết quả phê duyệt không hợp lệ.');
      changes.approval_status = body.approval_status;
      changes.approved_at = body.approval_status === 'approved' ? new Date() : null;
      changes.availability_status = body.approval_status === 'approved' ? 'available' : 'unavailable';
    }
    if (body.availability_status !== undefined) {
      if (body.availability_status === 'available' && existing.approval_status !== 'approved' && !existing.approved_at) throw new HttpError(409, 'Tài xế chưa được phê duyệt để nhận chuyến.');
      changes.availability_status = text(body.availability_status, 'Trạng thái tài xế', 30);
    }
  } else if (['pricing_rules', 'service_policies', 'promotions'].includes(resource)) {
    if (body.status !== undefined) {
      if (!['draft', 'active', 'inactive'].includes(body.status)) throw new HttpError(400, 'Trạng thái cấu hình không hợp lệ.');
      const required = resource === 'promotions' ? ['code', 'discount_percent', 'valid_until'] : resource === 'pricing_rules'
        ? ['name', 'service_type', 'vehicle_type', 'base_price', 'unit']
        : ['name', 'cancellation_fee_percent', 'waiting_fee_per_hour', 'overtime_fee_per_hour', 'extra_km_fee', 'refund_days'];
      if (body.status === 'active' && required.some((key) => existing[key] === undefined || existing[key] === null || existing[key] === '')) {
        throw new HttpError(409, 'Cấu hình thiếu dữ liệu bắt buộc nên chưa thể kích hoạt.');
      }
      if (resource === 'promotions' && body.status === 'active' && new Date(existing.valid_until) <= new Date()) throw new HttpError(409, 'Khuyến mãi đã hết hạn nên không thể kích hoạt.');
      changes.status = body.status;
    }
    if (body.name !== undefined) changes.name = text(body.name, 'Tên cấu hình', 120);
    if (resource === 'promotions') {
      if (body.code !== undefined) {
        const code = text(body.code, 'Mã khuyến mãi', 40).toUpperCase();
        if (await repository.findOne('promotions', { code, promotion_id: { $ne: id } })) throw new HttpError(409, 'Mã khuyến mãi đã tồn tại.');
        changes.code = code;
      }
      if (body.valid_until !== undefined) {
        const expires = parseDateEndOfDay(body.valid_until);
        if (!Number.isFinite(expires.getTime())) throw new HttpError(400, 'Thời hạn khuyến mãi không hợp lệ.');
        changes.valid_until = expires;
      }
    }
    for (const key of ['service_type', 'vehicle_type', 'unit', 'route']) {
      if (body[key] !== undefined) changes[key] = text(body[key], key, key === 'route' ? 200 : 60);
    }
    for (const key of ['base_price', 'distance_limit_km', 'surcharge_per_unit', 'cancellation_fee_percent', 'waiting_fee_per_hour', 'overtime_fee_per_hour', 'extra_km_fee', 'refund_days', 'free_cancellation_hours']) {
      if (body[key] !== undefined) {
        const value = Number(body[key]);
        if (!Number.isFinite(value) || value < 0 || (key === 'cancellation_fee_percent' && value > 100)) throw new HttpError(400, `${key} không hợp lệ.`);
        changes[key] = value;
      }
    }
    if (resource === 'promotions' && body.discount_percent !== undefined) {
      const discount = Number(body.discount_percent);
      if (!Number.isFinite(discount) || discount <= 0 || discount > 100) throw new HttpError(400, 'Phần trăm giảm giá không hợp lệ.');
      changes.discount_percent = discount;
    }
  } else {
    throw new HttpError(403, 'Bạn không được phép cập nhật dữ liệu này.');
  }

  const result = await repository.update(resource, { [field]: id }, changes);
  await repository.audit({ actor_id: actorId, actor_role: actor, action: 'update', resource, resource_id: id,
    changed_fields: Object.keys(changes).filter((field) => field !== 'updated_at'), summary: `Cập nhật ${resource}` });
  return { matchedCount: result.matchedCount };
}

module.exports = { createResource, listResource, updateResource };
