import { useCallback, useEffect, useState } from 'react';
import ContractsPage from '../../contracts/ContractsPage';
import Icon from '../../../components/Icon';
import { Brand } from '../../../components/SiteHeader';
import Pagination from '../../../components/ui/Pagination';
import GaragePhotoPreview from '../../garage/components/GaragePhotoPreview';
import { clearSession, getCurrentUser } from '../../auth/session';
import {
  attachOperatorEvidence,
  createOperatorIncident,
  getOperatorDashboard,
  getOperatorEvidence,
  getOperatorIncident,
  getOperatorIncidents,
  getOperatorGarageStaff,
  getOperatorVehicles,
  getOperatorVehicle,
  getOperatorVehicleDocument,
  scheduleOperatorVehicleInspection,
  submitOperatorIncident,
  updateOperatorIncident,
  updateOperatorVehicleInspectionSchedule,
  updateOperatorVehicleStatus,
} from '../api/operatorApi';
import './OperatorPage.css';

const EMPTY_LIST = Object.freeze([]);
const sections = [
  { id: 'overview', label: 'Tổng quan', icon: 'gear', permission: 'operation.dashboard.read' },
  { id: 'contracts', label: 'Hợp đồng xe', icon: 'document', permission: 'operation.contract.read' },
  { id: 'vehicles', label: 'Thông tin xe', icon: 'car', permission: 'operation.vehicle.read' },
  { id: 'incidents', label: 'Thông tin pháp lý sự cố của xe', icon: 'shield', permission: 'operation.incident.read' },
];
const sectionDescriptions = {
  overview: 'Theo dõi tiến độ vận hành và các công việc cần xử lý.',
  contracts: 'Theo dõi hồ sơ hợp đồng và chuyển Manager ký đúng quy trình.',
  vehicles: 'Tra cứu hồ sơ xe, lịch kiểm định và thông tin phân công Garage.',
  incidents: 'Ghi nhận sự cố, bổ sung chứng cứ và chuyển hồ sơ cho Manager.',
};
const dashboardMetrics = [
  { key: 'activeVehicles', label: 'Xe đang chạy', icon: 'car', tone: 'blue' },
  { key: 'expiringContracts', label: 'Hợp đồng sắp hết hạn (30 ngày)', icon: 'document', tone: 'amber' },
  { key: 'incidentsInProgress', label: 'Sự cố đang xử lý', icon: 'info', tone: 'rose' },
  { key: 'incidentsNeedsOperatorAction', label: 'Sự cố cần Operator xử lý', icon: 'info', tone: 'amber' },
  { key: 'incidentsWaitingManager', label: 'Sự cố chờ Manager', icon: 'shield', tone: 'blue' },
  { key: 'vehiclesAwaitingInspection', label: 'Hồ sơ xe chờ phân công kiểm định', icon: 'car', tone: 'green' },
  { key: 'inspectionsUpcoming', label: 'Lịch kiểm định sắp đến hạn', icon: 'check', tone: 'green' },
  { key: 'inspectionsOverdue', label: 'Lịch kiểm định quá hạn', icon: 'check', tone: 'rose' },
  { key: 'inspectionsAwaitingManager', label: 'Biên bản chờ Manager duyệt', icon: 'document', tone: 'amber' },
];

const vehicleStatuses = {
  with_owner: 'Ở chủ xe',
  at_garage: 'Tại gara',
  rented: 'Đang cho thuê',
  returned_to_owner: 'Đã trả chủ xe',
  maintenance: 'Bảo dưỡng',
};
const vehicleStatusTransitions = {
  with_owner: ['maintenance'],
  at_garage: ['maintenance'],
  rented: [],
  returned_to_owner: [],
  maintenance: ['at_garage'],
};
const inspectionScheduleStates = {
  awaiting_manager: 'Chờ Manager',
  overdue: 'Quá hạn',
  upcoming: 'Sắp đến hạn',
  scheduled: 'Đã phân công',
  unscheduled: 'Chưa có lịch',
  completed: 'Đã kết thúc',
};
const inspectionStatuses = {
  draft: 'Garage đang lập biên bản',
  pending: 'Chờ Manager duyệt',
  approved: 'Đã được duyệt',
  revision_required: 'Cần kiểm định vòng tiếp theo',
  rejected: 'Không đạt',
};
const incidentStatuses = {
  reported: 'Đã ghi nhận',
  open: 'Mở',
  investigating: 'Đang điều tra',
  in_progress: 'Đang xử lý',
  under_review: 'Đang xem xét',
  awaiting_response: 'Chờ phản hồi',
  pending_manager: 'Đã gửi Manager',
  pending_review: 'Chờ Manager',
  need_more_information: 'Cần bổ sung',
  escalated: 'Đã chuyển Manager',
  resolved: 'Đã giải quyết',
  closed: 'Đã đóng',
};
const caseTypes = [
  ['vehicle_damage', 'Hư hỏng xe'],
  ['accident', 'Tai nạn'],
  ['traffic_violation', 'Vi phạm giao thông'],
  ['theft', 'Mất cắp'],
  ['safety', 'An toàn'],
  ['overdue', 'Quá hạn'],
  ['other', 'Khác'],
];
const canEditIncident = (incident) => incident && ['reported', 'need_more_information'].includes(incident.status);

function dateTimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function readInitialSection(initialSection) {
  if (sections.some((section) => section.id === initialSection)) return initialSection;
  const section = window.location.hash.match(/^#\/(?:operator|operations|operation)(?:\/([^/?]+))?/i)?.[1];
  return sections.some((item) => item.id === section) ? section : 'overview';
}

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không đọc được tệp biên bản.'));
    reader.readAsDataURL(file);
  });
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function OperatorPage({ initialSection } = {}) {
  const currentUser = getCurrentUser();
  const roles = currentUser?.roles || EMPTY_LIST;
  const permissions = currentUser?.permissions || EMPTY_LIST;
  const isAdmin = roles.includes('ADMIN');
  const [section, setSection] = useState(() => readInitialSection(initialSection));
  const [dashboard, setDashboard] = useState(null);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [vehiclesForIncident, setVehiclesForIncident] = useState([]);
  const [incidentVehicleSearch, setIncidentVehicleSearch] = useState('');
  const [incidentVehicleSearchLoading, setIncidentVehicleSearchLoading] = useState(false);
  const [garageStaff, setGarageStaff] = useState([]);
  const [incidentVehicleId, setIncidentVehicleId] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [showCreateIncident, setShowCreateIncident] = useState(false);
  const [showInspectionForm, setShowInspectionForm] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const selectedIncidentId = selectedIncident?.id;
  const selectedVehicleId = selectedVehicle?.id;

  const permittedSections = sections.filter((item) => isAdmin || permissions.includes(item.permission));
  const activeSection = sections.find((item) => item.id === section) || sections[0];
  const authorized = isAdmin || permissions.includes(activeSection.permission);
  const hasPermission = (permission) => isAdmin || permissions.includes(permission);
  const canCreateIncident = hasPermission('operation.incident.create') && hasPermission('operation.vehicle.read');
  const canEditSelectedIncident = canEditIncident(selectedIncident) && hasPermission('operation.incident.update');
  const availableVehicleStatusTransitions = selectedVehicle
    ? (vehicleStatusTransitions[selectedVehicle.physicalStatus] || [])
      .filter((target) => target !== 'at_garage' || selectedVehicle.onboardingStatus === 'approved')
    : [];
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  function toggleCreateIncident() {
    const shouldOpen = !showCreateIncident;
    if (!shouldOpen) {
      setIncidentVehicleId('');
      setIncidentVehicleSearch('');
      setVehiclesForIncident([]);
    }
    setShowCreateIncident(shouldOpen);
  }

  function navigate(nextSection) {
    setSection(nextSection);
    setMenuOpen(false);
    setPage(1);
    setStatus('all');
    setQuery('');
    setSearchText('');
    setSelectedIncident(null);
    window.location.hash = nextSection === 'overview' ? '#/operator' : `#/operator/${nextSection}`;
  }

  useEffect(() => {
    const syncHash = () => setSection(readInitialSection());
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  useEffect(() => {
    document.title = `${activeSection.label} — XeDi`;
  }, [activeSection.label]);

  useEffect(() => {
    if (!authorized) {
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const load = async () => {
      try {
        if (section === 'overview') {
          const result = await getOperatorDashboard({ signal: controller.signal });
          if (!controller.signal.aborted) setDashboard(result.data?.metrics || {});
        } else if (section === 'vehicles') {
          const result = await getOperatorVehicles({ page, limit: 10, q: query, status }, { signal: controller.signal });
          if (!controller.signal.aborted) {
            setRows(result.data || []);
            setPagination(result.pagination || null);
          }
        } else if (section === 'incidents') {
          const result = await getOperatorIncidents({ page, limit: 10, q: query, status }, { signal: controller.signal });
          if (!controller.signal.aborted) {
            setRows(result.data || []);
            setPagination(result.pagination || null);
          }
        }
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason.message || 'Không thể tải dữ liệu.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [authorized, page, query, revision, section, status]);

  useEffect(() => {
    if (section !== 'incidents' || !showCreateIncident || !canCreateIncident || incidentVehicleId) {
      setVehiclesForIncident([]);
      setIncidentVehicleSearchLoading(false);
      return undefined;
    }
    const search = incidentVehicleSearch.trim();
    if (search.length < 2) {
      setVehiclesForIncident([]);
      setIncidentVehicleSearchLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setIncidentVehicleSearchLoading(true);
    const timeout = setTimeout(() => {
      getOperatorVehicles({ page: 1, limit: 10, q: search }, { signal: controller.signal })
        .then((result) => { if (!controller.signal.aborted) setVehiclesForIncident(result.data || []); })
        .catch((reason) => { if (!controller.signal.aborted) setError(reason.message || 'Không tải được danh sách xe.'); })
        .finally(() => { if (!controller.signal.aborted) setIncidentVehicleSearchLoading(false); });
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [canCreateIncident, incidentVehicleId, incidentVehicleSearch, section, showCreateIncident]);

  useEffect(() => {
    if (!selectedIncidentId) return undefined;
    const controller = new AbortController();
    getOperatorIncident(selectedIncidentId, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setSelectedIncident(result.data); })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message || 'Không tải được hồ sơ sự cố.'); });
    return () => controller.abort();
  }, [selectedIncidentId, revision]);

  useEffect(() => {
    if (!selectedVehicleId) return undefined;
    const controller = new AbortController();
    getOperatorVehicle(selectedVehicleId, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setSelectedVehicle(result.data); })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message || 'Không tải được thông tin xe.'); });
    return () => controller.abort();
  }, [selectedVehicleId, revision]);

  useEffect(() => {
    setShowInspectionForm(false);
  }, [selectedVehicleId]);

  async function runAction(action, message) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(message);
      refresh();
    } catch (reason) {
      setError(reason.message || 'Không thể cập nhật dữ liệu.');
    } finally {
      setBusy(false);
    }
  }

  async function saveIncident(event) {
    event.preventDefault();
    if (!incidentVehicleId) {
      setError('Hãy tìm và chọn xe liên quan trước khi lưu hồ sơ.');
      return;
    }
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    const odometerKm = body.odometerKm === '' ? undefined : Number(body.odometerKm);
    if (odometerKm !== undefined && (!Number.isSafeInteger(odometerKm) || odometerKm < 0)) {
      setError('Số km phải là số nguyên không âm.');
      return;
    }
    await runAction(async () => {
      await createOperatorIncident({
        vehicleId: body.vehicleId,
        caseType: body.caseType,
        description: body.description,
        ...(body.incidentType.trim() ? { incidentType: body.incidentType.trim() } : {}),
        ...(odometerKm !== undefined ? { odometerKm } : {}),
        ...(body.severity ? { severity: body.severity } : {}),
      });
      form.reset();
      setIncidentVehicleId('');
      setIncidentVehicleSearch('');
      setShowCreateIncident(false);
    }, 'Đã ghi nhận sự cố.');
  }

  async function saveIncidentChanges(event) {
    event.preventDefault();
    if (!selectedIncident || !canEditIncident(selectedIncident)) return;
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    const odometerKm = body.odometerKm === '' ? undefined : Number(body.odometerKm);
    if (odometerKm !== undefined && (!Number.isSafeInteger(odometerKm) || odometerKm < 0)) {
      setError('Số km phải là số nguyên không âm.');
      return;
    }
    await runAction(async () => {
      await updateOperatorIncident(selectedIncident.id, {
        description: body.description,
        ...(body.incidentType.trim() ? { incidentType: body.incidentType.trim() } : {}),
        ...(odometerKm !== undefined ? { odometerKm } : {}),
        ...(body.severity ? { severity: body.severity } : {}),
        ...(body.note.trim() ? { note: body.note.trim() } : {}),
      });
      setSelectedIncident(null);
    }, 'Đã cập nhật hồ sơ sự cố.');
  }

  async function saveVehicleStatus(event) {
    event.preventDefault();
    if (!selectedVehicle) return;
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    await runAction(
      () => updateOperatorVehicleStatus(selectedVehicle.id, { status: body.status, note: body.note.trim() }),
      'Đã cập nhật trạng thái xe và lưu lý do.',
    );
  }

  async function uploadEvidence(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedIncident || !canEditIncident(selectedIncident)) return;
    if (file.size > 4 * 1024 * 1024) {
      setError('Biên bản không được vượt quá 4 MB.');
      return;
    }
    await runAction(async () => {
      const data = await fileAsDataUrl(file);
      await attachOperatorEvidence(selectedIncident.id, { name: file.name, contentType: file.type, data });
      setSelectedIncident(null);
    }, 'Đã đính kèm biên bản.');
  }

  async function downloadEvidence(evidence) {
    await runAction(async () => {
      const blob = await getOperatorEvidence(selectedIncident.id, evidence.index);
      saveBlob(blob, evidence.name || 'bien-ban');
    }, 'Đã tải biên bản.');
  }

  async function downloadVehicleDocument(kind) {
    await runAction(async () => {
      const blob = await getOperatorVehicleDocument(selectedVehicle.id, kind);
      saveBlob(blob, `${selectedVehicle.licensePlate}-${kind}`);
    }, 'Đã tải tài liệu xe.');
  }

  async function openInspectionForm() {
    setBusy(true);
    setError('');
    try {
      const result = await getOperatorGarageStaff();
      setGarageStaff(result.data || []);
      setShowInspectionForm(true);
    } catch (reason) {
      setError(reason.message || 'Không thể tải danh sách nhân viên Garage.');
    } finally {
      setBusy(false);
    }
  }

  async function saveInspectionSchedule(event) {
    event.preventDefault();
    if (!selectedVehicle) return;
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    await runAction(async () => {
      const payload = {
        garageStaffId: body.garageStaffId,
        scheduledFor: new Date(body.scheduledFor).toISOString(),
        note: body.note,
      };
      if (selectedVehicle.inspection?.status === 'draft') {
        await updateOperatorVehicleInspectionSchedule(selectedVehicle.id, {
          ...payload,
          version: selectedVehicle.inspection.version,
        });
      } else {
        await scheduleOperatorVehicleInspection(selectedVehicle.id, payload);
      }
      setShowInspectionForm(false);
    }, selectedVehicle.inspection?.status === 'draft'
      ? 'Đã cập nhật lịch và phân công kiểm định.'
      : 'Đã lên lịch và phân công kiểm định đầu vào.');
  }

  if (!currentUser) {
    return <main className="operator-access-denied"><h1>Cần đăng nhập</h1><a href="/#/login">Đến trang đăng nhập</a></main>;
  }

  return (
    <div className="operator-app">
      <aside className={`operator-sidebar${menuOpen ? ' is-open' : ''}`}>
        <div className="operator-brand"><Brand /><span className="operator-brand-tag">VẬN HÀNH</span></div>
        <div className="operator-workspace-switcher">
          <span className="operator-workspace-mark">X</span>
          <span><strong>XeDi Việt Nam</strong><small>Trung tâm vận hành</small></span>
        </div>
        <span className="operator-nav-label">KHÔNG GIAN OPERATOR STAFF</span>
        <nav aria-label="Điều hướng Operator Staff">
          {permittedSections.map((item) => (
            <button key={item.id} className={section === item.id ? 'selected' : ''} onClick={() => navigate(item.id)}>
              <Icon name={item.icon} size={18} />{item.label}
            </button>
          ))}
        </nav>
        <div className="operator-sidebar-spacer" />
        <div className="operator-sidebar-user">
          <span className="operator-avatar">{(currentUser.full_name || 'OP').slice(0, 1).toUpperCase()}</span>
          <span><strong>{currentUser.full_name || 'Operator Staff'}</strong><small>Nhân viên vận hành</small></span>
        </div>
        <a href="#trang-chu" className="operator-back"><Icon name="car" size={16} /> Về trang XeDi</a>
      </aside>
      {menuOpen && <button className="operator-scrim" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />}

      <main className="operator-main">
        <header className="operator-topbar">
          <button className="operator-menu-toggle" aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            <Icon name={menuOpen ? 'close' : 'menu'} size={20} />
          </button>
          <div className="operator-breadcrumb">Không gian vận hành <span>/</span> <strong>{activeSection.label}</strong></div>
          <div className="operator-top-actions">
            <span className="operator-live"><i /> Hệ thống hoạt động</span>
            <div className="operator-account">
              <span className="operator-account-avatar">{(currentUser.full_name || 'OP').slice(0, 1).toUpperCase()}</span>
              <span className="operator-account-name"><strong>{currentUser.full_name || 'Operator Staff'}</strong><small>{currentUser.email}</small></span>
              <button onClick={() => { clearSession(); window.location.hash = '#/login'; }}>Đăng xuất</button>
            </div>
          </div>
        </header>
        <div className="operator-content">
          <section className="operator-page-heading">
            <div>
              <span className="operator-eyebrow"><i />{new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()).toLocaleUpperCase('vi-VN')}</span>
              <h1>{activeSection.label}</h1>
              <p>{sectionDescriptions[section]}</p>
            </div>
            <button className="operator-refresh" type="button" onClick={refresh} disabled={loading}>↻ <span>Làm mới</span></button>
          </section>
          {error && <div className="operator-alert" role="alert">{error}<button onClick={() => setError('')}>Đóng</button></div>}
          {notice && <div className="operator-notice" role="status">{notice}<button onClick={() => setNotice('')}>Đóng</button></div>}
          {!authorized ? (
            <section className="operator-empty">
              <h2>Không có quyền truy cập</h2>
              <p>Tài khoản của bạn không được cấp quyền cho mục này.</p>
            </section>
          ) : section === 'overview' ? (
            <section className="operator-dashboard">
              {loading && !dashboard ? (
                <p className="operator-loading" role="status">Đang tải tổng quan…</p>
              ) : (
                <div className="operator-metrics">
                  {dashboardMetrics
                    .filter(({ key }) => dashboard && Object.hasOwn(dashboard, key))
                    .map(({ key, label, icon, tone }) => (
                      <article className="operator-metric" key={key}>
                        <span className={`operator-metric-icon ${tone}`}><Icon name={icon} size={18} /></span>
                        <span className="operator-metric-label">{label}</span>
                        <strong>{dashboard[key]}</strong>
                      </article>
                    ))}
                  {!Object.keys(dashboard || {}).length && (
                    <p className="operator-empty">Không có số liệu phù hợp với quyền hiện tại.</p>
                  )}
                </div>
              )}
            </section>
          ) : section === 'contracts' ? (
            <ContractsPage embedded key={revision} />
          ) : section === 'vehicles' ? (
            <section className="operator-workspace">
              <form className="operator-filters" onSubmit={(event) => {
                event.preventDefault();
                setQuery(searchText.trim());
                setPage(1);
              }}>
                <label>
                  Tìm xe
                  <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Biển số, hãng hoặc mẫu xe" />
                </label>
                <label>
                  Trạng thái
                  <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                    <option value="all">Tất cả</option>
                    {Object.entries(vehicleStatuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                  </select>
                </label>
                <button type="submit">Tìm kiếm</button>
              </form>
              {loading ? (
                <p role="status">Đang tải danh sách xe…</p>
              ) : rows.length ? (
                <div className="operator-table-wrap">
                  <table className="operator-table">
                    <thead>
                      <tr><th>Xe</th><th>Chủ xe</th><th>Trạng thái vận hành</th><th>Kiểm định đầu vào</th><th>Cập nhật</th></tr>
                    </thead>
                    <tbody>
                      {rows.map((vehicle) => (
                        <tr key={vehicle.id}>
                          <td><strong>{vehicle.brand} {vehicle.model}</strong><span>{vehicle.licensePlate}</span></td>
                          <td>{vehicle.owner?.full_name || '—'}</td>
                          <td>{vehicleStatuses[vehicle.physicalStatus] || vehicle.physicalStatus || '—'}</td>
                          <td>
                            {vehicle.inspection ? (
                              <>
                                <strong>{inspectionStatuses[vehicle.inspection.status] || vehicle.inspection.status}</strong>
                                <span>{inspectionScheduleStates[vehicle.inspection.scheduleState]}</span>
                                <span>{vehicle.inspection.garageStaff?.full_name || 'Chưa rõ Garage Staff'}</span>
                                <span>{vehicle.inspection.scheduledFor
                                  ? new Date(vehicle.inspection.scheduledFor).toLocaleString('vi-VN')
                                  : 'Chưa có lịch'}</span>
                              </>
                            ) : 'Chưa phân công'}
                          </td>
                          <td>
                            {vehicle.updatedAt ? new Date(vehicle.updatedAt).toLocaleDateString('vi-VN') : '—'}
                            <button className="operator-secondary" onClick={() => setSelectedVehicle(vehicle)}>Chi tiết</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="operator-empty">Không có xe phù hợp.</p>}
              <Pagination
                page={pagination?.page ?? page}
                pageSize={pagination?.limit ?? 10}
                total={pagination?.total ?? 0}
                disabled={loading}
                onPageChange={setPage}
                label="Phân trang danh sách xe"
              />
            </section>
          ) : (
            <section className="operator-workspace">
              {canCreateIncident && (
                <div className="operator-section-actions">
                  <button onClick={toggleCreateIncident}>
                    {showCreateIncident ? 'Đóng biểu mẫu' : 'Ghi nhận sự cố'}
                  </button>
                </div>
              )}
              {showCreateIncident && (
                <form className="operator-form" onSubmit={saveIncident}>
                  <div className="operator-vehicle-search">
                    <label htmlFor="operator-incident-vehicle">Xe liên quan</label>
                    <div className="operator-vehicle-search-control">
                      <input
                        id="operator-incident-vehicle"
                        type="search"
                        role="combobox"
                        autoComplete="off"
                        placeholder="Gõ biển số, hãng hoặc mẫu xe"
                        value={incidentVehicleSearch}
                        onChange={(event) => {
                          setIncidentVehicleSearch(event.target.value);
                          setIncidentVehicleId('');
                          setVehiclesForIncident([]);
                        }}
                        aria-describedby="operator-incident-vehicle-help"
                        aria-autocomplete="list"
                        aria-expanded={vehiclesForIncident.length > 0}
                        aria-haspopup="listbox"
                        aria-controls="operator-incident-vehicle-options"
                      />
                      <input type="hidden" name="vehicleId" value={incidentVehicleId} />
                      {!!vehiclesForIncident.length && (
                        <div
                          id="operator-incident-vehicle-options"
                          className="operator-vehicle-search-results"
                          role="listbox"
                          aria-label="Kết quả tìm xe"
                        >
                          {vehiclesForIncident.map((vehicle) => (
                            <button
                              type="button"
                              role="option"
                              aria-selected="false"
                              key={vehicle.id}
                              aria-label={`${vehicle.licensePlate} · ${vehicle.brand} ${vehicle.model}`}
                              onClick={() => {
                                setIncidentVehicleId(vehicle.id);
                                setIncidentVehicleSearch(`${vehicle.licensePlate} · ${vehicle.brand} ${vehicle.model}`);
                                setVehiclesForIncident([]);
                              }}
                            >
                              {vehicle.licensePlate} · {vehicle.brand} {vehicle.model}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <small id="operator-incident-vehicle-help">Nhập ít nhất 2 ký tự, sau đó chọn xe trong kết quả.</small>
                    {incidentVehicleSearchLoading && <p role="status">Đang tìm xe…</p>}
                  </div>
                  <label>
                    Loại sự cố
                    <select name="caseType" defaultValue="vehicle_damage">
                      {caseTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                    </select>
                  </label>
                  <label>Nhóm sự cố chi tiết<input name="incidentType" maxLength={80} /></label>
                  <label>
                    Mức độ
                    <select name="severity" defaultValue="">
                      <option value="">Chưa xác định</option>
                      <option value="low">Thấp</option>
                      <option value="medium">Trung bình</option>
                      <option value="high">Cao</option>
                    </select>
                  </label>
                  <label>Số km tại thời điểm ghi nhận<input name="odometerKm" type="number" min="0" step="1" /></label>
                  <label className="operator-form-wide">
                    Mô tả sự việc
                    <textarea name="description" required maxLength={3000} rows="4" />
                  </label>
                  <button type="submit" disabled={busy || !hasPermission('operation.incident.create')}>Lưu hồ sơ</button>
                </form>
              )}
              <form className="operator-filters" onSubmit={(event) => {
                event.preventDefault();
                setQuery(searchText.trim());
                setPage(1);
              }}>
                <label>
                  Tìm hồ sơ
                  <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Mã hồ sơ hoặc nội dung" />
                </label>
                <label>
                  Trạng thái
                  <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                    <option value="all">Tất cả</option>
                    {Object.entries(incidentStatuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                  </select>
                </label>
                <button type="submit">Tìm kiếm</button>
              </form>
              {loading ? (
                <p role="status">Đang tải danh sách sự cố…</p>
              ) : rows.length ? (
                <div className="operator-table-wrap">
                  <table className="operator-table">
                    <thead>
                      <tr><th>Mã hồ sơ</th><th>Xe</th><th>Mô tả</th><th>Trạng thái</th><th /></tr>
                    </thead>
                    <tbody>
                      {rows.map((incident) => (
                        <tr key={incident.id}>
                          <td>{incident.caseNumber}</td>
                          <td>{incident.vehicle?.licensePlate || '—'}</td>
                          <td>{incident.description}</td>
                          <td>{incidentStatuses[incident.status] || incident.status}</td>
                          <td><button className="operator-secondary" onClick={() => setSelectedIncident(incident)}>Chi tiết</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="operator-empty">Chưa có hồ sơ sự cố.</p>}
              <Pagination
                page={pagination?.page ?? page}
                pageSize={pagination?.limit ?? 10}
                total={pagination?.total ?? 0}
                disabled={loading}
                onPageChange={setPage}
                label="Phân trang hồ sơ sự cố"
              />
            </section>
          )}
        </div>
      </main>

      {selectedIncident && <div className="operator-modal-backdrop"><section className="operator-modal" role="dialog" aria-modal="true" aria-labelledby="operator-incident-title">
        <header><div><h2 id="operator-incident-title">{selectedIncident.caseNumber}</h2><p>{selectedIncident.vehicle?.licensePlate} · {incidentStatuses[selectedIncident.status] || selectedIncident.status}</p></div><button aria-label="Đóng" onClick={() => {
          setSelectedIncident(null);
        }}>×</button></header>
        <p><strong>Loại:</strong> {caseTypes.find(([value]) => value === selectedIncident.caseType)?.[1] || selectedIncident.caseType}</p>
        <form className="operator-form operator-form-single" onSubmit={saveIncidentChanges}>
          <label>Mô tả<textarea name="description" required maxLength={3000} rows="4" defaultValue={selectedIncident.description} disabled={!canEditSelectedIncident} /></label>
          {canEditSelectedIncident && <>
            <label>Nhóm sự cố chi tiết<input name="incidentType" maxLength={80} defaultValue={selectedIncident.incidentType || ''} /></label>
            <label>Mức độ<select name="severity" defaultValue={selectedIncident.severity || ''}><option value="">Chưa xác định</option><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option></select></label>
            <label>Số km tại thời điểm ghi nhận<input name="odometerKm" type="number" min="0" step="1" defaultValue={selectedIncident.odometerKm ?? ''} /></label>
            <label>Ghi chú bổ sung<textarea name="note" maxLength={2000} rows="2" /></label>
            <button disabled={busy}>Lưu cập nhật</button>
          </>}
        </form>
        {!canEditSelectedIncident && canEditIncident(selectedIncident) && <p>Chỉ người có quyền cập nhật sự cố mới có thể sửa hồ sơ.</p>}
        {selectedIncident.timeline?.length > 0 && <section className="operator-evidence"><h3>Lịch sử xử lý</h3><ul>{[...selectedIncident.timeline].reverse().map((entry, index) => <li key={`${entry.action}-${entry.at}-${index}`}><strong>{entry.action}</strong>{entry.at && <> · {new Date(entry.at).toLocaleString('vi-VN')}</>}{entry.note && <p>{entry.note}</p>}</li>)}</ul></section>}
        <section className="operator-evidence"><h3>Biên bản và chứng cứ</h3>
          {selectedIncident.evidence?.length ? selectedIncident.evidence.map((evidence) => evidence.isGaragePhoto
            ? <GaragePhotoPreview key={evidence.index} photo={{ key: evidence.fileKey, name: evidence.name }} />
            : <button className="operator-secondary" key={evidence.index} onClick={() => downloadEvidence(evidence)}>{evidence.name} · Tải xuống</button>) : <p>Chưa có biên bản đính kèm.</p>}
          {canEditIncident(selectedIncident) && <label className="operator-upload">Đính kèm biên bản (PDF/JPEG/PNG/WebP, tối đa 4 MB)<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" disabled={busy || selectedIncident.evidence?.length >= 3 || !hasPermission('operation.incident.evidence.attach')} onChange={uploadEvidence} /></label>}
        </section>
        {selectedIncident.resolution?.note && <section className="operator-manager-outcome"><h3>Kết luận của Manager</h3><p>{selectedIncident.resolution.note}</p></section>}
        {canEditIncident(selectedIncident)
          && <button className="operator-submit" disabled={busy || !hasPermission('operation.incident.submit')} onClick={() => runAction(() => submitOperatorIncident(selectedIncident.id), 'Đã gửi hồ sơ cho Manager xem xét.')}>Gửi Manager xem xét</button>}
      </section></div>}
      {selectedVehicle && <div className="operator-modal-backdrop"><section className="operator-modal" role="dialog" aria-modal="true" aria-labelledby="operator-vehicle-title">
        <header><div><h2 id="operator-vehicle-title">{selectedVehicle.brand} {selectedVehicle.model}</h2><p>{selectedVehicle.licensePlate}</p></div><button aria-label="Đóng" onClick={() => setSelectedVehicle(null)}>×</button></header>
        <dl className="operator-vehicle-facts"><div><dt>Chủ xe</dt><dd>{selectedVehicle.owner?.full_name || '—'} · {selectedVehicle.owner?.email || ''}</dd></div><div><dt>Trạng thái vận hành</dt><dd>{vehicleStatuses[selectedVehicle.physicalStatus] || selectedVehicle.physicalStatus}</dd></div><div><dt>Trạng thái hồ sơ</dt><dd>{selectedVehicle.onboardingStatus || '—'}</dd></div><div><dt>Năm sản xuất</dt><dd>{selectedVehicle.year || '—'}</dd></div><div><dt>Số chỗ</dt><dd>{selectedVehicle.seats || '—'}</dd></div><div><dt>Nhiên liệu / Hộp số</dt><dd>{selectedVehicle.fuelType || '—'} / {selectedVehicle.transmission || '—'}</dd></div><div><dt>Mô tả</dt><dd>{selectedVehicle.description || '—'}</dd></div></dl>
        <section className="operator-evidence"><h3>Hồ sơ xe</h3>{Object.entries({ registration: 'Đăng ký xe', inspectionCertificate: 'Đăng kiểm', insurance: 'Bảo hiểm' }).map(([kind, label]) => selectedVehicle.documents?.[kind] && <button className="operator-secondary" key={kind} onClick={() => downloadVehicleDocument(kind)}>{label} · Tải xuống</button>)}</section>
        <section className="operator-evidence">
          <h3>Cập nhật trạng thái vận hành</h3>
          {availableVehicleStatusTransitions.length
            ? <form className="operator-form operator-form-single" onSubmit={saveVehicleStatus}>
              <label>Trạng thái mới<select name="status" required defaultValue=""><option value="" disabled>Chọn trạng thái</option>{availableVehicleStatusTransitions
                .map((target) => <option value={target} key={target}>{vehicleStatuses[target]}</option>)}</select></label>
              <label>Lý do cập nhật<textarea name="note" required minLength={5} maxLength={1000} rows="2" /></label>
              <button disabled={busy || !hasPermission('operation.vehicle.status.update')}>Lưu trạng thái</button>
            </form>
            : <p>Không có chuyển trạng thái Operator phù hợp với luồng hiện tại của xe.</p>}
          {selectedVehicle.statusHistory?.length > 0 && <ul>{[...selectedVehicle.statusHistory].reverse().slice(0, 5).map((entry, index) => <li key={`${entry.changed_at}-${index}`}>{vehicleStatuses[entry.from] || entry.from || '—'} → {vehicleStatuses[entry.to] || entry.to} · {entry.changed_at ? new Date(entry.changed_at).toLocaleString('vi-VN') : ''}{entry.note && <p>{entry.note}</p>}</li>)}</ul>}
        </section>
        <section className="operator-evidence">
          <h3>Kiểm định đầu vào</h3>
          {selectedVehicle.inspection
            ? <><p><strong>{inspectionStatuses[selectedVehicle.inspection.status] || selectedVehicle.inspection.status}</strong> · {inspectionScheduleStates[selectedVehicle.inspection.scheduleState]} · {selectedVehicle.inspection.scheduledFor ? new Date(selectedVehicle.inspection.scheduledFor).toLocaleString('vi-VN') : 'Chưa có lịch'}</p>
              <p>Garage Staff phụ trách: {selectedVehicle.inspection.garageStaff?.full_name || 'Không rõ'} · {selectedVehicle.inspection.garageStaff?.email || ''}</p>
              {selectedVehicle.inspection.scheduleNote && <p>Ghi chú lịch: {selectedVehicle.inspection.scheduleNote}</p>}
              {selectedVehicle.inspection.status === 'draft' && <button className="operator-secondary" disabled={busy || !hasPermission('operation.vehicle.inspection.schedule')} onClick={openInspectionForm}>Đổi lịch / người phụ trách</button>}
              {selectedVehicle.inspection.status === 'pending' && <p>Garage đã gửi biên bản; Operator không thể đổi lịch hoặc kết quả.</p>}
            </>
            : null}
          {!['draft', 'pending'].includes(selectedVehicle.inspection?.status)
            && ['submitted', 'pending_review', 'revision_required'].includes(selectedVehicle.onboardingStatus)
            && ['with_owner', 'returned_to_owner'].includes(selectedVehicle.physicalStatus)
            && <button className="operator-secondary" disabled={busy || !hasPermission('operation.vehicle.inspection.schedule')} onClick={openInspectionForm}>
              {selectedVehicle.inspection ? 'Lên lịch kiểm định vòng tiếp theo' : 'Lên lịch / phân công Garage'}
            </button>}
          {!selectedVehicle.inspection && !(['submitted', 'pending_review', 'revision_required'].includes(selectedVehicle.onboardingStatus)
            && ['with_owner', 'returned_to_owner'].includes(selectedVehicle.physicalStatus))
            && <p>Xe chưa ở trạng thái chờ kiểm định đầu vào.</p>}
          {showInspectionForm && <form className="operator-form operator-form-single" onSubmit={saveInspectionSchedule}>
            <label>Nhân viên Garage<select name="garageStaffId" required defaultValue={selectedVehicle.inspection?.garageStaffId || ''}><option value="" disabled>Chọn nhân viên</option>{garageStaff.map((staff) => <option value={staff.id} key={staff.id}>{staff.name} · {staff.email}</option>)}</select></label>
            <label>Thời gian kiểm định<input name="scheduledFor" type="datetime-local" required defaultValue={dateTimeLocalValue(selectedVehicle.inspection?.scheduledFor)} /></label>
            <label>Ghi chú<textarea name="note" required maxLength={1000} rows="3" defaultValue={selectedVehicle.inspection?.scheduleNote || ''} /></label>
            <div className="operator-section-actions"><button type="submit" disabled={busy || !garageStaff.length}>{selectedVehicle.inspection?.status === 'draft' ? 'Lưu thay đổi lịch' : 'Lưu lịch kiểm định'}</button><button type="button" className="operator-secondary" disabled={busy} onClick={() => setShowInspectionForm(false)}>Hủy</button></div>
            {!garageStaff.length && <p>Không có Garage Staff đang hoạt động có quyền kiểm định.</p>}
          </form>}
        </section>
      </section></div>}
    </div>
  );
}