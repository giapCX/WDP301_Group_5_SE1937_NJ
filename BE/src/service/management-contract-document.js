import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { httpError } from '../utils/http-error.js';

const authorizationArticles = JSON.parse(readFileSync(new URL('./management-contract-articles.json', import.meta.url), 'utf8'));

const vietnamDate = (value) => new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh',
}).format(value);
const facts = (entries) => entries.filter(([, value]) => value !== undefined && value !== null && value !== '')
  .map(([label, value]) => ({ label, value: String(value) }));

export function parseManagementTerms(body, agreement) {
  function read(key, fallback, max) {
    const value = body[key] ?? fallback;
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
      throw httpError(400, 'Thông tin lập hợp đồng không hợp lệ.');
    return value.trim();
  }
  const commission = body.commissionRatePct ?? agreement?.commission_rate_pct ?? 10;
  if (typeof commission !== 'number' || !Number.isFinite(commission) || commission < 0 || commission > 100)
    throw httpError(400, 'Tỷ lệ hoa hồng phải từ 0 đến 100%.');
  return {
    commission,
    place: read('place', 'Trực tuyến trên XeDi', 150),
    garage: read('garage', 'Gara XeDi theo lịch tiếp nhận', 250),
    platform: read('platformName', 'XeDi', 150),
  };
}

