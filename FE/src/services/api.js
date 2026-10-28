export async function getApi(path, { signal } = {}) {
  const token = localStorage.getItem('xedi_token') || sessionStorage.getItem('xedi_token');
  const headers = { Accept: 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`/api${path}`, { signal, headers });
  if (!response.ok) throw new Error('Không thể tải dữ liệu. Vui lòng thử lại sau.');
  return response.json();
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
