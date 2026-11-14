import { getSessionToken } from '../features/auth/session';

export async function getApi(path, { signal } = {}) {
  const token = getSessionToken();
  const headers = { Accept: 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`/api${path}`, { signal, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || 'Không thể tải dữ liệu. Vui lòng thử lại sau.');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function postApi(path, body, { signal } = {}) {
  const token = getSessionToken();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`/api${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Không kết nối được backend. Vui lòng kiểm tra backend đang chạy ở cổng 5000.');
  }

  let invalidJson = false;
  const data = await response.json().catch(() => { invalidJson = true; return {}; });
  if (!response.ok) {
    const proxyFailed = invalidJson && response.status >= 500;
    const message = data.error?.message || (proxyFailed
      ? 'Không kết nối được backend. Vui lòng kiểm tra backend đang chạy ở cổng 5000.'
      : `API trả về lỗi HTTP ${response.status}. Vui lòng kiểm tra backend.`);
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function updateApi(method, path, body, { signal } = {}) {
  const token = getSessionToken();
  const response = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || 'Không thể cập nhật dữ liệu. Vui lòng thử lại.');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const patchApi = (path, body, options) => updateApi('PATCH', path, body, options);
export const putApi = (path, body, options) => updateApi('PUT', path, body, options);

export async function getBlobApi(path, { signal } = {}) {
  const token = getSessionToken();
  const response = await fetch(`/api${path}`, { signal, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.error?.message || 'Không tải được tệp.');
    error.status = response.status;
    throw error;
  }
  return response.blob();
}
