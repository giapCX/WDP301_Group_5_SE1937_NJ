const mongoose = require('mongoose');
const { RESOURCE_ID_FIELDS: ID_FIELDS } = require('../config/management.constants');
const { PAID_PAYMENT_STATUSES } = require('../config/manager-dashboard.constants');

const database = () => mongoose.connection.db;
const collection = (name) => database().collection(name);

async function list(collectionName, query = {}, options = {}) {
  return collection(collectionName).find(query, options).sort({ _id: -1 }).limit(500).toArray();
}

async function findOne(collectionName, query, options) {
  return collection(collectionName).findOne(query, options);
}

async function nextId(name) {
  const idField = ID_FIELDS[name];
  if (!idField) throw new Error(`Unknown sequence collection: ${name}`);
  const existing = await collection(name).findOne({}, { sort: { [idField]: -1 } });
  await collection('sequences').updateOne({ _id: name }, { $max: { value: existing?.[idField] || 0 } }, { upsert: true });
  const result = await collection('sequences').findOneAndUpdate(
    { _id: name },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  const document = result?.value && typeof result.value === 'object' ? result.value : result;
  return document.value;
}

async function insert(collectionName, document) {
  await collection(collectionName).insertOne(document);
  return document;
}

async function update(collectionName, query, changes) {
  return collection(collectionName).updateOne(query, { $set: changes });
}

async function audit(event) {
  return insert('audit_logs', { ...event, created_at: new Date() });
}

async function managementReports() {
  const [paid, unpaid, refunds] = await Promise.all([
    collection('payments').aggregate([{ $match: { $or: [{ payment_status: { $in: [...PAID_PAYMENT_STATUSES] } }, { status: { $in: [...PAID_PAYMENT_STATUSES] } }] } }, { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }]).toArray(),
    collection('payments').aggregate([{ $match: { payment_status: { $in: ['pending', 'unpaid', 'processing'] } } }, { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }]).toArray(),
    collection('refunds').aggregate([{ $match: { refund_status: 'completed' } }, { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }]).toArray(),
  ]);
  return [
    { name: 'Doanh thu đã thu', value: paid[0]?.amount || 0, unit: 'VND' },
    { name: 'Giao dịch đã thu', value: paid[0]?.count || 0, unit: 'giao dịch' },
    { name: 'Khoản chưa thu', value: unpaid[0]?.amount || 0, unit: 'VND' },
    { name: 'Hoàn tiền đã xử lý', value: refunds[0]?.amount || 0, unit: 'VND' },
    { name: 'Số khoản hoàn tiền', value: refunds[0]?.count || 0, unit: 'khoản' },
  ];
}

module.exports = { audit, findOne, insert, list, managementReports, nextId, update };
