const express = require('express');
const HttpError = require('../utils/http-error');
const { findVehicles, findVehicleDetails, findVehicleTypes, findVehicleFilters, findReviews } = require('../repositories/homepage.repository');

const router = express.Router();
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function readTimestamp(value) {
  if (!timestampPattern.test(value)) return NaN;
  const day = new Date(value.slice(0, 10) + 'T00:00:00Z');
  if (!Number.isFinite(+day) || day.toISOString().slice(0, 10) !== value.slice(0, 10)) return NaN;
  return Date.parse(value);
}

function readFilters(query) {
  const { minSeats = '7', startAt, endAt, type, minPrice, maxPrice, priceBelow, page } = query;
  if (typeof minSeats !== 'string' || !/^[1-9]\d*$/.test(minSeats) || !Number.isSafeInteger(Number(minSeats))) {
    throw new HttpError(400, 'Số chỗ phải là số nguyên dương hợp lệ.');
  }
  if ((type !== undefined && (typeof type !== 'string' || type.length > 60)) ||
      [minPrice, maxPrice, priceBelow].some((value) => value !== undefined &&
        (typeof value !== 'string' || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))) ||
      (minPrice !== undefined && priceBelow !== undefined && Number(minPrice) >= Number(priceBelow)) ||
      (minPrice !== undefined && maxPrice !== undefined && Number(minPrice) > Number(maxPrice))) {
    throw new HttpError(400, 'Bộ lọc loại xe hoặc khoảng giá không hợp lệ.');
  }
  if (page !== undefined && (typeof page !== 'string' || !/^[1-9]\d{0,3}$/.test(page))) {
    throw new HttpError(400, 'Số trang không hợp lệ.');
  }
  const filters = { seats: Number(minSeats), type, page: page ? Number(page) : undefined };
  if (minPrice !== undefined) filters.minPrice = Number(minPrice);
  if (maxPrice !== undefined) filters.maxPrice = Number(maxPrice);
  if (priceBelow !== undefined) filters.priceBelow = Number(priceBelow);
  if (startAt === undefined && endAt === undefined) return filters;
  if (typeof startAt !== 'string' || typeof endAt !== 'string') {
    throw new HttpError(400, 'Cần cung cấp cả giờ bắt đầu và giờ kết thúc.');
  }
  const start = readTimestamp(startAt);
  const end = readTimestamp(endAt);
  if (!Number.isFinite(start) || start < Date.now()) {
    throw new HttpError(400, 'Giờ bắt đầu phải hợp lệ và không được trước thời điểm hiện tại.');
  }
  if (!Number.isFinite(end) || end < start) {
    throw new HttpError(400, 'Giờ kết thúc phải hợp lệ và không được trước giờ bắt đầu.');
  }
  return { ...filters, start: new Date(start), end: new Date(end) };
}

router.get('/vehicles', async (request, response) => {
  response.json(await findVehicles(readFilters(request.query)));
});
router.get('/vehicle-types', async (_request, response) => {
  response.json({ types: (await findVehicleTypes()).sort() });
});
router.get('/vehicles/filters', async (_request, response) => {
  response.json(await findVehicleFilters());
});
router.get('/vehicles/:id', async (request, response) => {
  const id = Number(request.params.id);
  if (!/^\d+$/.test(request.params.id) || !Number.isSafeInteger(id) || id < 1) {
    throw new HttpError(400, 'Mã xe không hợp lệ.');
  }
  const vehicle = await findVehicleDetails(id);
  if (!vehicle) throw new HttpError(404, 'Không tìm thấy xe.');
  response.json({ vehicle });
});
router.get('/reviews', async (_request, response) => {
  response.json({ reviews: await findReviews() });
});

module.exports = router;
