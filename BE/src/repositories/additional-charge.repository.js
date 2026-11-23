const mongoose = require('mongoose');
const { Booking } = require('../models');

async function transaction(work) {
  return mongoose.connection.transaction(work, {
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' },
  });
}

async function findBooking(bookingId, session = null) {
  return Booking.findOne({ booking_id: bookingId }).session(session).lean().exec();
}

async function saveCharges(bookingId, charges, total, session) {
  return Booking.findOneAndUpdate(
    { booking_id: bookingId },
    { $set: { additional_charges: charges, additional_charge: total } },
    { session, returnDocument: 'after', runValidators: true },
  )
    .select('booking_id additional_charge -_id')
    .lean()
    .exec();
}

async function listCharges({ bookingId, status, type, page, limit }) {
  const match = {};
  if (bookingId !== undefined) match.booking_id = bookingId;
  if (status !== undefined) match['additional_charges.status'] = status;
  if (type !== undefined) match['additional_charges.type'] = type;
  const [result] = await Booking.aggregate([
    { $unwind: '$additional_charges' },
    { $match: match },
    {
      $sort: {
        'additional_charges.created_at': -1,
        'additional_charges.charge_id': -1,
        booking_id: -1,
      },
    },
    {
      $facet: {
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              booking_id: 1,
              renter_id: 1,
              booking_status: 1,
              charge_id: '$additional_charges.charge_id',
              type: '$additional_charges.type',
              description: '$additional_charges.description',
              quantity: '$additional_charges.quantity',
              unit_price: '$additional_charges.unit_price',
              amount: '$additional_charges.amount',
              status: '$additional_charges.status',
              created_at: '$additional_charges.created_at',
              updated_at: '$additional_charges.updated_at',
            },
          },
        ],
        total: [{ $count: 'value' }],
      },
    },
  ]).exec();
  const total = result?.total[0]?.value || 0;
  return {
    items: result?.items || [],
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  };
}

module.exports = { transaction, findBooking, saveCharges, listCharges };
