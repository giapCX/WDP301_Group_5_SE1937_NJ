import { useState } from 'react';
import { dateTime } from '../../bookings/bookingConstants';
import GarageInspectionRecord from '../../garage/components/GarageInspectionRecord';
import { driverHandoverPhotoUrl } from '../api/tripWorkflowApi';

function receiveMessage(booking, workflow, clock) {
  if (booking?.booking_status === 'in_progress' && workflow.started_at && workflow.resume_stage) return null;
  const pickup = new Date(booking?.pickup_time).getTime();
  const start = pickup - 24 * 60 * 60 * 1000;
  if (!booking?.pickup_time || !Number.isFinite(pickup)) return 'Booking chưa có giờ khởi hành hợp lệ.';
  if (clock < start) return 'Có thể nhận xe từ ' + dateTime(new Date(start).toISOString()) + '.';
  if (clock >= pickup) return 'Đã đến giờ khởi hành. Hãy liên hệ Operator.';
  return null;
}

export default function DriverVehicleHandover({ item, clock, busy, onAction }) {
  const { booking, workflow, handover } = item;
  const [refusing, setRefusing] = useState(false);
  if (!handover) return <p className="workflow-muted">Chờ Gara lập biên bản bàn giao.</p>;

  const pending = handover.status === 'pending' && workflow.stage === 'awaiting_vehicle';
  const timing = pending && receiveMessage(booking, workflow, clock);
  const inspection_id = handover.inspection_id;

  function decline(event) {
    event.preventDefault();
    const reason = new FormData(event.currentTarget).get('reason').trim();
    onAction('vehicle_declined', { inspection_id, reason });
  }

  return (
    <details className="workflow-history" open={handover.status !== 'accepted'}>
      <summary>Biên bản bàn giao xe</summary>
      <div className="garage-check-panel">
        <p>{booking?.vehicle?.plate_number} · Lập lúc {dateTime(handover.prepared_at)}</p>
        {handover.inspection && (
          <GarageInspectionRecord inspection={handover.inspection}
            photoUrl={(id, index) => driverHandoverPhotoUrl(workflow.booking_id, id, index)}
          />
        )}
        {handover.status === 'accepted' && <p>Đã xác nhận nhận xe lúc {dateTime(handover.responded_at)}.</p>}
        {handover.status === 'declined' && <p>Đã từ chối nhận xe. Lý do: {handover.refusal_reason}</p>}
        {timing && <p className="workflow-muted">{timing}</p>}
        {pending && (
          <div className="workflow-actions">
            <button disabled={busy || Boolean(timing)} onClick={() => onAction('vehicle_received', { inspection_id })}>
              Xác nhận hiện trạng và nhận xe
            </button>
            <button className="workflow-danger" disabled={busy} onClick={() => setRefusing((open) => !open)}>
              Từ chối nhận xe
            </button>
          </div>
        )}
        {pending && refusing && (
          <form className="garage-check-form" onSubmit={decline}>
            <label>Lý do từ chối<textarea className="form-control" name="reason" rows={2} maxLength={500} required /></label>
            <button className="dispatch-button danger" disabled={busy}>Gửi lý do từ chối</button>
          </form>
        )}
      </div>
    </details>
  );
}
