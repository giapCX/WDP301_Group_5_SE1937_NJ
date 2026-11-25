const { User, Role } = require('../models');
const HttpError = require('../utils/http-error');

function required(value, label, max = 255) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, `${label} không hợp lệ`);
  }
  return value.trim();
}

function companyFromManager(manager) {
  return {
    name: manager.contract_company?.name || '',
    address: manager.contract_company?.address || '',
    taxId: manager.contract_company?.taxId || '',
    representative: manager.full_name,
    title: 'Manager',
    phone: manager.phone || '',
    managerId: manager.user_id,
  };
}

async function managerProfile(userId) {
  const role = await Role.findOne({ role_name: 'manager' }).lean();
  const manager = role && await User.findOne({ user_id: userId, role_id: role.role_id, status: 'active' })
    .select('user_id full_name phone contract_company -_id').lean();
  if (!manager) throw new HttpError(404, 'Không tìm thấy Manager đang hoạt động');
  return companyFromManager(manager);
}

async function saveManagerProfile(userId, input) {
  await managerProfile(userId);
  const company = {
    name: required(input?.name, 'Tên đơn vị vận tải'),
    address: required(input?.address, 'Địa chỉ đơn vị'),
    taxId: required(input?.taxId, 'Mã số thuế'),
  };
  const phone = required(input?.phone, 'Điện thoại Manager', 20);
  await User.updateOne({ user_id: userId, status: 'active' }, { $set: { contract_company: company, phone } }, { runValidators: true });
  return managerProfile(userId);
}

async function contractCompany() {
  const role = await Role.findOne({ role_name: 'manager' }).lean();
  const configuredId = process.env.CONTRACT_MANAGER_ID;
  if (configuredId && !/^[1-9]\d*$/.test(configuredId)) {
    throw new HttpError(409, 'Cấu hình Manager đại diện hợp đồng không hợp lệ');
  }
  const managers = role ? await User.find({ role_id: role.role_id, status: 'active',
    ...(configuredId ? { user_id: Number(configuredId) } : { 'contract_company.name': { $exists: true, $ne: '' } }),
  }).select('user_id full_name phone contract_company -_id').limit(2).lean() : [];
  if (managers.length !== 1) {
    throw new HttpError(409, managers.length ? 'Có nhiều Manager cấu hình hợp đồng; cần chọn CONTRACT_MANAGER_ID tại máy chủ' : 'Manager cần lưu hồ sơ đơn vị vận tải tại mục Hồ sơ hợp đồng trước khi gửi báo giá');
  }
  const company = companyFromManager(managers[0]);
  if (Object.values(company).some((value) => !value)) {
    throw new HttpError(409, 'Hồ sơ hợp đồng của Manager chưa đầy đủ');
  }
  return company;
}

module.exports = { contractCompany, managerProfile, saveManagerProfile };
