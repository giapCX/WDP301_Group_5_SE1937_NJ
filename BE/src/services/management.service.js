const { randomBytes, scrypt } = require('node:crypto');
const { promisify } = require('node:util');
const HttpError = require('../utils/http-error');
const repository = require('../repositories/management.repository');
const { SERVICE_TYPES, PRICING_STATUSES } = require('../config/pricing.constants');
const { CONFIGURATION_STATUSES, DRIVER_AVAILABILITY_STATUS, DRIVER_AVAILABILITY_STATUSES, USER_STATUS, USER_STATUSES, VEHICLE_STATUS, VEHICLE_STATUSES } = require('../config/workflow.constants');
const { APPROVAL_STATUSES, MANAGEMENT_ROLES, RESOURCE_ID_FIELDS, VEHICLE_REQUIRED_DOCUMENTS } = require('../config/management.constants');
const { ROLE_NAMES } = require('../config/role.constants');
const { SUPPORTED_VEHICLE_SEAT_COUNTS, supportsVehicleSeatCount } = require('../config/vehicle.constants');

const deriveKey = promisify(scrypt);
const ACTOR_RESOURCES = {
  [MANAGEMENT_ROLES.ADMIN]: new Set(['users', 'roles']),
  [MANAGEMENT_ROLES.MANAGER]: new Set(['pricing_rules', 'service_policies', 'audit_logs', 'reports']),
  [MANAGEMENT_ROLES.OPERATOR]: new Set(['vehicles', 'driver_profiles']),
};
const VERSIONED_CONFIG_RESOURCES = new Set(['pricing_rules', 'service_policies']);
const ID_FIELDS = RESOURCE_ID_FIELDS;
const clean = (data) => data && typeof data === 'object' && !Array.isArray(data) ? data : {};
function auditSnapshot(document) {
  if (!document) return null;
  const snapshot = { ...document };
  delete snapshot.password_hash;
  return snapshot;
}
const text = (value, field, max) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new HttpError(400, `${field} không hợp lệ.`);
  return value.trim();
};
const positive = (value, field) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new HttpError(400, `${field} phải lớn hơn 0.`);
  return number;
};
async function findOverlappingPolicies(start, end, policyId) {
  const query = {
    status: 'active', $or: [{ effective_to: null }, { effective_to: { $gt: start } }],
  };
  if (policyId !== undefined) query.policy_id = { $ne: policyId };
  if (end) query.effective_from = { $lt: end };
  return repository.list('service_policies', query);
}

function validatePricingRule(rule, { requireComplete = rule.status === PRICING_STATUSES.ACTIVE } = {}) {
  if (!Object.values(SERVICE_TYPES).includes(rule.service_type)) throw new HttpError(400, 'Loại dịch vụ trong bảng giá không hợp lệ.');
  if (!supportsVehicleSeatCount(rule.seat_count)) throw new HttpError(400, `Only ${SUPPORTED_VEHICLE_SEAT_COUNTS.join(', ')}-seat price classes are supported.`);
  const positiveMoney = (key) => Number.isSafeInteger(rule[key]) && rule[key] > 0;
  const nonNegativeMoney = (key) => Number.isSafeInteger(rule[key]) && rule[key] >= 0;
  const optionalNonNegative = (key) => rule[key] === undefined || nonNegativeMoney(key);
  const hasRoundtripRates = positiveMoney('km_rate') && Number.isFinite(rule.dispatch_percent) && rule.dispatch_percent >= 0 && rule.dispatch_percent <= 100;
  const hasTourRates = positiveMoney('day_rate') && nonNegativeMoney('included_km_per_day') &&
    nonNegativeMoney('extra_km_rate') && nonNegativeMoney('driver_night_rate');
  if (rule.service_type === SERVICE_TYPES.ROUNDTRIP &&
      (requireComplete ? !hasRoundtripRates : (!optionalNonNegative('km_rate') || !optionalNonNegative('dispatch_percent')))) {
    throw new HttpError(400, 'Bảng giá khứ hồi cần đơn giá/km nguyên VND và tỷ lệ điều xe từ 0 đến 100.');
  }
  if (rule.service_type === SERVICE_TYPES.TOUR &&
      (requireComplete ? !hasTourRates : ['day_rate', 'included_km_per_day', 'extra_km_rate', 'driver_night_rate'].some((key) => !optionalNonNegative(key)))) {
    throw new HttpError(400, 'Bảng giá tour cần đơn giá ngày, định mức km và đơn giá vượt km/lưu trú hợp lệ.');
  }
  return rule;
}

