import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { bookingCode } from '../../bookings/bookingConstants';
import { submitGarageInspection } from '../api/garageApi';
import GarageInspectionForm from '../components/GarageInspectionForm';
import GarageInspectionRecord from '../components/GarageInspectionRecord';
import GarageVehicleActions from '../components/GarageVehicleActions';
import { GARAGE_TASKS_PATH, TASK_TYPES } from '../garageConstants';
import useGarageTasks from '../hooks/useGarageTasks';

export default function GarageTaskPage() {
  const { taskId, vehicleId } = useParams();
  const { tasks, loading, error, refresh } = useGarageTasks();
  const [saved, setSaved] = useState(null);
  const matches = (task) => task?.id === taskId && task.vehicle_id === Number(vehicleId);
  const task = matches(saved) ? saved : tasks.find(matches);
  const preTrip = task?.type === 'HANDOVER_OUT';

  async function save(details) {
    try {
      const { inspection } = await submitGarageInspection({
        ...details, booking_id: task.booking_id, vehicle_id: task.vehicle_id, inspection_type: 'handover',
      });
      setSaved({ ...task, inspection });
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
      {task?.inspection && <GarageInspectionRecord inspection={task.inspection} />}
      {preTrip && !task.inspection && (
        task.workflow_stage === 'awaiting_vehicle'
          ? <GarageInspectionForm key={taskId + ':' + vehicleId} onSave={save} />
          : <p className="garage-check-hint">Chờ tài xế chấp nhận phân công để mở checklist.</p>
      )}
      {task && !preTrip && task.status !== 'completed' && (
        <GarageVehicleActions key={taskId + ':' + vehicleId} task={task} onUpdate={refresh} />
      )}
    </section>
  );
}
