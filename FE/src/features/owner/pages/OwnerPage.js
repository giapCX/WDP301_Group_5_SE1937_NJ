import { useState } from 'react';
import usePagination from '../../../hooks/usePagination';
import Pagination from '../../../components/ui/Pagination';
import { clearSession, getCurrentUser } from '../../auth/session';
import useOwnerDashboard from '../hooks/useOwnerDashboard';
import useOwnerAgreement from '../hooks/useOwnerAgreement';
import RegistrationDialog from '../components/RegistrationDialog';
import VehicleRevisionDialog from '../components/VehicleRevisionDialog';
import OwnerVehicleConditionDialog from '../components/OwnerVehicleConditionDialog';
import OwnerActions from '../components/OwnerActions';
import './owner.css';
const money = value => new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0
}).format(value || 0);
const statusLabels = {
  approved: 'Đã duyệt',
  submitted: 'Đang xác minh',
  pending_review: 'Đang xác minh',
  revision_required: 'Cần bổ sung',
  rejected: 'Từ chối',
  available: 'Sẵn sàng',
  rented: 'Đang cho thuê',
  maintenance: 'Bảo dưỡng',
  with_owner: 'Ở chủ xe',
  returned_to_owner: 'Đã bàn giao',
  paid: 'Đã thanh toán',
  payable: 'Sẵn sàng chi trả',
  payout_requested: 'Chờ xác nhận chi trả',
  draft: 'Đang đối soát',
  requested: 'Đã tiếp nhận',
  coordinating_bookings: 'Đang xử lý chuyến',
  processing: 'Đang xử lý',
  withdrawn: 'Đã rút xe',
  reported: 'Đã ghi nhận',
  investigating: 'Đang xác minh',
  resolved: 'Đã xử lý',
  closed: 'Đã đóng',
  pending_signatures: 'Chờ hoàn tất chữ ký',
  terminated: 'Đã chấm dứt',
  vehicle_damage: 'Hư hỏng xe',
  traffic_violation: 'Vi phạm giao thông',
  theft: 'Mất cắp',
  other: 'Khác'
};
function onboardingStep(vehicle, agreement) {
  if (vehicle.approvalStatus === 'rejected') return 'Hồ sơ đã bị từ chối';
  if (vehicle.approvalStatus === 'revision_required') return 'Bổ sung hồ sơ hoặc ghi nội dung đã khắc phục';
  if (vehicle.listing?.status === 'published' && ['at_garage', 'rented'].includes(vehicle.operatingStatus)) return 'Tin xe đã xuất bản';
  if (vehicle.operatingStatus === 'at_garage') return 'Đã nhập gara · chờ Manager xuất bản';
  if (vehicle.operatingStatus === 'maintenance') return 'Xe đang bảo dưỡng';
  if (vehicle.operatingStatus === 'returned_to_owner') return 'Xe đã giao lại cho chủ';
  if (vehicle.approvalStatus === 'approved') {
    if (agreement?.status === 'active') {
      if (vehicle.intake?.ownerReview?.status === 'accepted') return 'Chờ Garage hoàn tất tiếp nhận';
      if (vehicle.intake?.ownerReview?.status === 'disputed') return 'Garage đang xử lý bất đồng lúc tiếp nhận';
      return vehicle.intake?.status === 'draft' ? 'Xem và xác nhận biên bản tiếp nhận' : 'Chờ Garage lập biên bản tiếp nhận';
    }
    if (agreement?.status === 'pending_signatures') return 'Kiểm tra chữ ký hợp đồng ủy quyền';
    return 'Chờ Manager lập hợp đồng ủy quyền';
  }
  if (vehicle.inspection?.status === 'pending') {
    if (vehicle.inspection.ownerReview?.status === 'disputed') return 'Manager đang xem bất đồng về hiện trạng';
    return vehicle.inspection.ownerReview || !vehicle.inspection.conditionReport?.checklist ? 'Chờ Manager duyệt' : 'Xem và xác nhận báo cáo kiểm định';
  }
  if (vehicle.inspection?.status === 'draft') return 'Đã mở lượt kiểm định';
  return 'Chờ Manager xét duyệt và Operator phân công kiểm định';
}

