import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import BookingSidebar from '../../features/bookings/components/BookingSidebar';
import Icon from '../../features/bookings/components/BookingIcon';
import { money } from '../../features/bookings/bookingConstants';
import '../../features/bookings/styles/bookings.css';
import './operator-dashboard.css';

export default function AvailableVehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/operator/vehicles/available');
      setVehicles(response.data.data.items || []);
    } catch (failure) {
      setError(failure.response?.data?.message || 'Không thể tải danh sách xe.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="dispatch-app">
      <BookingSidebar />
      <div className="dispatch-workspace">
        <header className="dispatch-topbar">
          <div className="dispatch-breadcrumb">
            Trang chủ <Icon name="chevron" size={11} /> Điều hành{' '}
            <Icon name="chevron" size={11} />
            <strong>Xe sẵn sàng</strong>
          </div>
          <div className="operator-profile">
            <span className="profile-avatar">
              <Icon name="user" size={18} />
            </span>
            <span>
              <strong>Operator Staff</strong>
              <small>Trung tâm điều hành</small>
            </span>
          </div>
        </header>
        <main className="dispatch-content">
          <section className="dispatch-page-heading">
            <div>
              <div className="heading-kicker">
                <span>ĐIỀU PHỐI PHƯƠNG TIỆN</span>
                <i /> Danh sách xe
              </div>
              <h1>Xe Sẵn Sàng</h1>
              <p>Các phương tiện có thể được xem xét cho lịch thuê.</p>
            </div>
            <button className="dispatch-button primary" disabled={loading} onClick={load}>
              <Icon name="refresh" size={16} />
              Làm mới dữ liệu
            </button>
          </section>
          {error && (
            <div className="dispatch-alert" role="alert">
              {error}
              <button className="dashboard-retry" onClick={load}>
                Thử lại
              </button>
            </div>
          )}
          <section className="dashboard-panel vehicles-panel">
            <div className="dashboard-panel-heading">
              <div>
                <h2>
                  {loading ? 'Đang tải xe…' : `${vehicles.length} phương tiện sẵn sàng`}
                </h2>
                <p>Trạng thái được lấy trực tiếp từ database.</p>
              </div>
              <Link to="/operator/bookings">
                Mở điều phối <Icon name="arrow" size={15} />
              </Link>
            </div>
            {loading ? (
              <div className="dashboard-empty">Đang tải danh sách xe…</div>
            ) : vehicles.length ? (
              <div className="available-vehicle-grid">
                {vehicles.map((vehicle) => (
                  <article className="available-vehicle-card" key={vehicle.vehicle_id}>
                    <div className="vehicle-card-art">
                      <Icon name="car" size={34} />
                      <span>{vehicle.seat_count} chỗ</span>
                    </div>
                    <div className="vehicle-card-copy">
                      <small>{vehicle.plate_number || 'Chưa có biển số'}</small>
                      <h3>
                        {vehicle.brand} {vehicle.model}
                      </h3>
                      <p>
                        {vehicle.year || 'Năm sản xuất chưa cập nhật'} ·{' '}
                        {vehicle.color || 'Màu chưa cập nhật'}
                      </p>
                    </div>
                    <div className="available-vehicle-footer">
                      <span>
                        <i />
                        Sẵn sàng
                      </span>
                      <b>
                        {money(vehicle.price_per_day)}
                        <small>/ngày</small>
                      </b>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty">Không có xe sẵn sàng trong database.</div>
            )}
          </section>
          <footer className="dispatch-footer">
            <span>VietTour · Không gian điều hành</span>
            <span>Dữ liệu từ hệ thống</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
