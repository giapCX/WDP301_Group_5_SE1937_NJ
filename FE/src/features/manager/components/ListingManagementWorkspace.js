import { useState } from 'react';
import Pagination from '../../../components/ui/Pagination';
import useManagerActions from '../hooks/useManagerActions';
import useManagerCollection from '../hooks/useManagerCollection';

const statusLabels = {
  draft: 'Bản nháp',
  pending_review: 'Chờ duyệt',
  published: 'Đã xuất bản',
  suspended: 'Đã tạm ngưng',
  archived: 'Đã lưu trữ',
  rejected: 'Đã từ chối',
};

export default function ListingManagementWorkspace({ onNotice }) {
  const request = useManagerCollection('listings', { status: 'all' });
  const { reviewListing, updateListing } = useManagerActions();
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState('');
  const refresh = () => {
    setActionError('');
    request.refresh();
  };
  const edit = async (listing) => {
    const title = window.prompt('Tiêu đề tin xe:', listing.title || '');
    if (title === null) return;
    const description = window.prompt('Mô tả tin xe:', listing.description || '');
    if (description === null) return;
    const dailyPrice = window.prompt('Giá thuê mỗi ngày (VND):', String(listing.dailyPrice ?? ''));
    if (dailyPrice === null) return;
    const securityDepositAmount = window.prompt('Tiền cọc (VND):', String(listing.securityDepositAmount ?? ''));
    if (securityDepositAmount === null) return;
    const location = listing.pickupLocation || {};
    const branchName = window.prompt('Tên gara:', location.branch_name || '');
    if (branchName === null) return;
    const city = window.prompt('Tỉnh/thành:', location.city || '');
    if (city === null) return;
    const addressLabel = window.prompt('Địa chỉ giao xe:', location.address_label || '');
    if (addressLabel === null) return;
    const body = {
      title,
      description,
      dailyPrice: Number(dailyPrice),
      securityDepositAmount: Number(securityDepositAmount),
      pickupLocation: { branchName, city, addressLabel },
    };
    setBusyId(listing.id);
    setActionError('');
    try {
      await updateListing(listing.id, body);
      onNotice('Đã cập nhật thông tin tin xe.');
      refresh();
    } catch (error) {
      setActionError(error.message || 'Không thể cập nhật tin xe.');
    } finally {
      setBusyId('');
    }
  };
  const review = async (listing, action) => {
    const reason = ['reject', 'deactivate'].includes(action)
      ? window.prompt(action === 'reject' ? 'Lý do từ chối tin xe:' : 'Lý do tạm ngưng tin xe:')
      : '';
    if (reason === null) return;
    if (action === 'reject' && !reason.trim()) {
      setActionError('Vui lòng nhập lý do từ chối.');
      return;
    }
    setBusyId(listing.id);
    setActionError('');
    try {
      await reviewListing(listing.id, { action, ...(reason ? { reason: reason.trim() } : {}) });
      onNotice(action === 'approve' || action === 'activate' ? 'Tin xe đã được xuất bản.' : action === 'reject' ? 'Tin xe đã bị từ chối.' : 'Tin xe đã được tạm ngưng.');
      refresh();
    } catch (error) {
      setActionError(error.message || 'Không thể cập nhật trạng thái tin xe.');
    } finally {
      setBusyId('');
    }
  };

  if (request.loading) return <section className="manager-panel workspace-panel"><p className="manager-empty">Đang tải tin xe…</p><Pagination {...request.paging} /></section>;
  if (request.error && !request.data.length) return <section className="manager-panel workspace-panel"><div className="manager-notice manager-error">{request.error}<button onClick={refresh}>Thử lại</button></div></section>;
  return <section className="manager-panel workspace-panel">
    <div className="workspace-header"><div><h2>Quản lý tin xe</h2><p>Chỉ xuất bản xe đã được Manager duyệt, Garage tiếp nhận và có hợp đồng quản lý còn hiệu lực.</p></div><span className="workspace-count">{request.paging?.total ?? request.data.length} tin xe</span></div>
    {(actionError || request.error) && <div className="manager-notice manager-error" role="alert">{actionError || request.error}<button onClick={() => setActionError('')}>Đóng</button></div>}
    <div className="requests-table-wrap"><table className="requests-table"><thead><tr><th>TIN XE</th><th>CHỦ XE</th><th>TRẠNG THÁI</th><th>GIÁ / CỌC</th><th>ĐỊA ĐIỂM</th><th>THAO TÁC</th></tr></thead><tbody>
      {request.data.map((listing) => <tr key={listing.id}>
        <td><strong>{listing.title}</strong><span>{listing.vehicle ? `${listing.vehicle.brand || ''} ${listing.vehicle.model || ''} · ${listing.vehicle.licensePlate || ''}` : 'Chưa gắn xe'}</span></td>
        <td><strong>{listing.vehicle?.owner?.full_name || '—'}</strong><span>{listing.vehicle?.owner?.email || ''}</span></td>
        <td>{statusLabels[listing.status] || listing.status}</td>
        <td>{new Intl.NumberFormat('vi-VN').format(listing.dailyPrice || 0)} ₫ / {new Intl.NumberFormat('vi-VN').format(listing.securityDepositAmount || 0)} ₫</td>
        <td>{listing.pickupLocation?.branch_name || '—'}<span>{listing.pickupLocation?.city || ''} · {listing.pickupLocation?.address_label || ''}</span></td>
        <td>
          <button className="action-review" disabled={busyId === listing.id} onClick={() => edit(listing)}>Sửa</button>{' '}
          {['draft', 'pending_review', 'suspended'].includes(listing.status) && <button className="action-approve" disabled={busyId === listing.id} onClick={() => review(listing, listing.status === 'suspended' ? 'activate' : 'approve')}>{listing.status === 'suspended' ? 'Xuất bản lại' : 'Duyệt & xuất bản'}</button>}
          {listing.status === 'archived' && <button className="action-approve" disabled={busyId === listing.id} onClick={() => review(listing, 'activate')}>Khôi phục & xuất bản</button>}
          {listing.status === 'published' && <button className="action-review" disabled={busyId === listing.id} onClick={() => review(listing, 'deactivate')}>Tạm ngưng</button>}
          {['draft', 'pending_review', 'published'].includes(listing.status) && <button className="action-reject" disabled={busyId === listing.id} onClick={() => review(listing, 'reject')}>Từ chối</button>}
        </td>
      </tr>)}
    </tbody></table>{!request.data.length && <p className="manager-empty">Chưa có tin xe.</p>}</div>
    <Pagination {...request.paging} />
  </section>;
}
