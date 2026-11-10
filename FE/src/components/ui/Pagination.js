import './Pagination.css';

export default function Pagination({ page = 1, pageSize = 10, total = 0, onPageChange, onPageSizeChange, disabled = false, label = 'Phân trang danh sách' }) {
  if (!total || !onPageChange) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  return <nav className="xedi-pagination" aria-label={label}>
    <span>{(current - 1) * pageSize + 1}–{Math.min(current * pageSize, total)} / {total}</span>
    {onPageSizeChange && <label>Số dòng mỗi trang<select aria-label="Số dòng mỗi trang" value={pageSize} disabled={disabled} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
      {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
    </select></label>}
    <div>
      <button type="button" aria-label="Trang đầu" disabled={disabled || current === 1} onClick={() => onPageChange(1)}>«</button>
      <button type="button" aria-label="Trang trước" disabled={disabled || current === 1} onClick={() => onPageChange(current - 1)}>‹</button>
      <span>Trang {current} / {pages}</span>
      <button type="button" aria-label="Trang sau" disabled={disabled || current === pages} onClick={() => onPageChange(current + 1)}>›</button>
      <button type="button" aria-label="Trang cuối" disabled={disabled || current === pages} onClick={() => onPageChange(pages)}>»</button>
    </div>
  </nav>;
}
