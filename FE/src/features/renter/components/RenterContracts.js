import { useEffect, useState } from 'react';
import { getApi } from '../../../services/httpClient';
import Pagination from '../../../components/ui/Pagination';
import { SigningDialog, contractStatus } from '../../contracts/ContractsPage';
import { dateTime, vnd } from '../api/renterApi';

export default function RenterContracts() {
  const [rows, setRows] = useState([]), [pagination, setPagination] = useState({ total: 0 });
  const [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [selected, setSelected] = useState(null);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    getApi(`/contracts/rental?view=party&page=${page}&limit=10`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setRows(result.data); setPagination(result.pagination); if (result.pagination.page !== page) setPage(result.pagination.page); } })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, revision]);
  const refresh = () => setRevision(value => value + 1);
  return <section className="owner-panel renter-contracts">
    <div className="owner-panel-head"><div><h2>Hợp đồng thuê xe</h2><p>Xem nội dung thỏa thuận, ký xác nhận và theo dõi chữ ký của XeDi.</p></div><button className="owner-secondary" onClick={refresh} disabled={loading}>Tải lại</button></div>
    <p className="renter-contracts-note">Hồ sơ được tạo khi bạn chọn Thuê xe. XeDi duyệt chuyến và lập nội dung trình ký, bạn đọc và ký, sau đó đại diện XeDi xác nhận. Hoàn tất ký hai bên là điều kiện để tiếp tục thanh toán.</p>
    {error && <p role="alert" className="renter-error">{error}</p>}
    {loading ? <p className="renter-contracts-note" role="status">Đang tải hợp đồng...</p> : error ? <div className="owner-empty"><p>Không tải được danh sách hợp đồng.</p><button className="owner-secondary" onClick={refresh}>Thử lại</button></div> : rows.length ? <div className="owner-table-wrap"><table>
      <thead><tr><th>MÃ HỢP ĐỒNG / CHUYẾN</th><th>PHƯƠNG TIỆN / LỊCH THUÊ</th><th>TIỀN THUÊ / CỌC</th><th>CHỮ KÝ</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead>
      <tbody>{rows.map(item => <tr key={item.id}>
        <td><strong>{item.number}</strong>{item.bookingId && <a className="owner-text-button" href={`#/renter/bookings/${item.bookingId}`}>{item.bookingCode || 'Xem chuyến thuê'}</a>}</td>
        <td><strong>{item.vehicle}</strong><span>{dateTime(item.startDate)}</span><span>→ {dateTime(item.endDate)}</span></td>
        <td><strong>{vnd(item.rentalFee)}</strong><span>Cọc: {vnd(item.depositAmount)}</span></td>
        <td><span>Khách thuê: {item.partySignedAt || item.signature?.renter_confirmed ? 'Đã ký' : 'Chờ ký'}</span><span>XeDi: {item.platformSignedAt || item.signature?.platform_signer_user_id ? 'Đã ký' : 'Chờ ký'}</span>{item.partySignedAt && <span>{dateTime(item.partySignedAt)}</span>}</td>
        <td><i className={`owner-status ${['signed', 'active'].includes(item.status) ? 'green' : 'amber'}`}>{contractStatus[item.status] || item.status}</i>{!item.document && !['signed', 'active'].includes(item.status) && <span>Đang chờ XeDi lập nội dung trình ký.</span>}</td>
        <td><button className={item.canSign ? 'owner-primary' : 'owner-text-button'} onClick={() => setSelected(item)}>{item.canSign ? 'Đọc và ký' : 'Xem hợp đồng'}</button></td>
      </tr>)}</tbody>
    </table></div> : <div className="owner-empty"><span>▤</span><strong>Chưa có hợp đồng thuê xe</strong><p>Hợp đồng của chuyến thuê sẽ xuất hiện tại đây khi được tạo.</p><a className="owner-text-button" href="#/renter/bookings">Xem các chuyến thuê →</a></div>}
    <Pagination page={page} pageSize={10} total={pagination.total} onPageChange={setPage} disabled={loading} label="Phân trang hợp đồng thuê xe" />
    {selected && <SigningDialog key={selected.id} item={{ id: selected.id, type: 'rental' }} view="party" onClose={() => setSelected(null)} onSigned={refresh} />}
  </section>;
}
