const path = require('node:path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { User, Role } = require('../src/models');

const defaults = {
  'contract_company.name': 'VietTour DEMO – Đơn vị vận tải mô phỏng',
  'contract_company.address': '123 Đường Demo, Phường Demo, TP. Hồ Chí Minh (giả lập)',
  'contract_company.taxId': 'DEMO-MST-000001',
  phone: '0900000002',
};

async function main() {
  if (!process.env.MONGO_URI) throw new Error('Thiếu MONGO_URI trong BE/.env');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const role = await Role.findOne({ role_name: 'manager' }).lean();
  const manager = role && await User.findOne({
    email: 'demo2@example.com', role_id: role.role_id, status: 'active',
  }).select('user_id').lean();
  if (!manager) throw new Error('Chưa có Manager demo2@example.com đang active. Dùng npm run seed trên database demo để tạo tài khoản mẫu trước.');

  const dryRun = process.argv.includes('--check');
  let changed = 0;
  for (const [field, value] of Object.entries(defaults)) {
    const filter = { user_id: manager.user_id, role_id: role.role_id,
      $or: [{ [field]: { $exists: false } }, { [field]: null }, { [field]: /^\s*$/ }],
    };
    if (dryRun) {
      if (await User.exists(filter)) { console.log(`Sẽ bổ sung: ${field}`); changed++; }
    } else {
      const result = await User.updateOne(filter, { $set: { [field]: value } }, { runValidators: true });
      changed += result.modifiedCount;
    }
  }
  console.log(`${dryRun ? 'Kiểm tra, không ghi dữ liệu' : 'Đã seed Manager demo'}: ${changed} trường ${dryRun ? 'còn thiếu' : 'được bổ sung'}. Không ghi đè thông tin đã có.`);
}

if (require.main === module) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
}

module.exports = { main };
