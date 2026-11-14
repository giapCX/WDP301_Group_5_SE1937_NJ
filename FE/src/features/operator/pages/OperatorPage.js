import { useCallback, useEffect, useState } from 'react';
import ContractsPage from '../../contracts/ContractsPage';
import Icon from '../../../components/Icon';
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

const vehicleStatuses = {
  with_owner: 'Ở chủ xe',
  at_garage: 'Tại gara',
  rented: 'Đang cho thuê',
  returned_to_owner: 'Đã trả chủ xe',
  maintenance: 'Bảo dưỡng',
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
const editableIncidentStatuses = {
  reported: ['investigating', 'in_progress', 'awaiting_response'],
  investigating: ['in_progress', 'awaiting_response'],
  in_progress: ['investigating', 'awaiting_response'],
  awaiting_response: ['investigating', 'in_progress'],
  open: ['investigating', 'in_progress', 'awaiting_response'],
  under_review: ['investigating', 'in_progress', 'awaiting_response'],
  need_more_information: ['investigating', 'in_progress', 'awaiting_response'],
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
const canEditIncident = (incident) => incident && !['pending_manager', 'pending_review', 'escalated', 'resolved', 'closed'].includes(incident.status);

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
  const [garageStaff, setGarageStaff] = useState([]);
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
  const selectedIncidentId = selectedIncident?.id;
  const selectedVehicleId = selectedVehicle?.id;

  const permittedSections = sections.filter((item) => isAdmin || permissions.includes(item.permission));
  const activeSection = sections.find((item) => item.id === section) || sections[0];
  const authorized = isAdmin || permissions.includes(activeSection.permission);
  const hasPermission = (permission) => isAdmin || permissions.includes(permission);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  function navigate(nextSection) {
    setSection(nextSection);
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
    if (section !== 'incidents') return undefined;
    const controller = new AbortController();
    getOperatorVehicles({ page: 1, limit: 100 }, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setVehiclesForIncident(result.data || []); })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message || 'Không tải được danh sách xe.'); });
    return () => controller.abort();
  }, [section]);

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
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    await runAction(async () => {
      await createOperatorIncident({
        vehicleId: body.vehicleId,
        caseType: body.caseType,
        description: body.description,
        ...(body.severity ? { severity: body.severity } : {}),
      });
      form.reset();
      setShowCreateIncident(false);
    }, 'Đã ghi nhận sự cố.');
  }

  async function saveIncidentChanges(event) {
    event.preventDefault();
    if (!selectedIncident || !canEditIncident(selectedIncident)) return;
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    await runAction(async () => {
      await updateOperatorIncident(selectedIncident.id, {
        description: body.description,
        status: body.status,
        ...(body.note.trim() ? { note: body.note.trim() } : {}),
      });
      setSelectedIncident(null);
    }, 'Đã cập nhật hồ sơ sự cố.');
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
      await scheduleOperatorVehicleInspection(selectedVehicle.id, {
        garageStaffId: body.garageStaffId,
        scheduledFor: new Date(body.scheduledFor).toISOString(),
        note: body.note,
      });
      setShowInspectionForm(false);
    }, 'Đã lên lịch và phân công kiểm định đầu vào.');
  }

  if (!currentUser) {
    return <main className="operator-access-denied"><h1>Cần đăng nhập</h1><a href="/#/login">Đến trang đăng nhập</a></main>;
  }

  return (
    <div className="operator-app">
      <aside className="operator-sidebar">
        <a href="#trang-chu" className="operator-brand"><span className="operator-brand-mark">X</span><span><strong>XeDi</strong><small>OPERATOR WORKSPACE</small></span></a>
        <div className="operator-user"><span className="operator-avatar">{(currentUser.full_name || 'OP').slice(0, 1)}</span><span><strong>{currentUser.full_name || 'Operator Staff'}</strong><small>Nhân viên vận hành</small></span></div>
        <nav aria-label="Điều hướng Operator Staff">
          {permittedSections.map((item) => (
            <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => navigate(item.id)}>
              <Icon name={item.icon} size={18} />{item.label}
            </button>
          ))}
        </nav>
        <a href="#trang-chu" className="operator-back">← Về trang XeDi</a>
      </aside>

      <main className="operator-main">
        <header className="operator-topbar">
          <div><p>KHÔNG GIAN OPERATOR STAFF</p><h1>{activeSection.label}</h1></div>
          <div><span>{currentUser.email}</span><button onClick={() => { clearSession(); window.location.hash = '#/login'; }}>Đăng xuất</button></div>
        </header>
        {error && <div className="operator-alert" role="alert">{error}<button onClick={() => setError('')}>Đóng</button></div>}
        {notice && <div className="operator-notice" role="status">{notice}<button onClick={() => setNotice('')}>Đóng</button></div>}
        {!authorized ? <section className="operator-empty"><h2>Không có quyền truy cập</h2><p>Tài khoản của bạn không được cấp quyền cho mục này.</p></section>
          : section === 'overview' ? <section className="operator-dashboard">
            {loading ? <p role="status">Đang tải tổng quan…</p> : <div className="operator-metrics">
              <article><span>Xe đang chạy</span><strong>{dashboard?.activeVehicles ?? 0}</strong></article>
              <article><span>Hợp đồng sắp hết hạn (30 ngày)</span><strong>{dashboard?.expiringContracts ?? 0}</strong></article>
              <article><span>Sự cố đang xử lý</span><strong>{dashboard?.incidentsInProgress ?? 0}</strong></article>
            </div>}
          </section>
          : section === 'contracts' ? <ContractsPage embedded />
          : section === 'vehicles' ? <section className="operator-workspace">
            <form className="operator-filters" onSubmit={(event) => { event.preventDefault(); setQuery(searchText.trim()); setPage(1); }}>
              <label>Tìm xe<input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Biển số, hãng hoặc mẫu xe" /></label>
              <label>Trạng thái<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">Tất cả</option>{Object.entries(vehicleStatuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <button type="submit">Tìm kiếm</button>
            </form>
            {loading ? <p role="status">Đang tải danh sách xe…</p> : rows.length ? <div className="operator-table-wrap"><table className="operator-table"><thead><tr><th>Xe</th><th>Chủ xe</th><th>Trạng thái vận hành</th><th>Cập nhật</th></tr></thead><tbody>
              {rows.map((vehicle) => <tr key={vehicle.id}><td><strong>{vehicle.brand} {vehicle.model}</strong><span>{vehicle.licensePlate}</span></td><td>{vehicle.owner?.full_name || '—'}</td><td><select aria-label={`Trạng thái ${vehicle.licensePlate}`} value={vehicle.physicalStatus} disabled={busy || !hasPermission('operation.vehicle.status.update')} onChange={(event) => runAction(() => updateOperatorVehicleStatus(vehicle.id, { status: event.target.value }), 'Đã cập nhật trạng thái xe.')}>{Object.entries(vehicleStatuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></td><td>{vehicle.updatedAt ? new Date(vehicle.updatedAt).toLocaleDateString('vi-VN') : '—'} <button className="operator-secondary" onClick={() => setSelectedVehicle(vehicle)}>Chi tiết</button></td></tr>)}
            </tbody></table></div> : <p className="operator-empty">Không có xe phù hợp.</p>}
            <Pagination page={pagination?.page ?? page} pageSize={pagination?.limit ?? 10} total={pagination?.total ?? 0} disabled={loading} onPageChange={setPage} label="Phân trang danh sách xe" />
          </section>
          : <section className="operator-workspace">
            <div className="operator-section-actions"><button onClick={() => setShowCreateIncident((value) => !value)}>{showCreateIncident ? 'Đóng biểu mẫu' : 'Ghi nhận sự cố'}</button></div>
            {showCreateIncident && <form className="operator-form" onSubmit={saveIncident}>
              <label>Xe liên quan<select name="vehicleId" required defaultValue=""><option value="" disabled>Chọn xe</option>{vehiclesForIncident.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.licensePlate} · {vehicle.brand} {vehicle.model}</option>)}</select></label>
              <label>Loại sự cố<select name="caseType" defaultValue="vehicle_damage">{caseTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label>Mức độ<select name="severity" defaultValue=""><option value="">Chưa xác định</option><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option></select></label>
              <label className="operator-form-wide">Mô tả sự việc<textarea name="description" required maxLength={3000} rows="4" /></label>
              <button type="submit" disabled={busy || !hasPermission('operation.incident.create')}>Lưu hồ sơ</button>
            </form>}
            <form className="operator-filters" onSubmit={(event) => { event.preventDefault(); setQuery(searchText.trim()); setPage(1); }}>
              <label>Tìm hồ sơ<input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Mã hồ sơ hoặc nội dung" /></label>
              <label>Trạng thái<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">Tất cả</option>{Object.entries(incidentStatuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <button type="submit">Tìm kiếm</button>
            </form>
            {loading ? <p role="status">Đang tải danh sách sự cố…</p> : rows.length ? <div className="operator-table-wrap"><table className="operator-table"><thead><tr><th>Mã hồ sơ</th><th>Xe</th><th>Mô tả</th><th>Trạng thái</th><th></th></tr></thead><tbody>
              {rows.map((incident) => <tr key={incident.id}><td>{incident.caseNumber}</td><td>{incident.vehicle?.licensePlate || '—'}</td><td>{incident.description}</td><td>{incidentStatuses[incident.status] || incident.status}</td><td><button className="operator-secondary" onClick={() => setSelectedIncident(incident)}>Chi tiết</button></td></tr>)}
            </tbody></table></div> : <p className="operator-empty">Chưa có hồ sơ sự cố.</p>}
            <Pagination page={pagination?.page ?? page} pageSize={pagination?.limit ?? 10} total={pagination?.total ?? 0} disabled={loading} onPageChange={setPage} label="Phân trang hồ sơ sự cố" />
          </section>}
      </main>

      {selectedIncident && <div className="operator-modal-backdrop"><section className="operator-modal" role="dialog" aria-modal="true" aria-labelledby="operator-incident-title">
        <header><div><h2 id="operator-incident-title">{selectedIncident.caseNumber}</h2><p>{selectedIncident.vehicle?.licensePlate} · {incidentStatuses[selectedIncident.status] || selectedIncident.status}</p></div><button aria-label="Đóng" onClick={() => setSelectedIncident(null)}>×</button></header>
        <p><strong>Loại:</strong> {caseTypes.find(([value]) => value === selectedIncident.caseType)?.[1] || selectedIncident.caseType}</p>
        <form className="operator-form operator-form-single" onSubmit={saveIncidentChanges}>
          <label>Mô tả<textarea name="description" required maxLength={3000} rows="4" defaultValue={selectedIncident.description} disabled={!canEditIncident(selectedIncident)} /></label>
          {canEditIncident(selectedIncident) && <><label>Trạng thái<select name="status" defaultValue={selectedIncident.status}>{[selectedIncident.status, ...(editableIncidentStatuses[selectedIncident.status] || [])].map((value) => <option value={value} key={value}>{incidentStatuses[value] || value}</option>)}</select></label><label>Ghi chú xử lý<textarea name="note" maxLength={2000} rows="2" /></label><button disabled={busy || !hasPermission('operation.incident.update')}>Lưu cập nhật</button></>}
        </form>
        <section className="operator-evidence"><h3>Biên bản và chứng cứ</h3>
          {selectedIncident.evidence?.length ? selectedIncident.evidence.map((evidence) => evidence.isGaragePhoto
            ? <GaragePhotoPreview key={evidence.index} photo={{ key: evidence.fileKey, name: evidence.name }} />
            : <button className="operator-secondary" key={evidence.index} onClick={() => downloadEvidence(evidence)}>{evidence.name} · Tải xuống</button>) : <p>Chưa có biên bản đính kèm.</p>}
          {canEditIncident(selectedIncident) && <label className="operator-upload">Đính kèm biên bản (PDF/JPEG/PNG/WebP, tối đa 4 MB)<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" disabled={busy || selectedIncident.evidence?.length >= 3 || !hasPermission('operation.incident.evidence.attach')} onChange={uploadEvidence} /></label>}
        </section>
        {selectedIncident.resolution?.note && <section className="operator-manager-outcome"><h3>Kết luận của Manager</h3><p>{selectedIncident.resolution.note}</p></section>}
        {selectedIncident.status !== 'pending_manager' && selectedIncident.status !== 'pending_review' && !['escalated', 'resolved', 'closed'].includes(selectedIncident.status)
          && <button className="operator-submit" disabled={busy || !hasPermission('operation.incident.submit')} onClick={() => runAction(() => submitOperatorIncident(selectedIncident.id), 'Đã gửi hồ sơ cho Manager xem xét.')}>Gửi Manager xem xét</button>}
      </section></div>}
      {selectedVehicle && <div className="operator-modal-backdrop"><section className="operator-modal" role="dialog" aria-modal="true" aria-labelledby="operator-vehicle-title">
        <header><div><h2 id="operator-vehicle-title">{selectedVehicle.brand} {selectedVehicle.model}</h2><p>{selectedVehicle.licensePlate}</p></div><button aria-label="Đóng" onClick={() => setSelectedVehicle(null)}>×</button></header>
        <dl className="operator-vehicle-facts"><div><dt>Chủ xe</dt><dd>{selectedVehicle.owner?.full_name || '—'} · {selectedVehicle.owner?.email || ''}</dd></div><div><dt>Trạng thái vận hành</dt><dd>{vehicleStatuses[selectedVehicle.physicalStatus] || selectedVehicle.physicalStatus}</dd></div><div><dt>Trạng thái hồ sơ</dt><dd>{selectedVehicle.onboardingStatus || '—'}</dd></div><div><dt>Năm sản xuất</dt><dd>{selectedVehicle.year || '—'}</dd></div><div><dt>Số chỗ</dt><dd>{selectedVehicle.seats || '—'}</dd></div><div><dt>Nhiên liệu / Hộp số</dt><dd>{selectedVehicle.fuelType || '—'} / {selectedVehicle.transmission || '—'}</dd></div><div><dt>Mô tả</dt><dd>{selectedVehicle.description || '—'}</dd></div></dl>
        <section className="operator-evidence"><h3>Hồ sơ xe</h3>{Object.entries({ registration: 'Đăng ký xe', inspectionCertificate: 'Đăng kiểm', insurance: 'Bảo hiểm' }).map(([kind, label]) => selectedVehicle.documents?.[kind] && <button className="operator-secondary" key={kind} onClick={() => downloadVehicleDocument(kind)}>{label} · Tải xuống</button>)}</section>
        <section className="operator-evidence">
          <h3>Kiểm định đầu vào</h3>
          {selectedVehicle.inspection
            ? <p>{selectedVehicle.inspection.status === 'draft' ? 'Đã phân công Garage' : 'Garage đã gửi biên bản'} · {selectedVehicle.inspection.scheduledFor ? new Date(selectedVehicle.inspection.scheduledFor).toLocaleString('vi-VN') : 'Chưa có lịch'}</p>
            : ['submitted', 'pending_review'].includes(selectedVehicle.onboardingStatus) && ['with_owner', 'returned_to_owner'].includes(selectedVehicle.physicalStatus)
              ? <button className="operator-secondary" disabled={busy || !hasPermission('operation.vehicle.inspection.schedule')} onClick={openInspectionForm}>Lên lịch / phân công Garage</button>
              : <p>Xe chưa ở trạng thái chờ kiểm định đầu vào.</p>}
          {showInspectionForm && <form className="operator-form operator-form-single" onSubmit={saveInspectionSchedule}>
            <label>Nhân viên Garage<select name="garageStaffId" required defaultValue=""><option value="" disabled>Chọn nhân viên</option>{garageStaff.map((staff) => <option value={staff.id} key={staff.id}>{staff.name} · {staff.email}</option>)}</select></label>
            <label>Thời gian kiểm định<input name="scheduledFor" type="datetime-local" required /></label>
            <label>Ghi chú<textarea name="note" required maxLength={1000} rows="3" /></label>
            <div className="operator-section-actions"><button type="submit" disabled={busy || !garageStaff.length}>Lưu lịch kiểm định</button><button type="button" className="operator-secondary" disabled={busy} onClick={() => setShowInspectionForm(false)}>Hủy</button></div>
            {!garageStaff.length && <p>Không có Garage Staff đang hoạt động có quyền kiểm định.</p>}
          </form>}
        </section>
      </section></div>}
    </div>
  );
}