import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const rentalArticles = JSON.parse(readFileSync(new URL('./rental-contract-articles.json', import.meta.url), 'utf8'));

const localTime = (value) => new Date(value).toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
});

const money = (value) => value == null
  ? 'Theo booking'
  : `${new Intl.NumberFormat('vi-VN').format(value)} VND`;

const facts = (entries) => entries
  .filter(([, value]) => value != null && value !== '')
  .map(([label, value]) => ({ label, value: String(value) }));

const article = (title, ...paragraphs) => ({
  title,
  paragraphs: paragraphs.filter(Boolean),
});

export function createRentalContractDocument({
  row,
  booking,
  vehicle,
  owner,
  renter,
  now,
}) {
  const terms = row.terms_snapshot;
  const pickup = booking.pickup_location?.branch || 'Gara theo booking';
  const dropoff = booking.return_location?.branch || pickup;
  const cancellationHours = terms.cancellation?.config?.free_cancel_before_hours;
  const refundDays = terms.deposit_refund?.config?.refund_within_business_days;
  const articles = booking.review_info?.required === false ? rentalArticles.map((entry, index) => {
    const paragraphs = [...entry.paragraphs];
    if (index === 1) {
      paragraphs[0] = `1. Thời hạn thuê từ ${localTime(terms.start_at)} đến ${localTime(terms.end_at)}.`;
      paragraphs[1] = `2. Địa điểm giao xe: ${pickup}. Địa điểm trả xe: ${dropoff}.`;
    }
    if (index === 3) {
      paragraphs[0] = `1. Đơn giá ${money(terms.daily_rate)}/ngày. Tổng tiền thuê ${money(terms.rental_fee_amount)}.`;
      if (terms.mileage_policy?.included_km_per_day != null) paragraphs[1] = `2. Giới hạn ${terms.mileage_policy.included_km_per_day} km/ngày. Phí vượt km ${money(terms.mileage_policy.extra_km_fee)}/km.`;
      paragraphs[2] = `3. Bên B nộp tiền cọc ${money(terms.deposit_amount)} cho XeDi giữ hộ trước khi nhận xe để bảo đảm nghĩa vụ thanh toán và bồi thường.`;
    }
    return { ...entry, paragraphs };
  }) : [
    article(
      'Đặc điểm và thỏa thuận thuê xe',
      'Bên A đồng ý giao xe cho Bên B thuê tự lái theo booking và thông tin phương tiện ghi tại điều này.',
      'Bên B sử dụng giấy phép lái xe phù hợp và còn hiệu lực trong suốt thời gian thuê.',
    ),
    article(
      'Thời hạn thuê xe ô tô',
      `Thời gian thuê từ ${localTime(terms.start_at)} đến ${localTime(terms.end_at)} theo lịch đã xác nhận trong booking.`,
    ),
    article(
      'Mục đích thuê',
      'Bên B sử dụng xe để tự lái, đúng công dụng và phạm vi sử dụng đã thỏa thuận. Việc cho thuê lại hoặc giao xe cho người khác phải được Bên A đồng ý.',
    ),
    article(
      'Giá thuê và phương thức thanh toán',
      `Đơn giá ${money(terms.daily_rate)}/ngày. Tổng tiền thuê ${money(terms.rental_fee_amount)}. Tiền cọc ${money(terms.deposit_amount)}.`,
      'Bên B thanh toán tiền thuê và cọc theo phương thức và thời hạn hiển thị trong booking. Gara đối chiếu trạng thái giao dịch trước khi bàn giao.',
      terms.mileage_policy?.included_km_per_day != null
        && `Giới hạn ${terms.mileage_policy.included_km_per_day} km/ngày.`,
      terms.mileage_policy?.extra_km_fee != null
        && `Phí vượt giới hạn ${money(terms.mileage_policy.extra_km_fee)}/km.`,
      terms.rental_policy?.late_fee_per_hour != null
        && `Phí trả muộn ${money(terms.rental_policy.late_fee_per_hour)}/giờ.`,
    ),
    article(
      'Phương thức giao và trả xe',
      `Bên B nhận xe tại ${pickup} và trả xe tại ${dropoff} theo thời gian tại Điều 2.`,
      'Nhân viên gara lập biên bản khi giao và nhận trả, ghi nhận số km, nhiên liệu hoặc pin, phụ kiện và tình trạng thực tế của xe.',
    ),
    article(
      'Nghĩa vụ và quyền của Bên A',
      'Bên A bàn giao xe đúng thỏa thuận, bảo đảm xe đủ điều kiện sử dụng và hỗ trợ tiếp nhận thông báo sự cố trong thời gian thuê.',
      'Bên A có quyền nhận tiền thuê, nhận lại xe khi hết hạn và yêu cầu xử lý vi phạm hoặc thiệt hại theo hồ sơ đã xác minh.',
    ),
    article(
      'Nghĩa vụ và quyền của Bên B',
      'Bên B có quyền nhận và sử dụng xe theo thỏa thuận, đối chiếu tình trạng xe tại gara và phản hồi về các khoản phát sinh.',
      'Bên B bảo quản xe, thanh toán đầy đủ, trả xe đúng hẹn và thông báo kịp thời cho XeDi khi xảy ra tai nạn, hư hỏng hoặc sự cố.',
    ),
    article(
      'Cam đoan của các bên',
      'XeDi đại diện ký trong phạm vi chủ xe ủy quyền. Các bên xác nhận thông tin đã cung cấp và tự nguyện chấp thuận nội dung của bản hợp đồng này.',
    ),
    article(
      'Điều khoản cuối cùng',
      cancellationHours != null
        && `Điều kiện hủy miễn phí áp dụng trước giờ nhận xe ít nhất ${cancellationHours} giờ theo chính sách đã lưu cùng booking.`,
      refundDays != null
        && `Thời hạn hoàn cọc sau khi đủ điều kiện là ${refundDays} ngày làm việc.`,
      'Các khoản phát sinh, thiệt hại và hoàn cọc được đối chiếu theo biên bản và chính sách của booking. Khi có bất đồng, các bên trao đổi và xử lý theo quy trình khiếu nại.',
      'Mỗi bên có thể xem và lưu bản hợp đồng điện tử. Nội dung trình ký được lưu theo phiên bản đã xác nhận.',
    ),
  ];

  const content = {
    version: booking.review_info?.required === false ? 'xedi-rental-template-v1' : 'xedi-rental-paper-v2',
    title: 'HỢP ĐỒNG THUÊ XE Ô TÔ TỰ LÁI',
    place: pickup,
    parties: [
      {
        heading: 'BÊN A · XEDI, ĐẠI DIỆN THEO ỦY QUYỀN',
        facts: facts([
          ['Đơn vị cho thuê', 'XeDi'],
          ['Chủ xe ủy quyền', owner?.full_name],
          [
            'Hợp đồng ủy quyền',
            row.lender_details_snapshot?.authority_agreement_number
              || String(row.management_agreement_id),
          ],
        ]),
      },
      {
        heading: 'BÊN THUÊ (BÊN B)',
        facts: facts([
          ['Họ và tên', renter?.full_name],
          ['Địa chỉ liên hệ', renter?.contact_profile?.address],
          ['Email', renter?.email],
          ['Điện thoại', renter?.phone],
        ]),
      },
    ],
    facts: facts([
      ['Mã booking', booking.booking_code],
      ['Nhãn hiệu', vehicle.brand],
      ['Dòng xe', vehicle.model],
      ['Loại xe', vehicle.vehicle_type],
      ['Số chỗ ngồi', vehicle.seats],
      ['Biển số', vehicle.license_plate],
      ['Số đăng ký xe', vehicle.documents?.registration?.number_masked],
    ]),
    articles,
    clauses: articles.flatMap(({ paragraphs }) => paragraphs),
  };

  return {
    ...content,
    hash: createHash('sha256').update(JSON.stringify(content)).digest('hex'),
    prepared_at: now,
  };
}
