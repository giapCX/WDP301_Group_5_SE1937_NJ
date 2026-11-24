import { useState } from 'react';
import { Link } from 'react-router-dom';
import { bookingCode, dateTime } from '../../bookings/bookingConstants';
import { garageError, recordGarageRepair, submitGarageInspection, updateGarageMaintenance } from '../api/garageApi';
import { GARAGE_TASKS_PATH, INSPECTION_RESULTS } from '../garageConstants';
import { GarageReinspectionForm, GarageRepairForm } from './GarageMaintenanceForms';

export default function GarageMaintenanceActions({ task, onUpdate }) {
  const [form, setForm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { maintenance, reinspection, status, archived, needs_approval: needsApproval } = task;
  const id = maintenance.maintenance_id;
  const lastDecision = maintenance.approvals?.at(-1);
  const awaitingApproval = status === 'awaiting_approval';

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      setForm('');
      onUpdate();
    } catch (failure) {
      setError(garageError(failure));
    } finally {
      setBusy(false);
    }
  }

  function recheck(details) {
    return run(() => submitGarageInspection({
      ...details, vehicle_id: task.vehicle_id, maintenance_id: id, inspection_type: 'periodic',
    }));
  }

  return (
    <>
      {task.damage_sources?.map((source) => (
        <Link key={source.inspection_id} to={`${GARAGE_TASKS_PATH}/return-${source.booking_id}/${task.vehicle_id}`}>
          Hồ sơ hư hỏng {bookingCode(source.booking_id)}
        </Link>
      ))}
      {maintenance.repair_completed_at && (
        <div className="garage-check-note">
          <strong>Sửa chữa · {dateTime(maintenance.repair_completed_at)}</strong>
          <div>{maintenance.repair_work}</div>
          <div>{maintenance.repair_result}</div>
        </div>
      )}
      {reinspection && (
        <div className="garage-check-note">
          <strong>Kiểm tra lại · {INSPECTION_RESULTS[reinspection.result]}</strong>
          <div>{dateTime(reinspection.inspected_at)} · {reinspection.odometer} km</div>
          <div>{reinspection.condition_note}</div>
        </div>
      )}
      {lastDecision?.decision === 'reject' && (
        <p className="dispatch-alert">Manager trả phiếu · {lastDecision.note}</p>
      )}
      {status === 'completed' && <p className="garage-check-hint">Đã hoàn tất phiếu bảo dưỡng · {dateTime(maintenance.completed_at)}</p>}
      {awaitingApproval && (
        <div className="garage-maintenance-actions">
          <p className="garage-check-hint" role="status">Phiếu đang chờ Manager duyệt.</p>
          <button className="dispatch-button subtle compact" onClick={onUpdate}>Làm mới</button>
        </div>
      )}
      {!archived && !awaitingApproval && (
        <>
          {form === 'repair' && <GarageRepairForm maintenance={maintenance} needsApproval={needsApproval} busy={busy}
            onSave={(details) => run(() => recordGarageRepair(id, details))} onCancel={() => setForm('')} />}
          {form === 'recheck' && <GarageReinspectionForm busy={busy} onSave={recheck} onCancel={() => setForm('')} />}
          {!form && (
            <div className="garage-maintenance-actions">
              <button className="dispatch-button subtle compact" disabled={busy} onClick={() => setForm('repair')}>
                {maintenance.repair_completed_at ? 'Cập nhật sửa chữa' : 'Ghi kết quả sửa chữa'}
              </button>
              {maintenance.repair_completed_at && (
                <button className="dispatch-button subtle compact" disabled={busy} onClick={() => setForm('recheck')}>
                  Kiểm tra sau sửa chữa
                </button>
              )}
              {reinspection?.result === 'passed' && (
                <button className="dispatch-button primary compact" disabled={busy}
                  onClick={() => run(() => updateGarageMaintenance(id, 'completed', reinspection.inspection_id))}>
                  {needsApproval ? 'Gửi Manager duyệt' : 'Hoàn tất phiếu'}
                </button>
              )}
            </div>
          )}
        </>
      )}
      {error && <p className="dispatch-alert" role="alert">{error}</p>}
    </>
  );
}
