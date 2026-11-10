import { useEffect, useState } from 'react';
import { getApi, postApi } from '../../services/httpClient';
import { getCurrentUser, getSessionToken } from '../auth/session';
import Pagination from '../../components/ui/Pagination';
import './contracts.css';

export const contractStatus = { draft: 'Chờ lập nội dung', awaiting_signature: 'Chờ lập nội dung ký', pending_signatures: 'Chờ chữ ký các bên', pending_signature: 'Chờ lập nội dung ký', signed: 'Đã ký đủ', active: 'Có hiệu lực', terminated: 'Đã chấm dứt', expired: 'Hết hạn', cancelled: 'Đã hủy' };
const time = (value) => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa ký';

export function ContractContent({ agreement }) {
  return <div className="contract-content">
    <h2>{agreement.document?.title || 'Hồ sơ hợp đồng'}</h2>
    <p><strong>{agreement.number}</strong> · {contractStatus[agreement.status] || agreement.status}</p>
    {agreement.document ? <>
      <dl>{agreement.document.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
      <ol>{agreement.document.clauses.map((clause) => <li key={clause}>{clause}</li>)}</ol>
      <p>Phiên bản: {agreement.document.version} · Lập lúc {time(agreement.document.prepared_at)}</p>
    </> : <p>Hồ sơ này chưa có bản nội dung để ký trực tuyến. Với hợp đồng cũ đã ký giấy, giữ hồ sơ hiện có; không ký lại hoặc tự đổi nội dung.</p>}
    <div className="contract-signatures">
      <p><strong>{agreement.type === 'management' ? 'Chủ xe' : 'Khách thuê'}</strong><br />{agreement.partyName || '—'}<br />{time(agreement.partySignedAt)}</p>
      <p><strong>Đại diện XeDi</strong><br />{agreement.platformName || '—'}<br />{time(agreement.platformSignedAt)}</p>
    </div>
    <small>Xác nhận điện tử bằng tài khoản đăng nhập; chưa tích hợp OTP hoặc chữ ký số có chứng thực.</small>
  </div>;
}

function SigningDialog({ item, view, onClose, onSigned }) {
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
    <div className="contract-toolbar"><button onClick={() => window.print()} disabled={!agreement}>In / lưu PDF</button><button onClick={onClose} disabled={busy} autoFocus>Đóng</button></div>
    {error && <p role="alert">{error}</p>}
    {!agreement ? <p>Đang tải hợp đồng…</p> : <>
      <ContractContent agreement={agreement} />
      {agreement.canSign ? <form onSubmit={sign} className="contract-sign-form">
        <p>Bạn ký với tư cách <strong>{view === 'staff' ? 'đại diện nền tảng XeDi' : item.type === 'management' ? 'chủ xe' : 'khách thuê'}</strong>.</p>
        <label>Họ tên người ký<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} disabled={busy} /></label>
        <label className="contract-accept"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} disabled={busy} />Tôi đã đọc toàn bộ nội dung và đồng ý ký hợp đồng này.</label>
        <button type="submit" disabled={busy || !accepted}>{busy ? 'Đang ghi nhận…' : 'Xác nhận ký hợp đồng'}</button>
      </form> : <p role="status">{agreement.status === 'pending_signatures' ? 'Chữ ký của bạn đã được ghi nhận hoặc bạn không có quyền ký phía này. Chờ bên còn lại xác nhận.' : 'Hợp đồng hiện không cần chữ ký của bạn.'}</p>}
    </>}
  </section></div>;
}

