export async function getApi(path, { signal } = {}) {
  const token = localStorage.getItem('xedi_token') || sessionStorage.getItem('xedi_token');
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
  const token = localStorage.getItem('xedi_token') || sessionStorage.getItem('xedi_token');
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`/api${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || 'Có lỗi xảy ra. Vui lòng thử lại sau.';
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function updateApi(method, path, body, { signal } = {}) {
  const token = localStorage.getItem('xedi_token') || sessionStorage.getItem('xedi_token');
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
