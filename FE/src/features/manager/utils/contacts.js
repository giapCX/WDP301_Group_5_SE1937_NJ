export const isValidEmail = value => {
  const email = String(value || '').trim();
  return email.length <= 254 && /^(?=.{1,64}@)[A-Z0-9.!#$%&'*+/=?^_~-]+@(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,63}$/i.test(email) && !email.includes('..');
};

export const normalizeVietnamPhone = value => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const compact = raw.replace(/[\s().-]/g, '');
  const national = compact.startsWith('+84') ? `0${compact.slice(3)}` : compact;
  return /^0[35789]\d{8}$/.test(national) ? national : null;
};
