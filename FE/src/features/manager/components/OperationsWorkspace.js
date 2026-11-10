import Pagination from "../../../components/ui/Pagination";
import IncidentReviewCard from './IncidentReviewCard';
import { useState } from 'react';
import useManagerActions from '../hooks/useManagerActions';
import useManagerCollection from '../hooks/useManagerCollection';
import { DataFields, humanizeField } from './dataDisplay';
const formatMoney = (amount) => new Intl.NumberFormat('vi-VN').format(amount);
const requestStatus = (status) => ({ submitted: 'Chờ duyệt', pending_review: 'Chờ duyệt', reported: 'Mới tiếp nhận', open: 'Mới tiếp nhận', investigating: 'Đang xem xét', awaiting_response: 'Chờ phản hồi', pending_manager: 'Chờ Manager quyết định' }[status] || status);

export default function OperationsWorkspace({ active, onNotice }) {
  const request = useManagerCollection(active);
  const {
    createStaff,
    reviewCompensation,
    reviewIncident,
    reviewTrafficViolation,
    updatePolicy,
    updateStaff
  } = useManagerActions();
  const [actionError, setActionError] = useState('');
  const data = [request.data];
  const {
    loading
  } = request;
  const error = actionError || request.error;
  const refresh = () => {
    setActionError('');
    request.refresh();
  };
  const act = async (promise, successText) => {
    try {
      await promise;
      onNotice(successText);
      refresh();
    } catch (reason) {
      setActionError(reason.message || 'Không thể cập nhật dữ liệu.');
    }
  };
  const [primary] = data;
  if (loading) return <section className="manager-panel workspace-panel"><p className="manager-empty">Đang tải dữ liệu…</p><Pagination {...request.paging} /></section>;
  if (error) return <section className="manager-panel workspace-panel"><div className="manager-notice manager-error">{error}<button onClick={refresh}>Thử lại</button></div><Pagination {...request.paging} /></section>;
  if (active === 'incidents') return <section className="manager-panel workspace-panel"><WorkspaceHeader title="Khiếu nại & sự cố" subtitle="Garage ghi nhận; Operation xác minh; Manager quyết định." count={request.paging?.total ?? primary?.length ?? 0} />
    <div className="incident-list">{(primary || []).map(item => <IncidentReviewCard key={item.id} item={item} act={act} reviewCompensation={reviewCompensation} reviewIncident={reviewIncident} />)}{!primary?.length && <p className="manager-empty">Không có sự cố đang mở.</p>}</div>
  <Pagination {...request.paging} /></section>;
  if (active === 'policies') return <section className="manager-panel workspace-panel"><WorkspaceHeader title="Chính sách nền tảng" subtitle="Cập nhật chính sách sẽ tạo phiên bản mới và lưu lịch sử thay đổi." count={request.paging?.total ?? primary?.length ?? 0} />
    <div className="policy-grid">{(primary || []).map(item => <article className="policy-card" key={item.id}><div><span className="policy-type">{humanizeField(item.type)}</span><span className="policy-version">Đang áp dụng · phiên bản {item.version}</span></div><DataFields data={item.config} /><button className="action-review" onClick={() => {
          const raw = window.prompt('Cấu hình chính sách dạng JSON:', JSON.stringify(item.config, null, 2));
          if (!raw) return;
          try {
            const config = JSON.parse(raw);
            act(updatePolicy(item.type, {
              config
            }), 'Đã tạo phiên bản chính sách mới.');
          } catch {
            setActionError('Cấu hình phải là JSON hợp lệ.');
          }
        }}>Chỉnh sửa chính sách</button></article>)}</div>
  <Pagination {...request.paging} /></section>;
  if (active === 'staff') return <section className="manager-panel workspace-panel"><WorkspaceHeader title="Quản lý nhân sự" subtitle="Quản lý hồ sơ, phạm vi công việc, vai trò và trạng thái nhân viên vận hành/gara." count={request.paging?.total ?? primary?.length ?? 0} />
    <button className="action-approve" onClick={() => {
      const name = window.prompt('Họ tên nhân viên:');
      if (!name) return;
      const email = window.prompt('Email:');
      if (!email) return;
      const password = window.prompt('Mật khẩu ban đầu (ít nhất 8 ký tự):');
      if (!password) return;
      const role = window.prompt('Vai trò: OPERATION_STAFF hoặc GARAGE_STAFF', 'OPERATION_STAFF');
      if (!role) return;
      const phone = window.prompt('Số điện thoại:', '') ?? '';
      const department = window.prompt('Bộ phận:', '') ?? '';
      const jobTitle = window.prompt('Chức danh:', '') ?? '';
      const workScope = window.prompt('Phạm vi công việc:', '') ?? '';
      act(createStaff({
        name,
        email,
        password,
        role,
        phone,
        department,
        jobTitle,
        workScope
      }), 'Đã tạo nhân viên.');
    }}>Thêm nhân viên</button>
    <div className="requests-table-wrap"><table className="requests-table"><thead><tr><th>NHÂN SỰ</th><th>LIÊN HỆ / HỒ SƠ</th><th>VAI TRÒ</th><th>TRẠNG THÁI</th><th>HỒ SƠ</th></tr></thead><tbody>{(primary || []).map(item => <tr key={item.id}><td><strong>{item.name}</strong><span>{item.email}</span></td><td>{item.phone || '—'}<span>{item.department} · {item.jobTitle}</span><span>{item.workScope}</span></td><td><select className="workspace-select" value={item.role} onChange={event => act(updateStaff(item.id, {
                role: event.target.value
              }), 'Đã cập nhật vai trò nhân sự.')}><option value="OPERATION_STAFF">Nhân viên vận hành</option><option value="GARAGE_STAFF">Nhân viên gara</option></select></td><td><select className="workspace-select" value={item.status === 'active' ? 'active' : 'suspended'} onChange={event => act(updateStaff(item.id, {
                status: event.target.value
              }), 'Đã cập nhật trạng thái tài khoản.')}><option value="active">Đang hoạt động</option><option value="suspended">Tạm khóa</option></select></td><td><button className="action-review" onClick={() => {
                const name = window.prompt('Họ tên:', item.name);
                if (name === null) return;
                const phone = window.prompt('Số điện thoại:', item.phone || '');
                if (phone === null) return;
                const department = window.prompt('Bộ phận:', item.department || '');
                if (department === null) return;
                const jobTitle = window.prompt('Chức danh:', item.jobTitle || '');
                if (jobTitle === null) return;
                const workScope = window.prompt('Phạm vi công việc:', item.workScope || '');
                if (workScope === null) return;
                act(updateStaff(item.id, {
                  name,
                  phone,
                  department,
                  jobTitle,
                  workScope
                }), 'Đã cập nhật hồ sơ nhân sự.');
              }}>Sửa hồ sơ</button></td></tr>)}</tbody></table>{!primary?.length && <p className="manager-empty">Chưa có hồ sơ nhân sự.</p>}</div>
  <Pagination {...request.paging} /></section>;
  return null;
}
function WorkspaceHeader({
  title,
  subtitle,
  count
}) {
  return <div className="workspace-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{count !== undefined && <span className="workspace-count">{count} hồ sơ</span>}</div>;
}
