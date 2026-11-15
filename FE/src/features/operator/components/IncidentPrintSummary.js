import { incidentMilestones } from './IncidentResponseFields';

const dateTime = (value) => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa ghi nhận';

export default function IncidentPrintSummary({ incident }) {
  function printSummary() {
    const target = window.open('', '_blank', 'popup,width=900,height=700');
    if (!target) return;
    const { document } = target;
    target.opener = null;
    document.title = `Hồ sơ sự cố ${incident.caseNumber}`;
    document.documentElement.lang = 'vi';
    const add = (tag, value) => {
      const node = document.createElement(tag);
      node.textContent = value;
      document.body.append(node);
    };
    const checklist = incident.responseChecklist || {};
    const rental = incident.rentalContext;
    add('h1', document.title);
    add('p', 'Bản tổng hợp nghiệp vụ XeDi · thời gian hiển thị theo giờ Việt Nam');
    add('p', `Xe: ${[incident.vehicle?.brand, incident.vehicle?.model, incident.vehicle?.licensePlate].filter(Boolean).join(' ')}`);
    add('p', `Nội dung báo cáo: ${incident.description || 'Chưa ghi nhận'}`);
    add('p', `Tạm giữ xe: ${incident.vehicleSeized === true ? 'Có' : incident.vehicleSeized === false ? 'Không' : 'Chưa rõ'}`);
    add('p', `Operator tiếp nhận: ${dateTime(incident.operatorReceivedAt)}`);
    add('h2', 'Chuyến thuê và tài liệu liên quan');
    add('p', rental ? `${rental.bookingCode} · ${dateTime(rental.startAt)} → ${dateTime(rental.endAt)}` : 'Chưa liên kết chuyến thuê.');
    rental?.contracts?.forEach((item) => add('p', `${item.type === 'management' ? 'Hợp đồng ủy quyền' : 'Hợp đồng thuê'}: ${item.number}`));
    rental?.handovers?.forEach((item) => add('p', `Biên bản ${item.type === 'pickup' ? 'giao xe' : 'trả xe'}: ${item.id} · ${dateTime(item.occurredAt)} · ODO ${item.odometerKm ?? '—'} km`));
    incident.evidence?.forEach((item) => add('p', `Chứng cứ: ${item.name}`));
    add('h2', 'Mốc xử lý và tài liệu còn thiếu');
    for (const [key, label] of incidentMilestones) add('p', `${label}: ${dateTime(checklist[key])}`);
    for (const [key, label] of [
      ['driverName', 'Người lái'], ['driverVerification', 'Căn cứ xác minh người lái'],
      ['policeReference', 'Mã hồ sơ công an'], ['insurerReference', 'Mã hồ sơ bảo hiểm'],
      ['vehicleRecipient', 'Người nhận lại xe'], ['releaseAuthorizationReference', 'Giấy ủy quyền hoặc tài liệu liên quan'],
      ['missingDocuments', 'Tài liệu còn thiếu'],
    ]) add('p', `${label}: ${checklist[key] || 'Chưa ghi nhận'}`);
    add('p', 'Hợp đồng, biên bản và chứng từ gốc được chuẩn bị riêng theo yêu cầu của bên tiếp nhận hồ sơ.');
    target.focus();
    target.print();
  }

  return <button className="operator-secondary" type="button" onClick={printSummary}>In / lưu PDF bản tổng hợp sự cố</button>;
}
