const fuelNames = {
  gasoline: 'Xăng',
  diesel: 'Dầu Diesel',
  electric: 'Điện',
  hybrid: 'Hybrid',
};

export function toVehicle(listing) {
  const vehicle = listing.vehicle;
  const transmission =
    vehicle.transmission === 'automatic' ? 'Tự động' : 'Số sàn';
  // Seed photo keys are not actual files. Show the neutral placeholder until real assets exist.
  const image =
    listing.photos?.find(
      (photo) => /^https?:\/\//.test(photo) || photo.startsWith('/'),
    ) || null;
  return {
    id: listing._id,
    name: listing.title,
    price: listing.daily_price,
    image,
    fuel: vehicle.fuel_type,
    fuelLabel: fuelNames[vehicle.fuel_type] || vehicle.fuel_type,
    location:
      listing.pickup_location?.branch_name ||
      listing.pickup_location?.city ||
      'Nhận xe tại gara',
    tags: [
      transmission,
      `${vehicle.seats} chỗ`,
      vehicle.vehicle_type,
      `Đời ${vehicle.manufacture_year}`,
    ],
    description: listing.description,
    deposit: listing.security_deposit_amount,
  };
}

export function listingsQuery({ filters, search, sort, page, savedIds }) {
  const params = new URLSearchParams({
    page: String(page),
    limit: '6',
    sort,
    minPrice: String(filters.minPrice),
    maxPrice: String(filters.maxPrice),
  });
  if (search.q.trim()) params.set('q', search.q.trim());
  if (search.city) params.set('city', search.city);
  if (search.start && search.end) {
    params.set('startAt', new Date(search.start).toISOString());
    params.set('endAt', new Date(search.end).toISOString());
  }
  if (filters.types.length) params.set('vehicleType', filters.types.join(','));
  if (filters.fuel) params.set('fuelType', filters.fuel);
  if (filters.transmission) params.set('transmission', filters.transmission);
  if (filters.seats) params.set('seats', filters.seats);
  if (filters.recent) params.set('minYear', '2023');
  if (savedIds !== undefined) params.set('ids', savedIds.join(','));
  return params.toString();
}

export async function fetchListings(query, signal) {
  const response = await fetch(`/api/listings?${query}`, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      response.status >= 500
        ? 'Không thể tải danh sách xe. Vui lòng kiểm tra backend và MongoDB.'
        : body?.error?.message || 'Thông tin tìm kiếm không hợp lệ.',
    );
  }
  const body = await response.json();
  return { cars: body.data.map(toVehicle), pagination: body.pagination };
}
