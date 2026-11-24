import { useMemo, useState } from 'react';
import { ACCOUNT_FILTERS } from '../accessControlConfig';
import AccessControlIcon from './AccessControlIcon';
import CreateAccountDialog from './CreateAccountDialog';
import { exportAccountsCsv } from '../utils/accessControlExport';

export default function AccountsPanel({ accounts, roles, onViewAll, onCreate, onToggleStatus }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(ACCOUNT_FILTERS[0]);
  const [creating, setCreating] = useState(false);
  const filteredAccounts = useMemo(() => accounts.filter((account) => {
    const normalizedTerm = searchTerm.trim().toLocaleLowerCase('vi');
    const matchesText = !normalizedTerm || `${account.name} ${account.email} ${account.role}`.toLocaleLowerCase('vi').includes(normalizedTerm);
    return matchesText && (statusFilter === ACCOUNT_FILTERS[0] || account.status === statusFilter);
  }), [accounts, searchTerm, statusFilter]);

  return (
    <article className="acl-panel users-panel">
      <div className="bottom-panel-heading"><div><h2>Tài khoản nhân sự</h2><p>Danh sách nhân viên trong hệ thống</p></div><div><button type="button" className="text-link" onClick={() => setCreating(true)}><AccessControlIcon name="plus" size={13}/> Tạo tài khoản</button> <button type="button" className="text-link" onClick={onViewAll}>Xem tất cả <AccessControlIcon name="chevron" size={13}/></button></div></div>
      <div className="user-controls">
        <label className="acl-search"><AccessControlIcon name="search" size={15}/><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm tên, email..." aria-label="Tìm tài khoản"/></label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Lọc trạng thái">{ACCOUNT_FILTERS.map((filter) => <option key={filter}>{filter}</option>)}</select>
      </div>
      <div className="people-table-wrap">
        <table className="people-table"><thead><tr><th>NHÂN SỰ</th><th>VAI TRÒ</th><th>TRẠNG THÁI</th><th>NGÀY TẠO</th><th/></tr></thead>
          <tbody>{filteredAccounts.map((account) => <tr key={account.email}>
            <td><div className="person-cell"><span className={`person-avatar ${account.tone}`}>{account.initials}</span><span><b>{account.name}</b><small>{account.email}</small></span></div></td>
            <td><span className="person-role">{account.role}</span></td>
            <td><span className={`status-pill ${account.status === 'Hoạt động' ? 'status-active' : 'status-pending'}`}><i/>{account.status}</span></td>
            <td className="last-active">{account.createdAt || '—'}</td>
            <td><button type="button" className="icon-tool" aria-label={account.status === 'Hoạt động' ? `Khóa ${account.name}` : `Mở khóa ${account.name}`} title={account.status === 'Hoạt động' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'} onClick={() => onToggleStatus(account)}><AccessControlIcon name={account.status === 'Hoạt động' ? 'lock' : 'check'} size={17}/></button></td>
          </tr>)}</tbody>
        </table>
        {filteredAccounts.length === 0 && <div className="empty-users">Không tìm thấy tài khoản phù hợp.</div>}
      </div>
      <button className="export-users-link" type="button" onClick={() => exportAccountsCsv(filteredAccounts)}><AccessControlIcon name="download" size={13}/> Xuất danh sách đang lọc</button>
      {creating && <CreateAccountDialog roles={roles} onClose={() => setCreating(false)} onSubmit={onCreate}/>}
    </article>
  );
}
