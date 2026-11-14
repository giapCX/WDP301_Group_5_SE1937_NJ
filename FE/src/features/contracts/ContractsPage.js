import { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { getApi, postApi } from '../../services/httpClient';
import { getCurrentUser, getSessionToken } from '../auth/session';
import Pagination from '../../components/ui/Pagination';
import './contracts.css';
import ManagementContractPaper from './ManagementContractPaper';

export const contractStatus = { draft: 'Chờ lập nội dung', awaiting_signature: 'Chờ lập nội dung ký', pending_manager_review: 'Chờ Manager rà soát', pending_signatures: 'Đang trình ký', pending_signature: 'Chờ lập nội dung ký', signed: 'Đã ký đủ', active: 'Có hiệu lực', terminated: 'Đã chấm dứt', expired: 'Hết hạn', cancelled: 'Đã hủy' };
const time = (value) => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa ký';
const statusTone = (status) => ['active', 'signed'].includes(status) ? 'success' : ['terminated', 'expired', 'cancelled'].includes(status) ? 'muted' : 'pending';
const signatureState = (name, signedAt, signed = Boolean(signedAt)) => signed ? { title: 'Đã ký', name: name || 'Đã xác nhận', date: signedAt ? time(signedAt) : 'Đã xác nhận' } : { title: 'Chờ ký', name: 'Chưa ghi nhận chữ ký', date: 'Đang chờ xác nhận' };
const contractTypes = [
  { value: 'management', title: 'Hợp đồng ủy quyền quản lý xe', parties: 'Chủ xe ↔ XeDi', flow: 'Manager rà soát → Chủ xe ký → Manager ký' },
  { value: 'rental', title: 'Hợp đồng thuê xe', parties: 'XeDi ↔ Người thuê', flow: 'Người thuê ký → Operator tiếp nhận → Manager ký' },
];
const typeTitle = (type) => contractTypes.find((item) => item.value === type)?.title || 'Hợp đồng';
const contractTemplate = {
  management: {
    title: 'Mẫu hợp đồng ủy quyền cho thuê xe ô tô',
    fileName: 'Hop_dong_uy_quyen_cho_thue_xe_Xedi.docx',
    url: '/contract-templates/authorization.docx',
  },
  rental: {
    title: 'Mẫu hợp đồng thuê xe ô tô tự lái',
    fileName: 'Hop_dong_thue_xe_o_to_tu_lai_Xedi.docx',
    url: '/contract-templates/rental.docx',
  },
};
function workflowState(item) {
  if (item.status === 'pending_manager_review') return 'Chờ Manager rà soát nội dung';
  if (item.platformSigned ?? Boolean(item.platformSignedAt)) return item.status === 'active' ? 'Đang có hiệu lực' : 'Đã hoàn tất chữ ký';
  if (item.managerReviewStatus === 'approved' && item.partySigned) return 'Chờ Manager ký phía XeDi';
  if (item.operatorIntakeConfirmedAt) return 'Chờ Manager ký phía XeDi';
  if (item.partySigned) return 'Chờ Operator tiếp nhận';
  return item.document ? `Chờ ${item.type === 'management' ? 'Chủ xe' : 'Người thuê'} ký` : 'Chưa có nội dung trình ký';
}

export function ContractTemplatePreview({ type }) {
  const template = contractTemplate[type] || contractTemplate.management;
  const documentRef = useRef(null), styleRef = useRef(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    async function loadTemplate() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(template.url, { signal: controller.signal });
        if (!response.ok) throw new Error('Không tải được file mẫu hợp đồng.');
        const content = await response.arrayBuffer();
        if (controller.signal.aborted || !documentRef.current || !styleRef.current) return;
        documentRef.current.replaceChildren();
        styleRef.current.replaceChildren();
        await renderAsync(content, documentRef.current, styleRef.current, { breakPages: true });
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason.message || 'Không thể hiển thị file mẫu hợp đồng.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadTemplate();
    return () => controller.abort();
  }, [template.url]);
  return <section className="contract-template-preview" aria-label={template.title}>
    <header className="contract-template-header"><div><span className="contract-eyebrow">FILE WORD GỐC</span><h3>{template.title}</h3></div><a className="contract-button contract-button--secondary" href={template.url} download={template.fileName}>Tải file DOCX</a></header>
    <div ref={styleRef} className="contract-template-styles" />
    {loading && <div className="contract-loading" role="status"><span className="contract-spinner" />Đang mở file Word…</div>}
    {error && <p className="contract-alert" role="alert">{error}</p>}
    <div ref={documentRef} className="contract-template-document" />
  </section>;
}

