import { useState } from 'react';
import { dateTime } from '../../shared/booking/bookingConstants';
import { createVehicleHandover, garageError, recheckVehicleHandover } from '../api/garageApi';

export default function GarageHandoverActions({ task, onUpdate }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { inspection, handover } = task;

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      onUpdate();
    } catch (failure) {
      setError(garageError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Biên bản bàn giao">
      <h2>Biên bản bàn giao</h2>
      {handover && <p>Ngày lập {dateTime(handover.prepared_at)}</p>}
      {handover?.status === 'accepted' && <p>Tài xế đã xác nhận nhận xe lúc {dateTime(handover.responded_at)}.</p>}
      {handover?.status === 'pending' && (
        <p>{task.archived ? 'Biên bản của lần phân công trước.' : 'Chờ tài xế xác nhận hiện trạng và nhận xe.'}</p>
      )}
      {handover?.status === 'declined' && <p>Tài xế từ chối nhận xe. Lý do: {handover.refusal_reason}</p>}
      {error && <p className="dispatch-alert" role="alert">{error}</p>}
      {task.workflow_stage === 'awaiting_vehicle' && (
        <div className="garage-check-actions">
          {!handover && (
            <button className="dispatch-button primary" disabled={busy} onClick={() => run(() => createVehicleHandover({
              booking_id: task.booking_id, vehicle_id: task.vehicle_id, inspection_id: inspection.inspection_id,
            }))}>
              Lập biên bản bàn giao
            </button>
          )}
          {handover?.status === 'declined' && (
            <button className="dispatch-button primary" disabled={busy}
              onClick={() => run(() => recheckVehicleHandover(handover.inspection_id))}
            >
              Kiểm tra lại xe
            </button>
          )}
          {handover?.status === 'pending' && (
            <button className="dispatch-button subtle" onClick={onUpdate}>Làm mới trạng thái</button>
          )}
        </div>
      )}
    </section>
  );
}
