import { useState } from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import SearchBar from '../components/listings/SearchBar';
import FilterSidebar from '../components/listings/FilterSidebar';
import VehicleCard from '../components/listings/VehicleCard';
import VehicleImage from '../components/listings/VehicleImage';
import Icon from '../components/ui/Icon';
import Modal from '../components/ui/Modal';
import { initialFilters } from '../data/listingFilters';
import { formatPrice } from '../utils/formatPrice';
import { listingsQuery } from '../services/listings';
import useListings from '../hooks/useListings';

export default function ListingsPage() {
  const [filters, updateFilters] = useState(initialFilters);
  const [sort, updateSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [saved, setSaved] = useState([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [search, updateSearch] = useState({
    q: '',
    city: '',
    start: '',
    end: '',
  });
  const onInfo = (title, text) => setModal({ title, text });
  const setFilters = (next) => {
    updateFilters(next);
    setPage(1);
  };
  const setSearch = (next) => {
    updateSearch(next);
    setPage(1);
  };
  const setSort = (next) => {
    updateSort(next);
    setPage(1);
  };
  const query = listingsQuery({
    filters,
    search,
    sort,
    page,
    savedIds: savedOnly ? saved : undefined,
  });
  const {
    cars: results,
    pagination,
    loading,
    error,
    retry,
  } = useListings(query);
  const toggleSaved = (id) => {
    setSaved((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );
    if (savedOnly) setPage(1);
  };
  const reset = () => {
    setFilters(initialFilters);
    setSavedOnly(false);
    setSearch({ q: '', city: '', start: '', end: '' });
  };
  return (
    <>
      <Header onInfo={onInfo} />
      <SearchBar search={search} onChange={setSearch} onInfo={onInfo} />
      <main className="listings-page" id="cars">
        <div className="breadcrumbs">
          <a href="#cars">Trang chủ</a>
          <span>/</span>
          <a href="#cars">Thuê xe tự lái</a>
          <span>/</span>
          <strong>{search.city || 'Tất cả địa điểm'}</strong>
        </div>
        <div className="page-heading">
          <h1>
            {loading
              ? 'Đang tìm xe'
              : error
                ? 'Tìm xe tự lái'
                : `Tìm thấy ${pagination.total} xe phù hợp${search.city ? ` tại ${search.city}` : ''}`}{' '}
            <span>Tự lái</span>
          </h1>
          <span className="trust-pill">
            <Icon name="shield" size={14} />
            Cam kết xe chuẩn ảnh, hoàn tiền nếu chủ xe hủy
          </span>
        </div>
        <div className="listings-layout">
          <FilterSidebar
            filters={filters}
            onChange={setFilters}
            onReset={reset}
            expanded={filterOpen}
          />
          <section className="results-section" aria-label="Danh sách xe">
            <label className="vehicle-search">
              Tìm theo tên xe, hãng xe
              <input
                type="search"
                placeholder="Ví dụ: Toyota, VinFast, Vios..."
                value={search.q}
                onChange={(e) => setSearch({ ...search, q: e.target.value })}
              />
            </label>
            <div className="results-toolbar">
              <button
                className="mobile-filter outline-button"
                aria-expanded={filterOpen}
                onClick={() => setFilterOpen(!filterOpen)}
              >
                <Icon name="filter" size={15} />
                Bộ lọc
              </button>
              <div className="quick-filters">
                {[
                  ['delivery', 'delivery', 'Giao xe tận nơi'],
                  ['discount', 'tag', 'Giảm giá 10%'],
                  ['quick', 'bolt', 'Đặt xe nhanh'],
                ].map(([key, icon, label]) => {
                  const active =
                    key === 'delivery'
                      ? filters.delivery === 'delivery'
                      : filters[key];
                  return (
                    <button
                      key={key}
                      className={active ? 'active' : ''}
                      aria-pressed={active}
                      disabled
                      title="Bộ lọc này chưa được hỗ trợ"
                      onClick={() =>
                        setFilters({
                          ...filters,
                          [key]:
                            key === 'delivery'
                              ? active
                                ? ''
                                : 'delivery'
                              : !active,
                        })
                      }
                    >
                      <Icon name={icon} size={13} />
                      {label}
                    </button>
                  );
                })}
              </div>
              <label className="sort-control">
                Sắp xếp:
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="newest">Mới nhất</option>
                  <option value="price_asc">Giá thấp đến cao</option>
                  <option value="price_desc">Giá cao đến thấp</option>
                </select>
              </label>
            </div>
            <div className="demo-notice">
              <span>
                Dữ liệu từ hệ thống ·{' '}
                {search.start
                  ? 'Đã lọc lịch trống'
                  : 'Chưa chọn thời gian thuê'}
              </span>
              <button
                className={savedOnly ? 'active' : ''}
                aria-pressed={savedOnly}
                onClick={() => {
                  setSavedOnly(!savedOnly);
                  setPage(1);
                }}
              >
                <Icon name="heart" size={12} />
                Đã lưu ({saved.length})
              </button>
            </div>
            {loading && (
              <p role="status" className="request-state">
                Đang tải danh sách xe...
              </p>
            )}
            {error && (
              <div role="alert" className="request-state">
                <p>{error}</p>
                <button className="primary-button" onClick={retry}>
                  Thử lại
                </button>
              </div>
            )}
            <div className="vehicle-grid" aria-busy={loading}>
              {!loading &&
                !error &&
                results.map((car) => (
                  <VehicleCard
                    key={car.id}
                    car={car}
                    saved={saved.includes(car.id)}
                    onSave={toggleSaved}
                    onSelect={(car) => setModal({ title: car.name, car })}
                  />
                ))}
            </div>
            {!loading && !error && !results.length && (
              <div className="empty-state">
                <Icon name="car" size={46} />
                <h2>Chưa tìm thấy xe phù hợp</h2>
                <p>
                  Thử thay đổi bộ lọc hoặc xem tất cả xe để có thêm lựa chọn.
                </p>
                <button className="primary-button" onClick={reset}>
                  Xóa bộ lọc
                </button>
              </div>
            )}
            <div className="results-bottom">
              <p aria-live="polite">
                Hiển thị{' '}
                <strong>
                  {!loading && !error && results.length
                    ? `${(page - 1) * pagination.limit + 1} – ${(page - 1) * pagination.limit + results.length}`
                    : '0'}
                </strong>{' '}
                trong tổng số{' '}
                <strong>
                  {!loading && !error ? pagination.total : '…'} xe
                </strong>{' '}
                phù hợp
              </p>
              <nav className="pagination" aria-label="Phân trang">
                <button
                  disabled={loading || !!error || page <= 1}
                  onClick={() => setPage(page - 1)}
                  aria-label="Trang trước"
                >
                  <Icon name="arrow" className="rotate" size={13} />
                </button>
                <button className="current-page" aria-current="page">
                  {page}
                </button>
                <button
                  disabled={loading || !!error || page >= pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                  aria-label="Trang sau"
                >
                  <Icon name="arrow" size={13} />
                </button>
              </nav>
            </div>
          </section>
        </div>
      </main>
      <Footer onInfo={onInfo} />
      {modal && (
        <Modal title={modal.title} onClose={() => setModal(null)}>
          {modal.car ? (
            <>
              <VehicleImage
                className="detail-photo"
                car={modal.car}
                loading="eager"
              />
              <div className="detail-tags">
                {modal.car.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <p className="detail-cost">
                <strong>{formatPrice(modal.car.price)} đ</strong> / ngày
              </p>
              <p className="detail-note">
                {modal.car.description} Chức năng đặt xe chưa được triển khai.
              </p>
            </>
          ) : (
            <p className="info-text">{modal.text}</p>
          )}
          <button
            className="primary-button modal-done"
            onClick={() => setModal(null)}
          >
            Đã hiểu
          </button>
        </Modal>
      )}
    </>
  );
}
