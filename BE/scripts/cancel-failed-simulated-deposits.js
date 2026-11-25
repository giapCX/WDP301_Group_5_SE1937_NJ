const path = require('node:path');
const { connectDb, disconnectDb } = require('../dal/database');
const { Booking, Payment } = require('../src/models');

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
  await connectDb();
  const eligible = {
    booking_status: 'awaiting_payment',
    'transport_contract.status': 'signed_pending_payment',
    checkout_failed_at: { $type: 'date' },
    paid_total: 0,
  };
  const bookings = Booking.find(eligible).select('booking_id checkout_failed_at transport_contract.signedAt').lean().cursor();
  let count = 0;
  for await (const booking of bookings) {
    if (!booking.transport_contract?.signedAt || booking.checkout_failed_at < booking.transport_contract.signedAt) continue;
    const lastPayment = await Payment.findOne({ booking_id: booking.booking_id }).sort({ payment_id: -1 }).lean();
    if (lastPayment?.payment_status !== 'failed' || lastPayment.payment_method !== 'simulation' || lastPayment.purpose !== 'deposit') continue;
    const result = await Booking.updateOne({
      ...eligible, booking_id: booking.booking_id, checkout_failed_at: booking.checkout_failed_at,
    }, {
      $set: {
        booking_status: 'cancelled',
        'transport_contract.status': 'cancelled',
        'transport_contract.cancelledAt': booking.checkout_failed_at,
        'transport_contract.cancellationReason': 'payment_failed',
      },
      $unset: { checkout_attempt: '' },
    });
    if (result.modifiedCount) console.log(`Đã hủy hợp đồng của đơn #${booking.booking_id}`);
    count += result.modifiedCount;
  }
  console.log(`Số hợp đồng đã cập nhật: ${count}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(disconnectDb);