const statusTone = status => ['approved', 'available', 'paid'].includes(status) ? 'green' : ['rejected', 'maintenance'].includes(status) ? 'red' : 'amber';
export default function OwnerPage() {
  const {
    data,
    error,
    loading,
    refresh
  } = useOwnerDashboard();
  const [view, setView] = useState('overview');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [conditionVehicle, setConditionVehicle] = useState(null);
  const [revisionVehicle, setRevisionVehicle] = useState(null);
  const [notice, setNotice] = useState('');
  const [selectedAgreementId, setSelectedAgreementId] = useState('');
  const vehiclePage = usePagination(data?.vehicles || [], view);
  const settlementPage = usePagination(data?.settlements || [], view);
  const agreementPage = usePagination(data?.agreements || [], view);
  const withdrawalPage = usePagination(data?.withdrawals || [], view);
  const incidentPage = usePagination(data?.incidents || [], view);
  const {
    agreement,
    error: agreementError,
    loading: agreementLoading
  } = useOwnerAgreement(selectedAgreementId);
  const user = getCurrentUser();
  const onCreated = result => {
    setRegisterOpen(false);
    setNotice('Đã gửi hồ sơ xe. Sau khi Manager duyệt, hai bên sẽ ký hợp đồng quản lý riêng.');
    setView('vehicles');
    refresh();
  };
  const signOut = () => {
    clearSession();
    window.location.href = '/#/login';
  };
  const items = [['overview', 'Tổng quan', '⌂'], ['vehicles', 'Đội xe của tôi', '▣'], ['agreements', 'Hợp đồng quản lý', '▤'], ['earnings', 'Doanh thu & đối soát', '◷'], ['requests', 'Yêu cầu & sự cố', '!']];
  return <div className="owner-app"><aside className="owner-sidebar"><a className="owner-brand" href="/">XeDi<span>HOST</span></a><div className="owner-workspace"><span className="owner-avatar">X</span><span><strong>XeDi Host Portal</strong><small>Không gian chủ xe</small></span></div><small className="owner-nav-label">QUẢN LÝ TÀI SẢN</small><nav>{items.map(([id, label, icon]) => <button key={id} className={view === id ? 'selected' : ''} onClick={() => setView(id)}><i>{icon}</i>{label}{id === 'vehicles' && data?.vehicles.some(v => ['submitted', 'pending_review', 'revision_required'].includes(v.approvalStatus)) && <b className="owner-nav-dot" />}</button>)}<a className="owner-sidebar-link" href="#/verification"><i>✓</i><span>Xác minh eKYC</span></a></nav><div className="owner-sidebar-bottom"><div className="owner-help"><strong>Cần hỗ trợ?</strong><p>Đội ngũ XeDi luôn sẵn sàng đồng hành cùng bạn.</p><a href="mailto:support@xedi.vn">Liên hệ hỗ trợ <span>→</span></a></div><div className="owner-account"><span className="owner-user-avatar">{(user?.full_name || 'C').slice(0, 1).toUpperCase()}</span><span><strong>{user?.full_name || 'Chủ xe'}</strong><small>Đối tác chủ xe</small></span><button onClick={signOut} title="Đăng xuất">↗</button></div></div></aside>
    <div className="owner-main"><header className="owner-topbar"><div className="owner-breadcrumb">Cổng chủ xe <span>/</span> <strong>{items.find(x => x[0] === view)?.[1]}</strong></div><div className="owner-top-actions"><a className="owner-ekyc-pill" href="#/verification">Xác minh eKYC <span>→</span></a><span className="owner-live"><i />Hệ thống hoạt động</span><button aria-label="Đăng xuất" onClick={signOut}>Đăng xuất</button></div></header>
      <main className="owner-content"><div className="owner-heading"><div><span className="owner-eyebrow">{new Intl.DateTimeFormat('vi-VN', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              }).format(new Date()).toLocaleUpperCase('vi-VN')}</span><h1>{view === 'overview' ? 'Chào mừng trở lại, ' + (user?.full_name?.split(' ').slice(-1)[0] || 'Chủ xe') : items.find(x => x[0] === view)?.[1]}</h1><p>Theo dõi đội xe, trạng thái hồ sơ và thu nhập của bạn trên XeDi.</p></div><button className="owner-primary owner-heading-cta" onClick={() => setRegisterOpen(true)}>＋ <span>Đăng ký xe mới</span></button></div>
        {data?.vehicles?.some(vehicle => vehicle.approvalStatus === 'revision_required') && <div className="owner-revision-alert-banner"><div className="owner-alert-content"><span className="owner-alert-badge">!</span><div><strong>Có hồ sơ xe cần bổ sung tài liệu</strong><p>Quản lý xét duyệt đã phản hồi yêu cầu bổ sung/sửa đổi giấy tờ cho xe của bạn.</p></div></div><button className="owner-primary owner-alert-btn" onClick={() => setRevisionVehicle(data.vehicles.find(vehicle => vehicle.approvalStatus === 'revision_required'))}>Bổ sung tài liệu ngay</button></div>}
        {notice && <div className="owner-notice" role="status">✓ {notice}<button onClick={() => setNotice('')}>×</button></div>}
        {error && <div className="owner-error" role="alert"><span>{error}</span><button className="owner-retry" onClick={refresh}>Thử lại</button></div>}
        {loading ? <div className="owner-panel owner-loading">Đang tải dữ liệu chủ xe…</div> : data && <>
          {(view === 'overview' || view === 'earnings') && <div className="owner-metrics"><article><span>Doanh thu gộp</span><strong>{money(data.totals.gross)}</strong><small>Tổng doanh thu cho thuê</small></article><article><span>Phí nền tảng</span><strong>{money(data.totals.commission)}</strong><small>Khấu trừ theo kỳ đối soát</small></article><article><span>Thu nhập thực nhận</span><strong>{money(data.totals.net)}</strong><small>Sau khi trừ phí nền tảng</small></article><article className="metric-highlight"><span>Chờ thanh toán</span><strong>{money(data.totals.withdrawable)}</strong><small>Khoản chưa được chi trả</small></article></div>}
          <OwnerActions data={data} agreement={agreement} agreementError={agreementError} agreementLoading={agreementLoading} onCloseAgreement={() => setSelectedAgreementId('')} onDone={message => {
            setNotice(message);
            setSelectedAgreementId('');
            refresh();
          }} />
          {(view === 'overview' || view === 'vehicles') && <section className="owner-panel"><div className="owner-panel-head"><div><h2>Đội xe của tôi</h2><p>Trạng thái duyệt hồ sơ và tình trạng vận hành</p></div><button className="owner-text-button" onClick={() => setView('vehicles')}>Xem toàn bộ <span>→</span></button></div><div className="owner-table-wrap"><table><thead><tr><th>PHƯƠNG TIỆN</th><th>BIỂN SỐ</th><th>HỒ SƠ</th><th>VẬN HÀNH</th></tr></thead><tbody>{(view === 'overview' ? data.vehicles.slice(0, 5) : vehiclePage.items).map(vehicle => <tr key={vehicle.id}><td><strong>{vehicle.brand} {vehicle.model}</strong><span>{vehicle.year || '—'}</span><button type="button" className="owner-text-button" onClick={() => setConditionVehicle(vehicle)}>Xem hiện trạng</button><span>{onboardingStep(vehicle, data.agreements.find((item) => item.vehicleId === vehicle.id))}</span></td><td>{vehicle.licensePlate || '—'}</td><td><i className={`owner-status ${statusTone(vehicle.approvalStatus)}`}>{statusLabels[vehicle.approvalStatus] || vehicle.approvalStatus || 'Chưa cập nhật'}</i></td><td><i className={`owner-status ${statusTone(vehicle.operatingStatus)}`}>{statusLabels[vehicle.operatingStatus] || vehicle.operatingStatus || 'Chưa cập nhật'}</i></td></tr>)}</tbody></table>{!data.vehicles.length && <div className="owner-empty"><span>▣</span><strong>Chưa có xe trong đội xe</strong><p>Đăng ký phương tiện đầu tiên để bắt đầu cho thuê cùng XeDi.</p><button className="owner-primary" onClick={() => setRegisterOpen(true)}>Đăng ký xe mới</button></div>}</div>{view !== "overview" && <Pagination {...vehiclePage} />}</section>}
          {(view === 'overview' || view === 'earnings') && <section className="owner-panel"><div className="owner-panel-head"><div><h2>Báo cáo thu nhập</h2><p>Chi tiết đối soát doanh thu và phí nền tảng</p></div><span className="owner-report-label">{data.settlements.length} kỳ đối soát</span></div><div className="owner-table-wrap"><table><thead><tr><th>KỲ ĐỐI SOÁT</th><th>DOANH THU</th><th>PHÍ NỀN TẢNG</th><th>THỰC NHẬN</th><th>TRẠNG THÁI</th></tr></thead><tbody>{(view === 'overview' ? data.settlements.slice(0, 5) : settlementPage.items).map(item => <tr key={item.id}><td>{item.periodStart ? new Date(item.periodStart).toLocaleDateString('vi-VN') : '—'} – {item.periodEnd ? new Date(item.periodEnd).toLocaleDateString('vi-VN') : '—'}</td><td>{money(item.gross)}</td><td>{money(item.commission)}</td><td><strong>{money(item.net)}</strong></td><td><i className={`owner-status ${statusTone(item.payoutStatus)}`}>{statusLabels[item.payoutStatus] || item.payoutStatus || 'Đang xử lý'}</i></td></tr>)}</tbody></table>{!data.settlements.length && <p className="owner-empty">Chưa có dữ liệu đối soát thu nhập.</p>}</div>{view !== "overview" && <Pagination {...settlementPage} />}</section>}
          {view === 'agreements' && <section className="owner-panel"><div className="owner-panel-head"><div><h2>Hợp đồng quản lý xe</h2><p>Thỏa thuận điện tử, thông tin điều khoản và lịch sử chữ ký</p></div><span className="owner-report-label">{data.agreements.length} hợp đồng</span></div><div className="owner-table-wrap"><table><thead><tr><th>MÃ HỢP ĐỒNG</th><th>PHƯƠNG TIỆN</th><th>PHÍ NỀN TẢNG</th><th>NGƯỜI KÝ</th><th>NGÀY KÝ</th><th>TRẠNG THÁI</th><th /></tr></thead><tbody>{agreementPage.items.map(agreement => <tr key={agreement.id}><td><strong>{agreement.number}</strong><span>{agreement.termsVersion}</span></td><td>{agreement.vehicle}</td><td>{agreement.commissionRatePct}%</td><td>{agreement.signatureName || user?.full_name || 'Chủ xe'}</td><td>{agreement.signedAt ? new Date(agreement.signedAt).toLocaleDateString('vi-VN') : '—'}</td><td><i className={`owner-status ${agreement.status === 'active' ? 'green' : 'amber'}`}>{statusLabels[agreement.status] || agreement.status || 'Chưa xác định'}</i></td><td><button className="owner-text-button" onClick={() => setSelectedAgreementId(agreement.id)}>Xem hợp đồng</button></td></tr>)}</tbody></table>{!data.agreements.length && <p className="owner-empty">Chưa có hợp đồng quản lý.</p>}</div><Pagination {...agreementPage} /></section>}
          {view === 'requests' && <><section className="owner-panel"><div className="owner-panel-head"><div><h2>Yêu cầu rút xe</h2><p>Theo dõi lịch tiếp nhận xe và chốt đối soát</p></div><span className="owner-report-label">{data.withdrawals.length} yêu cầu</span></div><div className="owner-table-wrap"><table><thead><tr><th>PHƯƠNG TIỆN</th><th>LÝ DO</th><th>NGÀY GỬI</th><th>NGÀY DỰ KIẾN</th><th>TRẠNG THÁI</th></tr></thead><tbody>{withdrawalPage.items.map(item => <tr key={item.id}><td>{data.vehicles.find(vehicle => vehicle.id === item.vehicleId)?.brand} {data.vehicles.find(vehicle => vehicle.id === item.vehicleId)?.model}</td><td>{item.reason}</td><td>{item.requestedAt ? new Date(item.requestedAt).toLocaleDateString('vi-VN') : '—'}</td><td>{item.requestedReturnAt ? new Date(item.requestedReturnAt).toLocaleDateString('vi-VN') : '—'}</td><td><i className="owner-status amber">{statusLabels[item.status] || item.status}</i></td></tr>)}</tbody></table>{!data.withdrawals.length && <p className="owner-empty">Chưa có yêu cầu rút xe.</p>}</div><Pagination {...withdrawalPage} /></section><section className="owner-panel"><div className="owner-panel-head"><div><h2>Báo cáo sự cố</h2><p>Theo dõi xử lý, tình trạng tạm giữ xe và khoản bồi thường</p></div><span className="owner-report-label">{data.incidents.length} báo cáo</span></div><div className="owner-table-wrap"><table><thead><tr><th>MÃ SỰ CỐ</th><th>LOẠI</th><th>TẠM GIỮ XE</th><th>NỘI DUNG</th><th>BỒI THƯỜNG ĐƯỢC DUYỆT</th><th>NGÀY GỬI</th><th>TRẠNG THÁI</th></tr></thead><tbody>{incidentPage.items.map(item => <tr key={item.id}><td><strong>{item.caseNumber}</strong></td><td>{statusLabels[item.caseType] || item.caseType}</td><td>{item.vehicleSeized === true ? 'Có' : item.vehicleSeized === false ? 'Không' : 'Chưa ghi nhận'}</td><td>{item.description}</td><td>{money(item.compensation)}</td><td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : '—'}</td><td><i className="owner-status amber">{statusLabels[item.status] || item.status}</i></td></tr>)}</tbody></table>{!data.incidents.length && <p className="owner-empty">Chưa có báo cáo sự cố.</p>}</div><Pagination {...incidentPage} /></section></>}
        </>}
        <footer className="owner-footer">© 2026 XeDi · Cổng thông tin dành cho chủ xe <span><i />Dữ liệu tài khoản được bảo vệ</span></footer>
      </main>
    </div>
    {registerOpen && <RegistrationDialog onClose={() => setRegisterOpen(false)} onCreated={onCreated} />}
    {conditionVehicle && <OwnerVehicleConditionDialog vehicle={conditionVehicle} onClose={() => setConditionVehicle(null)}
      onSaved={() => { setConditionVehicle(null); setNotice('Đã ghi nhận phản hồi hiện trạng xe.'); refresh(); }} />}
    {revisionVehicle && <VehicleRevisionDialog vehicle={revisionVehicle} onClose={() => setRevisionVehicle(null)} onSuccess={(message) => { setNotice(message); setRevisionVehicle(null); refresh(); }} />}
  </div>;
}
