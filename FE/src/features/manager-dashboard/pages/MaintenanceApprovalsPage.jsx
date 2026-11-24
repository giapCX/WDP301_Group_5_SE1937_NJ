import { useState } from 'react';
import useHomeResource from '../../home/hooks/useHomeResource';
import { fetchMaintenanceApprovals } from '../api/maintenanceApprovalApi';
import MaintenanceApprovalCard from '../components/MaintenanceApprovalCard';
import ManagerSidebar from '../components/ManagerSidebar';
import { MAINTENANCE_APPROVALS_PATH } from '../managerDashboardConfig';
import '../styles/managerDashboard.css';
import '../styles/maintenanceApprovals.css';

export default function MaintenanceApprovalsPage() {
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState('');
  const { data, loading, error } = useHomeResource(fetchMaintenanceApprovals, revision);
  const refresh = () => setRevision((value) => value + 1);

  function onDecision(decision) {
    setMessage(decision === 'approve' ? 'Đã duyệt hoàn tất phiếu bảo dưỡng.' : 'Đã trả phiếu về Gara.');
    refresh();
  }

  return (
    <div className="manager-app">
      <ManagerSidebar activeHref={MAINTENANCE_APPROVALS_PATH} />
      <main className="manager-main">
        <div className="manager-content">
          <header className="manager-page-heading">
            <h1>Duyệt phiếu bảo dưỡng</h1>
            <button className="manager-button manager-button-outline" onClick={refresh}>Làm mới</button>
          </header>
          {message && <p className="manager-feedback" role="status">{message}</p>}
          {loading && <p className="manager-feedback" role="status">Đang tải phiếu chờ duyệt…</p>}
          {error && <p className="manager-feedback error" role="alert">{error.response?.data?.message || 'Không tải được phiếu chờ duyệt.'}</p>}
          {data?.length === 0 && <p className="manager-feedback">Không có phiếu chờ duyệt.</p>}
          <div className="manager-maintenance-list">
            {data?.map((record) => <MaintenanceApprovalCard key={record.maintenance_id} record={record} onDecision={onDecision} />)}
          </div>
        </div>
      </main>
    </div>
  );
}
