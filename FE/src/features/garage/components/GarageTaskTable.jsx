import { Link, useOutletContext } from 'react-router-dom';
import Icon from '../../shared/booking/BookingIcon';
import { DispatchStatus } from '../../shared/booking/BookingStatus';
import { bookingCode, dateTime } from '../../shared/booking/bookingConstants';
import { GARAGE_TASKS_PATH, TASK_STATUSES, TASK_TYPES } from '../garageConstants';

function TaskLink({ task }) {
  const { search } = useOutletContext();
  const path = GARAGE_TASKS_PATH + '/' + task.id + '/' + task.vehicle_id + search;
  let label = 'Xem nhiệm vụ';
  if (task.inspection) label = 'Xem hồ sơ';
  else if (task.type === 'HANDOVER_OUT' && task.workflow_stage === 'awaiting_vehicle') label = 'Mở checklist';
  else if (task.type === 'MAINTENANCE') label = 'Mở phiếu bảo dưỡng';
  return <Link className="dispatch-button primary compact" to={path}>{label}</Link>;
}

function handoverStatus(task) {
  if (task.workflow_stage === 'awaiting_driver') return 'Chờ tài xế nhận phân công';
  if (task.status === 'failed') return 'Chờ Operator đổi xe';
  if (task.handover?.status === 'declined') return 'Tài xế từ chối nhận xe';
  if (task.handover?.status === 'pending') return 'Chờ tài xế nhận xe';
  if (task.inspection) return 'Chờ Gara lập biên bản';
  return 'Chờ Gara kiểm tra xe';
}

function TaskRow({ task }) {
  const preTrip = task.type === 'HANDOVER_OUT';
  const status = TASK_STATUSES[task.status] || TASK_STATUSES.pending;
  return (
    <tr>
      <td>
        <div className="garage-vehicle">
          <span className="garage-vehicle-icon"><Icon name="car" /></span>
          <div>
            <strong>{task.vehicle?.brand} {task.vehicle?.model}</strong>
            <small>{task.vehicle?.plate_number} · {task.booking_id ? bookingCode(task.booking_id) : task.id}</small>
          </div>
        </div>
        {task.inspection?.condition_note && <small className="garage-inspection-note">{task.inspection.condition_note}</small>}
      </td>
      <td>{TASK_TYPES[task.type]}</td>
      <td>
        {task.due_at ? dateTime(task.due_at) : 'Đang bảo dưỡng'}
        {task.driver?.full_name && <small className="garage-subline">Tài xế {task.driver.full_name}</small>}
        {task.booking && <small className="garage-subline">{task.booking.pickup_location} → {task.booking.dropoff_location}</small>}
      </td>
      <td>
        <DispatchStatus label={status.label} tone={status.tone} />
        {preTrip && <small className="garage-subline">{handoverStatus(task)}</small>}
        {task.type === 'RETURN_IN' && (
          <small className="garage-subline">{task.inspection ? 'Chờ tài xế xác nhận trả xe' : 'Chờ Gara tiếp nhận xe'}</small>
        )}
        {task.vehicle?.status && <small className="garage-subline">Xe: {task.vehicle.status}</small>}
      </td>
      <td className="garage-task-actions">
        <TaskLink task={task} />
      </td>
    </tr>
  );
}

export default function GarageTaskTable({ tasks, loading, error, view, hasFilters, onReset }) {
  if (loading) return <p className="garage-task-loading" role="status">Đang tải nhiệm vụ Gara…</p>;
  if (error) return <p className="dispatch-alert" role="alert">{error}</p>;
  if (!tasks.length) {
    return (
      <div className="dispatch-empty">
        <Icon name="calendar" size={30} />
        <h3>{hasFilters ? 'Không có nhiệm vụ phù hợp' : view.emptyTitle}</h3>
        {hasFilters
          ? <button className="dispatch-button subtle compact" onClick={onReset}>Đặt lại bộ lọc</button>
          : view.emptyDescription && <p>{view.emptyDescription}</p>}
      </div>
    );
  }

  return (
    <div className="booking-table-scroll" role="region" aria-label="Bảng nhiệm vụ Gara" tabIndex={0}>
      <table className="booking-table garage-table">
        <thead><tr><th>Xe / booking</th><th>Loại nhiệm vụ</th><th>Lịch / tài xế</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
        <tbody>
          {tasks.map((task) => <TaskRow key={task.id + ':' + task.vehicle_id} task={task} />)}
        </tbody>
      </table>
    </div>
  );
}
