const HttpError = require('./http-error');

function positiveId(value, label = 'Mã hồ sơ') {
  const id = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, label + ' không hợp lệ');
  return id;
}

async function nextId(Model, field, session = null) {
  const last = await Model.findOne().sort({ [field]: -1 }).select(field).session(session).lean();
  return (last?.[field] || 0) + 1;
}

async function retryDuplicateId(fields, write) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await write();
    } catch (error) {
      const duplicateId = error.code === 11000 && fields.some((field) => error.keyPattern?.[field]);
      if (attempt >= 2 || !duplicateId) throw error;
    }
  }
}

module.exports = { positiveId, nextId, retryDuplicateId };
