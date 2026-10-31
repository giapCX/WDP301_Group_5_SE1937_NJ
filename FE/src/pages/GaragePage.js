import { useEffect, useState } from 'react';
import GarageLayout from '../components/garage/GarageLayout';
import GarageOverview from '../components/garage/GarageOverview';
import GarageTaskTable from '../components/garage/GarageTaskTable';
import GarageReportDialog from '../components/garage/GarageReportDialog';
import GarageIncidentDialog from '../components/garage/GarageIncidentDialog';
import GarageStatus from '../components/garage/GarageStatus';
import Modal from '../components/ui/Modal';
import Icon from '../components/ui/Icon';
import useGarageWorkspace from '../hooks/useGarageWorkspace';
import {
  bangkokDate,
  displayDate,
  displayTime,
  garageSections,
  sectionKinds,
  statusLabels,
  taskKinds,
} from '../data/garage';
import '../styles/garage.css';

const currentSection = () =>
  garageSections.some((item) => item.id === window.location.hash.slice(1))
    ? window.location.hash.slice(1)
    : 'overview';
const normalize = (value) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
function downloadCsv(tasks, section) {
  const cell = (value) => {
    const text = String(value);
    return `"${(/^[=+@-]/.test(text.trim()) ? "'" : '') + text.replaceAll('"', '""')}"`;
  };
  const rows = [
    [
      'Mã công việc',
      'Xe',
      'Biển số',
      'Loại công việc',
      'Lịch hẹn',
      'Trạng thái',
    ],
    ...tasks.map((task) => [
      task.id,
      task.vehicle,
      task.plate,
      taskKinds[task.kind],
      `${displayTime(task.schedule)} ${displayDate(task.schedule)}`,
      statusLabels[task.status],
    ]),
  ];
  const url = URL.createObjectURL(
    new Blob(
      ['\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n')],
      { type: 'text/csv;charset=utf-8' },
    ),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `xedi-garage-${section}-${bangkokDate()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function GaragePage() {
  const { workspace, storageError, saveReport, addIncident, reset } =
    useGarageWorkspace();
  const [section, setSection] = useState(currentSection);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [date, setDate] = useState('all');
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState('');
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Garage Staff · XeDi';
    return () => {
      document.title = previousTitle;
    };
  }, []);
  useEffect(() => {
    const handler = () => {
      setSection(currentSection());
      setQuery('');
      setStatus('all');
      setDate('all');
    };
    window.addEventListener('hashchange', handler);
    window.addEventListener('popstate', handler);
    return () => {
      window.removeEventListener('hashchange', handler);
      window.removeEventListener('popstate', handler);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  function navigate(next) {
    setSection(next);
    setQuery('');
    setStatus('all');
    setDate('all');
    window.history.pushState(null, '', `#${next}`);
  }
  const active = garageSections.find((item) => item.id === section);
  const today = bangkokDate();
  const filteredTasks = workspace.tasks
    .filter(
      (task) =>
        (!sectionKinds[section] || task.kind === sectionKinds[section]) &&
        (status === 'all' || task.status === status) &&
        (date === 'all' ||
          (date === 'today'
            ? task.schedule.startsWith(today)
            : task.schedule.slice(0, 10) > today)) &&
        normalize(
          `${task.vehicle} ${task.plate} ${task.id} ${task.contact}`,
        ).includes(normalize(query)),
    )
    .sort((a, b) => a.schedule.localeCompare(b.schedule));
  const incidents = workspace.incidents.filter((item) =>
    normalize(`${item.vehicle} ${item.plate} ${item.description}`).includes(
      normalize(query),
    ),
  );
  const logs = workspace.history.filter((item) =>
    normalize(`${item.title} ${item.detail}`).includes(normalize(query)),
  );
  function reportSaved(id, report, draft) {
    saveReport(id, report, draft);
    setDialog(null);
    setToast(
      draft
        ? 'Đã lưu bản nháp. Bạn có thể tiếp tục bất cứ lúc nào.'
        : workspace.tasks.find((task) => task.id === id)?.kind === 'inspection'
          ? 'Đã gửi đề xuất kiểm định cho Manager.'
          : 'Đã hoàn tất và lưu biên bản giao nhận.',
    );
  }
  return (
    <GarageLayout
      section={section}
      onNavigate={navigate}
      tasks={workspace.tasks}
      onReset={() => setDialog({ type: 'reset' })}
    >
      {storageError && (
        <p role="alert" className="gs-storage-error">
          {storageError}
        </p>
      )}
      {section === 'overview' ? (
        <GarageOverview
          workspace={workspace}
          onNavigate={navigate}
          onOpen={(task) => setDialog({ type: 'report', task })}
        />
      ) : (
        <>
          <div className="gs-page-heading">
            <div>
              <span className="gs-overline">VẬN HÀNH GARA</span>
              <h1>{active.label}</h1>
              <p>{active.description}</p>
            </div>
            <div className="gs-heading-actions">
              {section === 'incidents' ? (
                <button
                  className="gs-button gs-button-primary"
                  onClick={() => setDialog({ type: 'incident' })}
                >
                  <Icon name="plus" size={17} />
                  Tạo báo cáo sự cố
                </button>
              ) : (
                section !== 'history' && (
                  <button
                    className="gs-button gs-button-secondary"
                    onClick={() => downloadCsv(filteredTasks, section)}
                  >
                    <Icon name="download" size={16} />
                    Xuất danh sách
                  </button>
                )
              )}
            </div>
          </div>
          <section className="gs-panel">
            <div className="gs-list-toolbar">
              <label className="gs-search">
                <Icon name="search" size={17} />
                <input
                  aria-label="Tìm kiếm công việc"
                  placeholder="Tìm tên xe, biển số, mã công việc..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              {!['history', 'incidents'].includes(section) && (
                <div className="gs-list-filters">
                  <select
                    aria-label="Lọc trạng thái"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">Tất cả trạng thái</option>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Lọc ngày hẹn"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  >
                    <option value="all">Tất cả ngày hẹn</option>
                    <option value="today">Hôm nay</option>
                    <option value="upcoming">Sau hôm nay</option>
                  </select>
                </div>
              )}
            </div>
            {section === 'history' ? (
              <>
                <div className="gs-list-summary">
                  {logs.length} hoạt động được ghi nhận
                </div>
                {logs.map((log) => (
                  <div className="gs-activity-row" key={log.id}>
                    <span className="gs-activity-check">
                      <Icon
                        name={log.type === 'draft' ? 'clipboard' : 'check'}
                        size={16}
                      />
                    </span>
                    <div>
                      <strong>{log.title}</strong>
                      <small>{log.detail}</small>
                    </div>
                    <time>
                      {displayTime(log.time)}
                      <small>{displayDate(log.time)}</small>
                    </time>
                  </div>
                ))}
                {!logs.length && (
                  <div className="gs-empty">
                    <Icon name="history" size={32} />
                    <h3>Chưa có hoạt động phù hợp</h3>
                    <p>
                      Lịch sử sẽ xuất hiện sau khi bạn lưu hoặc gửi biên bản.
                    </p>
                  </div>
                )}
              </>
            ) : section === 'incidents' ? (
              <>
                <div className="gs-list-summary">
                  {incidents.length} báo cáo sự cố
                </div>
                {incidents.map((item) => (
                  <button
                    key={item.id}
                    className="gs-incident-row"
                    onClick={() =>
                      setDialog({ type: 'incident', incident: item })
                    }
                  >
                    <span
                      className={`gs-incident-icon gs-severity-${item.severity}`}
                    >
                      <Icon name="alert" size={23} />
                    </span>
                    <div>
                      <strong>
                        {item.vehicle} <span>· {item.plate}</span>
                      </strong>
                      <p>{item.description}</p>
                      <small>
                        {item.id} · {displayTime(item.time)}{' '}
                        {displayDate(item.time)}
                      </small>
                    </div>
                    <GarageStatus status="submitted" label="Đã gửi vận hành" />
                    <Icon name="arrow" size={16} />
                  </button>
                ))}
                {!incidents.length && (
                  <div className="gs-empty">
                    <span>
                      <Icon name="shield" size={32} />
                    </span>
                    <h3>
                      {query
                        ? 'Không có báo cáo phù hợp'
                        : 'Chưa có báo cáo sự cố'}
                    </h3>
                    <p>
                      Tạo báo cáo khi phát hiện hư hỏng hoặc bất thường trên xe.
                    </p>
                    {!query && (
                      <button
                        className="gs-button gs-button-secondary"
                        onClick={() => setDialog({ type: 'incident' })}
                      >
                        Tạo báo cáo đầu tiên
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="gs-list-summary">
                  {filteredTasks.length} công việc{' '}
                  <span>· Chỉ hiển thị công việc được phân công cho bạn</span>
                </div>
                <GarageTaskTable
                  tasks={filteredTasks}
                  onOpen={(task) => setDialog({ type: 'report', task })}
                  onClear={() => {
                    setQuery('');
                    setStatus('all');
                    setDate('all');
                  }}
                />
              </>
            )}
          </section>
          <div className="gs-workflow-note">
            <Icon name="shield" size={17} />
            {section === 'inspections'
              ? 'Nhân viên gara ghi nhận và đề xuất. Manager là người phê duyệt kết quả kiểm định.'
              : section === 'incidents'
                ? 'Bộ phận vận hành xác minh sự cố; Manager phê duyệt các quyết định bồi thường.'
                : 'Hãy đối chiếu thông tin thực tế và ghi nhận xác nhận trước khi hoàn tất biên bản.'}
          </div>
        </>
      )}
      {dialog?.type === 'report' && (
        <GarageReportDialog
          key={dialog.task.id}
          task={dialog.task}
          onSave={reportSaved}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'incident' && (
        <GarageIncidentDialog
          tasks={workspace.tasks}
          incident={dialog.incident}
          onClose={() => setDialog(null)}
          onSave={(incident) => {
            addIncident(incident);
            setDialog(null);
            setToast('Đã gửi báo cáo sự cố cho bộ phận vận hành.');
          }}
        />
      )}
      {dialog?.type === 'reset' && (
        <Modal
          title="Khôi phục dữ liệu mẫu?"
          className="gs-dialog gs-reset-dialog"
          onClose={() => setDialog(null)}
        >
          <p className="gs-dialog-intro">
            Các bản nháp, biên bản và ảnh bạn đã thêm trong bản thử nghiệm
            Garage Staff sẽ được thay bằng dữ liệu mẫu ban đầu.
          </p>
          <div className="gs-dialog-actions">
            <button
              className="gs-button gs-button-secondary"
              onClick={() => setDialog(null)}
            >
              Giữ lại dữ liệu
            </button>
            <button
              className="gs-button gs-button-primary"
              onClick={() => {
                reset();
                setDialog(null);
                setToast('Đã khôi phục dữ liệu mẫu.');
              }}
            >
              Khôi phục
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div role="status" className="gs-toast">
          <span>
            <Icon name="check" size={18} />
          </span>
          {toast}
          <button aria-label="Đóng thông báo" onClick={() => setToast('')}>
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
    </GarageLayout>
  );
}