export function createManagementContractDocument({ row, owner, vehicle, inspection, terms, now }) {
  const articles = row.arrival_confirmed_at ? authorizationArticles.map((article, index) => ({
    ...article,
    paragraphs: article.paragraphs.map((text, paragraph) => {
      if (index === 2 && paragraph === 0) return `1. Thời hạn ủy quyền từ ngày ${vietnamDate(row.start_date)} đến ngày ${vietnamDate(row.end_date)}.`;
      if (index === 4 && paragraph === 0) return text.replace('…… %', `${row.commission_rate_pct}%`);
      return text;
    }),
  })) : [
    { title: 'Phương tiện và hiện trạng', paragraphs: [
      'Bên A giao phương tiện nêu trên cho Bên B quản lý trong phạm vi hợp đồng. Báo cáo kiểm định được dẫn chiếu ghi nhận hiện trạng đã được duyệt. Hai bên lập biên bản riêng khi giao xe thực tế, ghi số km, nhiên liệu hoặc pin, chìa khóa, phụ kiện và ảnh hiện trạng.',
      'Nếu hiện trạng lúc giao khác đáng kể so với báo cáo, hai bên ghi nhận chênh lệch và thống nhất cách xử lý trước khi Bên B tiếp nhận.',
    ] },
    { title: 'Phạm vi và thời hạn ủy quyền', paragraphs: [
      `Thời hạn từ ngày ${vietnamDate(row.start_date)} đến ngày ${vietnamDate(row.end_date)}. Hai bên hoàn tất xác nhận hợp đồng trước khi thực hiện việc tiếp nhận và cho thuê.`,
      'Bên A ủy quyền cho Bên B giữ xe tại gara, quản lý tin đăng và lịch xe, điều phối đặt xe, ký hợp đồng thuê tự lái trong phạm vi ủy quyền và thực hiện giao nhận. Bên B chỉ đưa xe lên sàn sau khi hoàn tất tiếp nhận. Quyền sở hữu xe thuộc Bên A.',
    ] },
    { title: 'Hoa hồng và đối soát', paragraphs: [
      `Hoa hồng của Bên B là ${row.commission_rate_pct}% tiền thuê theo hợp đồng thuê. Tiền cọc và khoản bồi thường được ghi nhận riêng. Bên A được xem bảng đối soát doanh thu, hoa hồng và khoản phải trả theo từng kỳ.`,
    ] },
    { title: 'Trách nhiệm của các bên', paragraphs: [
      'Bên A cung cấp hồ sơ đúng với phương tiện, xác nhận quyền giao xe, khai báo lỗi đã biết và thông báo các thay đổi ảnh hưởng đến quyền quản lý hoặc sử dụng xe.',
      'Bên B bảo quản xe trong thời gian giữ xe, lập biên bản khi giao và nhận lại xe từ khách thuê, thông báo sự cố cho Bên A và cung cấp căn cứ khi đề xuất xử lý chi phí.',
    ] },
    { title: 'Sự cố và giải quyết bất đồng', paragraphs: [
      'Khi phát sinh sự cố, Bên B thu thập biên bản, ảnh, phản hồi của các bên và căn cứ chi phí. Trách nhiệm và khoản phải trả được xác định theo kết quả xác minh và thỏa thuận liên quan. Hai bên có quyền ghi ý kiến bất đồng và trao đổi hướng giải quyết.',
    ] },
    { title: 'Kết thúc ủy quyền và trả xe', paragraphs: [
      'Khi hết hạn hoặc có yêu cầu rút xe, hai bên phối hợp giải quyết các chuyến đã cam kết, hẹn giao lại xe và xác nhận biên bản trả xe. Các khoản đối soát hoặc tranh chấp còn mở tiếp tục được theo dõi theo hồ sơ riêng.',
      'Hai bên xác nhận nội dung trên cùng phiên bản hợp đồng. Thay đổi điều khoản sau khi ký cần được cả hai bên chấp thuận bằng phụ lục hoặc văn bản mới.',
    ] },
  ];
  const content = {
    version: row.arrival_confirmed_at ? 'xedi-authorization-v1' : 'xedi-management-paper-v1',
    title: row.arrival_confirmed_at ? 'HỢP ĐỒNG ỦY QUYỀN CHO THUÊ XE Ô TÔ' : 'HỢP ĐỒNG ỦY QUYỀN QUẢN LÝ VÀ KHAI THÁC XE',
    place: terms.place,
    parties: [
      { heading: 'BÊN A · CHỦ XE', facts: facts([['Họ và tên', owner?.full_name], ['Điện thoại', owner?.phone], ['Địa chỉ liên hệ', vehicle.owner_contact_address || owner?.contact_profile?.address]]) },
      { heading: 'BÊN B · BÊN NHẬN ỦY QUYỀN', facts: facts([['Tên đơn vị', terms.platform], ['Địa điểm tiếp nhận', terms.garage]]) },
    ],
    facts: facts([
      ['Phương tiện', [vehicle.brand, vehicle.model].filter(Boolean).join(' ')], ['Biển số', vehicle.license_plate],
      ['Hoa hồng trên tiền thuê', `${row.commission_rate_pct}%`],
      ['Năm sản xuất', vehicle.manufacture_year], ['Số chỗ', vehicle.seats], ['Số khung (VIN)', vehicle.vin],
      ['Khai báo hiện trạng của chủ xe', vehicle.condition_declaration],
      [row.arrival_confirmed_at ? 'Hồ sơ đối chiếu tiếp nhận' : 'Biên bản kiểm định', `${inspection._id} · phiên bản ${row.inspection_version}`],
      ['Số km lúc kiểm định', inspection.condition_report?.odometer_km],
      ['Ghi chú kiểm định', inspection.condition_report?.note],
    ]),
    clauses: articles.flatMap((article) => article.paragraphs),
    articles,
    ...(row.arrival_confirmed_at && {
      appendices: [
        { title: 'Phụ lục 01. Thiết lập cho thuê của Chủ xe', facts: facts([
          ['Giá thuê ngày thường', vehicle.daily_price != null ? `${vehicle.daily_price} VNĐ/ngày` : null],
          ['Giới hạn quãng đường', vehicle.mileage_policy?.included_km_per_day != null ? `${vehicle.mileage_policy.included_km_per_day} km/ngày` : null],
          ['Phụ phí vượt km', vehicle.mileage_policy?.extra_km_fee != null ? `${vehicle.mileage_policy.extra_km_fee} VNĐ/km` : null],
          ['Phí dịch vụ của Xedi', `${row.commission_rate_pct}%`],
        ]), paragraphs: [] },
        { title: 'Phụ lục 02. Mẫu hợp đồng thuê xe', facts: [], paragraphs: ['Mẫu Hợp đồng thuê xe ô tô tự lái của Xedi.'] },
        { title: 'Phụ lục 03. Bản sao giấy tờ kèm theo', facts: [], paragraphs: [
          'Hồ sơ định danh của Bên A và hồ sơ xe được quản lý trên XeDi.',
          'Giấy đăng ký xe, giấy chứng nhận kiểm định và giấy chứng nhận bảo hiểm đã được Operator đối chiếu.',
        ] },
      ],
    }),
  };
  return { ...content, hash: createHash('sha256').update(JSON.stringify(content)).digest('hex'), prepared_at: now };
}
