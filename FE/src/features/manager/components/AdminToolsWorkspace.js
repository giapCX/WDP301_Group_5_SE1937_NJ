import { useState } from 'react';
import useManagerActions from '../hooks/useManagerActions';
import useManagerCollection from '../hooks/useManagerCollection';
import { ChangeSummary, PermissionPills, humanizeField } from './dataDisplay';

function WorkspaceHeader({ title, subtitle, count }) {
  return <div className="workspace-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{count !== undefined && <span className="workspace-count">{count} hồ sơ</span>}</div>;
}

const auditActionLabels = {
  'account.create': 'Tạo tài khoản',
  'account.update': 'Cập nhật tài khoản',
  'role.create': 'Tạo vai trò',
  'role.update': 'Cập nhật vai trò',
  'policy.update': 'Cập nhật chính sách',
  'vehicle.approve': 'Duyệt phương tiện',
  'compensation.approve': 'Duyệt bồi thường',
  'incident.review': 'Xử lý sự cố',
  'report.generated': 'Tạo báo cáo',
};

const dateInput = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

export default function AdminToolsWorkspace({ active, onNotice }) {
  const [from, setFrom] = useState(() => { const start = new Date(); start.setDate(start.getDate() - 30); return dateInput(start); });
  const [to, setTo] = useState(() => dateInput(new Date()));
  const request = useManagerCollection(active, active === 'auditLogs' ? { from, to, limit: 100 } : {});
  const { createRole, updateRole } = useManagerActions();
  const [actionError, setActionError] = useState('');
  const data = request.data;
  const { loading } = request;
  const error = actionError || request.error;
  const refresh = () => { setActionError(''); request.refresh(); };

  const act = async (promise, message) => {
    try {
      await promise;
      onNotice(message);
      refresh();
    } catch (reason) {
      setActionError(reason.message || 'Không thể cập nhật dữ liệu.');
    }
  };

  if (loading) return <section className="manager-panel workspace-panel"><p className="manager-empty">Đang tải dữ liệu…</p></section>;
  if (error) return <section className="manager-panel workspace-panel"><div className="manager-notice manager-error">{error}<button onClick={refresh}>Thử lại</button></div></section>;

  if (active === 'roles') return <section className="manager-panel workspace-panel">
    <WorkspaceHeader title="Vai trò & quyền" subtitle="Tạo vai trò và cập nhật quyền truy cập của vai trò hiện có." count={data.length} />
    <button className="action-approve" onClick={() => { const code = window.prompt('Mã vai trò viết hoa (ví dụ: REPORT_VIEWER):'); if (!code) return; const name = window.prompt('Tên hiển thị:'); if (!name) return; const description = window.prompt('Mô tả vai trò:', '') ?? ''; const permissions = window.prompt('Mã quyền, cách nhau bằng dấu phẩy:', 'report.view'); if (permissions === null) return; act(createRole({ code: code.trim().toUpperCase(), name, description, permissions: permissions.split(',').map((value) => value.trim()).filter(Boolean) }), 'Đã tạo vai trò.'); }}>Tạo vai trò</button>
    <div className="policy-grid">{data.map((item) => <article className="policy-card role-card" key={item.id}><div><span className="policy-type">{item.name}</span><span className="policy-version">{item.code}</span></div><p>{item.description || 'Chưa có mô tả vai trò.'}</p><strong className="role-permission-heading">Quyền được cấp · {(item.permissions || []).length}</strong><PermissionPills permissions={item.permissions || []} /><button className="action-review" onClick={() => { const name = window.prompt('Tên vai trò:', item.name); if (name === null) return; const description = window.prompt('Mô tả:', item.description || ''); if (description === null) return; const permissions = window.prompt('Mã quyền, cách nhau bằng dấu phẩy:', item.permissions.join(', ')); if (permissions === null) return; act(updateRole(item.id, { name, description, permissions: permissions.split(',').map((value) => value.trim()).filter(Boolean) }), 'Đã cập nhật vai trò và quyền.'); }}>Chỉnh sửa vai trò</button></article>)}</div>
  </section>;

  if (active === 'auditLogs') return <section className="manager-panel workspace-panel">
    <WorkspaceHeader title="Nhật ký audit" subtitle="Tra cứu các hành động quản trị; bản ghi chỉ đọc." count={data.length} />
    <div className="report-filters"><label>Từ ngày<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label><label>Đến ngày<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label><button onClick={() => { setFrom(''); setTo(''); }}>Xóa lọc</button></div>
    <button className="action-review" onClick={() => { const rows = [['Thoi gian', 'Nguoi thuc hien', 'Email', 'Hanh dong', 'Loai doi tuong', 'ID doi tuong', 'Thay doi'], ...data.map((item) => [item.createdAt, item.actor, item.actorEmail, item.action, item.entityType, item.entityId, JSON.stringify(item.changes)])]; const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join(String.fromCharCode(13, 10)); const url = URL.createObjectURL(new Blob([String.fromCharCode(0xfeff), csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'xedi-audit-logs.csv'; link.click(); URL.revokeObjectURL(url); }}>Xuất CSV</button>
    <div className="requests-table-wrap"><table className="requests-table"><thead><tr><th>THỜI GIAN</th><th>NGƯỜI THỰC HIỆN</th><th>HÀNH ĐỘNG</th><th>ĐỐI TƯỢNG</th><th>THAY ĐỔI</th></tr></thead><tbody>{data.map((item) => <tr key={item.id}><td>{item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '—'}</td><td>{item.actor}<span>{item.actorEmail || ''}</span></td><td><span className="audit-action-pill">{auditActionLabels[item.action] || humanizeField(item.action)}</span></td><td>{humanizeField(item.entityType)}<span className="audit-entity-id">{item.entityId || '—'}</span></td><td><ChangeSummary changes={item.changes} /></td></tr>)}</tbody></table>{!data.length && <p className="manager-empty">Chưa có bản ghi audit.</p>}</div>
  </section>;

  return null;
}
