import { useEffect, useState } from 'react';
import { getApi, postApi } from '../../../services/httpClient';
import GaragePhotoPreview from '../../garage/components/GaragePhotoPreview';
import './operationIncidents.css';
import Pagination from '../../../components/ui/Pagination';

function ProposalForm({ incident, onSaved }) {
  const pendingIndex = (incident.compensation_claims || []).findIndex((claim) => !claim.decision || claim.decision === 'pending');
  const claim = incident.compensation_claims?.[pendingIndex];
  const [amount, setAmount] = useState(String(claim?.requested_amount ?? ''));
  const [basis, setBasis] = useState('');
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      await postApi(`/operations/incidents/${incident._id}/compensation-proposal`, {
        amount: Number(amount), evidenceBasis: basis, renterResponse: response,
        ...(pendingIndex >= 0 ? { claimIndex: pendingIndex } : {}),
      });
      onSaved();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  if (incident.investigation?.review_status === 'proposed') return <p role="status">Đã gửi đề xuất. Chờ Manager ra quyết định.</p>;
  if (!incident.booking_id) return <p>Chưa liên kết chuyến thuê. Cần xác minh trách nhiệm giữ xe; không được đề xuất trừ cọc khách.</p>;
  return <form onSubmit={submit}>
    <label>Số tiền đề xuất (VND)<input type="number" required min="1" step="1" max={claim?.requested_amount} value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
    <label>Căn cứ điều tra, so sánh hiện trạng và chi phí<textarea required minLength={10} maxLength={3000} value={basis} onChange={(event) => setBasis(event.target.value)} /></label>
    <label>Phản hồi thực tế của khách<select required value={response} onChange={(event) => setResponse(event.target.value)}>
      <option value="">Chọn trạng thái đã ghi nhận</option><option value="agreed">Khách đồng ý</option><option value="disputed">Khách có bất đồng</option><option value="not_received">Chưa nhận được phản hồi</option>
    </select></label>
    <small>Chưa phản hồi không đồng nghĩa khách chấp thuận. Gửi đề xuất chưa khấu trừ cọc.</small>
    {error && <p role="alert">{error}</p>}
    <button type="submit" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi đề xuất cho Manager'}</button>
  </form>;
}

export default function OperationIncidentsPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    getApi(`/operations/incidents?page=${page}&limit=${pageSize}`, { signal: controller.signal }).then(({ data, pagination: metadata }) => {
      if (!controller.signal.aborted) {
        setItems(data); setPagination(metadata);
        if (metadata) setPage(metadata.page);
      }
    }).catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, page, pageSize]);
  const reload = () => setRevision((value) => value + 1);
  return <main className="operation-incidents-page">
    <header><div><h1>Xác minh sự cố</h1><p>Operation kiểm tra chứng cứ và lập đề xuất; Manager duyệt trách nhiệm và khoản tiền.</p></div><a href="/#trang-chu">Trang chủ</a><button onClick={reload}>Tải lại</button></header>
    {loading ? <p>Đang tải hồ sơ…</p> : error ? <p role="alert">{error}</p> : <>
      {items.map((item) => <article key={item._id}>
        <h2>{item.case_number}</h2><p>{item.description}</p><p>Trạng thái: {item.status}</p>
        <div className="gs-photo-grid">{(item.evidence || []).filter((evidence) => evidence.file_key?.startsWith('garage-photos/')).map((evidence) => <div key={evidence.file_key}><GaragePhotoPreview photo={{ key: evidence.file_key, name: evidence.file_key.split('/').at(-1) }} /></div>)}</div>
        <ProposalForm key={`${item._id}-${item.updated_at || ''}`} incident={item} onSaved={reload} />
      </article>)}
      {!items.length && <p>Không có sự cố đang mở.</p>}
      <Pagination page={pagination?.page ?? page} pageSize={pageSize} total={pagination?.total ?? 0} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} label="Phân trang sự cố Operation" />
    </>}
  </main>;
}
