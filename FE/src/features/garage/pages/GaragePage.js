import { useEffect, useState } from 'react';
import usePagination from '../../../hooks/usePagination';
import Pagination from '../../../components/ui/Pagination';
import GarageLayout from '../components/GarageLayout';
import GarageOverview from '../components/GarageOverview';
import GarageTaskTable from '../components/GarageTaskTable';
import GarageReportDialog from '../components/GarageReportDialog';
import GarageIncidentDialog from '../components/GarageIncidentDialog';
import GarageStatus from '../components/GarageStatus';
import Icon from '../../../components/ui/Icon';
import useGarageWorkspace from '../hooks/useGarageWorkspace';
import {
  bangkokDate,
  displayDate,
  displayTime,
  garageSections,
  sectionKinds,
  statusLabels,
  taskKinds,
  sortGarageTasks,
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
      task.scheduled === false ? 'Chưa có lịch hẹn' : `${displayTime(task.schedule)} ${displayDate(task.schedule)}`,
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

export default function GaragePage({ user }) {
  const { workspace, loading, error, reload, saveReport, addIncident, reviewArrival } =
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
  const filteredTasks = sortGarageTasks(workspace.tasks
    .filter(
      (task) =>
        (!sectionKinds[section] || task.kind === sectionKinds[section]) &&
        (status === 'all' || task.status === status) &&
        (date === 'all' || (task.scheduled !== false &&
          (date === 'today'
            ? task.schedule.startsWith(today)
            : task.schedule.slice(0, 10) > today))) &&
        normalize(
          `${task.vehicle} ${task.plate} ${task.id} ${task.contact}`,
        ).includes(normalize(query)),
    ));
  const incidents = workspace.incidents.filter((item) =>
    normalize(`${item.vehicle} ${item.plate} ${item.description}`).includes(
      normalize(query),
    ),
  );
  const logs = workspace.history.filter((item) =>
    normalize(`${item.title} ${item.detail}`).includes(normalize(query)),
  );
  const listPage = usePagination(section === 'history' ? logs : section === 'incidents' ? incidents : filteredTasks, JSON.stringify([section, query, status, date]));
  async function reportSaved(id, report, draft) {
    await saveReport(id, report, draft);
    setDialog(null);
    const kind = workspace.tasks.find((task) => task.id === id)?.kind;
    setToast(
      draft
        ? 'Đã lưu bản nháp. Bạn có thể tiếp tục bất cứ lúc nào.'
        : kind === 'inspection'
          ? (report.checklist?.length ? 'Đã gửi báo cáo kiểm định để chủ xe xác nhận hiện trạng.' : 'Đã gửi đề xuất kiểm định cho Manager.')
          : kind === 'owner-return'
            ? 'Đã gửi biên bản. Chủ xe xác nhận sau khi nhận lại xe.'
            : 'Đã hoàn tất và lưu biên bản giao nhận.',
    );
  }
  if (loading || error) return (
    <GarageLayout user={user} section={section} onNavigate={navigate} tasks={workspace.tasks} permissions={workspace.permissions} onRefresh={reload}>
      {loading ? <p role="status">Đang tải dữ liệu gara...</p> : <div role="alert"><p>{error}</p><button className="gs-button gs-button-primary" onClick={reload}>Thử lại</button></div>}
    </GarageLayout>
  );
  return (
    <GarageLayout
      user={user}
      section={section}
      onNavigate={navigate}
      tasks={workspace.tasks}
      onRefresh={reload}
      permissions={workspace.permissions}
    >
      {section === 'overview' ? (
        <GarageOverview
          workspace={workspace}
          user={user}
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
              {section === 'incidents' ? (workspace.permissions.includes('case.report') && (
                <button
                  className="gs-button gs-button-primary"
                  onClick={() => setDialog({ type: 'incident' })}
                >
                  <Icon name="plus" size={17} />
                  Tạo báo cáo sự cố
                </button>
              )) : (
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
                {listPage.items.map((log) => (
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
                {listPage.items.map((item) => (
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
                    {!query && workspace.permissions.includes('case.report') && (
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
                  <span>· Ưu tiên: quá giờ hẹn → hôm nay → nháp → việc mở → lịch sắp tới → bị chặn → đã xử lý. Chỉ người lập được sửa nháp.</span>
                </div>
                <GarageTaskTable
                  tasks={listPage.items}
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
          <Pagination {...listPage} label="Phân trang công việc Garage" />
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
          onReviewArrival={async (task, status, note) => {
            await reviewArrival(task, status, note);
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'incident' && (
        <GarageIncidentDialog
          tasks={workspace.tasks}
          vehicles={workspace.vehicles}
          incident={dialog.incident}
          onClose={() => setDialog(null)}
          onSave={async (incident, requestId) => {
            await addIncident(incident, requestId);
            setDialog(null);
            setToast('Đã gửi báo cáo sự cố cho bộ phận vận hành.');
          }}
        />
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
