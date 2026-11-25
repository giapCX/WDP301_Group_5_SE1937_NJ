import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import SignOutButton from '../../auth/components/SignOutButton.js';
import ManagerSidebar from '../../manager-dashboard/components/ManagerSidebar';
import { decideManagerMaintenanceApproval, garageError, getManagerMaintenanceApprovals } from '../api/garageApi';
import '../../manager-dashboard/styles/managerDashboard.css';
import '../../management/styles/management.css';

function ApprovalCard({ record, onDecision }) {
  const [decision, setDecision] = useState('approve');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const vehicle = record.vehicle || {};
  const inspection = record.reinspection || {};

  async function submit(event) {
    event.preventDefault();
    const reason = note.trim();
    if (decision === 'reject' && !reason) {
      setError('Vui lòng nhập lý do trả phiếu.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onDecision(record.maintenance_id, {
        decision,
        inspection_id: inspection.inspection_id,
        note: reason,
      });
    } catch (failure) {
      setError(garageError(failure));
    } finally {
      setBusy(false);
    }
  }

  return <article className="acl-panel resource-workspace">
    <div className="panel-heading"><div><h2>Phiếu bảo dưỡng #{record.maintenance_id}</h2>
      <p>{[vehicle.brand, vehicle.model, vehicle.plate_number].filter(Boolean).join(' · ') || `Xe #${record.vehicle_id}`}</p></div></div>
    <p>{record.description || 'Không có mô tả công việc.'}</p>
    <p><strong>Kết quả kiểm tra:</strong> {inspection.result || 'Chưa có kết quả'}{inspection.condition_note ? ` · ${inspection.condition_note}` : ''}</p>
    {error && <p className="dispatch-alert" role="alert">{error}</p>}
    <form className="acl-account-form" onSubmit={submit}>
      <label>Quyết định<select value={decision} onChange={(event) => { setDecision(event.target.value); setError(''); }}>
        <option value="approve">Duyệt hoàn tất</option><option value="reject">Trả Gara xử lý lại</option>
      </select></label>
      <label>Ghi chú (bắt buộc khi trả phiếu)
        <textarea aria-required={decision === 'reject'} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <button className="button button-primary" disabled={busy || !inspection.inspection_id}>{busy ? 'Đang lưu…' : 'Gửi quyết định'}</button>
    </form>
  </article>;
}

export default function ManagerMaintenanceApprovalsPage() {
  const user = useOutletContext();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(async (signal) => {
    setLoading(true);
    try {
      setRecords(await getManagerMaintenanceApprovals(signal));
      setError('');
    } catch (failure) {
      if (!signal?.aborted) setError(garageError(failure));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, [refresh, revision]);

  async function decide(id, input) {
    await decideManagerMaintenanceApproval(id, input);
    setRevision((current) => current + 1);
  }

  return <div className="manager-app"><ManagerSidebar/><main className="manager-main"><div className="manager-content">
    <header className="op-heading"><div><h1>Duyệt bảo dưỡng ảnh hưởng an toàn</h1><p>Gara gửi phiếu sau khi sửa chữa và kiểm tra lại đạt. Quyết định được lưu cùng người duyệt và lý do.</p></div>
      <div className="manager-user"><span className="manager-user-avatar">{user?.full_name?.slice(0, 1) || '—'}</span><span><b>{user?.full_name || 'Manager'}</b><small>{user?.role_name || 'manager'}</small></span><SignOutButton/></div>
    </header>
    {error && <p className="dispatch-alert" role="alert">{error}<button type="button" onClick={() => setRevision((current) => current + 1)}>Thử lại</button></p>}
    {loading && <p role="status">Đang tải phiếu chờ duyệt…</p>}
    {!loading && !records.length && !error && <p className="acl-panel resource-workspace">Không có phiếu bảo dưỡng đang chờ quyết định.</p>}
    {!loading && records.map((record) => <ApprovalCard key={record.maintenance_id} record={record} onDecision={decide}/>)}
  </div></main></div>;
}
