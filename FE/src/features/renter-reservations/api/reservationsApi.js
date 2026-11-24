import api from '../../../api/client.js';

const bookings = '/renter/bookings';

export async function searchVehicles(filters, signal) {
  const { data } = await api.get('/homepage/vehicles', { params: filters, signal });
  return data;
}
export async function loadVehicleFilters(_params, signal) {
  return (await api.get('/homepage/vehicles/filters', { signal })).data;
}
export async function loadSeatOptions(_params, signal) {
  return (await api.get(bookings + '/seat-options', { signal })).data.seats;
}
export async function createReservation(payload) {
  return (await api.post(bookings, payload)).data;
}
export async function acceptReservationQuote(id, quoteId) {
  return (await api.post(bookings + '/' + id + '/accept-quote', { quoteId, termsAccepted: true })).data;
}
export async function loadQuoteReview(id, signal) {
  return (await api.get(bookings + '/' + id + '/quote-review', { signal })).data;
}
export async function loadBookings(before, signal) {
  return (await api.get(bookings, { params: { before }, signal })).data;
}
export async function startCheckout(id) {
  return (await api.post(bookings + '/' + id + '/checkout')).data;
}
export async function loadVehicle(id, signal) {
  return (await api.get('/homepage/vehicles/' + id, { signal })).data.vehicle;
}

