import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import SignOutButton from '../../auth/components/SignOutButton.js';
import AccessControlIcon from '../components/AccessControlIcon';
import AccessControlMetrics from '../components/AccessControlMetrics';
import AccountsPanel from '../components/AccountsPanel';
import AdminSidebar from '../components/AdminSidebar';
import PermissionMatrix from '../components/PermissionMatrix';
import useAccessControl from '../hooks/useAccessControl';
import { ADMIN_NAVIGATION } from '../accessControlConfig';
import { exportAccountsCsv } from '../utils/accessControlExport';
import ResourceWorkspace from '../../management/components/ResourceWorkspace.jsx';
import '../styles/accessControl.css';

export default function RolePermissionManagementPage() {
  const user = useOutletContext();
  const [activeNavigation, setActiveNavigation] = useState('dashboard');
  const [activeTab, setActiveTab] = useState('Ma trận phân quyền');
  const accessControl = useAccessControl();
  const activeLabel = ADMIN_NAVIGATION.find((item) => item.workspace === activeNavigation)?.label || 'Tổng quan';

  return (
    <div className="acl-app" id="top">
      <AdminSidebar activeItem={activeNavigation} onNavigate={setActiveNavigation}/>
      <main className="acl-main">
        <header className="acl-topbar">
          <div className="acl-breadcrumb"><span>Quản trị</span><AccessControlIcon name="chevron" size={13}/><b>{activeLabel}</b></div>
          <div className="acl-top-actions">
            <span className="system-status"><i/> Kết nối dữ liệu hệ thống</span>
            <button className="top-icon-button" type="button" aria-label="Thông báo"><AccessControlIcon name="bell" size={18}/><i/></button>
            <span className="top-divider"/>
            <span className="profile-button"><span className="profile-avatar">{user?.full_name?.slice(0, 1) || 'A'}</span><span><b>{user?.full_name || 'Quản trị viên'}</b><small>{user?.role_name || 'admin'}</small></span></span>
            <SignOutButton />
          </div>
        </header>

        <div className="acl-content">
          <section className="acl-page-heading">
            <div className="heading-copy">
              <div className="eyebrow"><span/> TRUNG TÂM QUẢN TRỊ</div>
              <h1>{activeLabel}</h1>
          <p>Admin quản lý tài khoản nhân sự và quyền truy cập. Booking, thanh toán, điều phối và bảo dưỡng được xử lý trong phân hệ actor tương ứng.</p>
            </div>
            <div className="heading-actions">
              {activeNavigation === 'dashboard' && <button className="button button-outline" type="button" onClick={() => exportAccountsCsv(accessControl.accounts)}><AccessControlIcon name="download" size={16}/> Xuất tài khoản</button>}
              {activeNavigation === 'permissions' && <button className="button button-primary" type="button" onClick={accessControl.saveMatrix}><AccessControlIcon name="check" size={16}/> Lưu thay đổi</button>}
            </div>
          </section>

          {accessControl.error && <div className="acl-feedback" role="alert">{accessControl.error}<button type="button" onClick={accessControl.refresh}>Thử lại</button></div>}
          {accessControl.loading && <p role="status" className="resource-loading">Đang tải dữ liệu quản trị…</p>}
          {!accessControl.loading && activeNavigation === 'dashboard' && <>
            <AccessControlMetrics accounts={accessControl.accounts} roles={accessControl.roles} matrix={accessControl.matrix}/>
            <AccountsPanel accounts={accessControl.accounts} roles={accessControl.roles} onViewAll={() => setActiveNavigation('users')} onCreate={accessControl.createAccount} onToggleStatus={accessControl.toggleAccountStatus}/>
          </>}
          {!accessControl.loading && activeNavigation === 'permissions' && <PermissionMatrix
            activeTab={activeTab}
            matrix={accessControl.matrix}
            onToggle={accessControl.togglePermission}
            onTabChange={setActiveTab}
            onNotice={accessControl.setToast}
            roles={accessControl.roles}
          />}
          {!accessControl.loading && activeNavigation === 'users' && <ResourceWorkspace workspace="users" onNotice={accessControl.setToast}/>}
          <footer className="acl-footer"><span>VietTour · Không gian quản trị</span><span><i/> Dữ liệu từ hệ thống <b>·</b> v1.0</span></footer>
        </div>
      </main>

      {accessControl.toast && <div className="acl-toast" role="status"><span><AccessControlIcon name="check" size={15}/></span>{accessControl.toast}<button type="button" aria-label="Đóng thông báo" onClick={() => accessControl.setToast('')}>×</button></div>}
    </div>
  );
}
