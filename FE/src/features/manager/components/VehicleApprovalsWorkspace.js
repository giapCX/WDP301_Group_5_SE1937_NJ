import Pagination from "../../../components/ui/Pagination";
import { useState } from 'react';
import { getBlobApi } from '../../../services/httpClient';
import useManagerActions from '../hooks/useManagerActions';
import useManagerCollection from '../hooks/useManagerCollection';
import InspectionReviewDetails from './InspectionReviewDetails';
import './VehicleApprovalsWorkspace.css';
import { inspectionItems } from '../../garage/data/inspectionChecklist';
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
function decisionReadiness(vehicle) {
  const inspection = vehicle.inspection;
  const report = inspection?.conditionReport || {};
  const checklist = report.checklist || [];
  const byKey = new Map(checklist.map((item) => [item.key, item]));
  const missing = inspectionItems.filter(([key]) => !byKey.has(key)).map(([, label]) => label);
  const unsafe = checklist.filter((item) => ['fail', 'unverified'].includes(item.result));
  const invalid = checklist.filter((item) => !['pass', 'recorded', 'not_applicable'].includes(item.result)
    || (item.result === 'not_applicable' && item.key !== 'accessories'));
  const weakEvidence = checklist.filter((item) => item.result === 'recorded' && (!item.note?.trim() || !item.photo_key));
  const ownerAccepted = inspection?.ownerReview?.status === 'accepted'
    && inspection.ownerReview.reviewed_version === inspection.version - 1;
  const checklistReady = checklist.length > 0 && !missing.length && !unsafe.length && !invalid.length && !weakEvidence.length;
  const blockers = [];
  if (inspection?.recommendation !== 'pass') blockers.push('Garage chưa kết luận đạt.');
  if (vehicle.conditionDeclaration && !checklist.length) blockers.push('Thiếu checklist đối chiếu bản khai của chủ xe.');
  if (checklist.length && missing.length) blockers.push(`Thiếu ${missing.length} mục checklist.`);
  if (unsafe.length) blockers.push(`${unsafe.length} mục không đạt hoặc chưa xác minh.`);
  if (invalid.length) blockers.push(`${invalid.length} mục có kết quả không hợp lệ.`);
  if (weakEvidence.length) blockers.push(`${weakEvidence.length} lỗi nhỏ thiếu mô tả hoặc ảnh.`);
  if (inspection?.status === 'pending' && checklist.length && !ownerAccepted) blockers.push(inspection.ownerReview?.status === 'disputed' ? 'Chủ xe đang bất đồng hiện trạng.' : 'Chờ chủ xe xác nhận đúng phiên bản hiện trạng.');
  return { checklistReady, ownerAccepted, blockers };
}
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
        const readiness = decisionReadiness(vehicle);
        const hasChecklist = Boolean(vehicle.inspection?.conditionReport?.checklist?.length);
        const canApprove = canDecide && vehicle.inspection?.recommendation === 'pass'
          && (hasChecklist ? readiness.checklistReady : !vehicle.conditionDeclaration)
          && !(vehicle.inspection?.status === 'pending' && hasChecklist && !readiness.ownerAccepted);
        return <article className="vehicle-approval-card" key={vehicle.id}>
        <header className="vehicle-card-header"><div><span className="vehicle-card-kicker">HỒ SƠ XE · {vehicle.id.slice(-6).toUpperCase()}</span><h3>{vehicle.brand} {vehicle.model}</h3><p>{vehicle.licensePlate} <span>·</span> {vehicle.year || 'Chưa rõ năm sản xuất'} <span>·</span> {vehicle.seats || '—'} chỗ</p></div><span className="vehicle-review-status">{statusText[vehicle.status] || vehicle.status}</span></header>
        <div className="vehicle-owner-row"><div><small>CHỦ XE</small><strong>{vehicle.owner?.full_name || 'Chưa cập nhật tên'}</strong></div><div><small>EMAIL</small><strong>{vehicle.owner?.email || '—'}</strong></div><div><small>HỘP SỐ / NHIÊN LIỆU</small><strong>{vehicle.transmission || '—'} · {vehicle.fuelType || '—'}</strong></div><div><small>GIÁ THUÊ CHỦ XE KHAI BÁO</small><strong>{vehicle.dailyPrice ? `${new Intl.NumberFormat('vi-VN').format(vehicle.dailyPrice)} ₫ / ngày` : '—'}</strong></div></div>
        <div className="vehicle-review-grid"><section><h4>Giấy tờ phương tiện</h4><div className="vehicle-document-list"><DocumentCard title="Đăng ký xe" document={vehicle.documents?.registration} onOpen={() => openDocument(vehicle, 'registration')} /><DocumentCard title="Giấy đăng kiểm" document={vehicle.documents?.inspection_certificate} onOpen={() => openDocument(vehicle, 'inspection')} /><DocumentCard title="Bảo hiểm" document={vehicle.documents?.insurance} onOpen={() => openDocument(vehicle, 'insurance')} /></div></section><section><h4>Kiểm định đầu vào · trước khi cho thuê</h4><div className={`vehicle-inspection-card ${canApprove ? 'is-approved' : ''}`}><strong>{vehicle.inspection ? inspectionText[vehicle.inspection.status] || vehicle.inspection.status : 'Chưa có biên bản'}</strong><span>Kết luận Garage: {vehicle.inspection?.recommendation === 'pass' ? 'Đạt' : vehicle.inspection?.recommendation === 'requires_repair' ? 'Cần sửa và kiểm định lại' : vehicle.inspection?.recommendation === 'fail' ? 'Không đạt' : 'Chưa có'}</span>{vehicle.inspection?.inspectedAt && <small>{new Date(vehicle.inspection.inspectedAt).toLocaleDateString('vi-VN')}</small>}</div></section></div>
        <section className="manager-decision-guide"><div><strong>Tiêu chí duyệt dựa trên hồ sơ</strong><p>Manager đối chiếu tính đầy đủ và nhất quán của hồ sơ; Garage chịu trách nhiệm kết luận kỹ thuật. Duyệt hồ sơ chưa phải xác nhận đã nhận giữ xe.</p></div><ul><li className={vehicle.inspection?.recommendation === 'pass' ? 'is-clear' : 'is-blocked'}>Garage kết luận đạt</li><li className={!vehicle.conditionDeclaration || readiness.checklistReady ? 'is-clear' : 'is-blocked'}>Checklist có đủ hạng mục, không còn lỗi chặn/chưa xác minh</li><li className={!hasChecklist || readiness.ownerAccepted ? 'is-clear' : 'is-blocked'}>{!hasChecklist ? 'Chủ xe xác nhận hiện trạng' : readiness.ownerAccepted ? 'Chủ xe xác nhận đúng phiên bản' : 'Chủ xe chưa xác nhận đúng phiên bản'}</li><li className={['registration', 'inspection_certificate', 'insurance'].every((key) => !vehicle.conditionDeclaration || vehicle.documents?.[key]?.file_key) ? 'is-clear' : 'is-blocked'}>Đủ giấy tờ xe để xác minh</li></ul>{readiness.blockers.length > 0 && <p className="manager-decision-blockers">Cần xử lý: {readiness.blockers.join(' ')}</p>}<p className="manager-decision-outcome"><strong>Duyệt:</strong> hồ sơ chuyển sang bước hoàn tất hợp đồng quản lý. Xe chỉ được ghi nhận đã vào gara sau biên bản tiếp nhận được xác nhận. <strong>Yêu cầu bổ sung:</strong> giữ hồ sơ chờ báo cáo/giấy tờ mới. <strong>Từ chối:</strong> kết thúc hồ sơ với lý do lưu trong lịch sử.</p><p className="manager-decision-outcome"><strong>Sau mỗi chuyến thuê:</strong> Garage lập biên bản nhận trả, so với biên bản giao xe của chuyến đó. Lỗi mới/nặng thêm sẽ chặn cho thuê và tạo sự cố; Operation xác minh, Manager xem đề xuất bồi thường riêng. Báo cáo trả xe không thay thế kiểm định đầu vào.</p></section>
        {vehicle.conditionDeclaration && <section className="vehicle-owner-declaration"><h4>Bản khai hiện trạng của chủ xe</h4><p>{vehicle.conditionDeclaration}</p><small>Đối chiếu nội dung này với checklist và ảnh Garage; mọi chênh lệch cần được ghi nhận, giải thích và chủ xe xác nhận.</small></section>}
        {vehicle.reviewNote && <div className="vehicle-prior-note"><strong>Ghi chú xét duyệt gần nhất</strong><p>{vehicle.reviewNote}</p></div>}
        <InspectionReviewDetails inspection={vehicle.inspection} />
        {!canDecide && <p className="vehicle-prior-note">Chờ Garage gửi biên bản kiểm định mới trước khi quyết định.</p>}
        <footer className="vehicle-card-actions"><button className="action-approve" disabled={!canApprove || busyId === vehicle.id} title={!canApprove ? 'Cần Garage gửi biên bản đề xuất đạt trước khi duyệt' : ''} onClick={() => {
              const note = window.prompt('Ghi căn cứ duyệt (ít nhất 5 ký tự), ví dụ đã đối chiếu checklist, xác nhận chủ xe và giấy tờ.', '');
              if (note === null) return;
              if (note.trim().length < 5) { setActionError('Cần ghi căn cứ duyệt tối thiểu 5 ký tự để lưu lịch sử.'); return; }
              act(vehicle, 'approve', note.trim());
            }}>{busyId === vehicle.id ? 'Đang lưu…' : 'Duyệt hồ sơ · chuyển sang hợp đồng'}</button><button className="action-review" disabled={!canDecide || busyId === vehicle.id} onClick={() => requestAdditionalInfo(vehicle)}>Yêu cầu bổ sung / kiểm định lại</button><button className="action-reject" disabled={!canDecide || busyId === vehicle.id} onClick={() => rejectApplication(vehicle)}>Từ chối hồ sơ</button></footer>
      </article>;
      })}</div>
    {!vehicles.length && <p className="manager-empty vehicle-empty">Không có hồ sơ xe chờ duyệt.</p>}
  <Pagination {...request.paging} /></section>;
}
