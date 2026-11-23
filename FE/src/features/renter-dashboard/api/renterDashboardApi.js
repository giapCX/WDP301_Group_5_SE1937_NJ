import api from '../../../api/client.js';

export async function loadRenterDashboard(_params, signal) {
  const { data } = await api.get('/renter/dashboard', { signal, withCredentials: true });
  return data;
}
