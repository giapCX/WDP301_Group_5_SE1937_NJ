import { updateComplaint, updateDispute, updateIncident } from '../api/operationApi';
import { formatOperationDate, formatOperationMoney, operationStatusLabels } from '../operationConfig';

function caseUpdater(section) {
  if (section === 'disputes') return updateDispute;
  if (section === 'complaints') return updateComplaint;
  return updateIncident;
}

function Status({ value }) {
  return (
    <span className={`operation-status status-${String(value || 'unknown').replaceAll('_', '-')}`}>
      <i />{operationStatusLabels[value] || value || '—'}
    </span>
  );
}

function VehicleDetails({ vehicle }) {
  return (
    <>
      <p><strong>Biển số:</strong> {vehicle.licensePlate || '—'} · <strong>Năm:</strong> {vehicle.year || '—'}</p>
      <p>
        <strong>Chủ xe:</strong> {vehicle.owner?.full_name || '—'} · {vehicle.owner?.email || ''} · {vehicle.owner?.phone || ''}
      </p>
      <p><strong>Trạng thái xe:</strong> {operationStatusLabels[vehicle.physicalStatus] || vehicle.physicalStatus || '—'}</p>
      <p>
        <strong>Giấy đăng ký:</strong> {vehicle.documents?.registration?.file_key || 'Chưa có'} ·
        <strong> Đăng kiểm:</strong> {vehicle.documents?.inspectionCertificate?.file_key || 'Chưa có'} ·
        <strong> Bảo hiểm:</strong> {vehicle.documents?.insurance?.file_key || 'Chưa có'}
      </p>
      {vehicle.reviewNote && <p><strong>Ghi chú sàng lọc:</strong> {vehicle.reviewNote}</p>}
      {vehicle.inspection && (
        <p>
          <strong>Lịch kiểm định:</strong> {formatOperationDate(vehicle.inspection.scheduledFor)} · {vehicle.inspection.note}
        </p>
      )}
    </>
  );
}

function CaseActions({ item, section, busy, onClose, perform }) {
  const addNote = () => {
    const note = window.prompt('Ghi chú mới:', '');
    if (!note?.trim()) return;
    perform(
      () => caseUpdater(section)(item.id, { note: note.trim() }),
      'Đã thêm ghi chú.',
    );
  };

  const attachEvidence = () => {
    const fileKey = window.prompt('Mã lưu trữ chứng cứ:', '');
    if (!fileKey?.trim()) return;
    perform(
      () => caseUpdater(section)(item.id, { evidence: [{ kind: 'document', fileKey: fileKey.trim() }] }),
      'Đã đính kèm chứng cứ.',
    );
  };

  return (
    <>
      <button onClick={onClose}>Đóng</button>
      <button disabled={busy} onClick={addNote}>Thêm ghi chú</button>
      <button disabled={busy} onClick={attachEvidence}>Đính kèm chứng cứ</button>
    </>
  );
}

export default function OperationDetailDialog({ item, section, busy, onClose, perform }) {
  const title = item.bookingCode
    || item.caseNumber
    || item.title
    || `${item.brand || ''} ${item.model || ''}`.trim()
    || item.id;
  const status = section === 'vehicles' ? item.onboardingStatus : item.status;

  return (
    <div
      className="operation-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="operation-detail" role="dialog" aria-modal="true" aria-labelledby="operation-detail-title">
        <button className="operation-detail-close" onClick={onClose} aria-label="Đóng">×</button>
        <p className="operation-eyebrow">CHI TIẾT HỒ SƠ</p>
        <h2 id="operation-detail-title">{title}</h2>
        <Status value={status} />

        {section === 'vehicles' && <VehicleDetails vehicle={item} />}
        {item.description && <p>{item.description}</p>}
        {item.title && <p><strong>Tin xe:</strong> {item.title} · {formatOperationMoney(item.dailyPrice)}/ngày</p>}
        {item.pickupLocation && (
          <p><strong>Địa điểm:</strong> {item.pickupLocation.branch_name} · {item.pickupLocation.city}</p>
        )}
        {item.renter && (
          <p><strong>Khách thuê:</strong> {item.renter.full_name} · {item.renter.phone || item.renter.email}</p>
        )}
        {item.vehicle && (
          <p><strong>Xe:</strong> {item.vehicle.brand} {item.vehicle.model} · {item.vehicle.license_plate}</p>
        )}
        {item.startAt && (
          <p><strong>Thời gian:</strong> {formatOperationDate(item.startAt)} – {formatOperationDate(item.endAt)}</p>
        )}
        {item.caseType && <p><strong>Loại hồ sơ:</strong> {item.caseType}</p>}
        {item.assignedStaff && <p><strong>Người xử lý:</strong> {item.assignedStaff.full_name}</p>}

        {item.evidence?.length > 0 && (
          <div>
            <h3>Chứng cứ</h3>
            <ul>
              {item.evidence.map((evidence, index) => (
                <li key={`${evidence.file_key}-${index}`}>{evidence.kind}: {evidence.file_key}</li>
              ))}
            </ul>
          </div>
        )}
        {item.timeline?.length > 0 && (
          <div>
            <h3>Lịch sử xử lý</h3>
            <ol className="operation-timeline">
              {item.timeline.map((event, index) => (
                <li key={`${event.at}-${index}`}>
                  <strong>{event.action}</strong>
                  <span>{event.note || 'Cập nhật trạng thái'} · {formatOperationDate(event.at)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {item.statusHistory?.length > 0 && (
          <div>
            <h3>Lịch sử booking</h3>
            <ol className="operation-timeline">
              {item.statusHistory.map((event, index) => (
                <li key={`${event.at}-${index}`}>
                  <strong>{event.from} → {event.to}</strong>
                  <span>{formatOperationDate(event.at)} {event.reason}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <footer>
          {item.caseType
            ? <CaseActions item={item} section={section} busy={busy} onClose={onClose} perform={perform} />
            : <button onClick={onClose}>Đóng</button>}
        </footer>
      </section>
    </div>
  );
}
