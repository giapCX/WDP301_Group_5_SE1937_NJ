import Pagination from "../../../components/ui/Pagination";
import { useState } from 'react';
import { getBlobApi } from '../../../services/httpClient';
import useManagerActions from '../hooks/useManagerActions';
import useManagerCollection from '../hooks/useManagerCollection';
import InspectionReviewDetails from './InspectionReviewDetails';
import './VehicleApprovalsWorkspace.css';
const statusText = {
  submitted: 'Mới gửi',
  pending_review: 'Chờ xét duyệt',
  revision_required: 'Chờ bổ sung'
};
const inspectionText = {
  draft: 'Garage đang lập nháp',
  approved: 'Đã được Manager duyệt',
  pending: 'Garage đã gửi - chờ Manager duyệt',
  revision_required: 'Cần kiểm định lại',
  rejected: 'Không đạt'
};
function DocumentCard({ title, document, onOpen }) {
  const verified = Boolean(document?.verified);
  return <div className={`vehicle-document-card ${verified ? 'is-verified' : 'is-pending'}`}>
    <span className="vehicle-document-icon" aria-hidden="true">{verified ? '✓' : '!'}</span>
    <span><strong>{title}</strong><small>{verified ? 'Đã xác minh' : 'Chưa xác minh'}</small>{document?.file_key && <button className="manager-inline-button" onClick={onOpen}>Mở tài liệu</button>}</span>
  </div>;
}
export default function VehicleApprovalsWorkspace({
  onNotice
}) {
  const request = useManagerCollection('vehicles');
  const {
    reviewVehicle
  } = useManagerActions();
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState('');
  const vehicles = request.data;
  const loading = request.loading;
  const error = actionError || request.error;
  const refresh = () => {
    setActionError('');
    request.refresh();
  };
  const openDocument = async (vehicle, kind) => {
    setActionError('');
    try {
      const blob = await getBlobApi(`/manager/vehicles/${vehicle.id}/documents/${kind}`);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (reason) { setActionError(reason.message || 'Không thể tải tài liệu private.'); }
  };
  const act = async (vehicle, action, note) => {
    setBusyId(vehicle.id);
    setActionError('');
    try {
      await reviewVehicle(vehicle.id, {
        action,
        note,
        inspectionId: vehicle.inspection?.id ?? null,
        inspectionVersion: vehicle.inspection?.version ?? null
      });
      onNotice(action === 'approve' ? 'Đã duyệt hồ sơ xe.' : action === 'revision' ? 'Đã gửi yêu cầu bổ sung cho chủ xe.' : 'Đã từ chối hồ sơ xe.');
      refresh();
    } catch (reason) {
      setActionError(reason.message || 'Không thể cập nhật hồ sơ xe.');
    } finally {
      setBusyId('');
    }
  };
  const requestAdditionalInfo = vehicle => {
    const note = window.prompt(`Nêu rõ hồ sơ cần bổ sung cho ${vehicle.brand} ${vehicle.model} (${vehicle.licensePlate}):`);
    if (note === null) return;
    const trimmed = note.trim();
    if (trimmed.length < 5) {
      setActionError('Nội dung yêu cầu bổ sung cần ít nhất 5 ký tự để chủ xe biết cần chỉnh sửa gì.');
      return;
    }
    if (trimmed.length > 1000) {
      setActionError('Nội dung yêu cầu bổ sung không được vượt quá 1.000 ký tự.');
      return;
    }
    act(vehicle, 'revision', trimmed);
  };
  const rejectApplication = vehicle => {
    const note = window.prompt(`Lý do từ chối hồ sơ ${vehicle.licensePlate}:`);
    if (note === null) return;
    const trimmed = note.trim();
    if (trimmed.length < 5) {
      setActionError('Lý do từ chối cần ít nhất 5 ký tự.');
      return;
    }
    act(vehicle, 'reject', trimmed);
  };
  if (loading) return <section className="manager-panel workspace-panel"><p className="manager-empty">Đang tải hồ sơ xe…</p><Pagination {...request.paging} /></section>;
  if (error && !vehicles.length) return <section className="manager-panel workspace-panel"><div className="manager-notice manager-error">{error}<button onClick={refresh}>Thử lại</button></div><Pagination {...request.paging} /></section>;
  return <section className="manager-panel workspace-panel">
    <div className="workspace-header"><div><h2>Hồ sơ phương tiện chờ duyệt</h2><p>Mỗi hồ sơ được trình bày riêng để kiểm tra thông tin, giấy tờ và biên bản kiểm định.</p></div><span className="workspace-count">{vehicles.length} hồ sơ</span></div>
    {error && <div className="manager-notice manager-error" role="alert">{error}<button onClick={() => setActionError('')} aria-label="Đóng">×</button></div>}
    <div className="vehicle-approval-list">{vehicles.map(vehicle => {
        const canDecide = !vehicle.inspection || ['pending', 'approved'].includes(vehicle.inspection.status);
        const ownerReviewRequired = vehicle.inspection?.status === 'pending' && Boolean(vehicle.inspection?.conditionReport?.checklist);
        const canApprove = canDecide && vehicle.inspection?.recommendation === 'pass'
          && (!ownerReviewRequired || vehicle.inspection.ownerReview?.status === 'accepted');
        return <article className="vehicle-approval-card" key={vehicle.id}>
        <header className="vehicle-card-header"><div><span className="vehicle-card-kicker">HỒ SƠ XE · {vehicle.id.slice(-6).toUpperCase()}</span><h3>{vehicle.brand} {vehicle.model}</h3><p>{vehicle.licensePlate} <span>·</span> {vehicle.year || 'Chưa rõ năm sản xuất'} <span>·</span> {vehicle.seats || '—'} chỗ</p></div><span className="vehicle-review-status">{statusText[vehicle.status] || vehicle.status}</span></header>
        <div className="vehicle-owner-row"><div><small>CHỦ XE</small><strong>{vehicle.owner?.full_name || 'Chưa cập nhật tên'}</strong></div><div><small>EMAIL</small><strong>{vehicle.owner?.email || '—'}</strong></div><div><small>HỘP SỐ / NHIÊN LIỆU</small><strong>{vehicle.transmission || '—'} · {vehicle.fuelType || '—'}</strong></div></div>
        <div className="vehicle-review-grid"><section><h4>Giấy tờ phương tiện</h4><div className="vehicle-document-list"><DocumentCard title="Đăng ký xe" document={vehicle.documents?.registration} onOpen={() => openDocument(vehicle, 'registration')} /><DocumentCard title="Giấy đăng kiểm" document={vehicle.documents?.inspection_certificate} onOpen={() => openDocument(vehicle, 'inspection')} /><DocumentCard title="Bảo hiểm" document={vehicle.documents?.insurance} onOpen={() => openDocument(vehicle, 'insurance')} /></div></section><section><h4>Biên bản kiểm định</h4><div className={`vehicle-inspection-card ${canApprove ? 'is-approved' : ''}`}><strong>{vehicle.inspection ? inspectionText[vehicle.inspection.status] || vehicle.inspection.status : 'Chưa có biên bản'}</strong><span>Kết luận: {vehicle.inspection?.recommendation === 'pass' ? 'Đạt' : vehicle.inspection?.recommendation === 'fail' ? 'Không đạt' : vehicle.inspection?.recommendation || 'Chưa có'}</span>{vehicle.inspection?.inspectedAt && <small>{new Date(vehicle.inspection.inspectedAt).toLocaleDateString('vi-VN')}</small>}</div></section></div>
        {vehicle.reviewNote && <div className="vehicle-prior-note"><strong>Ghi chú xét duyệt gần nhất</strong><p>{vehicle.reviewNote}</p></div>}
        <InspectionReviewDetails inspection={vehicle.inspection} />
        {!canDecide && <p className="vehicle-prior-note">Chờ Garage gửi biên bản kiểm định mới trước khi quyết định.</p>}
        <footer className="vehicle-card-actions"><button className="action-approve" disabled={!canApprove || busyId === vehicle.id} title={!canApprove ? 'Cần Garage gửi biên bản đề xuất đạt trước khi duyệt' : ''} onClick={() => {
              const note = window.prompt('Xác nhận đã kiểm tra đăng ký xe, đăng kiểm và bảo hiểm. Nhập ghi chú nếu cần.', '');
              if (note !== null) act(vehicle, 'approve', note.trim());
            }}>{busyId === vehicle.id ? 'Đang lưu…' : 'Duyệt xe và kiểm định'}</button><button className="action-review" disabled={!canDecide || busyId === vehicle.id} onClick={() => requestAdditionalInfo(vehicle)}>Yêu cầu bổ sung / kiểm định lại</button><button className="action-reject" disabled={!canDecide || busyId === vehicle.id} onClick={() => rejectApplication(vehicle)}>Từ chối hồ sơ</button></footer>
      </article>;
      })}</div>
    {!vehicles.length && <p className="manager-empty vehicle-empty">Không có hồ sơ xe chờ duyệt.</p>}
  <Pagination {...request.paging} /></section>;
}
