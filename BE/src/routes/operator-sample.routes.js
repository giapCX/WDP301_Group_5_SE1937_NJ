import { Router } from 'express';

const ALLOWED_STATUSES = new Set(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected']);
const OPERATOR_USER_ID = Number(process.env.OPERATOR_USER_ID || 3);

function positiveInteger(value, field) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw Object.assign(new Error(`${field} không hợp lệ.`), { status: 400 });
  return number;
}

function routeError(response, error) {
  response.status(error.status || 500).json({ error: { message: error.message || 'Không thể xử lý yêu cầu.' } });
}

export function createSampleOperatorRouter(connection) {
  const router = Router();
  const database = connection.db;
  const bookings = database.collection('bookings');
  const users = database.collection('users');
  const vehicles = database.collection('vehicles');
  const changeRequests = database.collection('booking_change_requests');

  async function presentBooking(booking) {
    if (!booking) return null;
    const [renter, vehicle] = await Promise.all([
      booking.renter_id ? users.findOne({ user_id: booking.renter_id }, { projection: { _id: 0, user_id: 1, full_name: 1, email: 1, phone: 1 } }) : null,
      booking.vehicle_id ? vehicles.findOne({ vehicle_id: booking.vehicle_id }, { projection: { _id: 0, vehicle_id: 1, brand: 1, model: 1, plate_number: 1, seat_count: 1, status: 1, price_per_day: 1 } }) : null,
    ]);
    return { ...booking, renter, vehicle };
  }

  async function availableVehicles(booking, session) {
    const candidates = await vehicles.find({ status: 'available' }, { session })
      .project({ _id: 0, vehicle_id: 1, brand: 1, model: 1, plate_number: 1, seat_count: 1, status: 1, price_per_day: 1 })
      .sort({ seat_count: 1, vehicle_id: 1 }).toArray();
    const pickup = new Date(booking.pickup_time);
    const end = new Date(booking.estimated_end_time);
    const result = [];
    for (const vehicle of candidates) {
      const conflict = await bookings.findOne({
        booking_id: { $ne: booking.booking_id },
        vehicle_id: vehicle.vehicle_id,
        booking_status: { $in: ['confirmed', 'in_progress'] },
        pickup_time: { $lt: end },
        estimated_end_time: { $gt: pickup },
      }, { session, projection: { _id: 1 } });
      if (!conflict) result.push(vehicle);
    }
    return result;
  }

  router.get('/dashboard', async (_request, response) => {
    try {
      const [totalBookings, pendingBookings, confirmedBookings, activeTrips, completedTrips, availableVehiclesCount, openIncidents] = await Promise.all([
        bookings.countDocuments({}),
        bookings.countDocuments({ booking_status: 'pending' }),
        bookings.countDocuments({ booking_status: 'confirmed' }),
        bookings.countDocuments({ booking_status: 'in_progress' }),
        bookings.countDocuments({ booking_status: 'completed' }),
        vehicles.countDocuments({ status: 'available' }),
        database.collection('incidents').countDocuments({ incident_status: { $in: ['open', 'investigating', 'in_progress'] } }),
      ]);
      response.json({ data: { totalBookings, pendingBookings, confirmedBookings, activeTrips, completedTrips, availableVehicles: availableVehiclesCount, openIncidents } });
    } catch (error) { routeError(response, error); }
  });

  router.get('/vehicles/available', async (_request, response) => {
    try {
      const items = await vehicles.find({ status: 'available' }, { projection: { _id: 0 } })
        .sort({ seat_count: 1, vehicle_id: 1 }).toArray();
      response.json({ data: { items, total: items.length } });
    } catch (error) { routeError(response, error); }
  });

  router.get('/booking-change-requests', async (request, response) => {
    try {
      const page = request.query.page === undefined ? 1 : positiveInteger(request.query.page, 'page');
      const limit = request.query.limit === undefined ? 10 : positiveInteger(request.query.limit, 'limit');
      if (limit > 100) throw Object.assign(new Error('limit tối đa là 100.'), { status: 400 });
      const status = typeof request.query.status === 'string' ? request.query.status.trim() : '';
      if (status && !['pending', 'approved', 'rejected'].includes(status)) throw Object.assign(new Error('Trạng thái yêu cầu không hợp lệ.'), { status: 400 });
      const filter = {};
      if (status) filter.request_status = status;
      if (request.query.booking_id !== undefined) filter.booking_id = positiveInteger(request.query.booking_id, 'booking_id');
      const [items, total] = await Promise.all([
        changeRequests.find(filter).sort({ requested_at: -1, change_request_id: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
        changeRequests.countDocuments(filter),
      ]);
      response.json({ data: { items, total, page, limit, total_pages: Math.ceil(total / limit) } });
    } catch (error) { routeError(response, error); }
  });

  router.get('/booking-change-requests/:id', async (request, response) => {
    try {
      const id = positiveInteger(request.params.id, 'change_request_id');
      const item = await changeRequests.findOne({ change_request_id: id });
      if (!item) throw Object.assign(new Error('Không tìm thấy yêu cầu thay đổi.'), { status: 404 });
      response.json({ data: item });
    } catch (error) { routeError(response, error); }
  });

  router.patch('/booking-change-requests/:id/reject', async (request, response) => {
    try {
      const id = positiveInteger(request.params.id, 'change_request_id');
      const reason = typeof request.body?.rejection_reason === 'string' ? request.body.rejection_reason.trim() : '';
      if (!reason) throw Object.assign(new Error('Cần nhập lý do từ chối.'), { status: 400 });
      const result = await changeRequests.updateOne(
        { change_request_id: id, request_status: 'pending' },
        { $set: { request_status: 'rejected', reviewed_by: OPERATOR_USER_ID, reviewed_at: new Date(), rejection_reason: reason } },
      );
      if (!result.modifiedCount) throw Object.assign(new Error('Yêu cầu không còn chờ xử lý.'), { status: 409 });
      response.json({ data: await changeRequests.findOne({ change_request_id: id }) });
    } catch (error) { routeError(response, error); }
  });

  router.patch('/booking-change-requests/:id/approve', async (request, response) => {
    try {
      const id = positiveInteger(request.params.id, 'change_request_id');
      const change = await changeRequests.findOne({ change_request_id: id, request_status: 'pending' });
      if (!change) throw Object.assign(new Error('Yêu cầu không còn chờ xử lý.'), { status: 409 });
      const booking = await bookings.findOne({ booking_id: change.booking_id, booking_status: 'confirmed' });
      if (!booking) throw Object.assign(new Error('Booking không còn ở trạng thái có thể đổi lịch.'), { status: 409 });
      const updated = await bookings.updateOne(
        { booking_id: booking.booking_id, booking_status: 'confirmed', pickup_time: change.before.pickup_time, estimated_end_time: change.before.estimated_end_time },
        { $set: { pickup_location: change.after.pickup_location, dropoff_location: change.after.dropoff_location, pickup_time: change.after.pickup_time, estimated_end_time: change.after.estimated_end_time, estimated_price: change.after.estimated_price, trip_stops: change.after.trip_stops || [] } },
      );
      if (!updated.modifiedCount) throw Object.assign(new Error('Lịch booking đã thay đổi. Tải lại yêu cầu.'), { status: 409 });
      const decision = await changeRequests.updateOne(
        { change_request_id: id, request_status: 'pending' },
        { $set: { request_status: 'approved', reviewed_by: OPERATOR_USER_ID, reviewed_at: new Date(), rejection_reason: null } },
      );
      if (!decision.modifiedCount) throw Object.assign(new Error('Yêu cầu vừa được xử lý.'), { status: 409 });
      response.json({ data: await changeRequests.findOne({ change_request_id: id }) });
    } catch (error) { routeError(response, error); }
  });

  router.get('/bookings', async (request, response) => {
    try {
      const page = request.query.page === undefined ? 1 : positiveInteger(request.query.page, 'page');
      const limit = request.query.limit === undefined ? 10 : positiveInteger(request.query.limit, 'limit');
      if (limit > 100) throw Object.assign(new Error('limit tối đa là 100.'), { status: 400 });
      const status = typeof request.query.status === 'string' ? request.query.status.trim() : '';
      if (status && status !== 'all' && !ALLOWED_STATUSES.has(status)) throw Object.assign(new Error('Trạng thái booking không hợp lệ.'), { status: 400 });
      const filter = status && status !== 'all' ? { booking_status: status } : {};
      let rows = await bookings.find(filter).sort({ created_at: -1, booking_id: -1 }).toArray();
      const query = typeof request.query.q === 'string' ? request.query.q.trim().toLocaleLowerCase('vi') : '';
      if (query) {
        const enriched = await Promise.all(rows.map(presentBooking));
        rows = enriched.filter((booking) => [
          booking.booking_id, booking.renter?.full_name, booking.renter?.phone,
          booking.pickup_location, booking.dropoff_location, booking.vehicle?.plate_number,
        ].some((value) => String(value || '').toLocaleLowerCase('vi').includes(query)));
        const total = rows.length;
        const items = rows.slice((page - 1) * limit, page * limit);
        return response.json({ data: { items, total, page, limit, total_pages: Math.ceil(total / limit) } });
      }
      const total = rows.length;
      rows = rows.slice((page - 1) * limit, page * limit);
      const items = await Promise.all(rows.map(presentBooking));
      response.json({ data: { items, total, page, limit, total_pages: Math.ceil(total / limit) } });
    } catch (error) { routeError(response, error); }
  });

  router.get('/bookings/:id/available-vehicles', async (request, response) => {
    try {
      const id = positiveInteger(request.params.id, 'booking_id');
      const booking = await bookings.findOne({ booking_id: id });
      if (!booking) throw Object.assign(new Error('Không tìm thấy booking.'), { status: 404 });
      if (booking.booking_status !== 'pending') throw Object.assign(new Error('Booking không còn chờ xử lý.'), { status: 409 });
      response.json({ data: { booking_id: id, vehicles: await availableVehicles(booking) } });
    } catch (error) { routeError(response, error); }
  });

  router.get('/bookings/:id', async (request, response) => {
    try {
      const id = positiveInteger(request.params.id, 'booking_id');
      const booking = await bookings.findOne({ booking_id: id });
      if (!booking) throw Object.assign(new Error('Không tìm thấy booking.'), { status: 404 });
      response.json({ data: await presentBooking(booking) });
    } catch (error) { routeError(response, error); }
  });

  router.patch('/bookings/:id/approve', async (request, response) => {
    try {
      const id = positiveInteger(request.params.id, 'booking_id');
      const vehicleId = positiveInteger(request.body?.vehicle_id, 'vehicle_id');
      const booking = await bookings.findOne({ booking_id: id });
      if (!booking) throw Object.assign(new Error('Không tìm thấy booking.'), { status: 404 });
      if (booking.booking_status !== 'pending') throw Object.assign(new Error('Booking không còn chờ xử lý.'), { status: 409 });
      const vehicle = await vehicles.findOne({ vehicle_id: vehicleId, status: 'available' });
      if (!vehicle) throw Object.assign(new Error('Xe không sẵn sàng điều phối.'), { status: 409 });
      const options = await availableVehicles(booking);
      if (!options.some((item) => item.vehicle_id === vehicleId)) throw Object.assign(new Error('Xe đã có chuyến trùng lịch.'), { status: 409 });
      const result = await bookings.updateOne(
        { booking_id: id, booking_status: 'pending' },
        { $set: { vehicle_id: vehicleId, booking_status: 'confirmed', reviewed_by: OPERATOR_USER_ID, reviewed_at: new Date(), rejection_reason: null } },
      );
      if (!result.modifiedCount) throw Object.assign(new Error('Booking vừa được xử lý. Tải lại danh sách.'), { status: 409 });
      const updated = await bookings.findOne({ booking_id: id });
      response.json({ data: await presentBooking(updated) });
    } catch (error) { routeError(response, error); }
  });

  router.patch('/bookings/:id/reject', async (request, response) => {
    try {
      const id = positiveInteger(request.params.id, 'booking_id');
      const reason = typeof request.body?.rejection_reason === 'string' ? request.body.rejection_reason.trim() : '';
      if (!reason) throw Object.assign(new Error('Cần nhập lý do từ chối.'), { status: 400 });
      const result = await bookings.updateOne(
        { booking_id: id, booking_status: 'pending' },
        { $set: { booking_status: 'rejected', reviewed_by: OPERATOR_USER_ID, reviewed_at: new Date(), rejection_reason: reason } },
      );
      if (!result.modifiedCount) throw Object.assign(new Error('Booking không còn chờ xử lý.'), { status: 409 });
      response.json({ data: await presentBooking(await bookings.findOne({ booking_id: id })) });
    } catch (error) { routeError(response, error); }
  });

  return router;
}
