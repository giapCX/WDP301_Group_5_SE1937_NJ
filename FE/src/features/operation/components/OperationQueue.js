import Icon from '../../../components/Icon';
import { operationSectionStatuses, operationSectionTitles, operationStatusLabels } from '../operationConfig';

function Status({ value }) {
  return (
    <span className={`operation-status status-${String(value || 'unknown').replaceAll('_', '-')}`}>
      <i />{operationStatusLabels[value] || value || '—'}
    </span>
  );
}

function RowActions({ section, item, actions, onOpenDetail }) {
  if (section === 'vehicles') {
    return <>
      <button onClick={() => onOpenDetail(item)}>Chi tiết hồ sơ</button>
      {!item.inspection && (
        <button onClick={() => actions.screenVehicleRecord(item, 'schedule_inspection')}>Hẹn kiểm định</button>
      )}
      <button className="danger" onClick={() => actions.screenVehicleRecord(item, 'request_revision')}>
        Yêu cầu bổ sung
      </button>
    </>;
  }

  if (section === 'bookings' && item.status === 'pending') {
    return <>
      <button onClick={() => actions.reviewBooking(item, 'approve')}>Duyệt, giữ chỗ 15 phút</button>
      <button className="danger" onClick={() => actions.reviewBooking(item, 'reject')}>Từ chối</button>
    </>;
  }

  if (section === 'listings') {
    const needsReview = item.status === 'draft' || item.status === 'pending_review';
    const reviewAction = item.status === 'published' ? 'deactivate' : needsReview ? 'approve' : 'activate';
    return <>
      <button onClick={() => actions.editVehicleListing(item)}>Sửa</button>
      <button onClick={() => actions.reviewVehicleListing(item, reviewAction)}>
        {item.status === 'published' ? 'Tạm dừng' : needsReview ? 'Duyệt' : 'Kích hoạt'}
      </button>
      {['draft', 'pending_review', 'published'].includes(item.status) && (
        <button className="danger" onClick={() => actions.reviewVehicleListing(item, 'reject')}>Từ chối</button>
      )}
    </>;
  }

  if (section === 'violations' && ['reported', 'investigating'].includes(item.status)) {
    return <>
      <button onClick={() => actions.submitViolationRecommendation(item, 'confirm')}>Đề xuất xác nhận</button>
      <button className="danger" onClick={() => actions.submitViolationRecommendation(item, 'reject')}>Đề xuất bác bỏ</button>
    </>;
  }

  if (['incidents', 'disputes', 'complaints'].includes(section)) {
    const isDisputeOrComplaint = section === 'disputes' || section === 'complaints';
    return <>
      <button onClick={() => onOpenDetail(item)}>Chi tiết</button>
      <button onClick={() => actions.assignCase(item)}>Nhận xử lý</button>
      {isDisputeOrComplaint ? <>
        {item.status === 'reported' && (
          <button onClick={() => actions.updateCase(item, 'under_review')}>Bắt đầu xem xét</button>
        )}
        <button onClick={() => actions.updateCase(item, 'awaiting_response')}>Chờ phản hồi</button>
        <button onClick={() => actions.updateCase(item, 'pending_manager')}>Trình Manager quyết định</button>
      </> : (
        <button onClick={() => actions.updateCase(item, item.status === 'reported' ? 'in_progress' : 'resolved')}>
          {item.status === 'reported' ? 'Bắt đầu' : 'Đề xuất kết luận'}
        </button>
      )}
    </>;
  }

  if (section === 'overdue' && !item.handledAt) {
    return <>
      <button onClick={() => actions.actOnOverdueBooking(item, 'remind')}>Nhắc khách</button>
      <button onClick={() => actions.actOnOverdueBooking(item, 'handled')}>Đã xử lý</button>
      {item.canEscalate && !item.escalatedAt && (
        <button onClick={() => actions.actOnOverdueBooking(item, 'escalate')}>Chuyển Manager</button>
      )}
      <button onClick={() => actions.createOverdueCase(item, 'overdue')}>Tạo sự cố</button>
      <button onClick={() => actions.createOverdueCase(item, 'traffic_violation')}>Tạo vi phạm</button>
    </>;
  }

  return null;
}

export default function OperationQueue({
  section,
  items,
  rows,
  pagination,
  status,
  query,
  sort,
  page,
  loading,
  actions,
  onStatusChange,
  onQueryChange,
  onSearch,
  onSortChange,
  onPageChange,
  onOpenDetail,
}) {
  return (
    <section className="operation-panel operation-list-panel">
      <div className="operation-list-heading">
        <div>
          <h2>{operationSectionTitles[section]}</h2>
          <p>{pagination ? `${pagination.total} hồ sơ` : 'Danh sách hồ sơ vận hành'}</p>
        </div>
        {section === 'incidents' && (
          <button className="operation-primary" onClick={actions.createIncidentCase}>+ Tạo hồ sơ sự cố</button>
        )}
      </div>

      <form className="operation-filters" onSubmit={onSearch}>
        <label className="operation-search">
          <Icon name="search" size={17} />
          <input
            aria-label="Tìm kiếm"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Tìm mã, tên hoặc mô tả"
          />
        </label>
        {section !== 'overdue' && (
          <label>
            Trạng thái
            <select aria-label="Lọc theo trạng thái" value={status} onChange={onStatusChange}>
              <option value="all">Tất cả</option>
              {(operationSectionStatuses[section] || [])
                .filter((value) => value !== 'all')
                .map((value) => (
                  <option key={value} value={value}>{operationStatusLabels[value] || value}</option>
                ))}
            </select>
          </label>
        )}
        <label>
          Sắp xếp
          <select aria-label="Sắp xếp" value={sort} onChange={onSortChange}>
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
            <thead>
              <tr>
                <th>HỒ SƠ</th>
                <th>KHÁCH HÀNG / CHI TIẾT</th>
                <th>TRẠNG THÁI</th>
                <th>THỜI GIAN</th>
                <th>GIÁ TRỊ</th>
                <th>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const row = rows[index];
                return (
                  <tr key={item.id}>
                    <td>
                      <button className="operation-row-link" onClick={() => onOpenDetail(item)}>{row.primary}</button>
                      <small>{row.tertiary}</small>
                    </td>
                    <td>
                      {row.secondary || '—'}
                      {(section === 'bookings' || section === 'overdue') && item.renter?.phone && (
                        <small>{item.renter.phone}</small>
                      )}
                    </td>
                    <td><Status value={row.status} /></td>
                    <td>{row.date}</td>
                    <td>{row.amount || '—'}</td>
                    <td>
                      <div className="operation-row-actions">
                        <RowActions
                          section={section}
                          item={item}
                          actions={actions}
                          onOpenDetail={onOpenDetail}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
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
