import { Fragment, useState } from 'react';
import Icon from '../../bookings/components/BookingIcon';
import { DispatchStatus } from '../../bookings/components/BookingStatus';
import { TASK_STATUSES, TASK_TYPES } from '../data/garageTasks';

export default function GarageTaskTable({ tasks, onReset }) {
  const [openId, setOpenId] = useState(null);

  if (!tasks.length) {
    return (
      <div className="dispatch-empty">
        <Icon name="calendar" size={30} />
        <h3>Không có nhiệm vụ phù hợp</h3>
        <button className="dispatch-button subtle" onClick={onReset}>
          Đặt lại bộ lọc
        </button>
      </div>
    );
  }

  return (
    <div className="booking-table-scroll" role="region" aria-label="Bảng nhiệm vụ gara" tabIndex={0}>
      <table className="booking-table garage-table">
        <thead>
          <tr>
            <th scope="col">Xe / Mã nhiệm vụ</th>
            <th scope="col">Loại nhiệm vụ</th>
            <th scope="col">Giờ hẹn</th>
            <th scope="col">Trạng thái</th>
            <th scope="col" className="action-heading">Chi tiết</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const isOpen = openId === task.id;
            return (
              <Fragment key={task.id}>
                <tr>
                  <td>
                    <div className="garage-vehicle">
                      <span className="garage-vehicle-icon"><Icon name="car" /></span>
                      <div>
                        <strong>{task.vehicle}</strong>
                        <small>{task.plate} · {task.id}</small>
                      </div>
                    </div>
                  </td>
                  <td>{TASK_TYPES[task.type]}</td>
                  <td><time dateTime={task.time}>{task.time}</time></td>
                  <td><DispatchStatus {...TASK_STATUSES[task.status]} /></td>
                  <td className="action-cell">
                    <button
                      className="dispatch-button subtle compact"
                      aria-label={`${isOpen ? 'Đóng' : 'Xem'} chi tiết ${task.id}`}
                      aria-expanded={isOpen}
                      aria-controls={isOpen ? `detail-${task.id}` : undefined}
                      onClick={() => setOpenId(isOpen ? null : task.id)}
                    >
                      {isOpen ? 'Thu gọn' : 'Xem'}
                      <Icon name={isOpen ? 'close' : 'chevron'} size={12} />
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="garage-task-detail" id={`detail-${task.id}`}>
                    <td colSpan={5}>
                      <strong>Yêu cầu thực hiện</strong>
                      <p>{task.note}</p>
                      {(task.booking || task.driver) && (
                        <small>
                          {task.booking && `Booking ${task.booking}`}
                          {task.booking && task.driver && ' · '}
                          {task.driver && `Tài xế ${task.driver}`}
                        </small>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