export default function ContractsPage() {
  const user = getCurrentUser(), roles = user?.roles || [];
  const staff = roles.some((role) => ['MANAGER', 'OPERATION_STAFF'].includes(role));
  const owner = roles.some((role) => ['OWNER', 'CAR_OWNER'].includes(role));
  const [view, setView] = useState(staff ? 'staff' : 'party');
  const [type, setType] = useState(owner || roles.includes('MANAGER') ? 'management' : 'rental');
  const [rows, setRows] = useState([]), [candidates, setCandidates] = useState([]);
  const [page, setPage] = useState(1), [limit, setLimit] = useState(10), [pagination, setPagination] = useState(null);
  const [candidatePage, setCandidatePage] = useState(1), [candidateMeta, setCandidateMeta] = useState(null);
  const [reference, setReference] = useState(''), [start, setStart] = useState(''), [end, setEnd] = useState('');
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
    const controller = new AbortController(); setReference(''); setCandidates([]);
    getApi(`/contracts/${type}/candidates?page=${candidatePage}&limit=10`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) { setCandidates(result.data); setCandidateMeta(result.pagination); setCandidatePage(result.pagination.page); } })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason.message); });
    return () => controller.abort();
  }, [type, canPrepare, candidatePage, revision]);
  async function prepare(event) {
    event.preventDefault(); if (!reference || busy) return;
    setBusy(true); setError('');
    try {
      const result = await postApi(`/contracts/${type}/prepare/${reference}`, { ...(start ? { startDate: start } : {}), ...(end ? { endDate: end } : {}) });
      setSelected(result.data); refresh();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  const reset = () => { setPage(1); setCandidatePage(1); setReference(''); setSelected(null); };
  if (!getSessionToken()) return <main className="contracts-page"><h1>Hợp đồng</h1><a href="/#/login">Đăng nhập để xem hợp đồng của bạn</a></main>;
  return <main className="contracts-page">
    <header><div><h1>Hợp đồng</h1><p>Đọc nội dung, ký riêng từng bên và theo dõi hiệu lực.</p></div><nav><a href="/#trang-chu">Trang chủ</a>{staff && <a href={roles.includes('MANAGER') ? '/#/manager' : '/#/operations'}>Không gian làm việc</a>}{owner && <a href="/owner">Chủ xe</a>}<button onClick={refresh}>Tải lại</button></nav></header>
    <div className="contract-filters">
      {staff && <label>Phạm vi<select value={view} onChange={(event) => { setView(event.target.value); setType(typesFor(event.target.value)[0]); reset(); }}><option value="staff">Nền tảng</option>{(owner || roles.includes('RENTER')) && <option value="party">Hợp đồng của tôi</option>}</select></label>}
      <label>Loại hợp đồng<select value={type} onChange={(event) => { setType(event.target.value); reset(); }}>{typesFor(view).map((value) => <option value={value} key={value}>{value === 'management' ? 'Quản lý xe' : 'Thuê xe'}</option>)}</select></label>
    </div>
    {error && <p role="alert">{error}</p>}
    {canPrepare && <form onSubmit={prepare} className="contract-prepare"><h2>Lập nội dung trình ký</h2><p>{type === 'management' ? 'Chỉ lập sau khi xe và biên bản kiểm định được duyệt. Mặc định thời hạn một năm; có thể chọn ngày trước khi lập.' : 'Chọn booking đã duyệt. Giá thuê, cọc và lịch lấy từ booking; hệ thống kiểm tra lại hồ sơ và quyền cho thuê.'}</p>
      <label>{type === 'management' ? 'Xe được duyệt' : 'Booking chờ ký'}<select required value={reference} onChange={(event) => setReference(event.target.value)}><option value="">Chọn hồ sơ</option>{candidates.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
      {type === 'management' && <><label>Ngày bắt đầu<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Ngày kết thúc<input type="date" value={end} min={start || undefined} onChange={(event) => setEnd(event.target.value)} /></label></>}
      <button disabled={busy || !reference}>Lập / mở hợp đồng</button>
      <Pagination page={candidatePage} pageSize={10} total={candidateMeta?.total || 0} onPageChange={setCandidatePage} label="Phân trang hồ sơ lập hợp đồng" />
    </form>}
    {loading ? <p>Đang tải danh sách…</p> : <><div className="contract-list">{rows.map((item) => <article key={item.id}><div><h2>{item.number}</h2><p>{item.vehicle}</p><p>{contractStatus[item.status] || item.status}</p><small>Bên khách hàng: {time(item.partySignedAt)} · XeDi: {time(item.platformSignedAt)}</small></div><button onClick={() => setSelected(item)}>{item.canSign ? 'Đọc và ký' : 'Xem hợp đồng'}</button></article>)}</div>{!rows.length && <p>Chưa có hợp đồng trong phạm vi này.</p>}</>}
    <Pagination page={page} pageSize={limit} total={pagination?.total || 0} disabled={loading} onPageChange={setPage} onPageSizeChange={(value) => { setLimit(value); setPage(1); }} />
    {selected && <SigningDialog key={`${selected.type}-${selected.id}-${view}`} item={selected} view={view} onClose={() => setSelected(null)} onSigned={refresh} />}
  </main>;
}
