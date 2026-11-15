import CopyCode from '../../../components/ui/CopyCode';
import ManagerActionForm from './ManagerActionForm';
import { useState } from 'react';
import Pagination from '../../../components/ui/Pagination';
import useManagerActions from '../hooks/useManagerActions';
import useManagerCollection from '../hooks/useManagerCollection';

const money = (value) => new Intl.NumberFormat('vi-VN').format(value || 0);
const dateTime = (value) => value ? new Date(value).toLocaleString('vi-VN') : '—';

const tripLabels = { confirmed: 'Chờ giao xe', ongoing: 'Đang thuê', completed: 'Đã trả xe' };

export default function BookingApprovalsWorkspace({ onNotice, loadResource, decideRequest, revision, trips = false, canReview = true }) {
  const request = useManagerCollection('bookings', { status: trips ? 'trips' : 'pending' }, { loadResource, revision });
  const { decideBooking } = useManagerActions();
  const [dialog, setDialog] = useState(null);
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState('');
  const refresh = () => {
    setActionError('');
    request.refresh();
  };
  const decide = async (booking, action, reason = '') => {
    setBusyId(booking.id);
    setActionError('');
    try {
      await (decideRequest ?? decideBooking)(booking.id, { action, ...(reason ? { reason: reason.trim() } : {}) });
      onNotice(action === 'approve' ? 'Đã duyệt yêu cầu thuê. Các bên có thể ký hợp đồng để tiếp tục thanh toán.' : 'Đã từ chối yêu cầu thuê.');
      refresh();
    } catch (error) {
      if (action === 'reject') throw error;
      setActionError(error.message || 'Không thể cập nhật yêu cầu thuê.');
    } finally {
      setBusyId('');
    }
  };

  if (request.loading) return <section className="manager-panel workspace-panel"><p className="manager-empty">Đang tải yêu cầu thuê…</p><Pagination {...request.paging} /></section>;
  if (request.error && !request.data.length) return <section className="manager-panel workspace-panel"><div className="manager-notice manager-error">{request.error}<button onClick={refresh}>Thử lại</button></div></section>;
  return <section className="manager-panel workspace-panel">
    <div className="workspace-header"><div><h2>{trips ? 'Theo dõi chuyến thuê' : 'Yêu cầu thuê xe chờ duyệt'}</h2><p>{trips ? 'Theo dõi giao và nhận trả xe từ biên bản Garage.' : 'Kiểm tra khách thuê, xe và lịch trước khi duyệt.'}</p></div><span className="workspace-count">{request.paging?.total ?? request.data.length} hồ sơ</span></div>
    {(actionError || request.error) && <div className="manager-notice manager-error" role="alert">{actionError || request.error}<button onClick={() => setActionError('')}>Đóng</button></div>}
    <div className="requests-table-wrap" tabIndex={0} role="region" aria-label="Yêu cầu thuê xe"><table className="requests-table"><thead><tr><th>MÃ CHUYẾN THUÊ</th><th>KHÁCH THUÊ</th><th>XE</th><th>THỜI GIAN THUÊ</th><th>GIÁ THUÊ</th><th>{trips ? 'TRẠNG THÁI' : 'THAO TÁC'}</th></tr></thead><tbody>
      {request.data.map((booking) => <tr key={booking.id}>
        <td><strong><CopyCode value={booking.bookingCode || booking.id} label="mã chuyến thuê" /></strong><span>Gửi lúc {dateTime(booking.createdAt)}</span></td>
        <td><strong>{booking.renter?.full_name || '—'}</strong><span>{booking.renter?.email || ''}</span></td>
        <td><strong>{booking.vehicle ? `${booking.vehicle.brand || ''} ${booking.vehicle.model || ''}` : '—'}</strong><span>{booking.vehicle?.license_plate || ''}</span></td>
        <td>{dateTime(booking.startAt)}<span>đến {dateTime(booking.endAt)}</span></td>
        <td>{money(booking.rentalFeeAmount)} ₫</td>
        <td>{trips ? <><strong>{booking.overdue ? 'Quá hạn trả xe' : tripLabels[booking.status] || booking.status}</strong>{booking.actualStartAt && <span>Giao lúc {dateTime(booking.actualStartAt)}</span>}{booking.actualEndAt && <span>Trả lúc {dateTime(booking.actualEndAt)}</span>}</>
          : canReview ? <><button className="action-approve" disabled={busyId === booking.id} onClick={() => decide(booking, 'approve')}>Duyệt</button> <button className="action-reject" disabled={busyId === booking.id} onClick={() => setDialog({ title: 'Từ chối yêu cầu thuê', context: booking.bookingCode, fields: [{ name: 'reason', label: 'Lý do từ chối', type: 'textarea', maxLength: 1000 }], onSubmit: ({ reason }) => decide(booking, 'reject', reason) })}>Từ chối</button></> : 'Chờ người có quyền duyệt'}</td>
      </tr>)}
    </tbody></table>{!request.data.length && <p className="manager-empty">{trips ? 'Chưa có chuyến thuê.' : 'Không có yêu cầu thuê đang chờ duyệt.'}</p>}</div>
    <Pagination {...request.paging} />
  {dialog && <ManagerActionForm {...dialog} onClose={() => setDialog(null)} />}</section>;
}
