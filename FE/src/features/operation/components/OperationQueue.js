import Icon from '../../../components/Icon';
import { operationSectionStatuses, operationStatusLabels } from '../operationConfig';

function Status({ value }) {
  return (
    <span className={`operation-status status-${String(value || 'unknown').replaceAll('_', '-')}`}>
      <i />{operationStatusLabels[value] || value || '—'}
    </span>
  );
}

function RowActions({ section, item, onAction, onOpenDetail }) {
  if (section === 'bookings' && item.status === 'pending') {
    return <>
      <button onClick={() => onAction('booking', item, 'approve')}>Duyệt</button>
      <button className="danger" onClick={() => onAction('booking', item, 'reject')}>Từ chối</button>
    </>;
  }

  if (section === 'listings') {
    const reviewAction = item.status === 'draft' || item.status === 'pending_review'
      ? 'approve'
      : item.status === 'published' ? 'deactivate' : 'activate';
    return <>
      <button onClick={() => onAction('editListing', item)}>Sửa</button>
      <button onClick={() => onAction('listing', item, reviewAction)}>
        {reviewAction === 'approve' ? 'Duyệt' : reviewAction === 'deactivate' ? 'Tạm dừng' : 'Kích hoạt'}
      </button>
      {['draft', 'pending_review', 'published'].includes(item.status) &&
        <button className="danger" onClick={() => onAction('listing', item, 'reject')}>Từ chối</button>}
    </>;
  }

  if (section === 'violations' && ['reported', 'investigating'].includes(item.status)) {
    return <>
      <button onClick={() => onAction('violation', item, 'confirm')}>Đề xuất xác nhận</button>
      <button className="danger" onClick={() => onAction('violation', item, 'reject')}>Đề xuất bác bỏ</button>
    </>;
  }

  if (['incidents', 'disputes', 'complaints'].includes(section)) {
    if (item.status === 'pending_manager') {
      return <button onClick={() => onOpenDetail(item)}>Theo dõi Manager</button>;
    }
    return <>
      <button onClick={() => onOpenDetail(item)}>Chi tiết</button>
      <button onClick={() => onAction('assignCase', item)}>Nhận xử lý</button>
      {item.status === 'reported' && <button onClick={() => onAction('caseStatus', item, section === 'disputes' ? 'under_review' : 'in_progress')}>Bắt đầu</button>}
      {section === 'disputes' && item.status !== 'resolved' && item.status !== 'closed' &&
        ['in_progress', 'under_review'].includes(item.status) &&
        <button onClick={() => onAction('caseStatus', item, 'escalated')}>Chuyển cấp</button>}
      {section !== 'disputes' && !['resolved', 'closed'].includes(item.status) &&
        <button onClick={() => onAction('caseStatus', item, 'resolved')}>Đóng sự cố</button>}
    </>;
  }

  if (section === 'overdue' && !item.handledAt) {
    return <>
      <button onClick={() => onAction('overdue', item, 'remind')}>Nhắc khách</button>
      <button onClick={() => onAction('overdue', item, 'handled')}>Đã xử lý</button>
      <button onClick={() => onAction('createOverdueCase', item, 'overdue')}>Tạo sự cố</button>
      <button onClick={() => onAction('createOverdueCase', item, 'traffic_violation')}>Tạo vi phạm</button>
    </>;
  }

  return null;
}

export default function OperationQueue({
  section,
  title,
  items,
  rows,
  pagination,
  loading,
  status,
  query,
  sort,
  page,
  onStatusChange,
  onQueryChange,
  onSearch,
  onSortChange,
  onPageChange,
  onAction,
  onCreateCase,
  onOpenDetail,
}) {
  return (
    <section className="operation-panel operation-list-panel">
      <div className="operation-list-heading">
        <div>
          <h2>{title}</h2>
          <p>{pagination ? `${pagination.total} hồ sơ` : 'Danh sách hồ sơ vận hành'}</p>
        </div>
        {section === 'incidents' && <button className="operation-primary" onClick={onCreateCase}>+ Tạo hồ sơ sự cố</button>}
      </div>

      <form className="operation-filters" onSubmit={onSearch}>
        <label className="operation-search">
          <Icon name="search" size={17} />
          <input aria-label="Tìm kiếm" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Tìm mã, tên hoặc mô tả" />
        </label>
        {section !== 'overdue' && (
          <label>Trạng thái
            <select aria-label="Lọc theo trạng thái" value={status} onChange={(event) => onStatusChange(event.target.value)}>
              <option value="all">Tất cả</option>
              {(operationSectionStatuses[section] || []).map((value) => (
                <option key={value} value={value}>{operationStatusLabels[value] || value}</option>
              ))}
            </select>
          </label>
        )}
        <label>Sắp xếp
          <select aria-label="Sắp xếp" value={sort} onChange={(event) => onSortChange(event.target.value)}>
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="start_asc">Ngày bắt đầu</option>
            <option value="end_asc">Ngày kết thúc</option>
          </select>
        </label>
        <button className="operation-primary" type="submit">Tìm kiếm</button>
      </form>

      {loading ? <p className="operation-empty">Đang tải dữ liệu…</p> : items.length === 0 ? (
        <p className="operation-empty">Không tìm thấy hồ sơ phù hợp.</p>
      ) : (
        <div className="operation-table-wrap">
          <table className="operation-table">
            <thead><tr><th>HỒ SƠ</th><th>KHÁCH HÀNG / CHI TIẾT</th><th>TRẠNG THÁI</th><th>THỜI GIAN</th><th>GIÁ TRỊ</th><th>THAO TÁC</th></tr></thead>
            <tbody>{items.map((item, index) => {
              const row = rows[index];
              return (
                <tr key={item.id}>
                  <td><button className="operation-row-link" onClick={() => onOpenDetail(item)}>{row.primary}</button><small>{row.tertiary}</small></td>
                  <td>{row.secondary || '—'}{(section === 'bookings' || section === 'overdue') && item.renter?.phone && <small>{item.renter.phone}</small>}</td>
                  <td><Status value={row.status} /></td>
                  <td>{row.date}</td>
                  <td>{row.amount || '—'}</td>
                  <td><div className="operation-row-actions"><RowActions section={section} item={item} onAction={onAction} onOpenDetail={onOpenDetail} /></div></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}

      {pagination && (
        <div className="operation-pagination">
          <span>Trang {pagination.page} / {Math.max(1, pagination.totalPages)}</span>
          <div>
            <button disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)}>Trước</button>
            <button disabled={page >= pagination.totalPages || loading} onClick={() => onPageChange(page + 1)}>Sau</button>
          </div>
        </div>
      )}
    </section>
  );
}
