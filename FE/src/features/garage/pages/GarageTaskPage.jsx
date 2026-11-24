import { Link, useParams } from 'react-router-dom';
import { bookingCode } from '../../bookings/bookingConstants';
import { submitGarageInspection } from '../api/garageApi';
import GarageHandoverActions from '../components/GarageHandoverActions';
import GarageInspectionForm from '../components/GarageInspectionForm';
import GarageInspectionRecord from '../components/GarageInspectionRecord';
import GarageMaintenanceActions from '../components/GarageMaintenanceActions';
import GarageReturnTask from '../components/GarageReturnTask';
import { GARAGE_TASKS_PATH, TASK_TYPES } from '../garageConstants';
import useGarageTask from '../hooks/useGarageTask';

export default function GarageTaskPage() {
  const { taskId, vehicleId } = useParams();
  const { task, loading, error, refresh } = useGarageTask(taskId, vehicleId);
  const preTrip = task?.type === 'HANDOVER_OUT';
  const returning = task?.type === 'RETURN_IN';
  const passed = ['passed', 'pass'].includes(task?.inspection?.result);

  async function save(details) {
    try {
      await submitGarageInspection({
        ...details, booking_id: task.booking_id, vehicle_id: task.vehicle_id,
        inspection_type: returning ? 'return' : 'handover',
      });
      refresh();
    } catch (failure) {
      if (failure.response?.status === 409) refresh();
      throw failure;
    }
  }

  return (
    <section className="garage-check-panel" aria-labelledby="garage-check-title">
      <header className="garage-check-header">
        <div>
          <h1 id="garage-check-title">{TASK_TYPES[task?.type] || 'Chi tiết nhiệm vụ'}</h1>
          {task && (
            <p>
              {task.booking_id && <>{bookingCode(task.booking_id)} · </>}
              {task.vehicle?.plate_number} · {task.vehicle?.brand} {task.vehicle?.model}
            </p>
          )}
        </div>
        <Link className="dispatch-button subtle compact" to={GARAGE_TASKS_PATH}>Về danh sách nhiệm vụ</Link>
      </header>
      {loading && !task && <p role="status">Đang tải nhiệm vụ Gara…</p>}
      {error && <p className="dispatch-alert" role="alert">{error}</p>}
      {!loading && !error && !task && <p>Nhiệm vụ này không còn trong danh sách đang xử lý.</p>}
      {task?.maintenance?.description && <p className="garage-check-note">{task.maintenance.description}</p>}
      {preTrip && task.inspection && <GarageInspectionRecord inspection={task.inspection} />}
      {preTrip && passed && <GarageHandoverActions key={task.inspection.inspection_id} task={task} onUpdate={refresh} />}
      {preTrip && !task.inspection && (
        task.workflow_stage === 'awaiting_vehicle'
          ? <GarageInspectionForm key={taskId + ':' + vehicleId} onSave={save} />
          : <p className="garage-check-hint">Chờ tài xế chấp nhận phân công để mở checklist.</p>
      )}
      {returning && <GarageReturnTask key={taskId + ':' + vehicleId} task={task} onSave={save} onRefresh={refresh} />}
      {task?.type === 'MAINTENANCE' && task.status !== 'completed' && (
        <GarageMaintenanceActions key={taskId + ':' + vehicleId} task={task} onUpdate={refresh} />
      )}
    </section>
  );
}
