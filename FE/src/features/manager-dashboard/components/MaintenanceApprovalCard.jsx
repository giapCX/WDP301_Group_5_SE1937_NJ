import { useState } from 'react';
import { dateTime } from '../../bookings/bookingConstants';
import { decideMaintenanceApproval } from '../api/maintenanceApprovalApi';

export default function MaintenanceApprovalCard({ record, onDecision }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { vehicle, reinspection } = record;

  async function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const decision = data.get('decision');
    const note = data.get('note').trim();
    if (decision === 'reject' && !note) {
      setError('Vui lòng nhập lý do trả phiếu.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await decideMaintenanceApproval(record.maintenance_id, { decision, note, inspection_id: record.reinspection_id });
      onDecision(decision);
    } catch (failure) {
      setError(failure.response?.data?.message || 'Không cập nhật được phiếu bảo dưỡng.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="manager-maintenance-card">
      <h2>Phiếu #{record.maintenance_id} · {vehicle?.plate_number || 'Xe #' + record.vehicle_id}</h2>
      {vehicle && <p>{vehicle.brand} {vehicle.model}</p>}
      <dl>
        <dt>Lý do bảo dưỡng</dt><dd>{record.description}</dd>
        <dt>Công việc đã thực hiện</dt><dd>{record.repair_work}</dd>
        <dt>Kết quả sửa chữa · {dateTime(record.repair_completed_at)}</dt><dd>{record.repair_result}</dd>
        <dt>Kiểm tra lại</dt>
        <dd>{reinspection?.result === 'passed'
          ? <>Đạt · {dateTime(reinspection.inspected_at)} · {reinspection.odometer} km<br />{reinspection.condition_note}</>
          : 'Chưa có kết quả đạt'}</dd>
      </dl>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>Quyết định
            <select name="decision" defaultValue="" required>
              <option value="" disabled>Chọn quyết định</option>
              <option value="approve" disabled={reinspection?.result !== 'passed'}>Duyệt hoàn tất bảo dưỡng</option>
              <option value="reject">Trả phiếu về Gara</option>
            </select>
          </label>
          <label>Ghi chú (bắt buộc khi trả phiếu)<textarea name="note" rows={2} maxLength={1000} /></label>
          <div><button className="manager-button manager-button-primary">Lưu quyết định</button></div>
        </fieldset>
      </form>
      {error && <p className="manager-feedback error" role="alert">{error}</p>}
    </article>
  );
}
