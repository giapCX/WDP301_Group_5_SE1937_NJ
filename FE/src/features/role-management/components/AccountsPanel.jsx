import { useMemo, useState } from 'react';
import { ACCOUNT_FILTERS } from '../accessControlConfig';
import AccessControlIcon from './AccessControlIcon';
import { exportAccountsCsv } from '../utils/accessControlExport';

export default function AccountsPanel({ accounts, onViewAll }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(ACCOUNT_FILTERS[0]);
  const filteredAccounts = useMemo(() => accounts.filter((account) => {
    const normalizedTerm = searchTerm.trim().toLocaleLowerCase('vi');
    const matchesText = !normalizedTerm || `${account.name} ${account.email} ${account.role}`.toLocaleLowerCase('vi').includes(normalizedTerm);
    return matchesText && (statusFilter === ACCOUNT_FILTERS[0] || account.status === statusFilter);
  }), [accounts, searchTerm, statusFilter]);

  return (
    <article className="acl-panel users-panel">
      <div className="bottom-panel-heading"><div><h2>Tài khoản nhân sự</h2><p>Tài khoản trong dữ liệu xem trước</p></div><button type="button" className="text-link" onClick={onViewAll}>Xem tất cả <AccessControlIcon name="chevron" size={13}/></button></div>
      <div className="user-controls">
        <label className="acl-search"><AccessControlIcon name="search" size={15}/><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm tên, email..." aria-label="Tìm tài khoản"/></label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Lọc trạng thái">{ACCOUNT_FILTERS.map((filter) => <option key={filter}>{filter}</option>)}</select>
      </div>
      <div className="people-table-wrap">
        <table className="people-table"><thead><tr><th>NHÂN SỰ</th><th>VAI TRÒ</th><th>TRẠNG THÁI</th><th>HOẠT ĐỘNG</th><th/></tr></thead>
          <tbody>{filteredAccounts.map((account) => <tr key={account.email}>
            <td><div className="person-cell"><span className={`person-avatar ${account.tone}`}>{account.initials}</span><span><b>{account.name}</b><small>{account.email}</small></span></div></td>
            <td><span className="person-role">{account.role}</span></td>
            <td><span className={`status-pill ${account.status === 'Hoạt động' ? 'status-active' : 'status-pending'}`}><i/>{account.status}</span></td>
            <td className="last-active">{account.lastActivity}</td>
            <td><button type="button" className="icon-tool" aria-label={`Tùy chọn ${account.name}`}><AccessControlIcon name="more" size={17}/></button></td>
          </tr>)}</tbody>
        </table>
        {filteredAccounts.length === 0 && <div className="empty-users">Không tìm thấy tài khoản phù hợp.</div>}
      </div>
      <button className="export-users-link" type="button" onClick={() => exportAccountsCsv(filteredAccounts)}><AccessControlIcon name="download" size={13}/> Xuất danh sách đang lọc</button>
    </article>
  );
}
