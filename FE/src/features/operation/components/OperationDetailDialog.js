import { useState } from 'react';
import { formatOperationDate, formatOperationMoney, operationStatusLabels } from '../operationConfig';

function Status({ value }) {
  return (
    <span className={`operation-status status-${String(value || 'unknown').replaceAll('_', '-')}`}>
      <i />{operationStatusLabels[value] || value || '—'}
    </span>
  );
}

export default function OperationDetailDialog({ item, section, busy, onClose, onUpdate, onPropose }) {
  const [amount, setAmount] = useState(item.investigation?.estimated_cost ?? '');
  const [responsibility, setResponsibility] = useState('undetermined');
  const [proposalNote, setProposalNote] = useState('');
  const title = item.bookingCode || item.caseNumber || item.title || item.id;
  const hasOpenProposal = item.compensationClaims?.some((claim) => !claim.decision || claim.decision === 'pending');
  const canPropose = ['incidents', 'disputes', 'complaints'].includes(section)
    && item.status !== 'pending_manager'
    && !hasOpenProposal;

  const submitProposal = (event) => {
    event.preventDefault();
    const proposedAmount = Number(amount);
    if (!Number.isSafeInteger(proposedAmount) || proposedAmount < 0 || !proposalNote.trim()) return;
    onPropose({
      amount: proposedAmount,
      responsibility,
      note: proposalNote.trim(),
    });
  };

  return (
    <div className="operation-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="operation-detail" role="dialog" aria-modal="true" aria-labelledby="operation-detail-title">
        <button className="operation-detail-close" onClick={onClose} aria-label="Đóng">×</button>
        <p className="operation-eyebrow">CHI TIẾT HỒ SƠ</p>
        <h2 id="operation-detail-title">{title}</h2>
        <Status value={item.status} />

        {item.description && <p>{item.description}</p>}
        {item.caseType && <p><strong>Loại hồ sơ:</strong> {item.caseType}</p>}
        {item.renter && <p><strong>Khách thuê:</strong> {item.renter.full_name} · {item.renter.phone || item.renter.email}</p>}
        {item.reporter && <p><strong>Người báo:</strong> {item.reporter.full_name} · {item.reporter.phone || item.reporter.email}</p>}
        {item.vehicle && <p><strong>Xe:</strong> {item.vehicle.brand} {item.vehicle.model} · {item.vehicle.license_plate}</p>}
        {item.startAt && <p><strong>Thời gian:</strong> {formatOperationDate(item.startAt)} – {formatOperationDate(item.endAt)}</p>}
        {item.assignedStaff && <p><strong>Người xử lý:</strong> {item.assignedStaff.full_name}</p>}
        {item.investigation?.findings && <p><strong>Kết quả xác minh:</strong> {item.investigation.findings}</p>}
        {item.investigation?.responsibility && <p><strong>Trách nhiệm đề xuất:</strong> {item.investigation.responsibility}</p>}
        {item.investigation?.estimated_cost !== undefined && <p><strong>Chi phí ước tính:</strong> {formatOperationMoney(item.investigation.estimated_cost)}</p>}
        {item.resolution && <p><strong>Kết luận:</strong> {item.resolution.note || operationStatusLabels[item.resolution.outcome] || item.resolution.outcome}</p>}

        {item.compensationClaims?.length > 0 && (
          <div>
            <h3>Đề xuất / quyết định bồi thường</h3>
            {item.compensationClaims.map((claim, index) => (
              <p key={`${item.id}-claim-${index}`}>
                {formatOperationMoney(claim.proposed_amount ?? claim.requested_amount)}
                {claim.operation_proposal?.recommendation && ` · Đề xuất: ${claim.operation_proposal.recommendation}`}
                {claim.operation_proposal?.responsibility && ` · Trách nhiệm đề xuất: ${claim.operation_proposal.responsibility}`}
                {claim.decision && ` · Manager: ${claim.decision}`}
                {claim.operation_proposal?.note && <><br />{claim.operation_proposal.note}</>}
              </p>
            ))}
          </div>
        )}

        {item.evidence?.length > 0 && (
          <div><h3>Chứng cứ</h3><ul>{item.evidence.map((evidence, index) => (
            <li key={`${evidence.file_key}-${index}`}>{evidence.kind}: {evidence.file_key}</li>
          ))}</ul></div>
        )}

        {item.timeline?.length > 0 && (
          <div><h3>Lịch sử xử lý</h3><ol className="operation-timeline">{item.timeline.map((event, index) => (
            <li key={`${event.at}-${index}`}><strong>{event.action}</strong><span>{event.note || 'Cập nhật trạng thái'} · {formatOperationDate(event.at)}</span></li>
          ))}</ol></div>
        )}

        {canPropose && (
          <form className="operation-case-proposal" onSubmit={submitProposal}>
            <h3>Trình Manager quyết định</h3>
            <p>Operation chỉ ghi nhận đề xuất; quyết định bồi thường thuộc Manager.</p>
            <label>Chi phí / mức bồi thường đề xuất (VND)
              <input aria-label="Mức bồi thường đề xuất" type="number" min="0" step="1" required value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
            <label>Trách nhiệm đề xuất
              <select aria-label="Trách nhiệm đề xuất" value={responsibility} onChange={(event) => setResponsibility(event.target.value)}>
                <option value="undetermined">Chưa xác định</option>
                <option value="renter">Người thuê</option>
                <option value="owner">Chủ xe</option>
                <option value="garage">Gara</option>
                <option value="shared">Nhiều bên</option>
              </select>
            </label>
            <label>Căn cứ xác minh
              <textarea aria-label="Căn cứ xác minh" required maxLength="2000" value={proposalNote} onChange={(event) => setProposalNote(event.target.value)} />
            </label>
            <button className="operation-primary" type="submit" disabled={busy}>Gửi Manager xem xét</button>
          </form>
        )}

        <footer>
          <button onClick={onClose}>Đóng</button>
          {item.caseType && <>
            <button disabled={busy} onClick={() => onUpdate('note')}>Thêm ghi chú</button>
            <button disabled={busy} onClick={() => onUpdate('evidence')}>Đính kèm chứng cứ</button>
          </>}
        </footer>
      </section>
    </div>
  );
}
