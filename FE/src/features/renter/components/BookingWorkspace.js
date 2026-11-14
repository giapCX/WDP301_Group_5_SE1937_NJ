import { useState, useEffect } from 'react';
import { getRenter, postRenter, vnd, dateTime, statusName } from '../api/renterApi';
import { SigningDialog } from '../../contracts/ContractsPage';
import RentalJourney from './RentalJourney';
import { Field, Otp, Upload } from './Controls';
const reasons = {
  CHANGE_OF_PLAN: 'Thay đổi lịch trình',
  FOUND_ALTERNATIVE: 'Đã tìm được phương tiện khác',
  EMERGENCY_ISSUE: 'Có việc đột xuất',
  WEATHER_REASON: 'Thời tiết',
  OTHER: 'Lý do khác'
};
export default function BookingWorkspace({
  bookingId,
  config,
  onChanged
}) {
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const [otp, setOtp] = useState({}),
    [read, setRead] = useState(false),
    [agree, setAgree] = useState(false),
    [depositAgree, setDepositAgree] = useState(false),
    [method, setMethod] = useState('VNPAY_QR'),
    [code, setCode] = useState('');
  const [cancel, setCancel] = useState(null),
    [reason, setReason] = useState('CHANGE_OF_PLAN'),
    [note, setNote] = useState(''),
    [cancelAgree, setCancelAgree] = useState(false);
  const [report, setReport] = useState(false),
    [incident, setIncident] = useState({
      case_type: 'MECHANICAL_BREAKDOWN',
      evidence: []
    });
  const [showContract, setShowContract] = useState(false);
  const [now, setNow] = useState(Date.now());
  const load = () => getRenter('/bookings/' + bookingId).then(r => setData(r.data));
  useEffect(() => {
    let active = true;
    setData(null);
    getRenter('/bookings/' + bookingId).then(r => {
      if (active) setData(r.data);
    }).catch(e => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, [bookingId]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      getRenter('/bookings/' + bookingId, {
        signal: controller.signal
      }).then(r => setData(r.data)).catch(e => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    }, 15000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [bookingId]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  async function action(work) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
      await load();
      if (onChanged) onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!data) return <p role={error ? 'alert' : 'status'}>{error || 'Đang tải chuyến đi...'}</p>;
  const {
    booking: b,
    agreement: a,
    payments,
    deposit
  } = data;
  const deadline = (b.status === 'awaiting_payment' ? b.payment_deadline_at : null) || b.hold_expires_at;
  const seconds = deadline ? Math.max(0, Math.ceil((new Date(deadline) - now) / 1000)) : null;
  const platformSigning = Boolean(a?.contract_document || a?.terms_snapshot?.signature_method === 'electronic_acceptance');
  const waiting = b.status === 'awaiting_payment' && (seconds === null || seconds > 0);
  return <div className="renter-booking renter-stack">
    <RentalJourney data={data} expired={seconds === 0 && ['pending', 'awaiting_payment'].includes(b.status)} />
    {showContract && a?._id && <SigningDialog item={{ id: a._id, type: 'rental' }} view="party"
      onClose={() => setShowContract(false)} onSigned={() => { load().catch((failure) => setError(failure.message)); onChanged?.(); }} />}
    {error && <p role="alert" className="renter-error">{error}</p>}{notice && <p role="status" className="renter-notice">{notice}</p>}
    <section className="renter-card"><div className="renter-row"><h2>{b.booking_code}</h2><strong>{statusName(b.status)}</strong></div><p>{data.vehicle?.brand} {data.vehicle?.model} · {data.vehicle?.license_plate}</p><p>{dateTime(b.start_at)} → {dateTime(b.end_at)}</p><p>Nhận / trả xe: {b.pickup_location?.branch}</p><p>Giá mỗi ngày: {vnd(b.pricing_snapshot?.daily_price)} · {b.pricing_snapshot?.charged_days} ngày</p><p className="renter-price">Tiền thuê: {vnd(b.rental_fee_amount)} · Cọc: {vnd(b.deposit_amount_snapshot)}</p>{['pending', 'awaiting_payment'].includes(b.status) && seconds !== null && <p role="timer">{b.status === 'pending' ? 'Thời gian giữ xe còn lại' : 'Thời gian thanh toán còn lại'}: {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</p>}
      {(waiting || (b.status === 'pending' && b.review_info?.required === false && seconds !== 0)) && a?.status !== 'signed' && !a?.signing_info?.renter_confirmed && <form className="renter-row" onSubmit={e => {
        e.preventDefault();
        action(() => postRenter(`/bookings/${b._id}/voucher`, {
          code
        }));
      }}><Field label="Mã giảm giá" value={code} onChange={e => setCode(e.target.value)} maxLength={50} /><button disabled={busy || !code || Boolean(b.discount_code)}>Áp dụng mã</button></form>}{b.discount_code && <p>Đã áp dụng {b.discount_code}: giảm {vnd(b.discount_amount)}</p>}
    </section>
    {platformSigning && <section className="renter-card">
      <h2>Hợp đồng thuê xe</h2>
      {!a.contract_document ? <p>{b.status === 'pending' ? 'Hợp đồng được lập sau khi Manager duyệt chuyến.' : 'Đang chờ XeDi lập nội dung hợp đồng.'}</p> : <>
        <p>Khách thuê {a.signing_info?.renter_confirmed ? 'đã ký' : 'chưa ký'} · XeDi {a.signing_info?.platform_signer_user_id ? 'đã ký' : 'chưa ký'}</p>
        <button type="button" onClick={() => setShowContract(true)}>Xem hợp đồng thuê</button>
      </>}
    </section>}
    {!platformSigning && a && <section className="renter-card"><h2>Hợp đồng {a.contract_number}</h2><p>Trạng thái: {statusName(a.status)}</p><div className="renter-contract" tabIndex={0} aria-label="Điều khoản hợp đồng" onScroll={e => {
        if (e.currentTarget.scrollTop + e.currentTarget.clientHeight >= e.currentTarget.scrollHeight - 8) setRead(true);
      }}>
      <h3>Hợp đồng thuê xe tự lái</h3><p>Khách thuê: {a.renter_details_snapshot?.full_name || 'Theo hồ sơ cá nhân'}</p><p>Hợp đồng ủy quyền: {a.lender_details_snapshot?.authority_agreement_number}</p><p>Nhận xe: {dateTime(a.terms_snapshot?.start_at)}</p><p>Trả xe: {dateTime(a.terms_snapshot?.end_at)}</p><p>Tiền thuê: {vnd(a.terms_snapshot?.rental_fee_amount)}. Tiền cọc: {vnd(a.terms_snapshot?.deposit_amount)}.</p><p>Giới hạn: {a.terms_snapshot?.mileage_policy?.included_km_per_day ?? 'Theo hồ sơ xe'} km/ngày. Phụ trội: {vnd(a.terms_snapshot?.mileage_policy?.extra_km_fee)}/km.</p><p>Trả muộn: {vnd(a.terms_snapshot?.rental_policy?.late_fee_per_hour)}/giờ.</p><p>Hủy miễn phí trước: {a.terms_snapshot?.cancellation?.config?.free_cancel_before_hours ?? 'Chưa quy định'} giờ (chính sách phiên bản {a.terms_snapshot?.cancellation?.version ?? 'chưa có'}).</p><p>Trường hợp chính sách chưa quy định mức hoàn sẽ được vận hành đối soát. Tiền cọc chỉ được khấu trừ khi có căn cứ đã xác minh và phê duyệt.</p><p>Thời hạn hoàn cọc sau khi đủ điều kiện: {a.terms_snapshot?.deposit_refund?.config?.refund_within_business_days ?? 'Theo đối soát'} ngày làm việc.</p><p>Khách thuê có trách nhiệm cung cấp giấy tờ hợp lệ, đối chiếu tình trạng xe lúc nhận/trả và thông báo sự cố trong chuyến. Việc bàn giao được nhân viên gara ghi nhận bằng biên bản.</p><p>Khách thuê xác nhận thông tin về xe, thời gian, tiền thuê, tiền cọc và chính sách được lưu cùng hợp đồng này.</p><p>— Hết điều khoản —</p>
    </div>{waiting && a.status !== 'signed' && <><label className="renter-check"><input type="checkbox" checked={agree} disabled={!read} onChange={e => setAgree(e.target.checked)} />Tôi đã đọc đến cuối và đồng ý hợp đồng.</label><Otp target={{
          purpose: 'sign',
          booking_id: b._id
        }} onChange={setOtp} /><button disabled={busy || !agree || !otp.otp} onClick={() => action(() => postRenter(`/bookings/${b._id}/sign`, {
          ...otp,
          agreed: agree,
          read_to_end: read
        }))}>Ký hợp đồng bằng OTP</button></>}</section>}
    {waiting && (!platformSigning || a?.status === 'signed') && <section className="renter-card"><h2>Thanh toán và tiền cọc</h2>{config?.services.payment === 'demo' ? <p className="renter-notice">Thanh toán mô phỏng. Không thu hoặc giữ tiền thật.</p> : <p className="renter-notice">Chưa cấu hình cổng thanh toán; không thể xác nhận đã thanh toán.</p>}<Field label="Phương thức thanh toán"><select value={method} onChange={e => setMethod(e.target.value)}><option value="VNPAY_QR">VNPAY QR</option><option value="DOMESTIC_ATM">ATM nội địa</option><option value="INTERNATIONAL_CARD">Thẻ quốc tế</option><option value="MOMO_WALLET">Ví MoMo</option></select></Field><label className="renter-check"><input type="checkbox" checked={depositAgree} onChange={e => setDepositAgree(e.target.checked)} />Tôi đồng ý điều kiện giữ tiền cọc {vnd(b.deposit_amount_snapshot)}.</label><button disabled={busy || a?.status !== 'signed' || !depositAgree || config?.services.payment !== 'demo'} onClick={() => action(async () => {
        await postRenter(`/bookings/${b._id}/pay`, {
          payment_method: method,
          agree_deposit: depositAgree
        });
        setNotice('Đã hoàn tất thanh toán mô phỏng.');
      })}>Thanh toán mô phỏng {vnd(b.rental_fee_amount + b.deposit_amount_snapshot)}</button></section>}
    <section className="renter-card"><h2>Lịch sử thanh toán</h2>{payments.length === 0 ? <p>Chưa có giao dịch.</p> : <div className="renter-table-wrap"><table className="renter-table"><thead><tr><th>Loại</th><th>Số tiền</th><th>Trạng thái</th><th>Thời gian</th></tr></thead><tbody>{payments.map(t => <tr key={t._id}><td>{t.transaction_type === 'rental_payment' ? 'Tiền thuê' : t.transaction_type === 'deposit_collection' ? 'Tiền cọc' : t.transaction_type} {t.provider === 'DEMO_ONLY' ? '(mô phỏng)' : ''}</td><td>{vnd(t.amount)}</td><td>{statusName(t.status)}</td><td>{dateTime(t.paid_at || t.created_at)}</td></tr>)}</tbody></table></div>}<h3>Tiền cọc</h3><p>{statusName(deposit?.status)} · Đã thu: {vnd(deposit?.collected_amount)} · Đã hoàn: {vnd(deposit?.refunded_amount)} · Khấu trừ: {vnd(deposit?.deducted_amount)}</p>{b.cancellation_info && <p>Yêu cầu hoàn tiền: {b.cancellation_info.refund_status === 'requested' ? 'Đã ghi nhận, chờ xử lý' : 'Chờ vận hành đối soát'}. Chưa xác nhận hoàn tiền về tài khoản.</p>}</section>
    {b.status === 'confirmed' && !b.actual_start_at && <section className="renter-card"><h2>Hủy chuyến</h2><button disabled={busy} onClick={() => action(async () => {
        setCancel((await getRenter(`/bookings/${b._id}/cancellation`)).data);
      })}>Xem chính sách và số tiền hoàn</button>{cancel && <form onSubmit={e => {
        e.preventDefault();
        action(async () => {
          await postRenter(`/bookings/${b._id}/cancel`, {
            reason,
            note,
            agreed: cancelAgree
          });
          setNotice('Đã hủy chuyến và ghi nhận yêu cầu đối soát.');
        });
      }}><p>Chính sách phiên bản {cancel.policy_version}. {cancel.refund_amount !== null ? `Tiền thuê đủ điều kiện yêu cầu hoàn: ${vnd(cancel.refund_amount)}.` : 'Chưa quy định mức hoàn trường hợp này; cần vận hành xem xét.'}</p><Field label="Lý do hủy"><select value={reason} onChange={e => setReason(e.target.value)}>{Object.entries(reasons).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></Field><Field label="Ghi chú"><textarea value={note} required={reason === 'OTHER'} minLength={reason === 'OTHER' ? 10 : 0} maxLength={500} onChange={e => setNote(e.target.value)} /></Field><label className="renter-check"><input type="checkbox" checked={cancelAgree} onChange={e => setCancelAgree(e.target.checked)} required />Tôi xác nhận chính sách hoàn tiền ở trên.</label><button disabled={busy || !cancelAgree}>Xác nhận hủy chuyến</button></form>}</section>}
    {b.status === 'ongoing' && <section className="renter-card"><h2>Báo cáo sự cố</h2><button onClick={() => setReport(!report)}>Mở báo cáo sự cố</button>{report && <form onSubmit={e => {
        e.preventDefault();
        action(async () => {
          await postRenter('/incidents', {
            ...incident,
            booking_id: b._id,
            latitude: Number(incident.latitude),
            longitude: Number(incident.longitude),
            odometer_km: Number(incident.odometer_km)
          });
          setReport(false);
          setNotice('Đã gửi báo cáo sự cố tới bộ phận hỗ trợ.');
        });
      }}><Field label="Phân loại"><select value={incident.case_type} onChange={e => setIncident({
            ...incident,
            case_type: e.target.value
          })}>{[['TRAFFIC_ACCIDENT', 'Tai nạn giao thông'], ['MECHANICAL_BREAKDOWN', 'Hỏng hóc'], ['TIRE_PUNCTURE', 'Thủng lốp'], ['TRAFFIC_CITATION', 'Vi phạm giao thông']].map(([k, v]) => <option value={k} key={k}>{v}</option>)}</select></Field><button type="button" onClick={() => {
          if (!navigator.geolocation) {
            setError('Thiết bị không hỗ trợ định vị.');
            return;
          }
          navigator.geolocation.getCurrentPosition(pos => setIncident(prev => ({
            ...prev,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          })), () => setError('Không lấy được GPS. Bạn có thể nhập tọa độ thực tế.'), {
            timeout: 10000
          });
        }}>Lấy vị trí GPS</button><div className="renter-grid">{[['latitude', 'Vĩ độ'], ['longitude', 'Kinh độ'], ['odometer_km', 'ODO hiện tại (km)']].map(([name, label]) => <Field key={name} label={label} required type="number" step={name === 'odometer_km' ? '1' : 'any'} value={incident[name] ?? ''} onChange={e => setIncident({
            ...incident,
            [name]: e.target.value
          })} />)}</div><p>ODO lúc nhận xe: {data.pickup_odometer_km ?? 'Chưa có'} km.</p><Field label="Mô tả (20–1000 ký tự)"><textarea required minLength={20} maxLength={1000} onChange={e => setIncident({
            ...incident,
            description: e.target.value
          })} /></Field><Upload label="2–10 tệp, ít nhất 2 ảnh toàn cảnh và cận cảnh · tối đa 20 MB/tệp" purpose="incident" multiple onChange={evidence => setIncident(prev => ({
          ...prev,
          evidence
        }))} /><button disabled={busy || incident.evidence.length < 2}>Gửi báo cáo</button></form>}</section>}
  </div>;
}
