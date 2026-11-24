import { useEffect, useState } from 'react';
import { VEHICLE_STATUS_META } from '../managerDashboardConfig';
import ManagerIcon from './ManagerIcon';

const PAGE_SIZE = 4;

function VehicleThumbnail({ vehicle }) {
  return (
    <span className="manager-vehicle-thumb">
      {vehicle.image
        ? <img src={vehicle.image} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }}/>
        : <ManagerIcon name="car" size={19}/>}
    </span>
  );
}

export default function FleetTable({ vehicles = [], statuses = [], selectedStatus, search, loading, onStatusChange, onSearchChange }) {
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('');
  const categories = [...new Set(vehicles.map((vehicle) => vehicle.category).filter(Boolean))];
  const displayedVehicles = selectedCategory ? vehicles.filter((vehicle) => vehicle.category === selectedCategory) : vehicles;
  const pageCount = Math.max(1, Math.ceil(displayedVehicles.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleVehicles = displayedVehicles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const placeholderCount = Math.max(0, PAGE_SIZE - visibleVehicles.length);
  const runningCount = statuses.filter(({ status }) => ['in_use', 'ongoing'].includes(status)).reduce((total, item) => total + item.count, 0);

  useEffect(() => setPage(1), [selectedStatus, selectedCategory, search]);

  return (
    <section className="manager-panel manager-fleet-panel" id="manager-fleet">
      <div className="manager-fleet-toolbar">
        <div className="manager-fleet-title"><h2>Danh sách phương tiện</h2><span>{vehicles.length} xe</span></div>
        <div className="manager-fleet-controls">
          <label className="manager-search"><ManagerIcon name="search" size={15}/><input aria-label="Tìm xe, khách thuê hoặc tài xế" placeholder="Tìm biển số, dòng xe, tài xế..." value={search} onChange={(event) => onSearchChange(event.target.value)}/></label>
          <label className="manager-select"><span className="sr-only">Lọc theo phân khúc xe</span><select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}><option value="">Tất cả phân khúc</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label className="manager-select"><span className="sr-only">Lọc theo trạng thái xe</span><select value={selectedStatus} onChange={(event) => onStatusChange(event.target.value)}><option value="">Trạng thái xe</option>{statuses.map((item) => <option key={item.status} value={item.status}>{VEHICLE_STATUS_META[item.status]?.label || item.status}</option>)}</select></label>
        </div>
      </div>
      <div className="manager-fleet-tabs" role="group" aria-label="Lọc danh sách xe">
        <button type="button" className={!selectedStatus ? 'active' : ''} onClick={() => onStatusChange('')}>Tất cả xe ({statuses.reduce((total, item) => total + item.count, 0)})</button>
        <button type="button" className={selectedStatus === 'in_use' ? 'active' : ''} onClick={() => onStatusChange(selectedStatus === 'in_use' ? '' : 'in_use')}>Đang chạy tour ({runningCount})</button>
      </div>
      <div className="manager-table-wrap">
        <table className="manager-fleet-table"><thead><tr><th>MÃ &amp; BIỂN SỐ</th><th>DÒNG XE / ĐỜI</th><th>PHÂN KHÚC</th><th>TÀI XẾ PHỤ TRÁCH</th><th>ODOMETER (KM)</th><th>TRẠNG THÁI</th></tr></thead>
          <tbody>{visibleVehicles.map((vehicle) => {
            const meta = VEHICLE_STATUS_META[vehicle.status];
            const vehicleModel = [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || vehicle.name;
            return <tr key={vehicle.id}>
              <td><div className="manager-vehicle-cell"><VehicleThumbnail vehicle={vehicle}/><span><b>{vehicle.name}</b><small>{vehicle.plateNumber}</small></span></div></td>
              <td>{vehicleModel}{vehicle.year ? ` · ${vehicle.year}` : ''}</td>
              <td><span className="manager-category-tag">{vehicle.category || (vehicle.seats ? `${vehicle.seats} chỗ` : 'Chưa phân loại')}</span></td>
              <td>{vehicle.driver || <span className="manager-cell-muted">Chưa phân công</span>}</td>
              <td>{vehicle.odometer == null ? '—' : Number(vehicle.odometer).toLocaleString('vi-VN')}</td>
              <td><span className={`manager-status-pill ${meta?.tone || 'unknown'}`}><i/>{meta?.label || vehicle.status}</span></td>
            </tr>;
          })}
            {displayedVehicles.length === 0
              ? <tr className="manager-fleet-empty-row"><td colSpan="6">{loading ? 'Đang tải danh sách phương tiện…' : 'Không tìm thấy phương tiện phù hợp.'}</td></tr>
              : Array.from({ length: placeholderCount }, (_, index) => <tr className="manager-fleet-placeholder" aria-hidden="true" key={`placeholder-${index}`}><td colSpan="6"/></tr>)}
          </tbody>
        </table>
        {loading && <div className="manager-table-loading">Đang cập nhật dữ liệu…</div>}
      </div>
      <div className="manager-table-pagination">
        <span>Hiển thị {displayedVehicles.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, displayedVehicles.length)} trên tổng {displayedVehicles.length} phương tiện</span>
        <div><button type="button" aria-label="Trang trước" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>‹</button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => <button type="button" key={pageNumber} className={pageNumber === currentPage ? 'active' : ''} aria-current={pageNumber === currentPage ? 'page' : undefined} onClick={() => setPage(pageNumber)}>{pageNumber}</button>)}
          <button type="button" aria-label="Trang tiếp theo" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>›</button></div>
      </div>
    </section>
  );
}
