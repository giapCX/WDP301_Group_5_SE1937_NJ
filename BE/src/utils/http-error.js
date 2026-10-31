export function httpError(status, message, details) {
  return Object.assign(new Error(message), { status, details, expose: true });
}

export function objectId(value, field = 'id') {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value))
    throw httpError(400, `${field} phải là ObjectId hợp lệ.`);
  return value;
}
