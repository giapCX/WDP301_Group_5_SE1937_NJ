import { useState } from 'react';
import IncidentConditionComparison from './IncidentConditionComparison';
import GaragePhotoPreview from '../../garage/components/GaragePhotoPreview';
import { getBlobApi } from '../../../services/httpClient';
import { incidentMilestones } from '../../operator/components/IncidentResponseFields';

const money = (value) => new Intl.NumberFormat('vi-VN').format(value || 0);
const expenseTypes = { assessment: 'Giám định', repair: 'Sửa chữa', deductible: 'Miễn thường', towing: 'Cứu hộ', other: 'Khác' };
const settlementParties = { owner_payable: 'Đề xuất trả chủ xe', renter_receivable: 'Đề xuất thu từ người thuê', third_party_payable: 'Đề xuất trả bên thứ ba' };
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
  const checklist = item.responseChecklist;
  const notificationTime = (value) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const responseDetails = checklist && <details>
    <summary>Checklist xử lý sự cố</summary>
    <dl>
      <dt>Người lái thực tế</dt><dd>{checklist.driverName || 'Chưa ghi nhận'}</dd>
      <dt>Thương tích</dt><dd>{{ none: 'Không ghi nhận', reported: 'Có báo cáo thương tích' }[checklist.injuryStatus] || 'Chưa rõ'}</dd>
      <dt>Thông báo chủ xe</dt><dd>{checklist.ownerNotifiedAt ? notificationTime(checklist.ownerNotifiedAt) : 'Chưa ghi nhận'}</dd>
      <dt>Thông báo bảo hiểm</dt><dd>{checklist.insurerNotifiedAt ? notificationTime(checklist.insurerNotifiedAt) : 'Chưa ghi nhận'}</dd>
      <dt>Mã hồ sơ công an</dt><dd>{checklist.policeReference || '—'}</dd>
      <dt>Mã hồ sơ bảo hiểm</dt><dd>{checklist.insurerReference || '—'}</dd>
      <dt>Tài liệu còn thiếu</dt><dd>{checklist.missingDocuments || 'Chưa ghi nhận'}</dd>
      <dt>Hỗ trợ hiện trường</dt><dd>{checklist.fieldResponder || 'Chưa ghi nhận'}</dd>
      <dt>Xác minh người lái</dt><dd>{checklist.driverVerification || 'Chưa ghi nhận'}</dd>
      <dt>Tạm giữ và nhận lại xe</dt><dd>{checklist.detentionProgress || 'Chưa ghi nhận'}</dd>
      <dt>Bảo hiểm và giám định</dt><dd>{checklist.insuranceProgress || 'Chưa ghi nhận'}</dd>
      <dt>Sửa chữa và bàn giao lại</dt><dd>{checklist.repairProgress || 'Chưa ghi nhận'}</dd>
      <dt>Người nhận lại xe</dt><dd>{checklist.vehicleRecipient || 'Chưa ghi nhận'}</dd>
      <dt>Giấy ủy quyền hoặc tài liệu liên quan</dt><dd>{checklist.releaseAuthorizationReference || 'Chưa ghi nhận'}</dd>
      {incidentMilestones.filter(([key]) => checklist[key]).map(([key, label]) => <div key={key}>
        <dt>{label}</dt><dd>{notificationTime(checklist[key])}</dd>
      </div>)}
    </dl>
  </details>;
  if (item.caseType === 'traffic_violation') return <article className="incident-card">
    <div className="incident-card-heading"><div><strong>{item.caseNumber} · Vi phạm giao thông</strong><p>{item.description}</p></div><span className="request-status rose">{item.status}</span></div>
    <p><strong>Xe bị tạm giữ:</strong> {item.vehicleSeized === true ? 'Có' : item.vehicleSeized === false ? 'Không' : 'Chưa ghi nhận'}</p>
    {responseDetails}
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
    <p><strong>Xe bị tạm giữ:</strong> {item.vehicleSeized === true ? 'Có' : item.vehicleSeized === false ? 'Không' : 'Chưa ghi nhận'} · Operator ghi nhận thông tin, không tự đổi trạng thái xe, booking hoặc cọc.</p>
    {item.sourceWithdrawalId && <p>Tranh chấp biên bản trả xe cho chủ · {item.sourceWithdrawalId}</p>}
    {responseDetails}
    <IncidentConditionComparison comparison={item.conditionComparison} />
    <IncidentConditionComparison comparison={item.ownerConditionComparison} ownerReturn />
    <div className="gs-photo-grid">{(item.evidence || []).filter((evidence) => evidence.file_key?.startsWith('garage-photos/')).map((evidence) => <div key={evidence.file_key}><GaragePhotoPreview photo={{ key: evidence.file_key, name: evidence.file_key.split('/').at(-1) }} /></div>)}</div>
    {(item.evidence || []).map((evidence, index) => evidence.file_key?.startsWith('owner-files/') || /^[a-f\d]{24}$/i.test(evidence.file_key || '')
      ? <button className="action-review" key={`${item.id}-evidence-${index}`} disabled={busy} onClick={() => downloadEvidence(index, evidence.file_name)}>Tải biên bản: {evidence.file_name || `Tệp ${index + 1}`}</button>
      : null)}
    {fileError && <p role="alert">{fileError}</p>}
    {claims.map((claim, index) => <div className="claim-row" key={`${item.id}-${index}`}>
      <div><span>Yêu cầu: {money(claim.requested_amount)} ₫</span>
        {claim.category && <p>{expenseTypes[claim.category]} · Bảo hiểm chấp nhận {money(claim.insurance_amount)} ₫</p>}
        {claim.settlement_party && <p>{settlementParties[claim.settlement_party]}</p>}
        {claim.proposed_amount !== undefined && <p>Operation đề xuất: {money(claim.proposed_amount)} ₫</p>}
        {claim.evidence_basis && <p>Căn cứ: {claim.evidence_basis}</p>}
        {claim.contract_basis && <p>Điều khoản hợp đồng: {claim.contract_basis}</p>}
        {claim.evidence_reference && <p>Chứng từ: {claim.evidence_reference}</p>}
        {claim.manager_note && <p>Quyết định: {claim.manager_note}</p>}
        {claim.settlement_status === 'pending_settlement' && <p>Đã duyệt {money(claim.approved_amount)} ₫ · Chờ xử lý thanh toán</p>}
        {claim.settlement_status === 'settled' && <p>Đã ghi nhận thanh toán · {claim.settlement_reference}</p>}
        <p>{responseText[claim.renter_response] || 'Chưa có thông tin phản hồi của khách'}</p>
      </div>
      {claim.settlement_status === 'pending_settlement' && <button className="action-review" disabled={busy} onClick={() => {
        const reference = window.prompt('Mã chứng từ của giao dịch đã hoàn tất:');
        if (reference?.trim()) run(() => reviewIncident(item.id, {
          action: 'record_settlement', claimIndex: index, reference: reference.trim(),
        }), 'Đã ghi nhận chứng từ thanh toán.');
      }}>Ghi nhận thanh toán</button>}
      {claim.decision && claim.decision !== 'pending' ? <span className="claim-decided">{claim.decision === 'approved' ? 'Đã duyệt' : 'Đã từ chối'}</span> : <div className="workspace-actions">
        <button className="action-approve" disabled={busy || index !== pending || !(managerReview || operatorProposal)} onClick={() => {
          const raw = window.prompt('Số tiền bồi thường được duyệt (VND):', String(claim.proposed_amount ?? claim.requested_amount));
          if (raw === null || !raw.trim()) return;
          const amount = Number(raw);
          if (!Number.isSafeInteger(amount) || amount < 0) return;
          const note = window.prompt('Căn cứ quyết định bồi thường của Manager:');
          if (!note?.trim()) return;
          const contractBasis = window.prompt('Số hợp đồng và điều khoản áp dụng:');
          if (!contractBasis?.trim()) return;
          const evidenceReference = window.prompt('Mã hoặc tên chứng từ làm căn cứ:');
          if (!evidenceReference?.trim()) return;
          run(() => reviewCompensation(item.id, {
            decision: 'approve', amount, note: note.trim(), claimIndex: index,
            settlementMode: 'record_only', contractBasis: contractBasis.trim(), evidenceReference: evidenceReference.trim(),
          }), 'Đã ghi nhận phê duyệt khoản bồi thường.');
        }}>Duyệt bồi thường</button>
        <button className="action-reject" disabled={busy || index !== pending || !(managerReview || operatorProposal)} onClick={() => {
          const note = window.prompt('Lý do từ chối bồi thường:');
          if (note?.trim()) run(() => reviewCompensation(item.id, { decision: 'reject', note: note.trim(), claimIndex: index, settlementMode: 'record_only' }), 'Đã từ chối đề xuất.');
        }}>Từ chối</button>
      </div>}
    </div>)}
    {managerReview ? <p>Operator đã gửi thông tin và chứng cứ; Manager tự đánh giá, quyết định khoản bồi thường.</p>
      : item.investigation?.review_status !== 'proposed' && <p>Chưa có đề xuất đã xác minh từ Operation. Báo cáo Garage không tự xác lập trách nhiệm bồi thường.</p>}
    {managerReview && <button className="action-review" disabled={busy} onClick={requestInformation}>Yêu cầu Operator bổ sung</button>}
    {item.status === 'need_more_information' && <p>Đang chờ Operator bổ sung hồ sơ; Manager chưa thể kết luận.</p>}
    {pending < 0 && !['need_more_information', 'resolved', 'closed'].includes(item.status) && <button className="action-review" disabled={busy} onClick={() => {
      const note = window.prompt('Kết luận đóng hồ sơ, nêu rõ căn cứ không còn yêu cầu bồi thường:');
      if (note?.trim()) run(() => reviewIncident(item.id, { action: 'resolve', note: note.trim() }), 'Đã đóng hồ sơ. Xe vẫn cần quy trình kiểm tra/sửa chữa nếu đang bảo trì.');
    }}>Kết luận / đóng hồ sơ</button>}
  </article>;
}
