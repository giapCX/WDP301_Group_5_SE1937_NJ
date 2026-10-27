export async function getApi(path, { signal } = {}) {
  const response = await fetch(`/api${path}`, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Không thể tải dữ liệu. Vui lòng thử lại sau.');
  return response.json();
}
