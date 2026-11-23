// Demo request history for confirmed booking #2, owned by renter #8.
function createSampleChangeRequests(bookings, tripStops) {
  const booking = bookings.find((item) => item.booking_id === 2);
  const current = {
    pickup_location: booking.pickup_location,
    dropoff_location: booking.dropoff_location,
    pickup_time: booking.pickup_time,
    estimated_end_time: booking.estimated_end_time,
    estimated_price: booking.estimated_price,
    trip_stops: tripStops
      .filter((stop) => stop.booking_id === booking.booking_id)
      .map(({ stop_order, location, note }) => ({ stop_order, location, note })),
  };
  const previous = {
    ...current,
    pickup_time: new Date('2026-12-02T01:00:00Z'),
    estimated_end_time: new Date('2026-12-04T01:00:00Z'),
  };

  return [
    {
      change_request_id: 1,
      booking_id: 2,
      requested_by: 8,
      requested_at: new Date('2026-11-17T02:00:00Z'),
      reason: 'Muốn chuyển điểm trả sang Đà Lạt và kéo dài chuyến đi một ngày.',
      before: previous,
      after: {
        ...previous,
        dropoff_location: 'Demo: Da Lat',
        estimated_end_time: new Date('2026-12-05T01:00:00Z'),
        estimated_price: 2400000,
      },
      price_difference: 800000,
      request_status: 'rejected',
      reviewed_by: 3,
      reviewed_at: new Date('2026-11-18T02:00:00Z'),
      rejection_reason: 'Không đáp ứng được lịch xe cho ngày thuê bổ sung.',
    },
    {
      change_request_id: 2,
      booking_id: 2,
      requested_by: 8,
      requested_at: new Date('2026-11-19T02:00:00Z'),
      reason: 'Lùi ngày khởi hành một ngày, giữ nguyên hành trình và thời lượng.',
      before: previous,
      after: current,
      price_difference: 0,
      request_status: 'approved',
      reviewed_by: 3,
      reviewed_at: new Date('2026-11-20T02:00:00Z'),
      rejection_reason: null,
    },
    {
      change_request_id: 3,
      booking_id: 2,
      requested_by: 8,
      requested_at: new Date('2026-11-22T02:00:00Z'),
      reason: 'Xin đón muộn hơn hai giờ và thêm điểm tham quan Hải đăng Vũng Tàu.',
      before: current,
      after: {
        ...current,
        pickup_time: new Date('2026-12-03T03:00:00Z'),
        estimated_end_time: new Date('2026-12-05T03:00:00Z'),
        estimated_price: 1800000,
        trip_stops: [
          ...current.trip_stops,
          {
            stop_order: 3,
            location: 'Demo: Hai dang Vung Tau',
            note: 'Tham quan 45 phút',
          },
        ],
      },
      price_difference: 200000,
      request_status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
    },
  ];
}

module.exports = { createSampleChangeRequests };
