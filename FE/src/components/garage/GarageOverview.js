import Icon from '../ui/Icon';
import GarageTaskTable from './GarageTaskTable';
import { bangkokDate, displayTime, taskKinds } from '../../data/garage';

export default function GarageOverview({ workspace, onNavigate, onOpen }) {
  const today = bangkokDate();
  const todayTasks = workspace.tasks.filter((task) =>
    task.schedule.startsWith(today),
  );
  const done = todayTasks.filter((task) =>
    ['completed', 'submitted'].includes(task.status),
  ).length;
  const pending = todayTasks
    .filter((task) => !['completed', 'submitted'].includes(task.status))
    .sort((a, b) => a.schedule.localeCompare(b.schedule));
  const stats = [
    {
      label: 'Công việc hôm nay',
      value: todayTasks.length,
      note: `${done} công việc đã xử lý`,
      icon: 'clipboard',
      section: 'overview',
      color: 'blue',
    },
    {
      label: 'Chờ kiểm định',
      value: workspace.tasks.filter(
        (t) =>
          t.kind === 'inspection' &&
          !['completed', 'submitted'].includes(t.status),
      ).length,
      note: 'Kiểm tra & gửi đề xuất',
      icon: 'wrench',
      section: 'inspections',
      color: 'violet',
    },
    {
      label: 'Lịch bàn giao',
      value: todayTasks.filter(
        (t) => t.kind === 'handover' && t.status !== 'completed',
      ).length,
      note: 'Chuẩn bị trước giờ hẹn',
      icon: 'delivery',
      section: 'handovers',
      color: 'teal',
    },
    {
      label: 'Lịch nhận trả',
      value: todayTasks.filter(
        (t) => t.kind === 'return' && t.status !== 'completed',
      ).length,
      note: 'Đối chiếu tình trạng xe',
      icon: 'history',
      section: 'returns',
      color: 'orange',
    },
  ];
  return (
    <>
      <div className="gs-page-heading">
        <div>
          <span className="gs-overline">MỘT NGÀY LÀM VIỆC HIỆU QUẢ</span>
          <h1>
            Chào Minh Anh, bắt đầu ca mới! <span className="gs-wave">✦</span>
          </h1>
          <p>Gara đã sẵn sàng. Cùng chuẩn bị những chuyến đi an tâm.</p>
        </div>
        <span className="gs-location-pill">
          <Icon name="pin" size={16} />
          Gara Tân Bình, TP. Hồ Chí Minh
        </span>
      </div>
      <div className="gs-stats">
        {stats.map((stat) => (
          <button
            className={`gs-stat gs-stat--${stat.color}`}
            key={stat.label}
            onClick={() => onNavigate(stat.section)}
          >
            <div>
              <span>{stat.label}</span>
              <strong>{stat.value.toString().padStart(2, '0')}</strong>
              <small>{stat.note}</small>
            </div>
            <span className="gs-stat-icon">
              <Icon name={stat.icon} size={23} />
            </span>
          </button>
        ))}
      </div>
      <div className="gs-overview-grid">
        <section className="gs-panel gs-work-panel">
          <div className="gs-panel-heading">
            <div>
              <h2>
                Công việc cần xử lý{' '}
                <span className="gs-count">{pending.length}</span>
              </h2>
              <p>Ưu tiên theo lịch hẹn hôm nay</p>
            </div>
            <button
              className="gs-text-link"
              onClick={() => onNavigate('handovers')}
            >
              Xem lịch bàn giao
              <Icon name="arrow" size={14} />
            </button>
          </div>
          <GarageTaskTable tasks={pending.slice(0, 5)} onOpen={onOpen} />
        </section>
        <aside className="gs-overview-rail">
          <section className="gs-day-progress">
            <div className="gs-progress-header">
              <span>TIẾN ĐỘ TRONG NGÀY</span>
              <Icon name="bolt" size={18} />
            </div>
            <strong>
              {done}
              <span> / {todayTasks.length}</span>
            </strong>
            <p>công việc đã hoàn tất hoặc gửi duyệt</p>
            <div className="gs-progress-track">
              <span
                style={{
                  width: `${todayTasks.length ? (done / todayTasks.length) * 100 : 0}%`,
                }}
              />
            </div>
            <small>
              {pending.length
                ? `Còn ${pending.length} công việc cần bạn xử lý.`
                : 'Bạn đã xử lý xong công việc hôm nay.'}
            </small>
          </section>
          <section className="gs-panel gs-next-panel">
            <h2>
              <Icon name="clock" size={17} />
              Lịch hẹn chờ xử lý
            </h2>
            {pending.slice(0, 3).map((task) => (
              <button
                className="gs-next-task"
                key={task.id}
                onClick={() => onOpen(task)}
              >
                <span className="gs-next-time">
                  {displayTime(task.schedule)}
                </span>
                <div>
                  <strong>{task.vehicle}</strong>
                  <small>
                    {taskKinds[task.kind]} · {task.plate}
                  </small>
                </div>
                <Icon name="arrow" size={13} />
              </button>
            ))}
            {!pending.length && (
              <p className="gs-muted">Không còn lịch hẹn hôm nay.</p>
            )}
          </section>
          <div className="gs-reminder">
            <span>
              <Icon name="shield" size={23} />
            </span>
            <div>
              <strong>Mỗi biên bản, một sự an tâm</strong>
              <p>
                Ghi rõ số km, nhiên liệu và tình trạng xe. Đính kèm ảnh khi phát
                hiện bất thường.
              </p>
            </div>
          </div>
        </aside>
      </div>
      <section className="gs-panel gs-recent-panel">
        <div className="gs-panel-heading">
          <div>
            <h2>Hoạt động gần đây</h2>
            <p>Các thao tác được ghi nhận trong không gian của bạn</p>
          </div>
          <button
            className="gs-text-link"
            onClick={() => onNavigate('history')}
          >
            Xem lịch sử
            <Icon name="arrow" size={14} />
          </button>
        </div>
        {workspace.history.slice(0, 3).map((log) => (
          <div className="gs-activity-row" key={log.id}>
            <span className="gs-activity-check">
              <Icon name="check" size={15} />
            </span>
            <div>
              <strong>{log.title}</strong>
              <small>{log.detail}</small>
            </div>
            <time>{displayTime(log.time)}</time>
          </div>
        ))}
      </section>
    </>
  );
}
