import { useEffect, useState } from 'react';
import { getManagerResource, getSystemReport, saveSystemReport } from '../api/managerApi';

const money = (amount) => new Intl.NumberFormat('vi-VN').format(amount || 0);
const date = (value, options = { day: '2-digit', month: '2-digit' }) => new Intl.DateTimeFormat('vi-VN', options).format(new Date(value));

function WorkspaceHeader({ title, subtitle, count }) {
  return <div className="workspace-header"><div><h2>{title}</h2><p>{subtitle}</p></div>{count !== undefined && <span className="workspace-count">{count} hồ sơ</span>}</div>;
}

function DateFilter({ from, to, setFrom, setTo }) {
  return <div className="report-filters"><label>Từ ngày<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label><label>Đến ngày<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label><button onClick={() => { setFrom(''); setTo(''); }}>Xóa lọc</button></div>;
}

function ReportMetric({ label, value = 0 }) {
  return <div className="report-metric"><span>{label}</span><strong>{money(value)} ₫</strong></div>;
}

function SettlementRows({ rows }) {
  return <div className="requests-table-wrap"><table className="requests-table"><thead><tr><th>NGÀY ĐỐI SOÁT</th><th>DOANH THU THUÊ</th><th>PHÍ NỀN TẢNG</th><th>THANH TOÁN CHỦ XE</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.date}-${index}`}><td>{date(row.date)}</td><td>{money(row.grossRentalRevenue)} ₫</td><td>{money(row.platformCommission)} ₫</td><td>{money(row.ownerPayout)} ₫</td></tr>)}</tbody></table>{!rows.length && <p className="manager-empty">Chưa có dữ liệu đối soát trong kỳ.</p>}</div>;
}

function SavedReportDialog({ report, onClose }) {
  const content = report.report || {};
  const finance = report.type === 'finance';
  const metrics = finance
    ? [
      ['Doanh thu thuê xe', content.totals?.grossRentalRevenue],
      ['Phí nền tảng', content.totals?.platformCommission],
      ['Đã trả chủ xe', content.totals?.ownerPayout],
      ['Số khoản đối soát', content.settlements?.length || 0],
    ]
    : [
      ['Tổng lượt đặt', content.bookings?.total],
      ['Doanh thu lượt thuê', content.bookings?.rentalRevenue],
      ['Xe đã có lượt đặt', content.fleet?.vehiclesWithBookings],
      ['Số xe được duyệt', content.fleet?.approvedVehicles],
      ['Sự cố đang mở', content.incidents?.open],
    ];
  return <div className="saved-report-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="saved-report-dialog" role="dialog" aria-modal="true" aria-labelledby="saved-report-title">
      <header><div><h3 id="saved-report-title">{report.title || 'Chi tiết báo cáo'}</h3><p>{report.from ? date(report.from) : '—'} – {report.to ? date(report.to) : '—'} · Tạo lúc {report.generatedAt ? date(report.generatedAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</p></div><button onClick={onClose} aria-label="Đóng">×</button></header>
      <div className="saved-report-metrics">{metrics.map(([label, value]) => <div className="saved-report-metric" key={label}><span>{label}</span><strong>{finance && label !== 'Số khoản đối soát' ? `${money(value)} ₫` : money(value)}</strong></div>)}</div>
    </section>
  </div>;
}

const dateInput = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

export default function ReportsWorkspace({ active, onNotice }) {
  const [data, setData] = useState(null);
  const [from, setFrom] = useState(() => { const start = new Date(); start.setDate(start.getDate() - 30); return dateInput(start); });
  const [to, setTo] = useState(() => dateInput(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getManagerResource(active, { ...(active === 'savedReports' ? {} : { from, to }), signal: controller.signal })
      .then((result) => setData(result.data))
      .catch((reason) => { if (reason.name !== 'AbortError') setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [active, from, to, reload]);

  const save = async (type) => {
    try {
      await saveSystemReport({ type, from, to });
      onNotice(type === 'finance' ? 'Đã lưu báo cáo tài chính.' : 'Đã lưu báo cáo hoạt động.');
      setReload((value) => value + 1);
    } catch (reason) {
      setError(reason.message || 'Không thể lưu báo cáo.');
    }
  };

  const openSavedReport = async (id) => {
    setReportLoading(true);
    try {
      const result = await getSystemReport(id);
      setSelectedReport(result.data);
    } catch (reason) {
      onNotice(reason.message || 'Không thể mở báo cáo.');
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) return <section className="manager-panel workspace-panel"><p className="manager-empty">Đang tải báo cáo…</p></section>;
  if (error) return <section className="manager-panel workspace-panel"><div className="manager-notice manager-error">{error}<button onClick={() => setReload((value) => value + 1)}>Thử lại</button></div></section>;

  if (active === 'savedReports') return <section className="manager-panel workspace-panel">
    <WorkspaceHeader title="Báo cáo hệ thống đã lưu" subtitle="Bản chụp báo cáo đã tạo để tra cứu và đối chiếu." count={data?.length || 0} />
    <div className="requests-table-wrap"><table className="requests-table"><thead><tr><th>TÊN BÁO CÁO</th><th>LOẠI</th><th>KỲ TỪ</th><th>KỲ ĐẾN</th><th>NGÀY TẠO</th></tr></thead><tbody>{(data || []).map((item) => <tr key={item.id}><td><button className="action-review" disabled={reportLoading} onClick={() => openSavedReport(item.id)}>{item.title}</button></td><td>{item.type === 'finance' ? 'Tài chính' : 'Hoạt động'}</td><td>{item.from ? date(item.from) : '—'}</td><td>{item.to ? date(item.to) : '—'}</td><td>{item.generatedAt ? date(item.generatedAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td></tr>)}</tbody></table>{!data?.length && <p className="manager-empty">Chưa có báo cáo được lưu.</p>}</div>
    {selectedReport && <SavedReportDialog report={selectedReport} onClose={() => setSelectedReport(null)} />}
  </section>;

  if (active === 'operations') {
    const report = data || { bookings: { byStatus: {} }, fleet: {}, incidents: {} };
    const statusLabels = { pending: 'Chờ xác nhận', awaiting_payment: 'Chờ thanh toán', confirmed: 'Đã xác nhận', ongoing: 'Đang thuê', completed: 'Hoàn tất', cancelled: 'Đã hủy', rejected: 'Từ chối' };
    return <section className="manager-panel workspace-panel"><WorkspaceHeader title="Báo cáo hoạt động" subtitle="Booking, tình trạng đội xe và sự cố trong khoảng ngày." /><DateFilter from={from} to={to} setFrom={setFrom} setTo={setTo} /><button className="action-review" onClick={() => save('operations')}>Lưu báo cáo hệ thống</button><div className="report-metrics"><ReportMetric label="Tổng booking" value={report.bookings.total} /><ReportMetric label="Doanh thu booking" value={report.bookings.rentalRevenue} /><ReportMetric label="Xe có booking / đội xe" value={`${report.fleet.vehiclesWithBookings || 0} / ${report.fleet.approvedVehicles || 0}`} /><ReportMetric label="Tỷ lệ sử dụng" value={`${report.fleet.utilizationPct || 0}%`} /><ReportMetric label="Sự cố đang mở" value={report.incidents.open} /></div><h3 className="saved-report-subheading">Booking theo trạng thái</h3><div className="booking-status-grid">{Object.entries(report.bookings.byStatus || {}).map(([status, count]) => <div className="booking-status-card" key={status}><span>{statusLabels[status] || status}</span><strong>{count}</strong></div>)}{!Object.keys(report.bookings.byStatus || {}).length && <p className="manager-empty">Chưa có booking trong kỳ.</p>}</div></section>;
  }

  if (active === 'finance') {
    const report = data || { totals: {}, settlements: [] };
    return <section className="manager-panel workspace-panel"><WorkspaceHeader title="Báo cáo tài chính" subtitle="Đối soát các khoản thanh toán chủ xe đã hoàn tất." /><DateFilter from={from} to={to} setFrom={setFrom} setTo={setTo} /><button className="action-review" onClick={() => save('finance')}>Lưu báo cáo hệ thống</button><div className="report-metrics"><ReportMetric label="Doanh thu thuê xe" value={report.totals?.grossRentalRevenue} /><ReportMetric label="Phí nền tảng" value={report.totals?.platformCommission} /><ReportMetric label="Đã trả chủ xe" value={report.totals?.ownerPayout} /></div><SettlementRows rows={report.settlements || []} /></section>;
  }

  if (active === 'inspections') return <section className="manager-panel workspace-panel"><WorkspaceHeader title="Báo cáo kiểm định xe" subtitle="Lịch sử kiểm định và biên bản xe ghi nhận tại gara." count={data?.length || 0} /><DateFilter from={from} to={to} setFrom={setFrom} setTo={setTo} /><div className="requests-table-wrap"><table className="requests-table"><thead><tr><th>THỜI GIAN</th><th>PHƯƠNG TIỆN</th><th>BIỂN SỐ</th><th>KẾT QUẢ</th><th>GHI CHÚ</th></tr></thead><tbody>{(data || []).map((item) => <tr key={item.id}><td>{item.inspectedAt ? date(item.inspectedAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td><td>{item.vehicle ? `${item.vehicle.brand} ${item.vehicle.model}` : '—'}</td><td>{item.vehicle?.license_plate || '—'}</td><td>{item.result}</td><td>{item.notes || '—'}</td></tr>)}</tbody></table>{!data?.length && <p className="manager-empty">Chưa có báo cáo kiểm định.</p>}</div></section>;

  return null;
}
