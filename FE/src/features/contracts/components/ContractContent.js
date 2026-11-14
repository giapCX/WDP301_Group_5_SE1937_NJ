import { useState } from 'react';
import ContractTemplatePreview from './ContractTemplatePreview';
import ManagementContractPaper from '../ManagementContractPaper';
import { contractStatus, contractTemplate, signatureState, statusTone, time } from '../contractPresentation';

export default function ContractContent({ agreement }) {
  const [showingTemplate, setShowingTemplate] = useState(false);
  const template = contractTemplate[agreement.type] || contractTemplate.management;
  if (!agreement.document) {
    return <div className="contract-content">
      <div className="contract-document-heading">
        <div>
          <span className="contract-eyebrow">HỒ SƠ HỢP ĐỒNG</span>
          <h2>Chưa có nội dung để xem hoặc in</h2>
          <p className="contract-number">{agreement.number}</p>
        </div>
        <span className={`contract-status contract-status--${statusTone(agreement.status)}`}>{contractStatus[agreement.status] || agreement.status}</span>
      </div>
      <section className="contract-unprepared" role="status">
        <h3>Manager cần lập nội dung hợp đồng</h3>
        <p>Hệ thống sẽ tự điền thông tin xe hoặc booking vào văn bản. Sau khi Manager rà soát và lập nội dung, các bên có thể xem, ký, in; Operator có thể tiếp nhận hồ sơ theo đúng quy trình.</p>
        <p>Mẫu Word trống không phải hợp đồng của hồ sơ này và không thể ký hoặc in thay cho bản đã lập.</p>
      </section>
    </div>;
  }
  if (showingTemplate) {
    return <div className="contract-content">
      <div className="contract-document-heading"><div><span className="contract-eyebrow">MẪU WORD GỐC · CHỈ THAM KHẢO</span><h2>{agreement.document.title || template.title}</h2><p className="contract-number">{agreement.number}</p></div><span className={`contract-status contract-status--${statusTone(agreement.status)}`}>{contractStatus[agreement.status] || agreement.status}</span></div>
      <button className="contract-button contract-button--secondary contract-template-back" type="button" onClick={() => setShowingTemplate(false)}>Quay lại nội dung đã điền</button>
      <ContractTemplatePreview type={agreement.type} />
    </div>;
  }
  const openTemplate = <button className="contract-button contract-button--secondary contract-template-back" type="button" onClick={() => setShowingTemplate(true)}>Xem mẫu Word gốc</button>;
  if (agreement.document?.articles?.length) {
    return <div className="contract-content">{openTemplate}<ManagementContractPaper agreement={agreement} /></div>;
  }
  const partyLabel = agreement.type === 'management' ? 'Chủ xe' : 'Người thuê';
  const partySignature = signatureState(agreement.partyName, agreement.partySignedAt, agreement.partySigned);
  const platformSignature = signatureState(agreement.platformName, agreement.platformSignedAt, agreement.platformSigned);
  return <div className="contract-content">
    {openTemplate}
    <div className="contract-document-heading"><div><span className="contract-eyebrow">VĂN BẢN TRÌNH KÝ</span><h2>{agreement.document.title}</h2><p className="contract-number">{agreement.number}</p></div><span className={`contract-status contract-status--${statusTone(agreement.status)}`}>{contractStatus[agreement.status] || agreement.status}</span></div>
    <div className="contract-facts"><h3>Thông tin chính</h3><dl>{(agreement.document.facts || []).map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl></div>
    <div className="contract-terms"><h3>Điều khoản hợp đồng</h3><ol>{(agreement.document.clauses || []).map((clause, index) => <li key={`${index}-${clause}`}><span className="contract-clause-number">{String(index + 1).padStart(2, '0')}</span><span>{clause}</span></li>)}</ol></div>
    <p className="contract-document-meta">Phiên bản {agreement.document.version} <span>·</span> Lập lúc {time(agreement.document.prepared_at)}</p>
    <div className="contract-signatures"><h3>Trạng thái chữ ký</h3>
      {[{ label: partyLabel, ...partySignature }, { label: 'Đại diện XeDi', ...platformSignature }].map((signature) => <div className="contract-signature" key={signature.label}><span className={`contract-signature-check ${signature.title === 'Đã ký' ? 'is-signed' : ''}`}>{signature.title === 'Đã ký' ? '✓' : '·'}</span><div><strong>{signature.label}</strong><span>{signature.name}</span><small>{signature.date}</small></div><b>{signature.title}</b></div>)}
    </div>
    <p className="contract-signing-note">Xác nhận được ghi nhận theo tài khoản đang đăng nhập. Hệ thống hiện chưa tích hợp OTP hoặc chữ ký số có chứng thực.</p>
  </div>;
}

