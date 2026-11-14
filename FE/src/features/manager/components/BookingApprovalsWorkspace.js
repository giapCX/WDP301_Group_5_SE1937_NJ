import { useState } from 'react';
import Pagination from '../../../components/ui/Pagination';
import useManagerActions from '../hooks/useManagerActions';
import useManagerCollection from '../hooks/useManagerCollection';

const money = (value) => new Intl.NumberFormat('vi-VN').format(value || 0);
const dateTime = (value) => value ? new Date(value).toLocaleString('vi-VN') : '—';

export default function BookingApprovalsWorkspace({ onNotice }) {
  const request = useManagerCollection('bookings', { status: 'pending' });
  const { decideBooking } = useManagerActions();
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState('');
  const refresh = () => {
    setActionError('');
    request.refresh();
  };
  const decide = async (booking, action) => {
    const reason = action === 'reject'
      ? window.prompt(`Lý do từ chối yêu cầu ${booking.bookingCode}:`)
      : '';
    if (reason === null) return;
    if (action === 'reject' && !reason.trim()) {
      setActionError('Vui lòng nhập lý do từ chối.');
      return;
    }
    setBusyId(booking.id);
    setActionError('');
    try {
      await decideBooking(booking.id, { action, ...(reason ? { reason: reason.trim() } : {}) });
      onNotice(action === 'approve' ? 'Đã duyệt yêu cầu thuê; khách có 15 phút để thanh toán.' : 'Đã từ chối yêu cầu thuê.');
      refresh();
    } catch (error) {
      setActionError(error.message || 'Không thể cập nhật yêu cầu thuê.');
    } finally {
      setBusyId('');
    }
  };

  if (request.loading) return <section className="manager-panel workspace-panel"><p className="manager-empty">Đang tải yêu cầu thuê…</p><Pagination {...request.paging} /></section>;
  if (request.error && !request.data.length) return <section className="manager-panel workspace-panel"><div className="manager-notice manager-error">{request.error}<button onClick={refresh}>Thử lại</button></div></section>;
  return <section className="manager-panel workspace-panel">
    <div className="workspace-header"><div><h2>Yêu cầu thuê xe chờ duyệt</h2><p>Chỉ Manager duyệt hoặc từ chối; booking được duyệt chuyển sang bước thanh toán.</p></div><span className="workspace-count">{request.paging?.total ?? request.data.length} yêu cầu</span></div>
    {(actionError || request.error) && <div className="manager-notice manager-error" role="alert">{actionError || request.error}<button onClick={() => setActionError('')}>Đóng</button></div>}
    <div className="requests-table-wrap"><table className="requests-table"><thead><tr><th>MÃ BOOKING</th><th>KHÁCH THUÊ</th><th>XE</th><th>THỜI GIAN THUÊ</th><th>GIÁ THUÊ</th><th>THAO TÁC</th></tr></thead><tbody>
      {request.data.map((booking) => <tr key={booking.id}>
        <td><strong>{booking.bookingCode || booking.id}</strong><span>Gửi lúc {dateTime(booking.createdAt)}</span></td>
        <td><strong>{booking.renter?.full_name || '—'}</strong><span>{booking.renter?.email || ''}</span></td>
        <td><strong>{booking.vehicle ? `${booking.vehicle.brand || ''} ${booking.vehicle.model || ''}` : '—'}</strong><span>{booking.vehicle?.license_plate || ''}</span></td>
        <td>{dateTime(booking.startAt)}<span>đến {dateTime(booking.endAt)}</span></td>
        <td>{money(booking.rentalFeeAmount)} ₫</td>
        <td><button className="action-approve" disabled={busyId === booking.id} onClick={() => decide(booking, 'approve')}>Duyệt</button> <button className="action-reject" disabled={busyId === booking.id} onClick={() => decide(booking, 'reject')}>Từ chối</button></td>
      </tr>)}
    </tbody></table>{!request.data.length && <p className="manager-empty">Không có yêu cầu thuê đang chờ duyệt.</p>}</div>
    <Pagination {...request.paging} />
  </section>;
}
