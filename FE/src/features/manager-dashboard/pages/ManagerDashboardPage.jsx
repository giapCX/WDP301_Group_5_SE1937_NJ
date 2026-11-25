import { useState } from 'react';
import { Link, useLocation, useOutletContext } from 'react-router-dom';
import ManagerIcon from '../components/ManagerIcon';
import ManagerSidebar from '../components/ManagerSidebar';
import ManagerTopbar from '../components/ManagerTopbar';
import useManagerDashboard from '../hooks/useManagerDashboard';
import { RevenueWorkspace } from './ManagerWorkspaces';
import { exportManagerReport } from '../utils/exportManagerReport';
import { monthLabel } from '../utils/managerDashboardFormatters';
import ContractCompanyProfile from '../components/ContractCompanyProfile';
import ResourceWorkspace from '../../management/components/ResourceWorkspace.jsx';
import '../styles/managerDashboard.css';

const CONFIGURATION_VIEWS = new Set(['pricing', 'policies', 'promotions', 'audit', 'contract-profile']);
const VIEW_CONTENT = {
  'contract-profile': { eyebrow: 'THÔNG TIN BÊN VẬN TẢI', title: 'Hồ sơ hợp đồng', description: 'Thông tin đơn vị và Manager đại diện được tự điền vào hợp đồng.' },
  dashboard: { eyebrow: 'TỔNG QUAN DỊCH VỤ', title: 'Tổng quan & Báo cáo', description: 'Theo dõi booking, khoản thu và hoàn tiền trong hệ thống.' },
  revenue: { eyebrow: 'DOANH THU & TÀI CHÍNH', title: 'Doanh thu & Tài chính', description: 'Đối chiếu khoản thu đã thanh toán, booking và hoàn tiền.' },
  pricing: { eyebrow: 'CẤU HÌNH DỊCH VỤ', title: 'Bảng giá dịch vụ', description: 'Quản lý quy tắc giá dịch vụ đã cấu hình trong hệ thống.' },
  policies: { eyebrow: 'CHÍNH SÁCH DỊCH VỤ', title: 'Chính sách dịch vụ', description: 'Quản lý chính sách hủy chuyến và các khoản phụ phí.' },
  promotions: { eyebrow: 'ƯU ĐÃI DỊCH VỤ', title: 'Khuyến mãi', description: 'Tạo và quản lý chương trình ưu đãi cho khách thuê.' },
  audit: { eyebrow: 'KIỂM SOÁT VẬN HÀNH', title: 'Nhật ký hoạt động', description: 'Tra cứu thay đổi cấu hình do các actor thực hiện.' },
};

function ManagerQuickLinks() {
  const links = [
    ['/manager/operation-approvals?tab=cancellations', 'Ngoại lệ hủy chuyến'],
    ['/manager/operation-approvals?tab=incidents', 'Duyệt phương án sự cố'],
    ['/manager/operation-approvals?tab=refunds', 'Duyệt và hoàn tiền mô phỏng'],
    ['/manager/maintenance-approvals', 'Duyệt bảo dưỡng ảnh hưởng an toàn'],
  ];
  return <section className="manager-panel" aria-labelledby="manager-queue-heading">
    <div className="manager-panel-heading"><div><h2 id="manager-queue-heading">Hàng đợi quyết định</h2><p>Chỉ xử lý ngoại lệ cần Manager phê duyệt.</p></div></div>
    <div className="manager-quick-links">{links.map(([href, label]) => <Link className="manager-button manager-button-outline" key={href} to={href}><ManagerIcon name="check" size={15}/>{label}</Link>)}</div>
  </section>;
}

export default function ManagerDashboardPage() {
  const user = useOutletContext();
  const location = useLocation();
  const [notice, setNotice] = useState('');
  const requestedView = location.pathname.split('/').filter(Boolean).at(-1) || 'dashboard';
  const view = VIEW_CONTENT[requestedView] ? requestedView : 'dashboard';
  const isConfigurationView = CONFIGURATION_VIEWS.has(view);
  const dashboard = useManagerDashboard(!isConfigurationView);
  const periodLabel = monthLabel(dashboard.year, dashboard.month);
  const page = VIEW_CONTENT[view];

  return <div className="manager-app">
    <ManagerSidebar />
    <main className="manager-main">
      <ManagerTopbar month={dashboard.month} year={dashboard.year} onMonthChange={dashboard.setMonth} onYearChange={dashboard.setYear}
        onRefresh={dashboard.refresh} user={user} />
      <div className="manager-content" id="manager-overview">
        <section className="manager-page-heading">
          <div><div className="manager-eyebrow"><span/>{page.eyebrow}</div><h1>{page.title}</h1><p>{page.description}</p></div>
          <div className="manager-heading-actions">
            {!isConfigurationView && <><span className="manager-period-chip"><ManagerIcon name="clock" size={14}/>{periodLabel}</span>
              <button className="manager-button manager-button-outline" type="button" disabled={!dashboard.data?.revenueTrend?.length}
                onClick={() => exportManagerReport(dashboard.data.revenueTrend, dashboard.data.period)}><ManagerIcon name="download" size={15}/>Xuất báo cáo</button>
              <button className="manager-button manager-button-primary" type="button" onClick={dashboard.refresh}><ManagerIcon name="refresh" size={15}/>Làm mới</button></>}
          </div>
        </section>
        {dashboard.error && <div className="manager-feedback error" role="alert">{dashboard.error}<button type="button" onClick={dashboard.refresh}>Thử lại</button></div>}
        {notice && <div className="manager-feedback" role="status">{notice}<button type="button" onClick={() => setNotice('')}>Đóng</button></div>}
        {view === 'contract-profile' ? <ContractCompanyProfile/> : isConfigurationView ? <ResourceWorkspace workspace={view} actor="manager" onNotice={setNotice}/> : <>
          {dashboard.loading && !dashboard.data && <div className="manager-loading" role="status"><span/>Đang tải báo cáo…</div>}
          {dashboard.data && <>
            {view === 'dashboard' && <>
              <ManagerQuickLinks />
            </>}
            <RevenueWorkspace data={dashboard.data}/>
          </>}
          {!dashboard.loading && !dashboard.error && !dashboard.data && <div className="manager-feedback" role="status">Chưa có dữ liệu báo cáo.</div>}
        </>}
        <footer className="manager-footer"><span>VietTour Mobility · Điều hành dịch vụ</span><span>Dữ liệu tổng hợp từ booking và thanh toán</span></footer>
      </div>
    </main>
  </div>;
}
