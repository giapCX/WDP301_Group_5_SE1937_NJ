const { createHash, randomUUID } = require("node:crypto");
const { Booking } = require("../models");
const template = require("../config/passenger-contract-template.json");
const HttpError = require("../utils/http-error");
// Fixed terms from Article 3 of the supplied passenger contract template.
const FIXED_CONTRACT_TERMS = Object.freeze({
  tollsAndParking: "Lái xe chịu trách nhiệm.",
  driverExpenses: "Ăn nghỉ theo đoàn.",
});
const text = (value, name, max = 255) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new HttpError(400, name + " không hợp lệ");
  return value.trim();
};
async function proposal(input, booking, operatorId) {
  const company = await require('./contract-company.service').contractCompany();
  const distance = Number(input.distanceKm);
  if (!Number.isFinite(distance) || distance <= 0 || distance > 100000)
    throw new HttpError(400, "Cự ly hành trình không hợp lệ");
  return {
    id: randomUUID(),
    status: "proposed",
    templateVersion: "passenger-2025-v1",
    company,
    distanceKm: distance,
    ...FIXED_CONTRACT_TERMS,
    penaltyTerms: text(input.penaltyTerms, "Thỏa thuận hủy và vi phạm", 1000),
    sentBy: operatorId,
    sentAt: new Date(),
    clauses: template.slice(
      template.findIndex((line) => line.startsWith("ĐIỀU 4.")),
      template.findIndex((line) => line.startsWith("ĐIỀU 11.")),
    ),
  };
}
function render(booking, input) {
  const contract = booking.transport_contract;
  if (!contract || contract.status !== "proposed")
    throw new HttpError(409, "Cần Operator gửi báo giá kèm hợp đồng mới");
  const renter = {};
  for (const [key, label] of Object.entries({
    name: "Tên bên thuê",
    address: "Địa chỉ bên thuê",
    identity: "Số CCCD/ĐKKD",
    phone: "Điện thoại bên thuê",
  }))
    renter[key] = text(input?.[key], label);
  const luggageKg = Number(input.luggageKg);
  if (!Number.isFinite(luggageKg) || luggageKg < 0 || luggageKg > 10000)
    throw new HttpError(400, "Khối lượng hành lý không hợp lệ");
  const price = booking.pricing_breakdown;
  const document = {
    number: `VT-${booking.booking_id}/${contract.id.slice(0, 8)}/HĐVCHK`,
    contractId: contract.id,
    quoteId: booking.quote_offer.id,
    company: contract.company,
    renter,
    luggageKg,
    distanceKm: contract.distanceKm,
    service: booking.service_type,
    requestedSeats: booking.requested_seats || booking.requested_seat_count,
    passengers: booking.passenger_count,
    pickup: booking.pickup_location,
    destination: booking.destination,
    dropoff: booking.dropoff_location,
    pickupTime: new Date(booking.pickup_time).toISOString(),
    endTime: new Date(booking.estimated_end_time).toISOString(),
    returnPickup: booking.return_pickup_location,
    returnTime: booking.return_pickup_time
      ? new Date(booking.return_pickup_time).toISOString()
      : null,
    total: price.total,
    deposit: booking.deposit_due,
    balance: price.total - booking.deposit_due,
    tollsAndParking: contract.tollsAndParking,
    driverExpenses: contract.driverExpenses,
    penaltyTerms: contract.penaltyTerms,
    stops: contract.stops,
    clauses: contract.clauses.map((line) => {
      if (line.includes("phạt tới")) return contract.penaltyTerms;
      if (line.startsWith("d) Được nhận lại toàn bộ")) {
        return `${line} ${contract.penaltyTerms}`;
      }
      if (line.startsWith("Khi phát sinh khiếu nại")) {
        return `Khi phát sinh khiếu nại, tố cáo của hành khách trên xe, Bên B liên hệ Bên A qua số điện thoại ${contract.company.phone} để yêu cầu giải quyết.`;
      }
      return line;
    }),
    paymentTerms:
      "Ký xác nhận trước khi thanh toán. Thanh toán cọc mô phỏng thành công mới kích hoạt hợp đồng. Phần còn lại thanh toán sau chuyến và đối soát phát sinh đã xác nhận.",
    effectiveTerms:
      "Bản xác nhận ký chờ thanh toán chưa có hiệu lực thực hiện. Hợp đồng được kích hoạt khi hệ thống ghi nhận thanh toán cọc thành công và áp dụng cho lịch trình đã thỏa thuận.",
  };
  const hash = createHash("sha256")
    .update(JSON.stringify(document))
    .digest("hex");
  return { document, hash };
}
async function preview(id, renterId, input) {
  const booking = await Booking.findOne({
    booking_id: id,
    renter_id: renterId,
  }).lean();
  if (!booking) throw new HttpError(404, "Không tìm thấy booking");
  if (
    booking.booking_status !== "quoted" ||
    input.quoteId !== booking.quote_offer?.id
  )
    throw new HttpError(409, "Báo giá đã thay đổi");
  // Itinerary is snapshotted in the quote proposal, not read from the client.
  return render(booking, input.renter);
}
module.exports = { proposal, render, preview };
