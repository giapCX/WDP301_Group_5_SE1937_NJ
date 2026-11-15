import ManagerActionForm from './ManagerActionForm';
import { formatDisplayValue, humanizeField } from './dataDisplay';
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
  const [action, setAction] = useState(null);
  const noteField = (label, minLength = 1) => ({ name: 'note', label, minLength, maxLength: 1000, type: 'textarea' });
  const amountField = (label, value) => ({ name: 'amount', label, value, type: 'number', min: 0, step: 1 });
  const claims = item.compensationClaims || [];
  const pending = claims.findIndex((claim) => !claim.decision || claim.decision === 'pending');
  const violation = item.trafficViolation;
  const managerReview = item.status === 'pending_manager' && item.investigation?.review_status === 'submitted';
  const operatorProposal = item.investigation?.review_status === 'proposed' && Boolean(claims[pending]?.evidence_basis);
  function openAction(title, fields, submit, success) {
    setAction({ title, fields, submit, success });
  }
  const actionDialog = action && <ManagerActionForm
    title={action.title}
    context={item.caseNumber}
    fields={action.fields}
    onSubmit={(values) => act(action.submit(values), action.success, { inlineError: true })}
    onClose={() => setAction(null)}
  />;
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
    const fields = [noteField('Căn cứ quyết định vi phạm')];
    if (decision === 'approve') fields.unshift(amountField('Khoản phạt được duyệt (VND)', violation.operation_recommended_penalty_fee ?? 0));
    openAction(decision === 'approve' ? 'Xác nhận vi phạm' : 'Bác bỏ vi phạm', fields,
      (values) => reviewTrafficViolation(item.id, { decision, ...values }), 'Đã lưu quyết định vi phạm.');
  }
  function requestInformation() {
    openAction('Yêu cầu Operator bổ sung', [noteField('Thông tin hoặc chứng cứ cần bổ sung', 5)],
      (values) => reviewIncident(item.id, { action: 'request_information', ...values }),
      'Đã chuyển hồ sơ lại cho Operator bổ sung.');
  }
  const checklist = item.responseChecklist;
  const notificationTime = (value) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const responseDetails = checklist && <details>
    <summary>Hiện trường, công an và bảo hiểm</summary>
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
  const isViolation = item.caseType === 'traffic_violation';
  return <article className="incident-card">
    <header className="incident-card-heading">
      <div><strong>{item.caseNumber} · {humanizeField(item.caseType || 'incident')}</strong><p>{item.description}</p></div>
      <span className="request-status rose">{formatDisplayValue(item.status, 'status')}</span>
    </header>
    <section className="incident-next">
      <h3>Việc cần làm</h3>
      <p>Xe bị tạm giữ: {item.vehicleSeized === true ? 'Có' : item.vehicleSeized === false ? 'Không' : 'Chưa ghi nhận'}</p>
      {item.status === 'need_more_information' && <p>Đang chờ Operator bổ sung hồ sơ; Manager chưa thể kết luận.</p>}
      {isViolation ? <>
          {violation?.operation_recommendation && <p>Operator đề xuất {violation.operation_recommendation === 'confirm' ? `xác nhận, mức phạt ${money(violation.operation_recommended_penalty_fee)} ₫` : 'bác bỏ'}.</p>}
          {violation?.operation_review_note && <p>{violation.operation_review_note}</p>}
          {item.status === 'pending_manager' && violation?.official_confirmation === 'pending_manager_review' && <div className="workspace-actions">
            {managerReview && <button className="action-review" disabled={busy} onClick={requestInformation}>Yêu cầu Operator bổ sung</button>}
            <button className="action-approve" disabled={busy} onClick={() => decideViolation('approve')}>Xác nhận vi phạm</button>
            <button className="action-reject" disabled={busy} onClick={() => decideViolation('reject')}>Bác bỏ vi phạm</button>
          </div>}
      </> : <>
        {managerReview && <p>Operator đã gửi thông tin và chứng cứ; Manager tự đánh giá, quyết định khoản bồi thường.</p>}
        {managerReview && <button className="action-review" disabled={busy} onClick={requestInformation}>Yêu cầu Operator bổ sung</button>}
        {pending < 0 && !['need_more_information', 'resolved', 'closed'].includes(item.status) && <button className="action-review" disabled={busy}
          onClick={() => openAction('Kết luận / đóng hồ sơ', [noteField('Kết luận và căn cứ đóng hồ sơ')],
            (values) => reviewIncident(item.id, { action: 'resolve', ...values }), 'Đã đóng hồ sơ.')}>Kết luận / đóng hồ sơ</button>}
      </>}
    </section>
    {responseDetails}
    <details>
      <summary>Biên bản và chứng cứ ({item.evidence?.length || 0} tệp)</summary>
      {item.sourceWithdrawalId && <p>Tranh chấp biên bản trả xe cho chủ · {item.sourceWithdrawalId}</p>}
      {!item.evidence?.length && !item.conditionComparison && !item.ownerConditionComparison && <p>Chưa có chứng cứ đính kèm.</p>}
      <IncidentConditionComparison comparison={item.conditionComparison} />
      <IncidentConditionComparison comparison={item.ownerConditionComparison} ownerReturn />
      <div className="gs-photo-grid">{(item.evidence || []).filter((evidence) => evidence.file_key?.startsWith('garage-photos/')).map((evidence) => <div key={evidence.file_key}><GaragePhotoPreview photo={{ key: evidence.file_key, name: evidence.file_key.split('/').at(-1) }} /></div>)}</div>
      {(item.evidence || []).map((evidence, index) => evidence.file_key?.startsWith('owner-files/') || /^[a-f\d]{24}$/i.test(evidence.file_key || '')
        ? <button className="action-review" key={`${item.id}-evidence-${index}`} disabled={busy} onClick={() => downloadEvidence(index, evidence.file_name)}>Tải biên bản: {evidence.file_name || `Tệp ${index + 1}`}</button>
        : null)}
      {fileError && <p role="alert">{fileError}</p>}
    </details>
    {!isViolation && <details open={claims.length > 0}>
      <summary>Chi phí và bồi thường ({claims.length})</summary>
      {!claims.length && <p>Chưa có khoản bồi thường.</p>}
      {claims.map((claim, index) => <div className="claim-row" key={`${item.id}-${index}`}>
        <div><span>Yêu cầu: {money(claim.requested_amount)} ₫</span>
          {claim.category && <p>{expenseTypes[claim.category]} · Bảo hiểm chấp nhận {money(claim.insurance_amount)} ₫</p>}
          {claim.settlement_party && <p>{settlementParties[claim.settlement_party]}</p>}
          {claim.proposed_amount !== undefined && <p>Operator đề xuất: {money(claim.proposed_amount)} ₫</p>}
          {claim.evidence_basis && <p>Căn cứ: {claim.evidence_basis}</p>}
          {claim.contract_basis && <p>Điều khoản hợp đồng: {claim.contract_basis}</p>}
          {claim.evidence_reference && <p>Chứng từ: {claim.evidence_reference}</p>}
          {claim.manager_note && <p>Quyết định: {claim.manager_note}</p>}
          {claim.settlement_status === 'pending_settlement' && <p>Đã duyệt {money(claim.approved_amount)} ₫ · Chờ xử lý thanh toán</p>}
          {claim.settlement_status === 'settled' && <p>Đã ghi nhận thanh toán · {claim.settlement_reference}</p>}
          <p>{responseText[claim.renter_response] || 'Chưa có thông tin phản hồi của khách'}</p>
        </div>
        {claim.settlement_status === 'pending_settlement' && <button className="action-review" disabled={busy} onClick={() => openAction('Ghi nhận thanh toán', [{ name: 'reference', label: 'Mã chứng từ giao dịch' }],
          (values) => reviewIncident(item.id, { action: 'record_settlement', claimIndex: index, ...values }),
          'Đã ghi nhận chứng từ thanh toán.')}>Ghi nhận thanh toán</button>}
        {claim.decision && claim.decision !== 'pending' ? <span className="claim-decided">{claim.decision === 'approved' ? 'Đã duyệt' : 'Đã từ chối'}</span> : <div className="workspace-actions">
          <button className="action-approve" disabled={busy || index !== pending || !(managerReview || operatorProposal)} onClick={() => openAction('Duyệt bồi thường', [
            amountField('Số tiền bồi thường (VND)', claim.proposed_amount ?? claim.requested_amount),
            noteField('Căn cứ quyết định bồi thường'),
            { name: 'contractBasis', label: 'Số hợp đồng và điều khoản áp dụng' },
            { name: 'evidenceReference', label: 'Mã hoặc tên chứng từ' },
          ], (values) => reviewCompensation(item.id, {
            decision: 'approve', claimIndex: index, settlementMode: 'record_only', ...values,
          }), 'Đã ghi nhận phê duyệt khoản bồi thường.')}>Duyệt bồi thường</button>
          <button className="action-reject" disabled={busy || index !== pending || !(managerReview || operatorProposal)} onClick={() => openAction('Từ chối bồi thường', [noteField('Lý do từ chối bồi thường')],
            (values) => reviewCompensation(item.id, { decision: 'reject', claimIndex: index, settlementMode: 'record_only', ...values }),
            'Đã từ chối đề xuất.')}>Từ chối</button>
        </div>}
      </div>)}
    </details>}
    <details>
      <summary>Lịch sử xử lý</summary>
      {item.createdAt && <p>Ghi nhận hồ sơ · {notificationTime(item.createdAt)}</p>}
      {item.timeline?.length > 0 && <ol>{[...item.timeline].reverse().map((entry, index) =>
        <li key={index}>{humanizeField(entry.action)}{entry.at && ` · ${notificationTime(entry.at)}`}{entry.note && <p>{entry.note}</p>}</li>)}</ol>}
      {item.resolution?.note && <p>Kết luận của Manager: {item.resolution.note}</p>}
      {item.updatedAt && <p>Cập nhật gần nhất · {notificationTime(item.updatedAt)}</p>}
      {!item.createdAt && !item.updatedAt && !item.timeline?.length && <p>Chưa có lịch sử.</p>}
    </details>
    {actionDialog}
  </article>;
}
