import { useEffect, useState } from 'react';
import { getApi, postApi } from '../../services/httpClient';
import { getCurrentUser, getSessionToken } from '../auth/session';
import Pagination from '../../components/ui/Pagination';
import './contracts.css';
import ManagementContractPaper from './ManagementContractPaper';
import RentalContractPaper from './RentalContractPaper';

export const contractStatus = { draft: 'Chờ lập nội dung', awaiting_signature: 'Chờ lập nội dung ký', pending_signatures: 'Chờ chữ ký các bên', pending_signature: 'Chờ lập nội dung ký', signed: 'Đã ký đủ', active: 'Có hiệu lực', terminated: 'Đã chấm dứt', expired: 'Hết hạn', cancelled: 'Đã hủy' };
function RentalSigningProgress({ agreement, onOpenBooking }) {
  const unavailable = ['cancelled', 'rejected', 'expired'].includes(agreement.bookingStatus) || agreement.signingExpired;
  const renterSigned = Boolean(agreement.partySignedAt || agreement.signature?.renter_confirmed);
  const platformSigned = Boolean(agreement.platformSignedAt || agreement.signature?.platform_signer_user_id);
  const stage = !agreement.document ? 1 : !renterSigned ? 2 : !platformSigned ? 3 : 4;
  const steps = ['Tạo hồ sơ thuê', 'XeDi duyệt & lập nội dung', 'Khách thuê ký', 'XeDi ký', 'Thanh toán'];
  return <section className="renter-contract-progress" aria-label="Trình tự hợp đồng thuê xe">
    <h3>Trình tự hợp đồng</h3><ol>{steps.map((label, index) => <li key={label} aria-current={!unavailable && index === stage ? 'step' : undefined} data-completed={index < stage}>{label}</li>)}</ol>
    <p role="status">{unavailable ? 'Chuyến thuê đã kết thúc, bị từ chối hoặc hết thời hạn ký. Bạn vẫn có thể xem hồ sơ.' : !agreement.document ? 'Đã tạo hồ sơ. Đang chờ XeDi duyệt chuyến và lập nội dung trình ký.' : !renterSigned ? 'Nội dung đã sẵn sàng. Đọc hợp đồng, nhập họ tên và xác nhận ký bên dưới.' : !platformSigned ? 'Đã ghi nhận chữ ký của bạn. Đang chờ đại diện XeDi ký.' : 'Hai bên đã ký. Bạn có thể mở chuyến thuê để tiếp tục thanh toán.'}</p>
    {agreement.bookingId && <a className="contract-button contract-button--secondary" href={`#/renter/bookings/${agreement.bookingId}`} onClick={onOpenBooking}>Mở chuyến thuê & thanh toán</a>}
  </section>;
}
const time = (value) => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa ký';
const statusTone = (status) => ['active', 'signed'].includes(status) ? 'success' : ['terminated', 'expired', 'cancelled'].includes(status) ? 'muted' : 'pending';
const signatureState = (name, signedAt) => signedAt ? { title: 'Đã ký', name: name || 'Đã xác nhận', date: time(signedAt) } : { title: 'Chờ ký', name: 'Chưa ghi nhận chữ ký', date: 'Đang chờ xác nhận' };

