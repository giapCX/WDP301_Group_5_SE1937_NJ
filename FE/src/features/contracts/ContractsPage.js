import { useState } from 'react';
import useContractsWorkspace from './hooks/useContractsWorkspace';
import { getCurrentUser, getSessionToken } from '../auth/session';
import Pagination from '../../components/ui/Pagination';
import SigningDialog from './components/SigningDialog';
import { contractStatus, contractTypes, statusTone, typeTitle, workflowState } from './contractPresentation';
import './contracts.css';

export default function ContractsPage({ embedded = false, initialType, queue } = {}) {
  const user = getCurrentUser(), roles = user?.roles || [];
  const staff = roles.some((role) => ['MANAGER', 'OPERATION_STAFF'].includes(role));
  const operator = roles.includes('OPERATION_STAFF');
  const permissions = user?.permissions || [];
  const owner = roles.some((role) => ['OWNER', 'CAR_OWNER'].includes(role));
  const [view, setView] = useState(staff ? 'staff' : 'party');
  const [type, setType] = useState(initialType || (staff || owner ? 'management' : 'rental'));
  const canPrepare = view === 'staff' && roles.includes('MANAGER');
  const { rows, candidates, page, setPage, limit, setLimit, pagination, query, setQuery, searchText, setSearchText, status, setStatus, candidatePage, setCandidatePage, candidateMeta, reference, setReference, start, setStart, end, setEnd, terms, setTerms, loading, busy, error, setError, selected, setSelected, refresh, prepare } = useContractsWorkspace({ type, view, canPrepare, queue });
  const changeTerm = (event) => setTerms((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  const typesFor = (scope) => scope === 'staff' ? (roles.includes('MANAGER') || roles.includes('OPERATION_STAFF') ? ['management', 'rental'] : ['rental']) : [...(owner ? ['management'] : []), ...(roles.includes('RENTER') ? ['rental'] : [])];
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
      <label>Trạng thái<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">Tất cả</option>
        {view === 'staff' && roles.includes('MANAGER') && <>
          <option value="waiting_party">Chờ khách ký</option>
          <option value="waiting_manager">Chờ Manager ký</option>
        </>}{Object.entries(contractStatus).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
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
    {loading ? <div className="contract-loading" role="status"><span className="contract-spinner" />Đang tải danh sách hợp đồng…</div> : rows.length ? <div className="contract-list">{rows.map((item) => { const platformSigned = item.platformSigned ?? Boolean(item.platformSignedAt); return <article className="contract-card" key={item.id}><div className="contract-card-main"><div className="contract-card-top"><span className={`contract-status contract-status--${statusTone(item.status)}`}>{contractStatus[item.status] || item.status}</span><span className="contract-card-type">{typeTitle(item.type)}</span><span className="contract-workflow-state">{workflowState(item)}</span></div><h3>{item.number}</h3><p className="contract-card-vehicle">{item.vehicle}</p><div className="contract-card-signatures"><span><i className={item.partySigned ? 'is-signed' : ''}>{item.partySigned ? '✓' : '·'}</i>{item.type === 'management' ? 'Chủ xe' : 'Người thuê'}: {item.partySigned ? 'Đã ký' : 'Chờ ký'}</span><span><i className={platformSigned ? 'is-signed' : ''}>{platformSigned ? '✓' : '·'}</i>XeDi: {platformSigned ? 'Đã ký' : 'Chờ ký'}</span></div></div><button className={`contract-button ${item.canSign || item.canManagerRelease ? 'contract-button--primary' : 'contract-button--secondary'}`} onClick={() => setSelected(item)}>{item.canManagerRelease ? 'Duyệt bản nháp' : item.canSign ? (view === 'staff' ? 'Manager ký hợp đồng' : 'Đọc và ký') : item.canOperatorConfirm ? 'Rà soát tiếp nhận' : 'Xem hợp đồng'} <span aria-hidden="true">→</span></button></article>; })}</div> : <div className="contract-empty"><span className="contract-empty-icon">▤</span><h3>Chưa có hợp đồng trong danh sách này</h3><p>{canPrepare ? 'Chọn hồ sơ phía trên để lập hoặc mở nội dung trình ký.' : 'Chưa có hồ sơ thuộc luồng hợp đồng này.'}</p></div>}
    </section>
    <Pagination page={page} pageSize={limit} total={pagination?.total || 0} disabled={loading} onPageChange={setPage} onPageSizeChange={(value) => { setLimit(value); setPage(1); }} />
    {selected && <SigningDialog key={`${selected.type}-${selected.id}-${view}`} item={selected} view={view} onClose={() => setSelected(null)} onSigned={refresh} />}
  </main>;
}
