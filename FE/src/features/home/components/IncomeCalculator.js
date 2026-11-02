import { useState } from 'react';
import { money } from '../../listings/components/VehicleCard';

export default function IncomeCalculator({ catalog, commission }) {
  const [vehicleId, setVehicleId] = useState('');
  const [days, setDays] = useState(16);
  const listing = catalog.find((item) => item._id === vehicleId) || catalog[0];
  const estimate =
    listing && commission !== null
      ? Math.round(listing.daily_price * days * (1 - commission / 100))
      : null;
  return (
    <div className="income-calculator">
      <div className="calculator-heading">
        <span>CÔNG CỤ TÍNH THU NHẬP</span>
        <span className="green-pill">Tham khảo</span>
      </div>
      <label htmlFor="income-vehicle">Dòng xe tham khảo</label>
      <select
        id="income-vehicle"
        value={listing?._id || ''}
        onChange={(event) => setVehicleId(event.target.value)}
        disabled={!catalog.length}
      >
        {!catalog.length && <option value="">Chưa có dữ liệu xe</option>}
        {catalog.map((item) => (
          <option value={item._id} key={item._id}>
            {item.vehicle.brand} {item.vehicle.model} — {money(item.daily_price)} đ/ngày
          </option>
        ))}
      </select>
      <label htmlFor="rental-days">
        Số ngày cho thuê mỗi tháng: <strong>{days} ngày</strong>
      </label>
      <input
        id="rental-days"
        type="range"
        min="1"
        max="30"
        value={days}
        onChange={(event) => setDays(Number(event.target.value))}
      />
      <div className="range-labels">
        <span>1 ngày</span>
        <span>30 ngày</span>
      </div>
      <div className="income-result" aria-live="polite">
        <span>Ước tính thu nhập mỗi tháng</span>
        <strong>
          {estimate === null ? '—' : money(estimate)} <small>đ</small>
        </strong>
        <span>
          {commission === null
            ? 'Chưa tải được mức phí nền tảng'
            : `Sau phí nền tảng mặc định ${commission}%`}
        </span>
      </div>
      <p className="calculator-note">
        Chưa bao gồm thuế và chi phí phát sinh. Mức phí và doanh thu thực tế được đối soát theo hợp
        đồng quản lý xe.
      </p>
    </div>
  );
}

