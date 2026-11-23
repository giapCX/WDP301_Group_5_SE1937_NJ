function normalizePhone(value) {
  if (typeof value !== 'string') return null;
  const compact = value.trim().replace(/[\s().-]/g, '');
  const local = compact.replace(/^\+84/, '0');
  if (/^0\d{9}$/.test(local)) return local;
  if (/^\+[1-9]\d{7,14}$/.test(compact) && !compact.startsWith('+84')) return compact;
  return null;
}

module.exports = normalizePhone;
