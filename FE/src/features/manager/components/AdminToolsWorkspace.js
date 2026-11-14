import Pagination from "../../../components/ui/Pagination";
import { useState } from 'react';
import useManagerActions from '../hooks/useManagerActions';
import useManagerCollection from '../hooks/useManagerCollection';
import { ChangeSummary, humanizeField } from './dataDisplay';
function WorkspaceHeader({
  title,
  subtitle,
  count
}) {
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
  'report.generated': 'Tạo báo cáo'
};
const dateInput = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const permissionLabels = {
  'vehicle.register': 'Đăng ký phương tiện', 'vehicle.inspect': 'Kiểm định phương tiện',
  'vehicle.intake': 'Tiếp nhận phương tiện', 'handover.record': 'Ghi nhận bàn giao',
  'case.report': 'Báo cáo sự cố', 'incident.review': 'Điều tra sự cố',
  'report.view': 'Xem báo cáo', 'booking.review': 'Duyệt đặt xe',
  'listing.review': 'Duyệt tin đăng', 'contract.manage': 'Quản lý hợp đồng'
};
export default function AdminToolsWorkspace({
  active,
  onNotice
}) {
  const [from, setFrom] = useState(() => {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return dateInput(start);
  });
  const [to, setTo] = useState(() => dateInput(new Date()));
  const request = useManagerCollection(active, active === 'auditLogs' ? {
    from,
    to,
    limit: 100
  } : {});
  const { updateRole } = useManagerActions();
  const [actionError, setActionError] = useState('');
  const data = request.data;
  const {
    loading
  } = request;
  const error = actionError || request.error;
  const refresh = () => {
    setActionError('');
    request.refresh();
  };
  const act = async (promise, message) => {
    try {
      await promise;
      onNotice(message);
      refresh();
    } catch (reason) {
      setActionError(reason.message || 'Không thể cập nhật dữ liệu.');
    }
  };
  if (loading) return <section className="manager-panel workspace-panel"><p className="manager-empty">Đang tải dữ liệu…</p><Pagination {...request.paging} /></section>;
  if (error) return <section className="manager-panel workspace-panel"><div className="manager-notice manager-error">{error}<button onClick={refresh}>Thử lại</button></div><Pagination {...request.paging} /></section>;
  if (active === 'roles') {
    const editableRoles = data.filter(role => role.code !== 'ADMIN' && !/(viewer|lead|profile|audit|finance)/i.test(`${role.code} ${role.name}`));
    const permissionCodes = [...new Set(editableRoles.flatMap(role => role.permissions || []))].sort();
    const togglePermission = (role, permission) => {
      const permissions = role.permissions || [];
      const next = permissions.includes(permission) ? permissions.filter(value => value !== permission) : [...permissions, permission];
      act(updateRole(role.id, { permissions: next }), `Đã cập nhật quyền ${role.name}.`);
    };
    return <section className="manager-panel workspace-panel">
    <WorkspaceHeader title="Ma trận phân quyền" subtitle="Đánh dấu X cho quyền của từng vai trò. Chọn ô để cập nhật quyền." count={editableRoles.length} />
    <div className="requests-table-wrap permission-matrix-wrap"><table className="requests-table permission-matrix"><thead><tr><th>CHỨC NĂNG</th>{editableRoles.map(role => <th key={role.id} title={role.code}>{role.name}</th>)}</tr></thead><tbody>{permissionCodes.map(permission => <tr key={permission}><th scope="row">{permissionLabels[permission] || humanizeField(permission)}<span>{permission}</span></th>{editableRoles.map(role => <td key={role.id}><button type="button" className={`permission-toggle ${(role.permissions || []).includes(permission) ? 'is-enabled' : ''}`} aria-label={`${(role.permissions || []).includes(permission) ? 'Tắt' : 'Bật'} ${permission} cho ${role.name}`} aria-pressed={(role.permissions || []).includes(permission)} onClick={() => togglePermission(role, permission)}>{(role.permissions || []).includes(permission) ? 'X' : ''}</button></td>)}</tr>)}</tbody></table>{!permissionCodes.length && <p className="manager-empty">Chưa có quyền nào được cấu hình.</p>}</div>
  <Pagination {...request.paging} /></section>;
  }
  if (active === 'auditLogs') return <section className="manager-panel workspace-panel">
    <WorkspaceHeader title="Nhật ký audit" subtitle="Tra cứu các hành động quản trị; bản ghi chỉ đọc." count={request.paging?.total ?? data.length} />
    <div className="report-filters"><label>Từ ngày<input type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} /></label><label>Đến ngày<input type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} /></label><button onClick={() => {
        setFrom('');
        setTo('');
      }}>Xóa lọc</button></div>
    <button className="action-review" onClick={() => {
      const rows = [['Thoi gian', 'Nguoi thuc hien', 'Email', 'Hanh dong', 'Loai doi tuong', 'ID doi tuong', 'Thay doi'], ...data.map(item => [item.createdAt, item.actor, item.actorEmail, item.action, item.entityType, item.entityId, JSON.stringify(item.changes)])];
      const csv = rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join(String.fromCharCode(13, 10));
      const url = URL.createObjectURL(new Blob([String.fromCharCode(0xfeff), csv], {
        type: 'text/csv;charset=utf-8'
      }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'xedi-audit-logs.csv';
      link.click();
      URL.revokeObjectURL(url);
    }}>Xuất CSV trang này</button>
    <div className="requests-table-wrap"><table className="requests-table"><thead><tr><th>THỜI GIAN</th><th>NGƯỜI THỰC HIỆN</th><th>HÀNH ĐỘNG</th><th>ĐỐI TƯỢNG</th><th>THAY ĐỔI</th></tr></thead><tbody>{data.map(item => <tr key={item.id}><td>{item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '—'}</td><td>{item.actor}<span>{item.actorEmail || ''}</span></td><td><span className="audit-action-pill">{auditActionLabels[item.action] || humanizeField(item.action)}</span></td><td>{humanizeField(item.entityType)}<span className="audit-entity-id">{item.entityId || '—'}</span></td><td><ChangeSummary changes={item.changes} /></td></tr>)}</tbody></table>{!data.length && <p className="manager-empty">Chưa có bản ghi audit.</p>}</div>
  <Pagination {...request.paging} /></section>;
  return null;
}
