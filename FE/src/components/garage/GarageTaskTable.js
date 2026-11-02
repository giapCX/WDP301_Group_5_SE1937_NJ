import Icon from '../ui/Icon';
import GarageStatus from './GarageStatus';
import {
  displayDate,
  displayTime,
  taskKinds,
  taskBlockers,
} from '../../data/garage';

export default function GarageTaskTable({ tasks, onOpen, onClear }) {
  if (!tasks.length)
    return (
      <div className="gs-empty">
        <span>
          <Icon name="clipboard" size={30} />
        </span>
        <h3>Không có công việc phù hợp</h3>
        <p>Thử thay đổi từ khóa hoặc bộ lọc để xem thêm công việc.</p>
        {onClear && (
          <button className="gs-button gs-button-secondary" onClick={onClear}>
            Xóa bộ lọc
          </button>
        )}
      </div>
    );
  return (
    <div className="gs-table-scroll">
      <table className="gs-table">
        <thead>
          <tr>
            <th>XE / MÃ CÔNG VIỆC</th>
            <th>CÔNG VIỆC</th>
            <th>LỊCH HẸN</th>
            <th>TRẠNG THÁI</th>
            <th>
              <span className="gs-sr-only">Thao tác</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>
                <div className="gs-vehicle-cell">
                  <span className={`gs-car-tile gs-car-tile--${task.kind}`}>
                    <Icon name="car" size={25} />
                  </span>
                  <div>
                    <strong>{task.vehicle}</strong>
                    <small>
                      {task.plate} <span>·</span> {task.id}
                    </small>
                  </div>
                </div>
              </td>
              <td>
                <span className={`gs-kind gs-kind--${task.kind}`}>
                  {taskKinds[task.kind]}
                </span>
                <small className="gs-contact">{task.contact}</small>
              </td>
              <td>
                <strong className="gs-table-time">
                  {displayTime(task.schedule)}
                </strong>
                <small className="gs-contact">
                  {displayDate(task.schedule)} · {task.location}
                </small>
              </td>
              <td>
                <GarageStatus
                  status={task.status}
                  blocked={
                    taskBlockers(task).length > 0 && task.status !== 'completed'
                  }
                />
              </td>
              <td>
                <button
                  className="gs-row-action"
                  onClick={() => onOpen(task)}
                  aria-label={`Xem ${task.id}`}
                >
                  {['completed', 'submitted'].includes(task.status)
                    ? 'Xem biên bản'
                    : task.status === 'draft'
                      ? 'Tiếp tục'
                      : 'Chi tiết'}
                  <Icon name="arrow" size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
