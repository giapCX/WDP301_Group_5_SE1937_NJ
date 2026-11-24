import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import SignOutButton from '../../auth/components/SignOutButton.js';
import AccessControlIcon from '../components/AccessControlIcon';
import AccessControlMetrics from '../components/AccessControlMetrics';
import AccountsPanel from '../components/AccountsPanel';
import AddRoleDialog from '../components/AddRoleDialog';
import AdminSidebar from '../components/AdminSidebar';
import AuditPanel from '../components/AuditPanel';
import PermissionMatrix from '../components/PermissionMatrix';
import useAccessControl from '../hooks/useAccessControl';
import { exportAccountsCsv } from '../utils/accessControlExport';
import '../styles/accessControl.css';

export default function RolePermissionManagementPage() {
  const user = useOutletContext();
  const [activeNavigation, setActiveNavigation] = useState('Quản lý vai trò & quyền');
  const [activeTab, setActiveTab] = useState('Ma trận phân quyền');
  const [isRoleDialogOpen, setRoleDialogOpen] = useState(false);
  const accessControl = useAccessControl();

  return (
    <div className="acl-app" id="top">
      <AdminSidebar activeItem={activeNavigation} onNavigate={setActiveNavigation}/>
      <main className="acl-main">
        <header className="acl-topbar">
          <div className="acl-breadcrumb"><span>Quản trị</span><AccessControlIcon name="chevron" size={13}/><b>{activeNavigation}</b></div>
          <div className="acl-top-actions">
            <span className="system-status"><i/> Chế độ xem trước</span>
            <button className="top-icon-button" type="button" aria-label="Thông báo"><AccessControlIcon name="bell" size={18}/><i/></button>
            <span className="top-divider"/>
            <div className="profile-button"><span className="profile-avatar">{user?.full_name?.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '--'}</span><span><b>{user?.full_name || 'Tài khoản quản trị'}</b><small>{user?.role_name || 'Quản trị viên'}</small></span></div>
            <SignOutButton />
          </div>
        </header>

        <div className="acl-content">
          <section className="acl-page-heading">
            <div className="heading-copy">
              <div className="eyebrow"><span/> TRUNG TÂM QUẢN TRỊ</div>
              <h1>Quản trị hệ thống <span>&amp;</span> Ma trận phân quyền</h1>
              <p>Kiểm soát tài khoản, vai trò và quyền truy cập trong hệ thống VietTour.</p>
            </div>
            <div className="heading-actions">
              <button className="button button-outline" type="button" onClick={() => exportAccountsCsv(accessControl.accounts)}><AccessControlIcon name="download" size={16}/> Xuất báo cáo</button>
              <button className="button button-light" type="button" onClick={() => setRoleDialogOpen(true)}><AccessControlIcon name="plus" size={16}/> Thêm vai trò mới</button>
              <button className="button button-primary" type="button" onClick={accessControl.saveMatrix}><AccessControlIcon name="check" size={16}/> Lưu thay đổi</button>
            </div>
          </section>

          <AccessControlMetrics accounts={accessControl.accounts} roles={accessControl.roles} matrix={accessControl.matrix}/>
          <PermissionMatrix
            activeTab={activeTab}
            matrix={accessControl.matrix}
            onToggle={accessControl.togglePermission}
            onTabChange={setActiveTab}
            onNotice={accessControl.setToast}
            roles={accessControl.roles}
          />
          <section className="acl-bottom-grid">
            <AccountsPanel accounts={accessControl.accounts} onViewAll={() => setActiveNavigation('Quản lý người dùng')}/>
            <AuditPanel events={accessControl.auditEvents} onViewAll={() => accessControl.setToast('Nhật ký kiểm toán là dữ liệu mẫu')}/>
          </section>
          <footer className="acl-footer"><span>VietTour · Không gian quản trị bản xem trước</span><span><i/> Dữ liệu mẫu, chưa kết nối RBAC API <b>·</b> v1.0</span></footer>
        </div>
      </main>

      {isRoleDialogOpen && <AddRoleDialog onClose={() => setRoleDialogOpen(false)} onSubmit={accessControl.addRole}/>}
      {accessControl.toast && <div className="acl-toast" role="status"><span><AccessControlIcon name="check" size={15}/></span>{accessControl.toast}<button type="button" aria-label="Đóng thông báo" onClick={() => accessControl.setToast('')}>×</button></div>}
    </div>
  );
}
