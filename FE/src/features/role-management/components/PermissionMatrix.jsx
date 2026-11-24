import { Fragment } from 'react';
import { ACCESS_TABS, PERMISSION_GROUPS } from '../accessControlConfig';
import AccessControlIcon from './AccessControlIcon';

function RoleSummary({ roles, matrix }) {
  return (
    <div className="role-card-grid">
      {roles.map((role) => {
        const grantedCount = Object.values(matrix).filter((rolePermissions) => rolePermissions[role.id]).length;
        return <article className="role-card" key={role.id}>
          <span className={`role-avatar ${role.color}`}>{role.short}</span>
          <div><b>{role.name}</b><small>{grantedCount} quyền được cấp</small></div>
          <button type="button" className="icon-tool" aria-label={`Tùy chọn ${role.name}`}><AccessControlIcon name="more" size={18}/></button>
        </article>;
      })}
    </div>
  );
}

function PermissionRows({ roles, matrix, onToggle }) {
  return <div className="matrix-scroll">
    <table className="permission-table">
      <thead><tr><th className="permission-label">CHỨC NĂNG &amp; QUYỀN</th>{roles.map((role) => <th key={role.id}><div className="role-column"><span className={`role-avatar ${role.color}`}>{role.short}</span><span>{role.name}</span></div></th>)}</tr></thead>
      <tbody>{PERMISSION_GROUPS.map((group) => <Fragment key={group.id}>
        <tr className="permission-group"><td colSpan={roles.length + 1}>{group.title}</td></tr>
        {group.permissions.map((permission) => <tr className="permission-row" key={permission.id}>
          <td className="permission-name"><span className="permission-bullet"/>{permission.label}</td>
          {roles.map((role) => <td key={role.id}><button type="button" disabled={role.role_name === 'admin'} className={`permission-toggle ${matrix[permission.id]?.[role.id] ? 'is-checked' : ''}`} aria-label={`${matrix[permission.id]?.[role.id] ? 'Thu hồi' : 'Cấp'} quyền ${permission.label} cho ${role.name}`} aria-pressed={Boolean(matrix[permission.id]?.[role.id])} onClick={() => onToggle(permission.id, role.id)}>{matrix[permission.id]?.[role.id] && <AccessControlIcon name="check" size={12}/>}</button></td>)}
        </tr>)}
      </Fragment>)}</tbody>
    </table>
  </div>;
}

export default function PermissionMatrix({ activeTab, matrix, onToggle, onTabChange, roles, onNotice }) {
  const assignedCount = Object.values(matrix).reduce((total, rolePermissions) => total + Object.values(rolePermissions).filter(Boolean).length, 0);
  return (
    <section className="acl-panel matrix-panel">
      <div className="panel-heading">
        <div><h2>Ma trận phân quyền <span className="heading-tag">RBAC</span></h2><p>Quản lý quyền truy cập theo vai trò trong hệ thống</p></div>
        <button type="button" className="subtle-action" onClick={() => onNotice('Ma trận quyền lấy từ dữ liệu vai trò trên hệ thống.')}>
          Dữ liệu <b>hệ thống</b> <span className="sync-dot"/>
        </button>
      </div>
      <div className="matrix-toolbar">
        <div className="acl-tabs" role="tablist" aria-label="Phân hệ quản trị">
          {ACCESS_TABS.map((tab) => <button type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'selected' : ''} key={tab} onClick={() => onTabChange(tab)}>{tab}</button>)}
        </div>
        <div className="matrix-tools"><span className="role-count">{roles.length} vai trò · {assignedCount} quyền</span><button type="button" className="icon-tool" aria-label="Tùy chọn ma trận" onClick={() => onNotice('Ma trận đang hiển thị tất cả nhóm quyền')}><AccessControlIcon name="more" size={18}/></button></div>
      </div>
      {activeTab === ACCESS_TABS[0] ? <PermissionRows roles={roles} matrix={matrix} onToggle={onToggle}/> : <RoleSummary roles={roles} matrix={matrix}/>}
      <div className="matrix-legend"><span><i className="legend-checked"/> Được cấp quyền</span><span><i className="legend-unchecked"/> Chưa cấp</span><span className="legend-note"><AccessControlIcon name="lock" size={13}/> Quyền được lưu trên máy chủ</span></div>
    </section>
  );
}