export function ContractContent({ agreement }) {
  if (agreement.type === 'rental' && agreement.document) {
    return <div className="contract-content"><RentalContractPaper agreement={agreement} /></div>;
  }
  if (agreement.type === 'management' && agreement.document?.articles?.length) {
    return <div className="contract-content"><ManagementContractPaper agreement={agreement} /></div>;
  }
  const partyLabel = agreement.type === 'management' ? 'Chủ xe' : 'Khách thuê';
  const partySignature = signatureState(agreement.partyName, agreement.partySignedAt);
  const platformSignature = signatureState(agreement.platformName, agreement.platformSignedAt);
  return <div className="contract-content">
    <div className="contract-document-heading"><div><span className="contract-eyebrow">VĂN BẢN TRÌNH KÝ</span><h2>{agreement.document?.title || 'Hồ sơ hợp đồng'}</h2><p className="contract-number">{agreement.number}</p></div><span className={`contract-status contract-status--${statusTone(agreement.status)}`}>{contractStatus[agreement.status] || agreement.status}</span></div>
    {agreement.document ? <>
      <div className="contract-facts"><h3>Thông tin chính</h3><dl>{(agreement.document.facts || []).map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl></div>
      <div className="contract-terms"><h3>Điều khoản hợp đồng</h3><ol>{(agreement.document.clauses || []).map((clause, index) => <li key={`${index}-${clause}`}><span className="contract-clause-number">{String(index + 1).padStart(2, '0')}</span><span>{clause}</span></li>)}</ol></div>
      <p className="contract-document-meta">Phiên bản {agreement.document.version} <span>·</span> Lập lúc {time(agreement.document.prepared_at)}</p>
    </> : agreement.type === 'rental' && !['signed', 'active', 'terminated', 'expired', 'cancelled'].includes(agreement.status) ? <>
      <p>Thông tin hồ sơ thuê xe đã được lưu. Đây là bản tóm tắt trước trình ký; XeDi sẽ lập nội dung hợp đồng để bạn đọc và xác nhận.</p>
      <div className="contract-facts"><h3>Thông tin thuê xe</h3><dl>{(agreement.previewFacts || []).map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl></div>
    </> : <p>Hồ sơ này chưa có bản nội dung để ký trực tuyến. Với hợp đồng cũ đã ký giấy, giữ hồ sơ hiện có; không ký lại hoặc tự đổi nội dung.</p>}
    <div className="contract-signatures"><h3>Trạng thái chữ ký</h3>
      {[{ label: partyLabel, ...partySignature }, { label: 'Đại diện XeDi', ...platformSignature }].map((signature) => <div className="contract-signature" key={signature.label}><span className={`contract-signature-check ${signature.title === 'Đã ký' ? 'is-signed' : ''}`}>{signature.title === 'Đã ký' ? '✓' : '·'}</span><div><strong>{signature.label}</strong><span>{signature.name}</span><small>{signature.date}</small></div><b>{signature.title}</b></div>)}
    </div>
    <p className="contract-signing-note">Xác nhận được ghi nhận theo tài khoản đang đăng nhập. Hệ thống hiện chưa tích hợp OTP hoặc chữ ký số có chứng thực.</p>
  </div>;
}

export function SigningDialog({ item, view, onClose, onSigned }) {
  const [agreement, setAgreement] = useState(null), [error, setError] = useState('');
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
    if (item.type !== 'rental' || busy) return undefined;
    const controller = new AbortController();
    const timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      getApi(`/contracts/${item.type}/${item.id}?view=${view}`, { signal: controller.signal })
        .then(result => { if (!controller.signal.aborted) setAgreement(result.data); })
        .catch(reason => { if (!controller.signal.aborted) setError(reason.message); });
    }, 15000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [item.type, item.id, view, busy]);
  useEffect(() => { setAccepted(false); }, [agreement?.document?.hash]);
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
  return <div className="contract-backdrop"><section role="dialog" aria-modal="true" aria-label="Nội dung và ký hợp đồng" className="contract-dialog">
    <div className="contract-dialog-header"><div><span className="contract-eyebrow">XEDI · KÝ KẾT ĐIỆN TỬ</span><h2>Rà soát hợp đồng</h2><p>Đọc kỹ nội dung trước khi xác nhận.</p></div><div className="contract-toolbar">{!(agreement?.type === 'rental' && agreement?.document) && !agreement?.document?.articles?.length && <button className="contract-button contract-button--secondary" onClick={() => window.print()} disabled={!agreement}>In / lưu PDF</button>}<button className="contract-close" onClick={onClose} disabled={busy} autoFocus aria-label="Đóng cửa sổ">×</button></div></div>
    {error && <p className="contract-alert" role="alert">{error}</p>}
    {!agreement ? <div className="contract-loading" role="status"><span className="contract-spinner" />Đang tải nội dung hợp đồng…</div> : <>
      {agreement.type === 'rental' && <RentalSigningProgress agreement={agreement} onOpenBooking={onClose} />}
      <ContractContent agreement={agreement} />
      {agreement.canSign ? <form onSubmit={sign} className="contract-sign-form">
        <label>Họ tên người ký<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} disabled={busy} /></label>
        <label className="contract-accept"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} disabled={busy} /><span>Tôi đã đọc và đồng ý ký hợp đồng.</span></label>
        <button className="contract-button contract-button--primary" type="submit" disabled={busy || !accepted}>{busy ? 'Đang ghi nhận…' : 'Xác nhận ký hợp đồng'}</button>
      </form> : <p className="contract-signing-note" role="status">{agreement.status === 'pending_signatures' ? 'Bạn không cần ký phía này hoặc chữ ký của bạn đã được ghi nhận. Hợp đồng đang chờ bên còn lại xác nhận.' : 'Hợp đồng hiện không cần chữ ký của bạn.'}</p>}
    </>}
  </section></div>;
}

