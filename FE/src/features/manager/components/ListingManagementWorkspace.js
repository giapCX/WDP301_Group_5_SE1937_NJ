import ManagerActionForm from './ManagerActionForm';
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
  const [dialog, setDialog] = useState(null);
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState('');
  const refresh = () => {
    setActionError('');
    request.refresh();
  };
  const edit = (listing) => {
    const location = listing.pickupLocation || {};
    setDialog({
      title: 'Sửa tin xe',
      fields: [
        { name: 'title', label: 'Tiêu đề tin xe', value: listing.title },
        { name: 'description', label: 'Mô tả tin xe', type: 'textarea', value: listing.description, required: false },
        { name: 'dailyPrice', label: 'Giá thuê mỗi ngày (VND)', type: 'number', min: 1, value: listing.dailyPrice },
        { name: 'securityDepositAmount', label: 'Tiền cọc (VND)', type: 'number', min: 0, value: listing.securityDepositAmount },
        { name: 'branchName', label: 'Tên gara', value: location.branch_name },
        { name: 'city', label: 'Tỉnh/thành', value: location.city },
        { name: 'addressLabel', label: 'Địa chỉ giao xe', value: location.address_label },
      ],
      onSubmit: async ({ branchName, city, addressLabel, ...terms }) => {
        await updateListing(listing.id, { ...terms, pickupLocation: { branchName, city, addressLabel } });
        onNotice('Đã cập nhật thông tin tin xe.');
        refresh();
      },
    });
  };
  const review = async (listing, action, reason) => {
    const needsReason = ['reject', 'deactivate'].includes(action);
    if (needsReason && reason === undefined) {
      setDialog({
        title: action === 'reject' ? 'Từ chối tin xe' : 'Tạm ngưng tin xe',
        context: listing.title,
        fields: [{ name: 'reason', label: 'Lý do', type: 'textarea', required: action === 'reject', maxLength: 1000 }],
        onSubmit: (values) => review(listing, action, values.reason),
      });
      return;
    }
    setBusyId(listing.id);
    setActionError('');
    try {
      await reviewListing(listing.id, { action, ...(reason ? { reason: reason.trim() } : {}) });
      onNotice(action === 'approve' || action === 'activate' ? 'Tin xe đã được xuất bản.' : action === 'reject' ? 'Tin xe đã bị từ chối.' : 'Tin xe đã được tạm ngưng.');
      refresh();
    } catch (error) {
      if (needsReason) throw error;
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
  {dialog && <ManagerActionForm {...dialog} onClose={() => setDialog(null)} />}</section>;
}
