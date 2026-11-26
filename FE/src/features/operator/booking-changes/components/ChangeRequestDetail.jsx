import { ActionForm } from '../../../operations/components/OperationShared';
import { useEffect, useRef, useState } from 'react';
import useChangeRequestDetail from '../hooks/useChangeRequestDetail';
import ChangeStatus from './ChangeStatus';
import ItineraryComparison from './ItineraryComparison';
import Icon from '../../../shared/booking/BookingIcon';
import { bookingCode, dateTime, money } from '../../../shared/booking/bookingConstants';
import { requestCode } from '../changeConstants';

export default function ChangeRequestDetail({ id, revision, onUpdated }) {
  const detail = useChangeRequestDetail(id, revision, onUpdated);
  const [mode, setMode] = useState('');
  const [reason, setReason] = useState('');
  const section = useRef(null);
  const { request } = detail;
  useEffect(() => {
    section.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [id]);

  return (
    <section
      ref={section}
      className="change-detail"
      aria-labelledby="change-detail-title"
      aria-busy={detail.loading}
    >
      <div className="section-heading table-heading">
        <h2 id="change-detail-title">
          <Icon name="route" />
          Chi tiết {requestCode(id)}
        </h2>
        <button
          className="text-button"
          disabled={detail.saving}
          onClick={() => {
            setMode('');
            detail.reload();
          }}
        >
          <Icon name="refresh" size={15} />
          Tải lại
        </button>
      </div>
      {detail.error && (
        <div className="change-message dispatch-alert" role="alert">
          {detail.error}
          {detail.stale && (
            <p>Dữ liệu có thể đã thay đổi. Tải lại để xem trạng thái mới nhất.</p>
          )}
        </div>
      )}
      {detail.loading && (
        <div className="dispatch-empty" role="status">
          Đang tải lịch trình trước và sau thay đổi…
        </div>
      )}
      {request && !detail.loading && (
        <>
          <div className="change-detail-meta">
            <div>
              <span>BOOKING</span>
              <strong>{bookingCode(request.booking_id)}</strong>
            </div>
            <div>
              <span>NGƯỜI YÊU CẦU</span>
              <strong>
                {request.requester?.full_name || `Khách #${request.requested_by}`}
              </strong>
            </div>
            <div>
              <span>THỜI ĐIỂM GỬI</span>
              <strong>{dateTime(request.requested_at)}</strong>
            </div>
            <ChangeStatus status={request.request_status} />
          </div>
          <div className="change-reason-box">
            <Icon name="list" />
            <div>
              <strong>Lý do thay đổi</strong>
              <p>{request.reason}</p>
            </div>
          </div>
          <ItineraryComparison before={request.before} after={request.after} />
          <div className="change-price-summary">
            <div>
              <span>Chênh lệch giá đề xuất</span>
              <p>Chưa phải khoản tiền đã thu thêm hoặc hoàn trả.</p>
            </div>
            <strong
              className={
                request.price_difference > 0 ? 'change-increase' : 'change-decrease'
              }
            >
              {request.price_difference > 0 ? '+' : ''}
              {money(request.price_difference)}
            </strong>
          </div>
          {request.reviewed_at && (
            <div className="change-review-info">
              <Icon name="check" />
              <span>
                Được xử lý bởi{' '}
                <strong>
                  {request.reviewer?.full_name || `Nhân viên #${request.reviewed_by}`}
                </strong>{' '}
                · {dateTime(request.reviewed_at)}
              </span>
            </div>
          )}
          {request.rejection_reason && (
            <div className="change-message dispatch-alert">
              <strong>Lý do từ chối: </strong>
              {request.rejection_reason}
            </div>
          )}
          {request.request_status === 'pending' && <ActionForm title="Xem xét giá lịch trình mới" path={'/operator/booking-change-requests/' + request.change_request_id + '/price'} method="patch" transform={(fields) => ({ price: Number(fields.price) })} onDone={detail.reload} label="Gửi giá thay đổi cho Renter"><label>Giá chuyến mới (₫)<input type="number" name="price" min="0" step="1" required defaultValue={request.after.estimated_price}/></label></ActionForm>}
          {request.price_offer && <p>{request.price_offer.accepted_at ? 'Renter đã đồng ý giá thay đổi.' : 'Đang chờ Renter chấp nhận giá thay đổi.'}</p>}
          {request.request_status === 'pending' && (
            <div className="change-decisions">
              <p className="change-decision-hint">
                <Icon name="help" size={16} />
                Khi duyệt, hệ thống sẽ kiểm tra lại lịch và cập nhật booking cùng các điểm
                dừng.
              </p>
              {mode === 'reject' && (
                <div className="change-reject-form">
                  <label htmlFor="change-reason">
                    Lý do từ chối <span>*</span>
                  </label>
                  <textarea
                    id="change-reason"
                    value={reason}
                    disabled={detail.saving}
                    maxLength={2000}
                    rows={3}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Giải thích lý do không thể đáp ứng yêu cầu…"
                  />
                  <small>{reason.length}/2000 ký tự</small>
                </div>
              )}
              {mode === 'approve' && (
                <div className="change-confirm" role="status">
                  Bạn xác nhận áp dụng lịch đề xuất vào {bookingCode(request.booking_id)}?
                  Lịch cũ sẽ được thay thế sau khi kiểm tra thành công.
                </div>
              )}
              <div className="change-action-row">
                {mode ? (
                  <>
                    <button
                      className="dispatch-button subtle"
                      disabled={detail.saving}
                      onClick={() => setMode('')}
                    >
                      Quay lại
                    </button>
                    <button
                      className={`dispatch-button ${mode === 'approve' ? 'primary' : 'danger'}`}
                      disabled={
                        detail.saving ||
                        detail.stale ||
                        (mode === 'reject' && !reason.trim())
                      }
                      onClick={() => detail.decide(mode, reason)}
                    >
                      {detail.saving
                        ? 'Đang xử lý…'
                        : mode === 'approve'
                          ? 'Xác nhận duyệt thay đổi'
                          : 'Xác nhận từ chối'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="dispatch-button outline-danger"
                      disabled={detail.stale}
                      onClick={() => setMode('reject')}
                    >
                      Từ chối yêu cầu
                    </button>
                    <button
                      className="dispatch-button primary"
                      disabled={detail.stale}
                      onClick={() => setMode('approve')}
                    >
                      <Icon name="check" />
                      Duyệt thay đổi
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
