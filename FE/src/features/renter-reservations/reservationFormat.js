const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const timeZone = 'Asia/Ho_Chi_Minh';
const time = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone });
const inputTime = new Intl.DateTimeFormat('sv-SE', {
  timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export const minuteMs = 60 * 1000;

export function earliestTripMinute(now = Date.now()) {
  const nextMinute = Math.ceil(now / minuteMs) * minuteMs;
  const parts = Object.fromEntries(inputTime.formatToParts(nextMinute).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export const money = (value) => Number.isFinite(value) ? currency.format(value) : '—';
export const formatTime = (value) => value ? time.format(new Date(value)) : '—';
export const vehicleName = (vehicle) => [vehicle.brand, vehicle.model].filter(Boolean).join(' ');
export const errorMessage = (error, fallback) => error.response?.data?.message || fallback;
export const toTripTime = (value) => value ? value + ':00+07:00' : undefined;
export const services = [
  { value: 'roundtrip', label: 'Round-trip Transfer', description: 'Tài xế đưa khách đi và quay lại đón theo giờ hẹn.' },
  { value: 'tour', label: 'Accompanied Sightseeing', description: 'Tài xế đồng hành và đưa khách đến từng điểm tham quan.' },
];