export function ContractContent({ agreement }) {
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

export function SigningDialog({ item, view, onClose, onSigned }) {
  const [agreement, setAgreement] = useState(null), [error, setError] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const roles = getCurrentUser()?.roles || [];
  const [name, setName] = useState(getCurrentUser()?.full_name || '');
  const [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    getApi(`/contracts/${item.type}/${item.id}?view=${view}`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setAgreement(result.data); })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [item.type, item.id, view]);
  useEffect(() => {
    const key = (event) => { if (event.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [busy, onClose]);
  async function sign(event) {
    event.preventDefault(); if (busy || !accepted) return;
    setBusy(true); setError('');
    try {
      const result = await postApi(`/contracts/${item.type}/${item.id}/sign?view=${view}`, { signatureName: name, acceptedTerms: accepted, documentHash: agreement.document.hash });
      setAgreement(result.data); setAccepted(false); onSigned();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  async function confirmIntake() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await postApi(`/contracts/${item.type}/${item.id}/operator-intake?view=staff`, {});
      setAgreement(result.data); onSigned();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  async function reviewManagement(action) {
    if (busy) return;
    if (action === 'revision' && reviewNote.trim().length < 5) {
      setError('Ghi rõ nội dung cần chỉnh sửa (tối thiểu 5 ký tự).');
      return;
    }
    setBusy(true); setError('');
    try {
      const result = await postApi(`/contracts/management/${item.id}/manager-review?view=staff`, { action, note: reviewNote });
      setAgreement(result.data); setReviewNote(''); onSigned();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  return <div className="contract-backdrop"><section role="dialog" aria-modal="true" aria-label="Nội dung và ký hợp đồng" className="contract-dialog">
    <div className="contract-dialog-header"><div><span className="contract-eyebrow">XEDI · KÝ KẾT ĐIỆN TỬ</span><h2>Rà soát hợp đồng</h2><p>Đọc kỹ nội dung trước khi xác nhận.</p></div><div className="contract-toolbar">{agreement?.document && !agreement.document.articles?.length && <button className="contract-button contract-button--secondary" onClick={() => window.print()}>In / lưu PDF</button>}<button className="contract-close" onClick={onClose} disabled={busy} autoFocus aria-label="Đóng cửa sổ">×</button></div></div>
    {error && <p className="contract-alert" role="alert">{error}</p>}
    {!agreement ? <div className="contract-loading" role="status"><span className="contract-spinner" />Đang tải nội dung hợp đồng…</div> : <>
      <ContractContent agreement={agreement} />
      {agreement.canManagerRelease && <div className="contract-sign-form">
        <p>Manager rà soát bản hợp đồng đã tự điền sau khi xe được duyệt. Chỉ gửi Chủ xe ký khi nội dung phù hợp.</p>
        <label>Ghi chú rà soát<input maxLength={1000} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} disabled={busy} /></label>
        <div className="contract-toolbar">
          <button className="contract-button contract-button--secondary" type="button" onClick={() => reviewManagement('revision')} disabled={busy || reviewNote.trim().length < 5}>Yêu cầu chỉnh sửa</button>
          <button className="contract-button contract-button--primary" type="button" onClick={() => reviewManagement('approve')} disabled={busy}>{busy ? 'Đang ghi nhận…' : 'Duyệt nội dung, gửi Chủ xe ký'}</button>
        </div>
      </div>}
      {agreement.canOperatorConfirm && <div className="contract-sign-form">
        <p>Chủ xe/người thuê đã xác nhận. Hãy kiểm tra hồ sơ và xác nhận đã tiếp nhận để chuyển Manager ký phía XeDi. Đây không phải phê duyệt nội dung hoặc chữ ký thay Manager.</p>
        <button className="contract-button contract-button--primary" type="button" onClick={confirmIntake} disabled={busy}>{busy ? 'Đang ghi nhận…' : 'Xác nhận đã tiếp nhận'}</button>
      </div>}
      {agreement.canSign ? <form onSubmit={sign} className="contract-sign-form">
        <label>Họ tên người ký<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} disabled={busy} /></label>
        <label className="contract-accept"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} disabled={busy} /><span>Tôi đã đọc và đồng ý ký hợp đồng.</span></label>
        <button className="contract-button contract-button--primary" type="submit" disabled={busy || !accepted}>{busy ? 'Đang ghi nhận…' : 'Xác nhận ký hợp đồng'}</button>
      </form> :       <p className="contract-signing-note" role="status">      {view === 'staff' && agreement.partySigned && agreement.managerReviewStatus === 'approved' && !(agreement.platformSigned ?? Boolean(agreement.platformSignedAt))
          ? 'Chủ xe/người thuê đã ký sau bước rà soát. Hợp đồng đang chờ Manager ký phía XeDi.'
          : view === 'staff' && agreement.partySigned && agreement.operatorIntakeConfirmedAt && !(agreement.platformSigned ?? Boolean(agreement.platformSignedAt))
        ? 'Operator đã tiếp nhận hồ sơ. Hợp đồng đang chờ Manager ký phía XeDi.'
        : view === 'staff' && agreement.partySigned && !agreement.operatorIntakeConfirmedAt && !agreement.managerReviewStatus && roles.includes('MANAGER')
        ? 'Bên còn lại đã ký. Hợp đồng đang chờ Operator xác nhận tiếp nhận trước khi Manager có thể ký phía XeDi.'
        : !agreement.document
          ? 'Hồ sơ chưa có nội dung điện tử để ký. Manager cần lập nội dung trước khi các bên có thể xác nhận.'
        : agreement.status === 'pending_signatures'
          ? 'Bạn không cần ký phía này hoặc chữ ký của bạn đã được ghi nhận. Hợp đồng đang chờ bước tiếp theo.'
          : 'Hợp đồng hiện không cần chữ ký của bạn.'}</p>}
    </>}
  </section></div>;
}

export default function ContractsPage({ embedded = false } = {}) {
  const user = getCurrentUser(), roles = user?.roles || [];
  const staff = roles.some((role) => ['MANAGER', 'OPERATION_STAFF'].includes(role));
  const operator = roles.includes('OPERATION_STAFF');
  const permissions = user?.permissions || [];
  const owner = roles.some((role) => ['OWNER', 'CAR_OWNER'].includes(role));
  const [view, setView] = useState(staff ? 'staff' : 'party');
  const [type, setType] = useState(staff || owner ? 'management' : 'rental');
  const [rows, setRows] = useState([]), [candidates, setCandidates] = useState([]);
  const [page, setPage] = useState(1), [limit, setLimit] = useState(10), [pagination, setPagination] = useState(null);
  const [query, setQuery] = useState(''), [searchText, setSearchText] = useState(''), [status, setStatus] = useState('all');
  const [candidatePage, setCandidatePage] = useState(1), [candidateMeta, setCandidateMeta] = useState(null);
  const [reference, setReference] = useState(''), [start, setStart] = useState(''), [end, setEnd] = useState('');
  const [terms, setTerms] = useState({ commissionRatePct: '', place: '', garage: '', platformName: '' });
  const changeTerm = (event) => setTerms((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [selected, setSelected] = useState(null), [revision, setRevision] = useState(0);
  const canPrepare = view === 'staff' && roles.includes('MANAGER') && (type === 'rental' || roles.includes('MANAGER'));
  const typesFor = (scope) => scope === 'staff' ? (roles.includes('MANAGER') || roles.includes('OPERATION_STAFF') ? ['management', 'rental'] : ['rental']) : [...(owner ? ['management'] : []), ...(roles.includes('RENTER') ? ['rental'] : [])];
  const refresh = () => setRevision((value) => value + 1);
  useEffect(() => {
    if (!getSessionToken()) { setLoading(false); return; }
    const controller = new AbortController(); setLoading(true); setError('');
    const params = new URLSearchParams({ view, page: String(page), limit: String(limit) });
    if (query.trim()) params.set('q', query.trim());
    if (status !== 'all') params.set('status', status);
    getApi(`/contracts/${type}?${params}`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) { setRows(result.data); setPagination(result.pagination); setPage(result.pagination.page); } })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [type, view, page, limit, revision, query, status]);
  useEffect(() => {
    if (!canPrepare) return;
    const controller = new AbortController(); setReference(''); setCandidates([]); setCandidateMeta(null);
    getApi(`/contracts/${type}/candidates?page=${candidatePage}&limit=10`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) { setCandidates(result.data); setCandidateMeta(result.pagination); setCandidatePage(result.pagination.page); } })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [type, canPrepare, candidatePage, revision]);
  async function prepare(event) {
    event.preventDefault(); if (!reference || busy) return;
    setBusy(true); setError('');
    try {
      const managementFields = type === 'management' ? {
        ...(start ? { startDate: start } : {}), ...(end ? { endDate: end } : {}),
        ...(terms.commissionRatePct !== '' ? { commissionRatePct: Number(terms.commissionRatePct) } : {}),
        ...Object.fromEntries(['place', 'garage', 'platformName'].filter((key) => terms[key].trim()).map((key) => [key, terms[key]])),
      } : {};
      const result = await postApi(`/contracts/${type}/prepare/${reference}`, managementFields);
      setSelected(result.data); refresh();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  const submitSearch = (event) => {
    event.preventDefault();
    setQuery(searchText.trim());
    setPage(1);
  };
  const reset = () => { setPage(1); setCandidatePage(1); setReference(''); setSelected(null); setQuery(''); setSearchText(''); };
  if (!getSessionToken()) return <main className="contracts-page"><section className="contract-login-card"><span className="contract-hero-icon">▤</span><span className="contract-eyebrow">XEDI · HỒ SƠ ĐIỆN TỬ</span><h1>Hợp đồng của bạn</h1><p>Đăng nhập để xem nội dung, theo dõi chữ ký và trạng thái hiệu lực.</p><a className="contract-button contract-button--primary" href="/#/login">Đăng nhập</a></section></main>;
  const pendingCount = rows.filter((item) => ['draft', 'awaiting_signature', 'pending_signature', 'pending_signatures', 'pending_manager_review'].includes(item.status)).length;
  const effectiveCount = rows.filter((item) => ['active', 'signed'].includes(item.status)).length;
  const selectedType = contractTypes.find((item) => item.value === type) || contractTypes[0];
  return <main className={`contracts-page${embedded ? ' contracts-page--embedded' : ''}`}>
    {!embedded && <header className="contracts-header"><div className="contracts-brand"><span className="contract-hero-icon">▤</span><div><span className="contract-eyebrow">XEDI · HỒ SƠ ĐIỆN TỬ</span><h1>Hợp đồng</h1><p>Rà soát nội dung, hoàn tất chữ ký và theo dõi hiệu lực.</p></div></div><nav><a href="/#trang-chu">Trang chủ</a>{staff && <a href={roles.includes('MANAGER') ? '/#/manager' : '/#/operator'}>Không gian làm việc</a>}{owner && <a href="/owner">Chủ xe</a>}<button className="contract-button contract-button--secondary" onClick={refresh} aria-label="Tải lại danh sách">↻ <span>Tải lại</span></button></nav></header>}
    <section className="contract-welcome"><div><span className="contract-eyebrow">{view === 'staff' ? 'KHÔNG GIAN NỀN TẢNG' : 'KHÔNG GIAN CỦA BẠN'}</span><h2>{typeTitle(type)}</h2><p>{type === 'management' ? 'Theo dõi thỏa thuận ủy quyền giữa Chủ xe và XeDi, từ chữ ký Chủ xe đến khi Manager ký phía XeDi.' : 'Theo dõi hợp đồng thuê giữa XeDi và Người thuê, từ chữ ký Người thuê đến khi Manager ký phía XeDi.'}</p></div><div className="contract-summary"><div><strong>{pagination?.total ?? rows.length}</strong><span>Tổng hồ sơ</span></div><div><strong>{pendingCount}</strong><span>Chờ xử lý · trang này</span></div><div><strong>{effectiveCount}</strong><span>Hoàn tất · trang này</span></div></div></section>
    {staff && view === 'staff' && <section className="contract-type-switch" aria-label="Chọn luồng hợp đồng">
      {contractTypes.map((option, index) => <button key={option.value} type="button" className={`contract-type-option${type === option.value ? ' is-selected' : ''}`} aria-pressed={type === option.value} onClick={() => { setType(option.value); reset(); }}>
        <span className="contract-type-number">0{index + 1}</span><strong>{option.title}</strong><small>{option.parties}</small><span className="contract-type-flow">{option.flow}</span>
      </button>)}
    </section>}
    <section className="contract-controls"><div className="contract-filters">
      {staff && !embedded && <label>Phạm vi<select value={view} onChange={(event) => { setView(event.target.value); setType(typesFor(event.target.value)[0]); reset(); }}><option value="staff">Nền tảng</option>{(owner || roles.includes('RENTER')) && <option value="party">Hợp đồng của tôi</option>}</select></label>}
      {!(staff && view === 'staff') && <label>Loại hợp đồng<select value={type} onChange={(event) => { setType(event.target.value); reset(); }}>{typesFor(view).map((value) => <option value={value} key={value}>{typeTitle(value)}</option>)}</select></label>}
      <form className="contract-code-search" onSubmit={submitSearch}>
        <label htmlFor="contract-code-query">Mã hợp đồng<input id="contract-code-query" type="search" value={searchText} maxLength={100} onChange={(event) => setSearchText(event.target.value)} placeholder="Nhập đúng mã hợp đồng" /></label>
        <button className="contract-button contract-button--secondary" type="submit" disabled={searchText.trim() === query}>{query && !searchText.trim() ? 'Xóa tìm kiếm' : 'Tìm chính xác'}</button>
      </form>
      <label>Trạng thái<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">Tất cả</option>{Object.entries(contractStatus).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    </div><span className="contract-access-note">🔒 Chỉ người có quyền mới xem và ký được hợp đồng.</span></section>
    {operator && view === 'staff' && !permissions.includes('operation.contract.intake.confirm') && <p className="contract-permission-warning" role="status">Bạn vẫn có thể xem hợp đồng, nhưng tài khoản chưa được cấp quyền tiếp nhận để chuyển hồ sơ cho Manager.</p>}
    {error && <p className="contract-alert" role="alert">{error}<button className="contract-alert-close" onClick={() => setError('')} aria-label="Đóng thông báo">×</button></p>}
    {canPrepare && <form onSubmit={prepare} className="contract-prepare"><div className="contract-prepare-heading"><span className="contract-step">01</span><div><span className="contract-eyebrow">TẠO HỒ SƠ</span><h2>Lập nội dung trình ký</h2><p>{type === 'management' ? 'Hệ thống tự tạo hợp đồng sau khi Manager duyệt xe; tại đây có thể lập lại nội dung nếu cần.' : 'Hệ thống tự tạo hợp đồng khi Manager duyệt booking; tại đây có thể mở hoặc hoàn thiện hồ sơ còn thiếu.'}</p></div></div>
      <div className="contract-prepare-fields"><label>{type === 'management' ? 'Xe chờ lập nội dung hợp đồng' : 'Booking chờ ký'}<select required value={reference} onChange={(event) => setReference(event.target.value)}><option value="">{!candidateMeta ? 'Đang tải hồ sơ…' : candidates.length ? 'Chọn xe cần lập nội dung' : 'Không có hồ sơ phù hợp'}</option>{candidates.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
      {type === 'management' && <><label>Ngày bắt đầu<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Ngày kết thúc<input type="date" value={end} min={start || undefined} onChange={(event) => setEnd(event.target.value)} /></label>
        <label>Hoa hồng (%)<input name="commissionRatePct" type="number" min="0" max="100" step="0.01" value={terms.commissionRatePct} onChange={changeTerm} placeholder="Theo hồ sơ, mặc định 10" /></label>
        <label>Đơn vị nhận ủy quyền<input name="platformName" maxLength={150} value={terms.platformName} onChange={changeTerm} placeholder="XeDi" /></label>
        <label>Nơi lập hợp đồng<input name="place" maxLength={150} value={terms.place} onChange={changeTerm} placeholder="Trực tuyến trên XeDi" /></label>
        <label>Địa điểm tiếp nhận<input name="garage" maxLength={250} value={terms.garage} onChange={changeTerm} placeholder="Gara XeDi theo lịch tiếp nhận" /></label>
      </>}
      <button className="contract-button contract-button--primary" disabled={busy || !reference}>{busy ? 'Đang chuẩn bị…' : 'Lập / mở hợp đồng'} <span aria-hidden="true">→</span></button></div>
      {type === 'management' && candidateMeta && !candidates.length && <p className="contract-candidate-empty">Chưa có xe nào cần Manager lập hoặc hoàn thiện nội dung. Xe đã có nội dung trình ký hoặc hợp đồng còn hiệu lực được ẩn khỏi danh sách này.</p>}
      <Pagination page={candidatePage} pageSize={10} total={candidateMeta?.total || 0} onPageChange={setCandidatePage} label="Phân trang hồ sơ lập hợp đồng" />
    </form>}
    <section className="contract-results"><div className="contract-results-heading"><div><span className="contract-eyebrow">DANH SÁCH</span><h2>{selectedType.title}</h2></div><span>{pagination?.total ?? rows.length} hồ sơ</span></div>
    {loading ? <div className="contract-loading" role="status"><span className="contract-spinner" />Đang tải danh sách hợp đồng…</div> : rows.length ? <div className="contract-list">{rows.map((item) => { const platformSigned = item.platformSigned ?? Boolean(item.platformSignedAt); return <article className="contract-card" key={item.id}><div className="contract-card-main"><div className="contract-card-top"><span className={`contract-status contract-status--${statusTone(item.status)}`}>{contractStatus[item.status] || item.status}</span><span className="contract-card-type">{typeTitle(item.type)}</span><span className="contract-workflow-state">{workflowState(item)}</span></div><h3>{item.number}</h3><p className="contract-card-vehicle">{item.vehicle}</p><div className="contract-card-signatures"><span><i className={item.partySigned ? 'is-signed' : ''}>{item.partySigned ? '✓' : '·'}</i>{item.type === 'management' ? 'Chủ xe' : 'Người thuê'}: {item.partySigned ? 'Đã ký' : 'Chờ ký'}</span><span><i className={platformSigned ? 'is-signed' : ''}>{platformSigned ? '✓' : '·'}</i>XeDi: {platformSigned ? 'Đã ký' : 'Chờ ký'}</span></div></div><button className={`contract-button ${item.canSign || item.canManagerRelease ? 'contract-button--primary' : 'contract-button--secondary'}`} onClick={() => setSelected(item)}>{item.canManagerRelease ? 'Rà soát nội dung' : item.canSign ? 'Đọc và ký' : item.canOperatorConfirm ? 'Rà soát tiếp nhận' : 'Xem hợp đồng'} <span aria-hidden="true">→</span></button></article>; })}</div> : <div className="contract-empty"><span className="contract-empty-icon">▤</span><h3>Chưa có hợp đồng trong danh sách này</h3><p>{canPrepare ? 'Chọn hồ sơ phía trên để lập hoặc mở nội dung trình ký.' : 'Chưa có hồ sơ thuộc luồng hợp đồng này.'}</p></div>}
    </section>
    <Pagination page={page} pageSize={limit} total={pagination?.total || 0} disabled={loading} onPageChange={setPage} onPageSizeChange={(value) => { setLimit(value); setPage(1); }} />
    {selected && <SigningDialog key={`${selected.type}-${selected.id}-${view}`} item={selected} view={view} onClose={() => setSelected(null)} onSigned={refresh} />}
  </main>;
}
