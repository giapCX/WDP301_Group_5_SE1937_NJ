import { useState } from 'react';
import { Link } from 'react-router-dom';
import { bookingCode } from '../../bookings/bookingConstants';
import { garageError, submitGarageInspection, updateGarageMaintenance } from '../api/garageApi';
import { GARAGE_TASKS_PATH } from '../garageConstants';

export default function GarageMaintenanceActions({ task, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lastCheck = task.latest_inspection;
  const canClose = lastCheck && ['pass', 'passed'].includes(lastCheck.result)
    && new Date(lastCheck.inspected_at) >= new Date(task.maintenance?.started_at || 0);

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      setOpen(false);
      onUpdate();
    } catch (failure) {
      setError(garageError(failure));
    } finally {
      setBusy(false);
    }
  }

  function inspect(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const note = form.get('note').trim();
    if (!note) {
      setError('Vui lòng ghi tình trạng xe.');
      return;
    }
    run(() => submitGarageInspection({
      booking_id: task.booking_id ?? null,
      vehicle_id: task.vehicle_id,
      inspection_type: 'periodic',
      result: event.nativeEvent.submitter?.value || 'passed',
      condition_note: note,
      odometer: Number(form.get('odometer')),
    }));
  }

  return (
    <>
      {task.damage_sources?.length > 0 && (
        <ul className="garage-check-photos">
          {task.damage_sources.map((source) => (
            <li key={source.inspection_id}>
              <Link to={`${GARAGE_TASKS_PATH}/return-${source.booking_id}/${task.vehicle_id}`}>
                Hồ sơ hư hỏng {bookingCode(source.booking_id)}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <form className="garage-inspection-form" onSubmit={inspect}>
          <label>Tình trạng xe<textarea name="note" rows={2} maxLength={1000} required disabled={busy} /></label>
          <label>Số km<input name="odometer" type="number" min="0" step="0.1" required disabled={busy} /></label>
          <div>
            <button value="passed" disabled={busy}>Ghi nhận đạt</button>
            <button className="garage-fail-button" value="failed" disabled={busy}>Không đạt</button>
            <button className="garage-cancel-button" type="button" disabled={busy} onClick={() => setOpen(false)}>Hủy</button>
          </div>
        </form>
      ) : (
        <div className="garage-maintenance-actions">
          <button className="dispatch-button subtle compact" disabled={busy} onClick={() => { setError(''); setOpen(true); }}>
            Kiểm tra sau sửa chữa
          </button>
          {canClose && (
            <button className="dispatch-button primary compact" disabled={busy}
              onClick={() => run(() => updateGarageMaintenance(task.maintenance.maintenance_id, 'completed'))}
            >
              Đưa xe về sẵn sàng
            </button>
          )}
        </div>
      )}
      {error && <p className="dispatch-alert" role="alert">{error}</p>}
    </>
  );
}