export default function ContractsPage({ embedded = false } = {}) {
  const user = getCurrentUser(), roles = user?.roles || [];
  const staff = roles.some((role) => ['MANAGER', 'OPERATION_STAFF'].includes(role));
  const owner = roles.some((role) => ['OWNER', 'CAR_OWNER'].includes(role));
  const [view, setView] = useState(staff ? 'staff' : 'party');
  const [type, setType] = useState(owner || roles.includes('MANAGER') ? 'management' : 'rental');
  const [rows, setRows] = useState([]), [candidates, setCandidates] = useState([]);
  const [page, setPage] = useState(1), [limit, setLimit] = useState(10), [pagination, setPagination] = useState(null);
  const [candidatePage, setCandidatePage] = useState(1), [candidateMeta, setCandidateMeta] = useState(null);
  const [reference, setReference] = useState(''), [start, setStart] = useState(''), [end, setEnd] = useState('');
  const [terms, setTerms] = useState({ commissionRatePct: '', place: '', garage: '', platformName: '' });
  const changeTerm = (event) => setTerms((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [selected, setSelected] = useState(null), [revision, setRevision] = useState(0);
  const canPrepare = view === 'staff' && (type === 'rental' || roles.includes('MANAGER'));
  const typesFor = (scope) => scope === 'staff' ? (roles.includes('MANAGER') ? ['management', 'rental'] : ['rental']) : [...(owner ? ['management'] : []), ...(roles.includes('RENTER') ? ['rental'] : [])];
  const refresh = () => setRevision((value) => value + 1);
  useEffect(() => {
    if (!getSessionToken()) { setLoading(false); return; }
    const controller = new AbortController(); setLoading(true); setError('');
    getApi(`/contracts/${type}?view=${view}&page=${page}&limit=${limit}`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) { setRows(result.data); setPagination(result.pagination); setPage(result.pagination.page); } })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [type, view, page, limit, revision]);
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
  const reset = () => { setPage(1); setCandidatePage(1); setReference(''); setSelected(null); };
  if (!getSessionToken()) return <main className="contracts-page"><section className="contract-login-card"><span className="contract-hero-icon">▤</span><span className="contract-eyebrow">XEDI · HỒ SƠ ĐIỆN TỬ</span><h1>Hợp đồng của bạn</h1><p>Đăng nhập để xem nội dung, theo dõi chữ ký và trạng thái hiệu lực.</p><a className="contract-button contract-button--primary" href="/#/login">Đăng nhập</a></section></main>;
  const pendingCount = rows.filter((item) => ['draft', 'awaiting_signature', 'pending_signature', 'pending_signatures'].includes(item.status)).length;
  const effectiveCount = rows.filter((item) => ['active', 'signed'].includes(item.status)).length;
  return <main className={`contracts-page${embedded ? ' contracts-page--embedded' : ''}`}>
    {!embedded && <header className="contracts-header"><div className="contracts-brand"><span className="contract-hero-icon">▤</span><div><span className="contract-eyebrow">XEDI · HỒ SƠ ĐIỆN TỬ</span><h1>Hợp đồng</h1><p>Rà soát nội dung, hoàn tất chữ ký và theo dõi hiệu lực.</p></div></div><nav><a href="/#trang-chu">Trang chủ</a>{staff && <a href={roles.includes('MANAGER') ? '/#/manager' : '/#/operations'}>Không gian làm việc</a>}{owner && <a href="/owner">Chủ xe</a>}<button className="contract-button contract-button--secondary" onClick={refresh} aria-label="Tải lại danh sách">↻ <span>Tải lại</span></button></nav></header>}
    <section className="contract-welcome"><div><span className="contract-eyebrow">{view === 'staff' ? 'KHÔNG GIAN NỀN TẢNG' : 'KHÔNG GIAN CỦA BẠN'}</span><h2>{type === 'management' ? 'Quản lý xe' : 'Thuê xe'}</h2><p>{type === 'management' ? 'Theo dõi thỏa thuận giữa chủ xe và XeDi, từ khâu trình ký đến khi có hiệu lực.' : 'Theo dõi hợp đồng thuê xe và chữ ký của khách hàng cùng XeDi.'}</p></div><div className="contract-summary"><div><strong>{pagination?.total ?? rows.length}</strong><span>Tổng hồ sơ</span></div><div><strong>{pendingCount}</strong><span>Chờ ký · trang này</span></div><div><strong>{effectiveCount}</strong><span>Hiệu lực · trang này</span></div></div></section>
    <section className="contract-controls"><div className="contract-filters">
      {staff && <label>Phạm vi<select value={view} onChange={(event) => { setView(event.target.value); setType(typesFor(event.target.value)[0]); reset(); }}><option value="staff">Nền tảng</option>{(owner || roles.includes('RENTER')) && <option value="party">Hợp đồng của tôi</option>}</select></label>}
      <label>Loại hợp đồng<select value={type} onChange={(event) => { setType(event.target.value); reset(); }}>{typesFor(view).map((value) => <option value={value} key={value}>{value === 'management' ? 'Quản lý xe' : 'Thuê xe'}</option>)}</select></label>
    </div><span className="contract-access-note">🔒 Chỉ người có quyền mới xem và ký được hợp đồng.</span></section>
    {error && <p className="contract-alert" role="alert">{error}<button className="contract-alert-close" onClick={() => setError('')} aria-label="Đóng thông báo">×</button></p>}
    {canPrepare && <form onSubmit={prepare} className="contract-prepare"><div className="contract-prepare-heading"><span className="contract-step">01</span><div><span className="contract-eyebrow">TẠO HỒ SƠ</span><h2>Lập nội dung trình ký</h2><p>{type === 'management' ? 'Chỉ lập sau khi xe và biên bản kiểm định được duyệt. Thời hạn mặc định một năm.' : 'Chọn booking đã duyệt. Giá thuê, tiền cọc và lịch được lấy từ booking.'}</p></div></div>
      <div className="contract-prepare-fields"><label>{type === 'management' ? 'Xe được duyệt, chưa có hồ sơ hợp đồng' : 'Booking chờ ký'}<select required value={reference} onChange={(event) => setReference(event.target.value)}><option value="">{!candidateMeta ? 'Đang tải hồ sơ…' : candidates.length ? 'Chọn xe chưa có hồ sơ' : 'Không có hồ sơ phù hợp'}</option>{candidates.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
      {type === 'management' && <><label>Ngày bắt đầu<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Ngày kết thúc<input type="date" value={end} min={start || undefined} onChange={(event) => setEnd(event.target.value)} /></label>
        <label>Hoa hồng (%)<input name="commissionRatePct" type="number" min="0" max="100" step="0.01" value={terms.commissionRatePct} onChange={changeTerm} placeholder="Theo hồ sơ, mặc định 10" /></label>
        <label>Đơn vị nhận ủy quyền<input name="platformName" maxLength={150} value={terms.platformName} onChange={changeTerm} placeholder="XeDi" /></label>
        <label>Nơi lập hợp đồng<input name="place" maxLength={150} value={terms.place} onChange={changeTerm} placeholder="Trực tuyến trên XeDi" /></label>
        <label>Địa điểm tiếp nhận<input name="garage" maxLength={250} value={terms.garage} onChange={changeTerm} placeholder="Gara XeDi theo lịch tiếp nhận" /></label>
      </>}
      <button className="contract-button contract-button--primary" disabled={busy || !reference}>{busy ? 'Đang chuẩn bị…' : 'Lập / mở hợp đồng'} <span aria-hidden="true">→</span></button></div>
      {type === 'management' && candidateMeta && !candidates.length && <p className="contract-candidate-empty">Chưa có xe nào cần lập hồ sơ mới. Xe đã có hồ sơ trình ký hoặc hợp đồng còn hiệu lực được ẩn khỏi danh sách này.</p>}
      <Pagination page={candidatePage} pageSize={10} total={candidateMeta?.total || 0} onPageChange={setCandidatePage} label="Phân trang hồ sơ lập hợp đồng" />
    </form>}
    <section className="contract-results"><div className="contract-results-heading"><div><span className="contract-eyebrow">DANH SÁCH</span><h2>Hồ sơ hợp đồng</h2></div><span>{pagination?.total ?? rows.length} hồ sơ</span></div>
    {loading ? <div className="contract-loading" role="status"><span className="contract-spinner" />Đang tải danh sách hợp đồng…</div> : rows.length ? <div className="contract-list">{rows.map((item) => <article className="contract-card" key={item.id}><div className="contract-card-main"><div className="contract-card-top"><span className={`contract-status contract-status--${statusTone(item.status)}`}>{contractStatus[item.status] || item.status}</span><span className="contract-card-type">{item.type === 'management' ? 'Hợp đồng quản lý xe' : 'Hợp đồng thuê xe'}</span></div><h3>{item.number}</h3><p className="contract-card-vehicle">{item.vehicle}</p><div className="contract-card-signatures"><span><i className={item.partySignedAt ? 'is-signed' : ''}>{item.partySignedAt ? '✓' : '·'}</i>{item.type === 'management' ? 'Chủ xe' : 'Khách thuê'}: {item.partySignedAt ? 'Đã ký' : 'Chờ ký'}</span><span><i className={item.platformSignedAt ? 'is-signed' : ''}>{item.platformSignedAt ? '✓' : '·'}</i>XeDi: {item.platformSignedAt ? 'Đã ký' : 'Chờ ký'}</span></div></div><button className={`contract-button ${item.canSign ? 'contract-button--primary' : 'contract-button--secondary'}`} onClick={() => setSelected(item)}>{item.canSign ? 'Đọc và ký' : 'Xem hợp đồng'} <span aria-hidden="true">→</span></button></article>)}</div> : <div className="contract-empty"><span className="contract-empty-icon">▤</span><h3>Chưa có hợp đồng trong danh sách này</h3><p>{canPrepare ? 'Chọn hồ sơ phía trên để lập hoặc mở nội dung trình ký.' : 'Khi hợp đồng được tạo, hồ sơ sẽ xuất hiện tại đây.'}</p></div>}
    </section>
    <Pagination page={page} pageSize={limit} total={pagination?.total || 0} disabled={loading} onPageChange={setPage} onPageSizeChange={(value) => { setLimit(value); setPage(1); }} />
    {selected && <SigningDialog key={`${selected.type}-${selected.id}-${view}`} item={selected} view={view} onClose={() => setSelected(null)} onSigned={refresh} />}
  </main>;
}
