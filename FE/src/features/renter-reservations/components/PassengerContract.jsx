import { useEffect, useRef, useState } from "react";
import { operationAction } from "../../operations/api/operationsApi";
import { acceptReservationQuote } from "../api/reservationsApi";
import { errorMessage } from "../reservationFormat";
import "./passengerContract.css";
import ContractDocument from "./PassengerContractPaper";
export { ContractDocument };
export default function PassengerContract({ booking, contact, onSigned }) {
  const dialog = useRef(null);
  const [preview, setPreview] = useState(null),
    [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!preview) return;
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector("button")?.focus();
    const handleKey = (event) => {
      if (event.key !== "Tab") return;
      const controls = [
        ...dialog.current.querySelectorAll(
          "button:not(:disabled), input:not(:disabled), [tabindex='0']",
        ),
      ];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const element = dialog.current;
    element.addEventListener("keydown", handleKey);
    return () => {
      element.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [preview]);
  const [values, setValues] = useState({
    name: contact?.full_name || "",
    address: "",
    identity: "",
    phone: contact?.phone || "",
    luggageKg: 0,
  });
  const edit = (key, value) => {
    setValues((old) => ({ ...old, [key]: value }));
    setPreview(null);
    setAccepted(false);
  };
  return (
    <section>
      <h3>Thông tin lập và ký hợp đồng</h3>
      {!booking.transport_contract && (
        <p>
          Đề xuất cũ chưa có hợp đồng. Vui lòng yêu cầu Operator gửi lại báo giá
          kèm hợp đồng.
        </p>
      )}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            const result = await operationAction(
              `/renter/bookings/${booking.booking_id}/contract-preview`,
              {
                quoteId: booking.quote_offer.id,
                renter: { ...values, luggageKg: Number(values.luggageKg) },
              },
            );
            setPreview(result);
          } catch (failure) {
            setError(errorMessage(failure, "Chưa tạo được bản xem trước"));
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          {Object.entries({
            name: "Họ tên / Tên bên thuê",
            address: "Địa chỉ bên thuê",
            identity: "CCCD / ĐKKD",
            phone: "Số điện thoại",
            luggageKg: "Khối lượng hành lý (kg)",
          }).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                required
                maxLength={255}
                type={key === "luggageKg" ? "number" : "text"}
                min={0}
                value={values[key]}
                onChange={(event) => edit(key, event.target.value)}
              />
            </label>
          ))}
          <button className="rv-button" disabled={!booking.transport_contract}>
            Xem hợp đồng đã điền
          </button>
        </fieldset>
      </form>
      {preview && (
        <div className="passenger-signing-backdrop">
          <div
            ref={dialog}
            className="passenger-signing"
            role="dialog"
            aria-modal="true"
            aria-label="Rà soát và ký hợp đồng"
          >
            <header className="passenger-signing-header">
              <div>
                <span>HỢP ĐỒNG VẬN CHUYỂN</span>
                <h2>Rà soát và ký xác nhận</h2>
              </div>
              <button
                type="button"
                className="rv-button"
                disabled={busy}
                onClick={() => {
                  setPreview(null);
                  setAccepted(false);
                }}
              >
                Đóng và sửa thông tin
              </button>
            </header>
            <div
              className="passenger-paper-scroll"
              tabIndex={0}
              aria-label="Nội dung hợp đồng có thể cuộn"
            >
              <ContractDocument document={preview.document} />
            </div>
            <footer className="passenger-signing-footer">
              <label className="rv-check">
                <input
                  type="checkbox"
                  checked={accepted}
                  disabled={busy}
                  onChange={(event) => setAccepted(event.target.checked)}
                />
                Tôi đã đọc toàn bộ nội dung, xác nhận thông tin chính xác và
                đồng ý ký hợp đồng này bằng ô xác nhận.
              </label>
              {error && (
                <p className="rv-error" role="alert">
                  {error}
                </p>
              )}
              <p>
                Ký xong hợp đồng ở trạng thái chờ thanh toán; chưa kích hoạt.
              </p>
              <button
                className="rv-button rv-primary"
                disabled={!accepted || busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await acceptReservationQuote(
                      booking.booking_id,
                      booking.quote_offer.id,
                      {
                        renter: {
                          ...values,
                          luggageKg: Number(values.luggageKg),
                        },
                        contractAccepted: true,
                        documentHash: preview.hash,
                      },
                    );
                    onSigned();
                  } catch (failure) {
                    setError(errorMessage(failure, "Chưa ký được hợp đồng"));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Đang xác nhận…" : "Xác nhận ký và tiếp tục thanh toán"}
              </button>
            </footer>
          </div>
        </div>
      )}
      {!preview && error && (
        <p className="rv-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
