import client from '../../../api/client.js';

export async function loadVehicles(params, signal) {
  const { data } = await client.get('/homepage/vehicles', { params, signal });
  return data.vehicles;
}

export async function loadReviews(_params, signal) {
  const { data } = await client.get('/homepage/reviews', { signal });
  return data.reviews;
}
