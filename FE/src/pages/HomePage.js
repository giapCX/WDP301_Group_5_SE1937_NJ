import { useEffect, useState } from 'react';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import VehicleCard, { money, fuelLabels } from '../components/VehicleCard';
import { getApi } from '../services/api';
import './HomePage.css';

const categories = [
  { label: 'Tất cả xe', query: {}, icon: 'car' },
  { label: 'Xe 7 chỗ', query: { seats: 7 }, icon: 'people' },
  { label: 'Sedan', query: { vehicleType: 'Sedan' }, icon: 'car' },
  { label: 'Xe điện', query: { fuelType: 'electric' }, icon: 'bolt' },
  { label: 'Xe 5 chỗ', query: { seats: 5 }, icon: 'car' },
];

function localDateTime(date) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
}

function initialDates() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 2);
  return { start: localDateTime(start), end: localDateTime(end) };
}

function SectionHeading({ eyebrow, title, description, left = false }) {
  return (
    <div className={`section-heading ${left ? 'heading-left' : ''}`}>
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

function IncomeCalculator({ catalog, commission }) {
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

export default function HomePage() {
  const [homepage, setHomepage] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [metaError, setMetaError] = useState(false);
  const [metaRetry, setMetaRetry] = useState(0);
  const [listings, setListings] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [category, setCategory] = useState(0);
  const [sort, setSort] = useState('newest');
  const [limit, setLimit] = useState(6);
  const [dates, setDates] = useState(initialDates);
  const [city, setCity] = useState('');
  const [search, setSearch] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [dialog, setDialog] = useState(null);
  const policies = homepage?.policies;
  const refundDays = policies?.depositRefundBusinessDays;
  const cancelHours = policies?.freeCancellationHours;

  useEffect(() => {
    const controller = new AbortController();
    setMetaError(false);
    Promise.allSettled([
      getApi('/homepage', { signal: controller.signal }),
      getApi('/listings?limit=100', { signal: controller.signal }),
    ])
      .then(([meta, cars]) => {
        if (controller.signal.aborted) return;
        if (meta.status === 'fulfilled') setHomepage(meta.value.data);
        else setMetaError(true);
        if (cars.status === 'fulfilled') setCatalog(cars.value.data);
      });
    return () => controller.abort();
  }, [metaRetry]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ limit, sort, ...categories[category].query });
    if (search) {
      if (search.city) query.set('city', search.city);
      query.set('startAt', search.startAt);
      query.set('endAt', search.endAt);
    }
    getApi(`/listings?${query}`, { signal: controller.signal })
      .then((result) => {
        setListings(result.data);
        setTotal(result.pagination.total);
      })
      .catch((reason) => {
        if (reason.name !== 'AbortError') setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [category, sort, search, limit, retry]);

  const submitSearch = (event) => {
    event.preventDefault();
    const start = new Date(dates.start);
    const end = new Date(dates.end);
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      start <= new Date() ||
      end <= start
    ) {
      setSearchError('Vui lòng chọn ngày nhận trong tương lai và ngày trả sau ngày nhận.');
      return;
    }
    setSearchError('');
    setLimit(6);
    setSearch({ city, startAt: start.toISOString(), endAt: end.toISOString() });
    document.getElementById('xe-noi-bat').scrollIntoView({ behavior: 'smooth' });
  };

  const resetSearch = () => {
    setSearch(null);
    setCity('');
    setCategory(0);
    setLimit(6);
    setSearchError('');
  };

  const steps = [
    {
      title: 'Tìm & chọn xe',
      text: 'Chọn địa điểm, thời gian thuê và chiếc xe phù hợp. Xem rõ giá thuê, tiền cọc và điều kiện trước khi đặt.',
      note: 'Danh sách xe đã được kiểm duyệt',
      icon: 'search',
    },
    {
      title: 'Xác thực & xác nhận',
      text: 'Xác minh danh tính, bằng lái, xác nhận hợp đồng và thanh toán. Nền tảng quản lý yêu cầu theo quy trình vận hành.',
      note: 'Không cần chủ xe duyệt từng đơn',
      icon: 'document',
    },
    {
      title: 'Nhận xe & lên đường',
      text: 'Nhận xe tại gara cùng nhân viên, đối chiếu tình trạng, ảnh, số km và nhiên liệu. Xác nhận biên bản khi nhận và trả.',
      note: 'Bàn giao có biên bản rõ ràng',
      icon: 'car',
    },
  ];

  return (
    <>
      <a className="skip-link" href="#noi-dung">
        Đến nội dung chính
      </a>
      <SiteHeader onLogin={() => setDialog({ type: 'login' })} />
      <main id="noi-dung">
        <section className="hero" id="trang-chu">
          <div className="container">
            <span className="hero-badge">
              <Icon name="shield" size={15} /> Hành trình tự do, an tâm cùng XeDi
            </span>
            <h1>
              Thuê Xe Tự Lái Dễ Dàng,
              <br />
              <span>Vi Vu Mọi Nẻo Đường</span>
            </h1>
            <p className="hero-description">
              Chọn chiếc xe phù hợp, rõ ràng từng chi phí.
              <br className="mobile-break" /> Xe được nền tảng quản lý, kiểm tra và bàn giao tại
              gara.
            </p>
            <form className="search-pod" onSubmit={submitSearch} aria-label="Tìm xe cho thuê">
              <div className="search-field location-field">
                <label htmlFor="pickup-city">ĐỊA ĐIỂM NHẬN XE</label>
                <div>
                  <Icon name="pin" />
                  <select
                    id="pickup-city"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                  >
                    <option value="">Bạn muốn nhận xe ở đâu?</option>
                    {homepage?.cities.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="search-field">
                <label htmlFor="pickup-date">NGÀY NHẬN</label>
                <div>
                  <Icon name="calendar" />
                  <input
                    id="pickup-date"
                    type="datetime-local"
                    required
                    min={localDateTime(new Date())}
                    value={dates.start}
                    onChange={(event) => setDates({ ...dates, start: event.target.value })}
                  />
                </div>
              </div>
              <div className="search-field">
                <label htmlFor="return-date">NGÀY TRẢ</label>
                <div>
                  <Icon name="calendar" />
                  <input
                    id="return-date"
                    type="datetime-local"
                    required
                    min={dates.start}
                    value={dates.end}
                    onChange={(event) => setDates({ ...dates, end: event.target.value })}
                  />
                </div>
              </div>
              <button className="button button-primary search-button" type="submit">
                <Icon name="search" />
                Tìm xe ngay
              </button>
            </form>
            {searchError && (
              <p className="form-error" role="alert">
                {searchError}
              </p>
            )}
            <div className="hero-trust">
              <span>
                <Icon name="shield" size={17} />
                Xe được kiểm tra trước khi đăng
              </span>
              <i />
              <span>
                <Icon name="document" size={17} />
                Hợp đồng & biên bản minh bạch
              </span>
              <i />
              <span>
                <Icon name="wallet" size={17} />
                Hoàn cọc sau đối soát
              </span>
            </div>
          </div>
        </section>

        <section className="metrics" aria-label="Thông tin dịch vụ">
          <div className="container metrics-grid">
            <div>
              <span className="metric-icon">
                <Icon name="car" size={23} />
              </span>
              <strong>{homepage ? homepage.totalListings : '—'} xe</strong>
              <span>Đang được niêm yết</span>
            </div>
            <div>
              <span className="metric-icon">
                <Icon name="shield" size={23} />
              </span>
              <strong>Đã kiểm duyệt</strong>
              <span>Hồ sơ & tình trạng phương tiện</span>
            </div>
            <div>
              <span className="metric-icon">
                <Icon name="document" size={23} />
              </span>
              <strong>Rõ hợp đồng</strong>
              <span>Xác nhận trước khi nhận xe</span>
            </div>
            <div>
              <span className="metric-icon">
                <Icon name="wallet" size={23} />
              </span>
              <strong>{refundDays ? `${refundDays} ngày làm việc` : 'Sau đối soát'}</strong>
              <span>Thời hạn hoàn tiền cọc hợp lệ</span>
            </div>
          </div>
          {metaError && (
            <p className="meta-error" role="status">
              Chưa tải được chính sách hiện hành.{' '}
              <button onClick={() => setMetaRetry((value) => value + 1)}>Thử lại</button>
            </p>
          )}
        </section>

        <section className="section how-it-works" id="huong-dan">
          <div className="container">
            <SectionHeading
              eyebrow="TRẢI NGHIỆM ĐƠN GIẢN"
              title="Thuê xe chỉ với 3 bước tinh gọn"
              description="Từ chọn xe đến bàn giao, mỗi bước đều rõ ràng để bạn an tâm bắt đầu hành trình."
            />
            <div className="steps-grid">
              {steps.map((step, index) => (
                <article className="step-card" key={step.title}>
                  <span className="step-number">0{index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                  <span className="step-note">
                    <Icon name={step.icon} size={16} />
                    {step.note}
                  </span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section featured-section" id="xe-noi-bat">
          <div className="container">
            <div className="featured-heading">
              <SectionHeading
                left
                eyebrow="BỘ SƯU TẬP XE"
                title={search ? 'Chiếc xe cho hành trình của bạn' : 'Tìm chiếc xe bạn yêu thích'}
                description={
                  search
                    ? `Xe phù hợp lịch thuê${search.city ? ` tại ${search.city}` : ''}. Kết quả sẽ được kiểm tra lại khi đặt xe.`
                    : 'Khám phá những chiếc xe đã được nền tảng kiểm duyệt và niêm yết.'
                }
              />
              <div className="category-list" aria-label="Loại xe">
                {categories.map((item, index) => (
                  <button
                    key={item.label}
                    className={`category-chip ${category === index ? 'selected' : ''}`}
                    aria-pressed={category === index}
                    onClick={() => {
                      setCategory(index);
                      setLimit(6);
                    }}
                  >
                    <Icon name={item.icon} size={14} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="results-toolbar">
              <span aria-live="polite">
                {loading
                  ? 'Đang tìm xe phù hợp…'
                  : error
                    ? 'Danh sách xe tạm thời chưa khả dụng'
                    : `${total} xe${search ? ' phù hợp tìm kiếm' : ' đang niêm yết'}`}
                {search && (
                  <button className="clear-search" onClick={resetSearch}>
                    Xóa tìm kiếm <Icon name="close" size={12} />
                  </button>
                )}
              </span>
              <label htmlFor="listing-sort">
                Sắp xếp:
                <select
                  id="listing-sort"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="newest">Mới nhất</option>
                  <option value="price_asc">Giá thấp đến cao</option>
                  <option value="price_desc">Giá cao đến thấp</option>
                </select>
              </label>
            </div>
            {loading ? (
              <div className="vehicle-grid" aria-label="Đang tải xe" aria-busy="true">
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="skeleton-card">
                    <div />
                    <span />
                    <span />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="empty-state" role="alert">
                <Icon name="info" size={36} />
                <h3>Chưa thể tải danh sách xe</h3>
                <p>{error}</p>
                <button
                  className="button button-primary"
                  onClick={() => {
                    setRetry((value) => value + 1);
                    setMetaRetry((value) => value + 1);
                  }}
                >
                  Thử lại
                </button>
              </div>
            ) : listings.length ? (
              <div className="vehicle-grid">
                {listings.map((listing, index) => (
                  <VehicleCard
                    listing={listing}
                    key={listing._id}
                    index={index}
                    onDetails={(item) => setDialog({ type: 'vehicle', listing: item })}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Icon name="search" size={36} />
                <h3>Chưa có xe phù hợp</h3>
                <p>Thử địa điểm, thời gian hoặc loại xe khác để tìm thêm lựa chọn.</p>
                <button className="button button-outline" onClick={resetSearch}>
                  Xem tất cả xe
                </button>
              </div>
            )}
            {!loading && !error && listings.length < total && (
              <div className="view-all">
                <button
                  className="button button-outline"
                  onClick={() => setLimit((value) => Math.min(value + 6, 100))}
                >
                  Xem thêm xe <Icon name="arrow" size={17} />
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="section host-section" id="chu-xe">
          <div className="container">
            <div className="host-banner">
              <div className="host-copy">
                <span className="host-eyebrow">
                  <Icon name="wallet" size={14} /> ĐỐI TÁC CHỦ XE XEDI
                </span>
                <h2>
                  Bạn có xe nhàn rỗi?
                  <br />
                  Để XeDi đồng hành
                  <br className="desktop-break" /> cùng chiếc xe của bạn.
                </h2>
                <p>
                  Giao xe cho nền tảng quản lý và khai thác cho thuê. Theo dõi tình trạng phương
                  tiện và doanh thu theo hợp đồng ủy quyền.
                </p>
                <ul>
                  <li>
                    <Icon name="check" />
                    Kiểm tra xe, ký hợp đồng quản lý và tiếp nhận tại gara
                  </li>
                  <li>
                    <Icon name="check" />
                    Nền tảng quản lý tin xe, lịch thuê và yêu cầu đặt xe
                  </li>
                  <li>
                    <Icon name="check" />
                    Đối soát doanh thu, hoa hồng và khoản chi trả rõ ràng
                  </li>
                </ul>
                <div className="host-actions">
                  <button
                    className="button button-primary"
                    onClick={() => setDialog({ type: 'owner' })}
                  >
                    Tìm hiểu đăng ký xe <Icon name="arrow" size={17} />
                  </button>
                  <button className="host-policy" onClick={() => setDialog({ type: 'policy' })}>
                    Xem chính sách chủ xe
                  </button>
                </div>
              </div>
              <IncomeCalculator
                catalog={catalog}
                commission={policies?.commissionPercent ?? null}
              />
            </div>
          </div>
        </section>

        <section className="section safety-section" id="an-tam">
          <div className="container">
            <SectionHeading
              eyebrow="TIÊU CHUẨN VẬN HÀNH XEDI"
              title="An tâm trên mọi cung đường"
              description="Hồ sơ rõ ràng, bàn giao có đối chiếu và quyền lợi được xử lý theo hợp đồng."
            />
            <div className="safety-grid">
              <article className="info-card">
                <span className="info-icon">
                  <Icon name="car" size={27} />
                </span>
                <h3>Bàn giao tại gara</h3>
                <p>
                  Nhân viên ghi nhận hình ảnh, tình trạng xe, số km và mức nhiên liệu ở cả hai thời
                  điểm nhận và trả. Khách thuê cùng kiểm tra và xác nhận biên bản.
                </p>
              </article>
              <article className="info-card">
                <span className="info-icon">
                  <Icon name="shield" size={27} />
                </span>
                <h3>Xác minh trước khi nhận xe</h3>
                <p>
                  Khách thuê cung cấp thông tin danh tính và giấy phép lái xe để xác minh. Xe được
                  kiểm tra hồ sơ và tình trạng trước khi được quản lý cho thuê.
                </p>
              </article>
              <article className="info-card">
                <span className="info-icon">
                  <Icon name="wallet" size={27} />
                </span>
                <h3>Tiền cọc được đối soát rõ ràng</h3>
                <p>
                  {refundDays
                    ? `Hoàn cọc trong ${refundDays} ngày làm việc sau khi đủ điều kiện đối soát.`
                    : 'Tiền cọc được hoàn theo chính sách có hiệu lực sau khi đủ điều kiện đối soát.'}{' '}
                  Chỉ khấu trừ với căn cứ đã xác minh; yêu cầu bồi thường được quản lý phê duyệt và
                  khách thuê có quyền tranh chấp.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section faq-section" id="cau-hoi">
          <div className="container">
            <SectionHeading
              eyebrow="TRƯỚC KHI BẮT ĐẦU"
              title="Bạn hỏi, XeDi giải đáp"
              description="Một vài điều cần biết để chuẩn bị cho chuyến đi sắp tới."
            />
            <div className="faq-grid">
              <details>
                <summary>
                  Tôi nhận và trả xe ở đâu?
                  <Icon name="down" size={18} />
                </summary>
                <p>
                  Bạn nhận và trả xe tại gara ghi trên tin xe và hợp đồng. Nhân viên gara thực hiện
                  bàn giao, ghi nhận tình trạng và xác nhận cùng bạn.
                </p>
              </details>
              <details>
                <summary>
                  Chủ xe có duyệt đơn thuê không?
                  <Icon name="down" size={18} />
                </summary>
                <p>
                  Chủ xe ủy quyền cho nền tảng quản lý booking theo hợp đồng quản lý xe. Yêu cầu
                  thuê được nền tảng xử lý, không cần chủ xe xác nhận từng đơn.
                </p>
              </details>
              <details>
                <summary>
                  Khi nào tôi được hoàn tiền cọc?
                  <Icon name="down" size={18} />
                </summary>
                <p>
                  {refundDays
                    ? `Trong ${refundDays} ngày làm việc sau khi đủ điều kiện đối soát.`
                    : 'Theo chính sách hoàn cọc có hiệu lực sau khi đủ điều kiện đối soát.'}{' '}
                  Các khoản khấu trừ phải có căn cứ đã xác minh. Trường hợp phát sinh tranh chấp sẽ
                  được xử lý theo hồ sơ và quy trình của nền tảng.
                </p>
              </details>
            </div>
          </div>
        </section>
        <section className="about-strip" id="ve-xedi">
          <div className="container">
            <Icon name="car" size={24} />
            <p>
              <strong>Một chiếc xe phù hợp. Một hành trình đáng nhớ.</strong>
              <span>
                XeDi kết nối nhu cầu di chuyển với những chiếc xe được quản lý và bàn giao theo quy
                trình.
              </span>
            </p>
            <a href="#trang-chu">
              Bắt đầu hành trình <Icon name="arrow" size={17} />
            </a>
          </div>
        </section>
      </main>
      <SiteFooter onPolicy={() => setDialog({ type: 'policy' })} />

      {dialog && (
        <Modal
          title={
            dialog.type === 'vehicle'
              ? dialog.listing.title
              : dialog.type === 'policy'
                ? 'Chính sách thuê và quản lý xe'
                : dialog.type === 'owner'
                  ? 'Trở thành đối tác chủ xe'
                  : 'Đăng nhập XeDi'
          }
          onClose={() => setDialog(null)}
        >
          {dialog.type === 'vehicle' ? (
            <>
              <span className="green-pill">Xe đã kiểm duyệt · Nhận tại gara</span>
              <p>{dialog.listing.description}</p>
              <dl className="vehicle-details">
                <div>
                  <dt>Địa điểm nhận xe</dt>
                  <dd>
                    {dialog.listing.pickup_location.branch_name} ·{' '}
                    {dialog.listing.pickup_location.city}
                  </dd>
                </div>
                <div>
                  <dt>Giá thuê mỗi ngày</dt>
                  <dd>{money(dialog.listing.daily_price)} đ</dd>
                </div>
                <div>
                  <dt>Tiền cọc đảm bảo</dt>
                  <dd>{money(dialog.listing.security_deposit_amount)} đ</dd>
                </div>
                <div>
                  <dt>Thông số xe</dt>
                  <dd>
                    {dialog.listing.vehicle.seats} chỗ ·{' '}
                    {fuelLabels[dialog.listing.vehicle.fuel_type]} ·{' '}
                    {dialog.listing.vehicle.transmission === 'automatic' ? 'Tự động' : 'Số sàn'}
                  </dd>
                </div>
                <div>
                  <dt>Giới hạn quãng đường</dt>
                  <dd>
                    {dialog.listing.mileage_policy?.included_km_per_day} km/ngày · Phụ trội{' '}
                    {money(dialog.listing.mileage_policy?.extra_km_fee || 0)} đ/km
                  </dd>
                </div>
              </dl>
              <p className="dialog-note">
                Đặt xe trực tuyến sẽ sớm được mở. Bạn có thể tham khảo thông tin và chi phí trước
                khi lên kế hoạch.
              </p>
            </>
          ) : dialog.type === 'policy' ? (
            <div className="policy-content">
              <h3>Đặt và nhận xe</h3>
              <p>
                Booking do nền tảng quản lý theo hợp đồng ủy quyền. Khách thuê xác minh giấy tờ, xác
                nhận hợp đồng, thanh toán và nhận xe tại gara cùng nhân viên.
              </p>
              <h3>Hủy chuyến và hoàn cọc</h3>
              <p>
                {cancelHours
                  ? `Miễn phí hủy trước giờ nhận xe ít nhất ${cancelHours} giờ, theo điều kiện áp dụng.`
                  : 'Điều kiện hủy chuyến áp dụng theo chính sách có hiệu lực.'}{' '}
                {refundDays
                  ? `Hoàn cọc trong ${refundDays} ngày làm việc sau khi đủ điều kiện đối soát.`
                  : 'Vui lòng kiểm tra chính sách hoàn cọc trước khi giao kết.'}{' '}
                Khấu trừ phải có căn cứ xác minh và được xử lý theo thẩm quyền.
              </p>
              <h3>Dành cho chủ xe</h3>
              <p>
                Chủ xe ký hợp đồng quản lý, giao xe cho gara và ủy quyền nền tảng quản lý tin xe,
                booking và hợp đồng thuê.{' '}
                {policies?.commissionPercent != null
                  ? `Hoa hồng mặc định hiện tại là ${policies.commissionPercent}%; mức áp dụng thực tế theo từng hợp đồng quản lý.`
                  : 'Hoa hồng áp dụng theo hợp đồng quản lý.'}{' '}
                Yêu cầu rút xe được xử lý cùng các booking và khoản quyết toán còn liên quan.
              </p>
            </div>
          ) : dialog.type === 'owner' ? (
            <>
              <p>
                Đăng ký thông tin xe, cung cấp hồ sơ pháp lý để được kiểm tra và quản lý phê duyệt.
              </p>
              <ol className="owner-steps">
                <li>Kiểm tra hồ sơ và tình trạng phương tiện.</li>
                <li>Ký hợp đồng quản lý và phạm vi ủy quyền.</li>
                <li>Bàn giao xe cho gara của nền tảng.</li>
                <li>Nhân viên vận hành đăng tin và quản lý lịch thuê.</li>
              </ol>
              <p className="dialog-note">Cổng đăng ký chủ xe sẽ sớm được mở.</p>
            </>
          ) : (
            <>
              <p>
                Tài khoản XeDi giúp bạn quản lý thông tin cá nhân, yêu cầu thuê và hành trình của
                mình.
              </p>
              <p className="dialog-note">
                Đăng nhập sẽ sớm được mở. Hiện bạn có thể xem xe và tham khảo chính sách thuê.
              </p>
              <button
                className="button button-primary"
                onClick={() => {
                  setDialog(null);
                  document.getElementById('xe-noi-bat').scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Khám phá xe <Icon name="arrow" size={16} />
              </button>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
