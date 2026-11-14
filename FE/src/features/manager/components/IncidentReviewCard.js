import { useState } from 'react';
import IncidentConditionComparison from './IncidentConditionComparison';
import GaragePhotoPreview from '../../garage/components/GaragePhotoPreview';
import { getBlobApi } from '../../../services/httpClient';

const money = (value) => new Intl.NumberFormat('vi-VN').format(value || 0);
const responseText = { agreed: 'Khách đồng ý', disputed: 'Khách có bất đồng', not_received: 'Chưa nhận phản hồi' };

export default function IncidentReviewCard({ item, reviewCompensation, reviewIncident, reviewTrafficViolation, act }) {
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState('');
  const claims = item.compensationClaims || [];
  const pending = claims.findIndex((claim) => !claim.decision || claim.decision === 'pending');
  const violation = item.trafficViolation;
  const managerReview = item.status === 'pending_manager' && item.investigation?.review_status === 'submitted';
  const operatorProposal = item.investigation?.review_status === 'proposed' && Boolean(claims[pending]?.evidence_basis);
  async function run(work, message) {
    if (busy) return;
    setBusy(true);
    try { await act(work(), message); } finally { setBusy(false); }
  }
  async function downloadEvidence(index, name) {
    setBusy(true);
    setFileError('');
    try {
      const blob = await getBlobApi(`/operator/incidents/${encodeURIComponent(item.id)}/evidence/${index}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name || `incident-${item.id}-${index}`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setFileError(error.message || 'Không thể tải biên bản.');
    } finally {
      setBusy(false);
    }
  }
  function decideViolation(decision) {
    let amount;
    if (decision === 'approve') {
      const raw = window.prompt('Khoản phạt được duyệt (VND):', String(violation.operation_recommended_penalty_fee ?? 0));
      if (!raw?.trim()) return;
      amount = Number(raw);
      if (!Number.isSafeInteger(amount) || amount < 0) return;
    }
    const note = window.prompt('Căn cứ quyết định vi phạm:');
    if (!note?.trim()) return;
    run(() => reviewTrafficViolation(item.id, { decision, amount, note: note.trim() }), 'Đã lưu quyết định vi phạm.');
  }
  function requestInformation() {
    const note = window.prompt('Nêu rõ thông tin hoặc chứng cứ Operator cần bổ sung (5–1.000 ký tự):');
    if (note?.trim()) run(
      () => reviewIncident(item.id, { action: 'request_information', note: note.trim() }),
      'Đã chuyển hồ sơ lại cho Operator bổ sung.',
    );
  }
  if (item.caseType === 'traffic_violation') return <article className="incident-card">
    <div className="incident-card-heading"><div><strong>{item.caseNumber} · Vi phạm giao thông</strong><p>{item.description}</p></div><span className="request-status rose">{item.status}</span></div>
    {(item.evidence || []).map((evidence, index) => evidence.file_key?.startsWith('owner-files/') || /^[a-f\d]{24}$/i.test(evidence.file_key || '')
      ? <button className="action-review" key={`${item.id}-evidence-${index}`} disabled={busy} onClick={() => downloadEvidence(index, evidence.file_name)}>Tải biên bản: {evidence.file_name || `Tệp ${index + 1}`}</button>
      : null)}
    {fileError && <p role="alert">{fileError}</p>}
    {violation?.operation_recommendation && <p>Operation đề xuất {violation.operation_recommendation === 'confirm' ? `xác nhận, mức phạt ${money(violation.operation_recommended_penalty_fee)} ₫` : 'bác bỏ'}.</p>}
    {violation?.operation_review_note && <p>{violation.operation_review_note}</p>}
    {item.status === 'pending_manager' && violation?.official_confirmation === 'pending_manager_review' && <div className="workspace-actions">
      {managerReview && <button className="action-review" disabled={busy} onClick={requestInformation}>Yêu cầu Operator bổ sung</button>}
      <button className="action-approve" disabled={busy} onClick={() => decideViolation('approve')}>Xác nhận vi phạm</button>
      <button className="action-reject" disabled={busy} onClick={() => decideViolation('reject')}>Bác bỏ vi phạm</button>
    </div>}
    {item.status === 'need_more_information' && <p>Đang chờ Operator bổ sung hồ sơ; Manager chưa thể ra quyết định.</p>}
  </article>;
  return <article className="incident-card">
    <div className="incident-card-heading"><div><strong>{item.caseNumber} · {item.caseType}</strong><p>{item.description}</p></div><span className="request-status rose">{item.status}</span></div>
    {item.sourceWithdrawalId && <p>Tranh chấp biên bản trả xe cho chủ · {item.sourceWithdrawalId}</p>}
    <IncidentConditionComparison comparison={item.conditionComparison} />
    <IncidentConditionComparison comparison={item.ownerConditionComparison} ownerReturn />
    <div className="gs-photo-grid">{(item.evidence || []).filter((evidence) => evidence.file_key?.startsWith('garage-photos/')).map((evidence) => <div key={evidence.file_key}><GaragePhotoPreview photo={{ key: evidence.file_key, name: evidence.file_key.split('/').at(-1) }} /></div>)}</div>
    {(item.evidence || []).map((evidence, index) => evidence.file_key?.startsWith('owner-files/') || /^[a-f\d]{24}$/i.test(evidence.file_key || '')
      ? <button className="action-review" key={`${item.id}-evidence-${index}`} disabled={busy} onClick={() => downloadEvidence(index, evidence.file_name)}>Tải biên bản: {evidence.file_name || `Tệp ${index + 1}`}</button>
      : null)}
    {fileError && <p role="alert">{fileError}</p>}
    {claims.map((claim, index) => <div className="claim-row" key={`${item.id}-${index}`}>
      <div><span>Yêu cầu: {money(claim.requested_amount)} ₫</span>
        {claim.proposed_amount !== undefined && <p>Operation đề xuất: {money(claim.proposed_amount)} ₫</p>}
        {claim.evidence_basis && <p>Căn cứ: {claim.evidence_basis}</p>}
        <p>{responseText[claim.renter_response] || 'Chưa có thông tin phản hồi của khách'}</p>
      </div>
      {claim.decision && claim.decision !== 'pending' ? <span className="claim-decided">{claim.decision === 'approved' ? 'Đã duyệt' : 'Đã từ chối'}</span> : <div className="workspace-actions">
        <button className="action-approve" disabled={busy || index !== pending || !(managerReview || operatorProposal)} onClick={() => {
          const raw = window.prompt('Số tiền bồi thường được duyệt (VND):', String(claim.proposed_amount ?? claim.requested_amount));
          if (raw === null || !raw.trim()) return;
          const amount = Number(raw);
          if (!Number.isSafeInteger(amount) || amount < 0) return;
          const note = window.prompt('Căn cứ quyết định bồi thường của Manager:');
          if (note?.trim()) run(() => reviewCompensation(item.id, { decision: 'approve', amount, note: note.trim(), claimIndex: index }), 'Đã duyệt bồi thường và cập nhật cọc.');
        }}>Duyệt bồi thường</button>
        <button className="action-reject" disabled={busy || index !== pending} onClick={() => {
          const note = window.prompt('Lý do từ chối bồi thường:');
          if (note?.trim()) run(() => reviewCompensation(item.id, { decision: 'reject', note: note.trim(), claimIndex: index }), 'Đã từ chối đề xuất.');
        }}>Từ chối</button>
      </div>}
    </div>)}
    {managerReview ? <p>Operator đã gửi thông tin và chứng cứ; Manager tự đánh giá, quyết định khoản bồi thường.</p>
      : item.investigation?.review_status !== 'proposed' && <p>Chưa có đề xuất đã xác minh từ Operation. Báo cáo Garage không tự xác lập trách nhiệm bồi thường.</p>}
    {managerReview && <button className="action-review" disabled={busy} onClick={requestInformation}>Yêu cầu Operator bổ sung</button>}
    {item.status === 'need_more_information' && <p>Đang chờ Operator bổ sung hồ sơ; Manager chưa thể kết luận.</p>}
    {pending < 0 && item.status !== 'need_more_information' && <button className="action-review" disabled={busy} onClick={() => {
      const note = window.prompt('Kết luận đóng hồ sơ, nêu rõ căn cứ không còn yêu cầu bồi thường:');
      if (note?.trim()) run(() => reviewIncident(item.id, { action: 'resolve', note: note.trim() }), 'Đã đóng hồ sơ. Xe vẫn cần quy trình kiểm tra/sửa chữa nếu đang bảo trì.');
    }}>Kết luận / đóng hồ sơ</button>}
  </article>;
}
