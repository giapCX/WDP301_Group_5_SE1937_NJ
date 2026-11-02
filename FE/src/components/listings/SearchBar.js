import { useState } from 'react';
import Icon from '../ui/Icon';
import { cities } from '../../data/listingFilters';
export default function SearchBar({ search, onChange, onInfo }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(search);
  const [error, setError] = useState('');
  const days = Math.max(
    1,
    Math.ceil((new Date(search.end) - new Date(search.start)) / 86400000),
  );
  const date = (value) =>
    value
      ? new Date(value)
          .toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
          .replace(',', '')
      : 'Chưa chọn';
  return (
    <section className="search-section" aria-label="Thông tin tìm kiếm">
      <div className="search-inner">
        <div className="search-box">
          <div className="search-field">
            <Icon name="pin" size={23} />
            <div>
              <span className="eyebrow">ĐỊA ĐIỂM NHẬN XE</span>
              <strong>{search.city || 'Tất cả địa điểm'}</strong>
            </div>
          </div>
          <div className="search-field date-field">
            <Icon name="calendar" size={21} />
            <div>
              <span className="eyebrow">THỜI GIAN THUÊ</span>
              <strong>
                {date(search.start)} – {date(search.end)}
              </strong>
            </div>
          </div>
          <button
            className="primary-button"
            onClick={() => {
              setDraft(search);
              setEditing(true);
            }}
          >
            <Icon name="filter" size={16} />
            Thay đổi
          </button>
        </div>
        <span className="rental-duration">
          <strong>
            {search.start && search.end
              ? `${days} ngày thuê`
              : 'Chọn ngày để lọc lịch trống'}
          </strong>
        </span>
        <button
          className="outline-button map-button"
          onClick={() =>
            onInfo(
              'Địa điểm nhận xe',
              `Khu vực đang tìm: ${search.city || 'Tất cả địa điểm'}.\nBản đồ tương tác chưa được tích hợp.`,
            )
          }
        >
          <Icon name="map" />
          Xem bản đồ
        </button>
      </div>
      {editing && (
        <div className="search-editor">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (
                Boolean(draft.start) !== Boolean(draft.end) ||
                (draft.start && new Date(draft.end) <= new Date(draft.start))
              ) {
                setError('Thời gian trả xe phải sau thời gian nhận xe.');
                return;
              }
              onChange(draft);
              setError('');
              setEditing(false);
            }}
          >
            <label>
              Địa điểm nhận xe
              <select
                value={draft.city}
                onChange={(e) => setDraft({ ...draft, city: e.target.value })}
              >
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city || 'Tất cả địa điểm'}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nhận xe
              <input
                type="datetime-local"
                value={draft.start}
                onChange={(e) => setDraft({ ...draft, start: e.target.value })}
              />
            </label>
            <label>
              Trả xe
              <input
                type="datetime-local"
                value={draft.end}
                onChange={(e) => setDraft({ ...draft, end: e.target.value })}
              />
            </label>
            <button type="submit" className="primary-button">
              Áp dụng
            </button>
            <button
              type="button"
              className="outline-button"
              onClick={() => {
                setEditing(false);
                setError('');
              }}
            >
              Hủy
            </button>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              className="text-button"
              onClick={() => setDraft({ ...draft, start: '', end: '' })}
            >
              Xóa ngày thuê
            </button>
            <small>
              Lọc theo lịch đặt xe và khoảng thời gian xe ngừng nhận khách.
            </small>
          </form>
        </div>
      )}
    </section>
  );
}
