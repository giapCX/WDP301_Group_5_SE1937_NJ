const express = require('express');
const HttpError = require('../utils/http-error');
const { findVehicles, findReviews } = require('../repositories/homepage.repository');

const router = express.Router();

function readFilters(query) {
  const { minSeats = '7', startAt, endAt } = query;
  if (typeof minSeats !== 'string' || !/^(?:[7-9]|[1-4][0-9]|50)$/.test(minSeats)) {
    throw new HttpError(400, 'Số chỗ phải từ 7 đến 50.');
  }
  const seats = Number(minSeats);
  if (startAt === undefined && endAt === undefined) return { seats };
  if (typeof startAt !== 'string' || typeof endAt !== 'string') {
    throw new HttpError(400, 'Cần cung cấp giờ đón và giờ kết thúc.');
  }
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || start <= new Date() || end <= start) {
    throw new HttpError(400, 'Khoảng thời gian thuê không hợp lệ.');
  }
  return { seats, start, end };
}

router.get('/vehicles', async (request, response) => {
  response.json({ vehicles: await findVehicles(readFilters(request.query)) });
});
router.get('/reviews', async (_request, response) => {
  response.json({ reviews: await findReviews() });
});

module.exports = router;
