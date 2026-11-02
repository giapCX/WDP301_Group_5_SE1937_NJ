import Icon from '../ui/Icon';
import { formatPrice } from '../../utils/formatPrice';
export default function FilterSidebar({
  filters: f,
  onChange,
  onReset,
  expanded,
}) {
  const set = (key, value) => onChange({ ...f, [key]: value });
  const toggle = (key, value) =>
    set(
      key,
      f[key].includes(value)
        ? f[key].filter((item) => item !== value)
        : [...f[key], value],
    );
  return (
    <aside
      className={`filters-column ${expanded ? 'is-expanded' : ''}`}
      aria-label="Bộ lọc tìm kiếm"
    >
      <div className="filter-panel">
        <div className="filter-heading">
          <h2>
            <Icon name="filter" />
            Bộ lọc tìm kiếm
          </h2>
          <button onClick={onReset}>Đặt lại</button>
        </div>
        <fieldset>
          <legend>
            Khoảng giá thuê <span>VNĐ / ngày</span>
          </legend>
          <input
            aria-label="Giá thuê tối đa"
            className="price-range"
            type="range"
            min="0"
            max="3500000"
            step="50000"
            value={f.maxPrice}
            onChange={(e) =>
              onChange({
                ...f,
                maxPrice: Number(e.target.value),
                minPrice: Math.min(f.minPrice, Number(e.target.value)),
              })
            }
            style={{
              '--range-progress': `${(f.maxPrice / 3500000) * 100}%`,
            }}
          />
          <div className="range-labels">
            <span>0 đ</span>
            <span>3.500.000 đ</span>
          </div>
          <div className="price-boxes">
            <div>
              <small>GIÁ THẤP NHẤT</small>
              <input
                aria-label="Giá thuê tối thiểu"
                type="number"
                min="0"
                max={f.maxPrice}
                step="50000"
                value={f.minPrice}
                onChange={(e) =>
                  set(
                    'minPrice',
                    Math.min(f.maxPrice, Math.max(0, Number(e.target.value))),
                  )
                }
              />
            </div>
            <div>
              <small>GIÁ CAO NHẤT</small>
              <strong>{formatPrice(f.maxPrice)} đ</strong>
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Loại xe (Kiểu dáng)</legend>
          {[
            ['sedan', 'Sedan (4–5 chỗ)'],
            ['suv', 'SUV gầm cao (5–7 chỗ)'],
            ['mpv', 'MPV gia đình cỡ lớn'],
            ['hatchback', 'Hatchback đô thị nhỏ gọn'],
            ['pickup', 'Bán tải Pickup thể thao'],
          ].map(([value, label]) => (
            <label className="check-row" key={value}>
              <input
                type="checkbox"
                checked={f.types.includes(value)}
                onChange={() => toggle('types', value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Hộp số</legend>
          <div className="transmission-options">
            {[
              ['automatic', '⚙ Tự động'],
              ['manual', '☰ Số sàn'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={f.transmission === value ? 'selected' : ''}
                aria-pressed={f.transmission === value}
                onClick={() =>
                  set('transmission', f.transmission === value ? '' : value)
                }
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Loại nhiên liệu</legend>
          <div className="fuel-options">
            {[
              ['', 'Tất cả'],
              ['electric', 'ϟ Điện VinFast'],
              ['gasoline', 'Xăng'],
              ['diesel', 'Dầu Diesel'],
              ['hybrid', 'Hybrid'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={f.fuel === value ? 'selected' : ''}
                aria-pressed={f.fuel === value}
                onClick={() => set('fuel', value)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Số chỗ</legend>
          <select
            aria-label="Số chỗ"
            value={f.seats}
            onChange={(e) => set('seats', e.target.value)}
          >
            <option value="">Tất cả</option>
            {[4, 5, 7, 8, 9, 16].map((seats) => (
              <option key={seats} value={seats}>
                {seats} chỗ
              </option>
            ))}
          </select>
        </fieldset>
        <fieldset disabled title="Chưa có thông tin tiện nghi">
          <legend>Tiện nghi trên xe</legend>
          <small className="filter-unavailable">
            Chưa có dữ liệu tiện nghi
          </small>
          {[
            ['camera', 'Camera hành trình / Camera 360'],
            ['gps', 'Bản đồ dẫn đường GPS'],
            ['sunroof', 'Cửa sổ trời toàn cảnh'],
            ['childseat', 'Ghế trẻ em ISOFIX'],
            ['bluetooth', 'Bluetooth / Apple CarPlay / Android Auto'],
            ['sensor', 'Cảm biến áp suất lốp'],
          ].map(([value, label]) => (
            <label className="check-row amenity" key={value}>
              <input
                type="checkbox"
                checked={f.amenities.includes(value)}
                onChange={() => toggle('amenities', value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <fieldset
          disabled
          title="Hiện nhận xe tại gara"
        >
          <legend>Hình thức giao nhận xe</legend>
          <small className="filter-unavailable">Hiện nhận xe tại gara</small>
          {[
            [
              'delivery',
              'Giao xe tận nơi',
              'Chủ xe mang xe đến tận khách sạn/nhà riêng của bạn',
            ],
            [
              'pickup',
              'Tự đến lấy xe',
              'Nhận xe trực tiếp tại địa chỉ cố định của chủ xe',
            ],
          ].map(([value, label, text]) => (
            <label className="delivery-option" key={value}>
              <span>
                <input
                  type="radio"
                  name="delivery"
                  checked={f.delivery === value}
                  onChange={() => set('delivery', value)}
                />
                {label}
              </span>
              <small>{text}</small>
            </label>
          ))}
          {f.delivery && (
            <button className="text-button" onClick={() => set('delivery', '')}>
              Tất cả hình thức
            </button>
          )}
        </fieldset>
        <fieldset>
          <legend>Độ tin cậy & Đời xe</legend>
          {[
            ['superhost', 'Chủ xe 5 sao (Superhost)'],
            ['recent', 'Xe đời mới (Từ năm 2023)'],
            ['quick', 'Đặt xe nhanh không cần chờ xe duyệt'],
          ].map(([key, label]) => (
            <label className="check-row amenity" key={key}>
              <input
                type="checkbox"
                checked={f[key]}
                disabled={key !== 'recent'}
                title={
                  key !== 'recent'
                    ? 'Chưa có dữ liệu cho bộ lọc này'
                    : undefined
                }
                onChange={(e) => set(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </fieldset>
      </div>
      <div className="insurance-note">
        <Icon name="shield" size={24} />
        <div>
          <strong>Bảo hiểm 2 chiều MIC</strong>
          <p>
            Mọi chuyến đi trên XeDi đều được bảo vệ toàn diện với gói bảo hiểm
            của đối tác MIC, trị giá tới 2 tỷ đồng.
          </p>
        </div>
      </div>
    </aside>
  );
}