function ensureResource(resource, actor) {
  const allowed = ACTOR_RESOURCES[actor];
  if (!allowed?.has(resource)) throw new HttpError(403, 'Bạn không có quyền truy cập dữ liệu này.');
}

async function listResource(resource, actor) {
  ensureResource(resource, actor);
  if (resource === 'reports') return repository.managementReports();
  const docs = await repository.list(resource, ['vehicles', 'pricing_rules'].includes(resource)
    ? { seat_count: { $in: SUPPORTED_VEHICLE_SEAT_COUNTS } } : {});
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

async function listDriverCandidates() {
  const driverRoles = await repository.list('roles', { role_name: 'driver' });
  const roleIds = driverRoles.map(({ role_id }) => role_id);
  if (!roleIds.length) return [];
  const profiles = await repository.list('driver_profiles', {}, { projection: { user_id: 1 } });
  const existingUserIds = profiles.map(({ user_id }) => user_id);
  return repository.list('users', {
    role_id: { $in: roleIds }, status: 'active',
    ...(existingUserIds.length && { user_id: { $nin: existingUserIds } }),
  }, { projection: { password_hash: 0, full_name: 1, email: 1, user_id: 1 } });
}

async function createResource(resource, actor, actorId, input) {
  ensureResource(resource, actor);
  if (resource === 'pricing_rules') throw new HttpError(409, 'Vehicle classes and services are fixed; update an existing rate instead.');
  if (resource === 'roles') throw new HttpError(409, 'System roles are fixed; update permissions for an existing role.');
  const body = clean(input);
  const now = new Date();
  let document;

  if (resource === 'users' && actor === MANAGEMENT_ROLES.ADMIN) {
    const email = text(body.email, 'Email', 150).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Email không hợp lệ.');
    if (await repository.findOne('users', { email })) throw new HttpError(409, 'Email đã được sử dụng.');
    const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null;
    if (phone && await repository.findOne('users', { phone })) throw new HttpError(409, 'Số điện thoại đã được sử dụng.');
    const roleId = Number(body.role_id);
    const role = Number.isSafeInteger(roleId) ? await repository.findOne('roles', { role_id: roleId }) : null;
    if (!role) throw new HttpError(400, 'Vai trò không hợp lệ.');
    if (role.role_name === ROLE_NAMES.RENTER) throw new HttpError(403, 'Admin chỉ được tạo tài khoản nhân sự, không tạo tài khoản người thuê.');
    const password = text(body.password, 'Mật khẩu khởi tạo', 128);
    if (password.length < 12) throw new HttpError(400, 'Mật khẩu khởi tạo cần ít nhất 12 ký tự.');
    const salt = randomBytes(16).toString('hex');
    const hash = (await deriveKey(password, salt, 64)).toString('hex');
    document = { user_id: await repository.nextId('users'), full_name: text(body.full_name, 'Họ tên', 120), email,
      phone,
      role_id: roleId, password_hash: `scrypt$${salt}$${hash}`, status: USER_STATUS.ACTIVE, created_at: now };
  } else if (resource === 'roles' && actor === MANAGEMENT_ROLES.ADMIN) {
    const roleName = text(body.role_name, 'Tên vai trò', 40).toLowerCase();
    if (await repository.findOne('roles', { role_name: roleName })) throw new HttpError(409, 'Vai trò đã tồn tại.');
    document = { role_id: await repository.nextId('roles'), role_name: roleName,
      permissions: Array.isArray(body.permissions) ? [...new Set(body.permissions.filter((permission) => typeof permission === 'string'))] : [],
      created_at: now, updated_at: now };
  } else if (resource === 'vehicles' && actor === MANAGEMENT_ROLES.OPERATOR) {
    const plate = text(body.plate_number, 'Biển số', 20).toUpperCase();
    if (await repository.findOne('vehicles', { plate_number: plate })) throw new HttpError(409, 'Biển số đã tồn tại.');
    const pricePerDay = Number(body.price_per_day);
    if (!Number.isSafeInteger(pricePerDay) || pricePerDay <= 0) throw new HttpError(400, 'Giá thuê/ngày phải là số nguyên VND dương.');
    const seatCount = Number(body.seat_count);
    if (!supportsVehicleSeatCount(seatCount)) throw new HttpError(400, `Only ${SUPPORTED_VEHICLE_SEAT_COUNTS.join(', ')}-seat vehicles are supported.`);
    document = { vehicle_id: await repository.nextId('vehicles'), plate_number: plate,
      brand: text(body.brand, 'Hãng xe', 60), model: text(body.model, 'Dòng xe', 60),
      seat_count: seatCount,
      price_per_day: pricePerDay, status: APPROVAL_STATUSES.PENDING, approval_status: APPROVAL_STATUSES.PENDING,
      photos: Array.isArray(body.photos) ? body.photos.filter((item) => typeof item === 'string') : [],
      documents: clean(body.documents), created_at: now, updated_at: now };
  } else if (resource === 'pricing_rules') {
    document = validatePricingRule({ rule_id: await repository.nextId('pricing_rules'), name: text(body.name, 'Tên bảng giá', 120),
      service_type: text(body.service_type, 'Loại dịch vụ', 40), seat_count: Number(body.seat_count),
      km_rate: body.km_rate === '' || body.km_rate == null ? undefined : Number(body.km_rate),
      dispatch_percent: body.dispatch_percent === '' || body.dispatch_percent == null ? undefined : Number(body.dispatch_percent),
      day_rate: body.day_rate === '' || body.day_rate == null ? undefined : Number(body.day_rate),
      included_km_per_day: body.included_km_per_day === '' || body.included_km_per_day == null ? undefined : Number(body.included_km_per_day),
      extra_km_rate: body.extra_km_rate === '' || body.extra_km_rate == null ? undefined : Number(body.extra_km_rate),
      driver_night_rate: body.driver_night_rate === '' || body.driver_night_rate == null ? undefined : Number(body.driver_night_rate),
      route: typeof body.route === 'string' ? body.route.trim() : '', status: PRICING_STATUSES.DRAFT,
      created_by: actorId, created_at: now, updated_at: now });
  } else if (resource === 'driver_profiles' && actor === MANAGEMENT_ROLES.OPERATOR) {
    const userId = Number(body.user_id);
    const user = Number.isSafeInteger(userId) ? await repository.findOne('users', { user_id: userId }) : null;
    const role = user && await repository.findOne('roles', { role_id: user.role_id });
    if (!user || role?.role_name !== ROLE_NAMES.DRIVER || user.status !== USER_STATUS.ACTIVE) throw new HttpError(400, 'Tài khoản phải đang hoạt động và có vai trò tài xế.');
    if (await repository.findOne('driver_profiles', { user_id: userId })) throw new HttpError(409, 'Tài khoản đã có hồ sơ tài xế.');
    const expiry = new Date(body.license_expiry);
    if (!Number.isFinite(expiry.getTime()) || expiry <= now) throw new HttpError(400, 'Giấy phép tài xế đã hết hạn hoặc không hợp lệ.');
    const licenseNumber = text(body.license_number, 'Số giấy phép', 60);
    if (await repository.findOne('driver_profiles', { license_number: licenseNumber })) throw new HttpError(409, 'Số giấy phép đã được sử dụng.');
    document = { driver_id: await repository.nextId('driver_profiles'), user_id: userId,
      license_number: licenseNumber, license_type: text(body.license_type, 'Loại giấy phép', 30),
      license_expiry: expiry, availability_status: DRIVER_AVAILABILITY_STATUS.UNAVAILABLE, approval_status: APPROVAL_STATUSES.PENDING, approved_at: null,
      created_at: now, updated_at: now };
  } else if (resource === 'service_policies') {
      const policyValues = ['cancellation_fee_percent', 'waiting_fee_per_hour', 'overtime_fee_per_hour', 'extra_km_fee', 'refund_days', 'free_cancellation_hours'];
    const policyData = Object.fromEntries(policyValues.map((key) => [key, Number(body[key] || 0)]));
    const effectiveFrom = new Date(body.effective_from);
    const effectiveTo = body.effective_to ? new Date(body.effective_to) : null;
    if (Object.values(policyData).some((value) => !Number.isFinite(value) || value < 0) || policyData.cancellation_fee_percent > 100 ||
      !Number.isSafeInteger(policyData.waiting_fee_per_hour) || !Number.isSafeInteger(policyData.overtime_fee_per_hour) ||
      !Number.isSafeInteger(policyData.extra_km_fee) || !Number.isSafeInteger(policyData.refund_days) ||
      !Number.isFinite(effectiveFrom.getTime()) || (effectiveTo && (!Number.isFinite(effectiveTo.getTime()) || effectiveTo <= effectiveFrom))) {
      throw new HttpError(400, 'Các khoản phí, thời hạn và hiệu lực chính sách không hợp lệ.');
    }
    document = { policy_id: await repository.nextId('service_policies'), name: text(body.name, 'Tên chính sách', 120),
      ...policyData, effective_from: effectiveFrom, effective_to: effectiveTo,
      status: 'draft', created_by: actorId, created_at: now, updated_at: now };
  } else {
    throw new HttpError(403, 'Bạn không được phép tạo dữ liệu này.');
  }

  await repository.insert(resource, document);
  const versioned = VERSIONED_CONFIG_RESOURCES.has(resource);
  await repository.audit({ actor_id: actorId, actor_role: actor, action: 'create', resource, resource_id: document[ID_FIELDS[resource]],
    changed_fields: Object.keys(document).filter((field) => !['password_hash', 'created_at', 'updated_at'].includes(field)),
    ...(versioned && { before: null, after: auditSnapshot(document), configuration_version: document.updated_at?.toISOString?.() }),
    summary: `Tạo ${resource}` });
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

  if (resource === 'users' && actor === MANAGEMENT_ROLES.ADMIN) {
    if (body.status !== undefined) {
      if (!USER_STATUSES.includes(body.status)) throw new HttpError(400, 'Trạng thái tài khoản không hợp lệ.');
      if (id === actorId && body.status !== USER_STATUS.ACTIVE) throw new HttpError(409, 'Không thể khóa hoặc vô hiệu hóa tài khoản đang đăng nhập.');
      const currentRole = await repository.findOne('roles', { role_id: existing.role_id });
      if (currentRole?.role_name === MANAGEMENT_ROLES.ADMIN && existing.status === USER_STATUS.ACTIVE && body.status !== USER_STATUS.ACTIVE) {
        const activeAdmins = await repository.list('users', { role_id: existing.role_id, status: USER_STATUS.ACTIVE });
        if (activeAdmins.length <= 1) throw new HttpError(409, 'Cần giữ lại ít nhất một tài khoản Admin đang hoạt động.');
      }
      changes.status = body.status;
    }
    if (body.role_id !== undefined) {
      const roleId = Number(body.role_id);
      if (!Number.isSafeInteger(roleId) || !(await repository.findOne('roles', { role_id: roleId }))) throw new HttpError(400, 'Vai trò không hợp lệ.');
      const currentRole = await repository.findOne('roles', { role_id: existing.role_id });
      const targetRole = await repository.findOne('roles', { role_id: roleId });
      if (currentRole?.role_name === MANAGEMENT_ROLES.ADMIN && targetRole?.role_name !== MANAGEMENT_ROLES.ADMIN && existing.status === USER_STATUS.ACTIVE) {
        const activeAdmins = await repository.list('users', { role_id: existing.role_id, status: USER_STATUS.ACTIVE });
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
  } else if (resource === 'roles' && actor === MANAGEMENT_ROLES.ADMIN) {
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
    if (body.seat_count !== undefined) {
      const seatCount = Number(body.seat_count);
      if (!supportsVehicleSeatCount(seatCount)) throw new HttpError(400, `Only ${SUPPORTED_VEHICLE_SEAT_COUNTS.join(', ')}-seat vehicles are supported.`);
      changes.seat_count = seatCount;
    }
    if (body.price_per_day !== undefined) {
      const pricePerDay = Number(body.price_per_day);
      if (!Number.isSafeInteger(pricePerDay) || pricePerDay <= 0) throw new HttpError(400, 'Giá thuê/ngày phải là số nguyên VND dương.');
      changes.price_per_day = pricePerDay;
    }
    if (body.photos !== undefined) {
      if (!Array.isArray(body.photos) || body.photos.some((photo) => typeof photo !== 'string')) throw new HttpError(400, 'Danh sách ảnh không hợp lệ.');
      changes.photos = body.photos;
    }
    if (body.documents !== undefined) changes.documents = clean(body.documents);
    if (body.status !== undefined) {
      if (!VEHICLE_STATUSES.includes(body.status)) throw new HttpError(400, 'Trạng thái xe không hợp lệ.');
      if (body.status === VEHICLE_STATUS.AVAILABLE && ![APPROVAL_STATUSES.APPROVED, VEHICLE_STATUS.AVAILABLE].includes(existing.approval_status || existing.status)) throw new HttpError(409, 'Xe chưa được phê duyệt nên không thể đưa vào hoạt động.');
      changes.status = body.status;
    }
    if (body.approval_status !== undefined) {
      if (actor !== MANAGEMENT_ROLES.OPERATOR) throw new HttpError(403, 'Chỉ Operator có quyền xét duyệt hồ sơ xe.');
      if (![APPROVAL_STATUSES.APPROVED, APPROVAL_STATUSES.REJECTED].includes(body.approval_status)) throw new HttpError(400, 'Kết quả phê duyệt không hợp lệ.');
      if (existing.approval_status && existing.approval_status !== APPROVAL_STATUSES.PENDING) throw new HttpError(409, 'Hồ sơ xe không còn ở trạng thái chờ xét duyệt.');
      if (body.approval_status === APPROVAL_STATUSES.APPROVED) {
        const documents = clean(existing.documents);
        if (VEHICLE_REQUIRED_DOCUMENTS.some((key) => !documents[key])) throw new HttpError(409, 'Xe thiếu giấy đăng ký, bảo hiểm hoặc đăng kiểm hợp lệ.');
      }
      if (body.documents !== undefined) throw new HttpError(400, 'Không thể sửa hồ sơ xe và xét duyệt trong cùng một thao tác.');
      changes.approval_status = body.approval_status;
      changes.status = body.approval_status === APPROVAL_STATUSES.APPROVED ? VEHICLE_STATUS.AVAILABLE : VEHICLE_STATUS.PENDING;
      changes.reviewed_by = actorId;
      changes.reviewed_at = new Date();
    }
    if (['plate_number', 'brand', 'model', 'seat_count', 'documents'].some((key) => body[key] !== undefined)) {
      if (body.approval_status !== undefined) throw new HttpError(400, 'Không thể sửa hồ sơ xe và xét duyệt trong cùng một thao tác.');
      changes.approval_status = APPROVAL_STATUSES.PENDING;
      changes.status = VEHICLE_STATUS.PENDING;
      changes.reviewed_by = null;
      changes.reviewed_at = null;
    }
  } else if (resource === 'driver_profiles') {
    const licenseChanges = ['license_number', 'license_type', 'license_expiry'].some((key) => body[key] !== undefined);
    if (licenseChanges && (body.approval_status !== undefined || body.availability_status !== undefined)) {
      throw new HttpError(400, 'Cập nhật giấy phép cần được lưu và xét duyệt riêng.');
    }
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
        changes.approval_status = APPROVAL_STATUSES.EXPIRED;
        changes.availability_status = DRIVER_AVAILABILITY_STATUS.UNAVAILABLE;
        changes.approved_at = null;
      }
    }
    if (body.approval_status !== undefined) {
      if (actor !== MANAGEMENT_ROLES.OPERATOR) throw new HttpError(403, 'Chỉ Operator có quyền xét duyệt hồ sơ tài xế.');
      if (licenseChanges) throw new HttpError(400, 'Không thể sửa giấy phép và xét duyệt trong cùng một thao tác.');
      const expiry = existing.license_expiry && new Date(existing.license_expiry);
      if (body.approval_status === APPROVAL_STATUSES.APPROVED && (!expiry || expiry <= new Date())) throw new HttpError(409, 'Giấy phép tài xế đã hết hạn hoặc chưa hợp lệ.');
      if (![APPROVAL_STATUSES.APPROVED, APPROVAL_STATUSES.REJECTED].includes(body.approval_status)) throw new HttpError(400, 'Kết quả phê duyệt không hợp lệ.');
      if (existing.approval_status && existing.approval_status !== APPROVAL_STATUSES.PENDING) throw new HttpError(409, 'Hồ sơ tài xế không còn ở trạng thái chờ xét duyệt.');
      changes.approval_status = body.approval_status;
      changes.approved_at = body.approval_status === APPROVAL_STATUSES.APPROVED ? new Date() : null;
      changes.availability_status = body.approval_status === APPROVAL_STATUSES.APPROVED ? DRIVER_AVAILABILITY_STATUS.AVAILABLE : DRIVER_AVAILABILITY_STATUS.UNAVAILABLE;
    }
    if (licenseChanges && body.approval_status === undefined && changes.approval_status !== APPROVAL_STATUSES.EXPIRED) {
      changes.approval_status = APPROVAL_STATUSES.PENDING;
      changes.approved_at = null;
      changes.availability_status = DRIVER_AVAILABILITY_STATUS.UNAVAILABLE;
    }
    if (body.availability_status !== undefined) {
      if (!DRIVER_AVAILABILITY_STATUSES.includes(body.availability_status)) throw new HttpError(400, 'Trạng thái tài xế không hợp lệ.');
      const expiry = existing.license_expiry && new Date(existing.license_expiry);
      if (body.availability_status === DRIVER_AVAILABILITY_STATUS.AVAILABLE &&
          (existing.approval_status !== APPROVAL_STATUSES.APPROVED || !existing.approved_at || !expiry || expiry <= new Date())) {
        throw new HttpError(409, 'Tài xế chưa được phê duyệt hoặc giấy phép đã hết hạn.');
      }
      changes.availability_status = body.availability_status;
    }
  } else if (['pricing_rules', 'service_policies'].includes(resource)) {
    if (resource === 'pricing_rules' && ['name', 'service_type', 'seat_count', 'status', 'route'].some((key) => body[key] !== undefined)) {
      throw new HttpError(400, 'Vehicle classes, services, and status are fixed; only existing rates can be changed.');
    }
    if (body.status !== undefined) {
      if (!Object.values(CONFIGURATION_STATUSES).includes(body.status)) throw new HttpError(400, 'Trạng thái cấu hình không hợp lệ.');
      const required = resource === 'service_policies' ? ['name', 'cancellation_fee_percent', 'waiting_fee_per_hour', 'overtime_fee_per_hour', 'extra_km_fee', 'refund_days', 'effective_from']
        : ['name', 'service_type', 'seat_count'];
      if (body.status === 'active' && required.some((key) => existing[key] === undefined || existing[key] === null || existing[key] === '')) {
        throw new HttpError(409, 'Cấu hình thiếu dữ liệu bắt buộc nên chưa thể kích hoạt.');
      }
      if (resource === 'pricing_rules' && body.status === PRICING_STATUSES.ACTIVE) {
        const rule = { ...existing, ...body };
        validatePricingRule(rule, { requireComplete: true });
        const duplicate = await repository.findOne('pricing_rules', {
          service_type: rule.service_type, seat_count: rule.seat_count, status: PRICING_STATUSES.ACTIVE, rule_id: { $ne: id },
        });
        if (duplicate) throw new HttpError(409, 'Đã có bảng giá hoạt động cho loại dịch vụ và số chỗ này.');
      }
      if (resource === 'service_policies' && body.status === 'active') {
        const candidate = { ...existing, ...body };
        const start = new Date(candidate.effective_from);
        const end = candidate.effective_to ? new Date(candidate.effective_to) : null;
        if (!Number.isFinite(start.getTime()) || (end && (!Number.isFinite(end.getTime()) || end <= start))) {
          throw new HttpError(409, 'Chính sách cần có khoảng hiệu lực hợp lệ trước khi kích hoạt.');
        }
        const overlaps = await findOverlappingPolicies(start, end, id);
        if (overlaps.length) throw new HttpError(409, 'Khoảng hiệu lực bị trùng với một chính sách đang hoạt động.');
      }
      changes.status = body.status;
    }
    if (body.name !== undefined) changes.name = text(body.name, 'Tên cấu hình', 120);
    for (const key of ['service_type', 'route']) {
      if (body[key] !== undefined) changes[key] = key === 'route' && body[key] === '' ? '' : text(body[key], key, key === 'route' ? 200 : 60);
    }
    if (resource === 'service_policies') {
      if (body.effective_from !== undefined) {
        const effectiveFrom = new Date(body.effective_from);
        if (!Number.isFinite(effectiveFrom.getTime())) throw new HttpError(400, 'Ngày bắt đầu hiệu lực không hợp lệ.');
        changes.effective_from = effectiveFrom;
      }
      if (body.effective_to !== undefined) {
        const effectiveTo = body.effective_to ? new Date(body.effective_to) : null;
        if (effectiveTo && !Number.isFinite(effectiveTo.getTime())) throw new HttpError(400, 'Ngày kết thúc hiệu lực không hợp lệ.');
        changes.effective_to = effectiveTo;
      }
      const start = changes.effective_from ?? existing.effective_from;
      const end = Object.hasOwn(changes, 'effective_to') ? changes.effective_to : existing.effective_to;
      if (!start || (end && end <= start)) throw new HttpError(400, 'Khoảng hiệu lực chính sách không hợp lệ.');
      if (existing.status === 'active' || changes.status === 'active') {
        const overlaps = await findOverlappingPolicies(start, end, id);
        if (overlaps.length) throw new HttpError(409, 'Khoảng hiệu lực bị trùng với một chính sách đang hoạt động.');
      }
    }
    for (const key of ['km_rate', 'dispatch_percent', 'day_rate', 'included_km_per_day', 'extra_km_rate', 'driver_night_rate', 'cancellation_fee_percent', 'waiting_fee_per_hour', 'overtime_fee_per_hour', 'extra_km_fee', 'refund_days', 'free_cancellation_hours']) {
      if (body[key] !== undefined) {
        const value = Number(body[key]);
        const percent = key === 'cancellation_fee_percent' || key === 'dispatch_percent';
        const integerRate = ['km_rate', 'day_rate', 'included_km_per_day', 'extra_km_rate', 'driver_night_rate'].includes(key);
      const integerVnd = ['km_rate', 'day_rate', 'extra_km_rate', 'driver_night_rate', 'waiting_fee_per_hour', 'overtime_fee_per_hour', 'extra_km_fee'].includes(key);
      if (!Number.isFinite(value) || value < 0 || (percent && value > 100) || (integerRate && !Number.isSafeInteger(value)) || (integerVnd && !Number.isSafeInteger(value))) throw new HttpError(400, `${key} không hợp lệ.`);
        changes[key] = value;
      }
    }
    if (resource === 'pricing_rules') validatePricingRule({ ...existing, ...changes });
  } else {
    throw new HttpError(403, 'Bạn không được phép cập nhật dữ liệu này.');
  }

  const result = await repository.update(resource, { [field]: id }, changes);
  const versioned = VERSIONED_CONFIG_RESOURCES.has(resource);
  await repository.audit({ actor_id: actorId, actor_role: actor, action: 'update', resource, resource_id: id,
    changed_fields: Object.keys(changes).filter((field) => field !== 'updated_at'),
    ...(versioned && { before: auditSnapshot(existing), after: auditSnapshot({ ...existing, ...changes }),
      configuration_version: changes.updated_at.toISOString() }), summary: `Cập nhật ${resource}` });
  return { matchedCount: result.matchedCount };
}

module.exports = { createResource, listDriverCandidates, listResource, updateResource };
