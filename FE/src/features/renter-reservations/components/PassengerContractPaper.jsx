import { useRef } from "react";
import { money, formatTime } from "../reservationFormat";

// Use the same isolated print document as the former XeDi A4 contract view.
function printPaper(paper, number) {
  const frame = document.createElement("iframe");
  frame.title = "Bản in hợp đồng";
  frame.setAttribute("aria-hidden", "true");
  frame.className = "passenger-print-frame";
  document.body.append(frame);
  const printDocument = frame.contentDocument;
  const printWindow = frame.contentWindow;
  printDocument.documentElement.lang = "vi";
  printDocument.title = number;
  const pageStyle = printDocument.createElement("style");
  pageStyle.textContent =
    "@page { size: A4; margin: 18mm 20mm; } html, body { margin: 0; }";
  printDocument.head.append(pageStyle);
  const ready = [
    ...document.querySelectorAll('style, link[rel="stylesheet"]'),
  ].map((style) => {
    const copy = printDocument.importNode(style, true);
    const loaded =
      copy.tagName === "LINK"
        ? new Promise((resolve) => {
            copy.onload = resolve;
            copy.onerror = resolve;
          })
        : Promise.resolve();
    printDocument.head.append(copy);
    return loaded;
  });
  printDocument.body.className = "passenger-print-document";
  printDocument.body.append(printDocument.importNode(paper, true));
  printWindow.addEventListener("afterprint", () => frame.remove(), {
    once: true,
  });
  Promise.all(ready).then(async () => {
    await printDocument.fonts.ready;
    printWindow.focus();
    printWindow.print();
  });
}

function Facts({ values }) {
  return (
    <dl className="passenger-paper-facts">
      {values.map(([label, value]) => (
        <div key={label}>
          <dt>{label}:</dt>
          <dd>{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function clausesByArticle(clauses = []) {
  const articles = [];
  for (const line of clauses) {
    if (line.startsWith("ĐIỀU "))
      articles.push({ title: line, paragraphs: [] });
    else articles.at(-1)?.paragraphs.push(line);
  }
  return articles;
}

export default function PassengerContractPaper({ document: d, signature }) {
  const paper = useRef(null);
  return (
    <div className="passenger-contract-view">
      <div className="passenger-paper-toolbar">
        <span>Bản hợp đồng mô phỏng · Khổ A4</span>
        <button
          type="button"
          onClick={() => printPaper(paper.current, d.number)}
        >
          In / lưu PDF
        </button>
      </div>
      <article
        ref={paper}
        className="passenger-contract"
        lang="vi"
        aria-label="Hợp đồng vận chuyển hành khách khổ A4"
      >
        <header className="passenger-paper-heading">
          <p>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
          <p className="passenger-paper-motto">Độc lập – Tự do – Hạnh phúc</p>
          <h2>
            HỢP ĐỒNG VẬN CHUYỂN HÀNH KHÁCH
            <br />
            BẰNG XE Ô TÔ
          </h2>
          <p className="passenger-paper-number">Số: {d.number}</p>
        </header>
        <p className="passenger-paper-intro">
          Căn cứ nhu cầu sử dụng dịch vụ và thỏa thuận của các bên, chúng tôi
          gồm:
        </p>
        <section className="passenger-paper-party">
          <h3>BÊN VẬN TẢI (BÊN A)</h3>
          <Facts
            values={[
              ["Tên đơn vị", d.company.name],
              ["Địa chỉ", d.company.address],
              ["Mã số thuế", d.company.taxId],
              ["Người đại diện", d.company.representative],
              ["Chức vụ", d.company.title],
              ["Điện thoại", d.company.phone],
            ]}
          />
        </section>
        <section className="passenger-paper-party">
          <h3>BÊN THUÊ VẬN TẢI (BÊN B)</h3>
          <Facts
            values={[
              ["Họ tên / Tên bên thuê", d.renter.name],
              ["Địa chỉ", d.renter.address],
              ["Số CCCD / ĐKKD", d.renter.identity],
              ["Điện thoại", d.renter.phone],
            ]}
          />
        </section>
        <p>
          Hai bên thống nhất ký kết hợp đồng vận chuyển hành khách với các điều
          khoản sau đây:
        </p>
        <section className="passenger-paper-article">
          <h3>ĐIỀU 1. NỘI DUNG HỢP ĐỒNG</h3>
          <p>
            Bên A cung cấp cho Bên B 01 xe có tài xế, yêu cầu từ{" "}
            <strong>{d.requestedSeats} chỗ</strong>, phục vụ{" "}
            <strong>{d.passengers} hành khách</strong>; hành lý {d.luggageKg}{" "}
            kg; cự ly hành trình {d.distanceKm} km.
          </p>
          <Facts
            values={[
              ["Điểm đón khách", d.pickup],
              ["Thời gian khởi hành", formatTime(d.pickupTime)],
              ["Điểm đến", d.destination],
              ...(d.returnTime
                ? [
                    ["Điểm đón về", d.returnPickup],
                    ["Thời gian đón về", formatTime(d.returnTime)],
                  ]
                : []),
              ["Điểm trả khách cuối", d.dropoff],
              ["Thời gian kết thúc dự kiến", formatTime(d.endTime)],
            ]}
          />
          {d.stops?.length > 0 && (
            <>
              <p>
                <strong>Các điểm trong hành trình:</strong>
              </p>
              <ol>
                {d.stops.map((stop, index) => (
                  <li key={index}>
                    {stop.location}
                    {stop.arrival_at &&
                      ` · Đến: ${formatTime(stop.arrival_at)}`}
                    {stop.departure_at &&
                      ` · Rời đi: ${formatTime(stop.departure_at)}`}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
        <section className="passenger-paper-article">
          <h3>ĐIỀU 2. GIÁ TRỊ HỢP ĐỒNG</h3>
          <Facts
            values={[
              ["Tổng giá trị hợp đồng", money(d.total)],
              ["Tạm ứng / Đặt cọc", money(d.deposit)],
              ["Giá trị còn lại", money(d.balance)],
            ]}
          />
        </section>
        <section className="passenger-paper-article">
          <h3>ĐIỀU 3. THANH TOÁN</h3>
          <p>{d.paymentTerms}</p>
          <p>
            <strong>Cầu đường và đỗ xe:</strong> {d.tollsAndParking}
          </p>
          <p>
            <strong>Ăn nghỉ tài xế:</strong> {d.driverExpenses}
          </p>
        </section>
        {clausesByArticle(d.clauses).map((article) => (
          <section className="passenger-paper-article" key={article.title}>
            <h3>{article.title}</h3>
            {article.paragraphs.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </section>
        ))}
        <section className="passenger-paper-article">
          <h3>ĐIỀU 11. HIỆU LỰC HỢP ĐỒNG</h3>
          <p>{d.effectiveTerms}</p>
          <p>
            Thời gian phục vụ: {formatTime(d.pickupTime)} đến{" "}
            {formatTime(d.endTime)}. Bản xác nhận điện tử được lưu trong đơn đặt
            xe để hai bên xem lại.
          </p>
        </section>
        <footer className="passenger-paper-signatures">
          <div>
            <strong>ĐẠI DIỆN BÊN A</strong>
            <em>Người đại diện đơn vị vận tải</em>
            <b>{d.company.representative}</b>
          </div>
          <div>
            <strong>ĐẠI DIỆN BÊN B</strong>
            <em>
              {signature?.signedAt
                ? "Đã xác nhận điện tử bằng ô xác nhận"
                : "Xác nhận bằng ô đồng ý khi ký"}
            </em>
            <b>{d.renter.name}</b>
            {signature?.signedAt && (
              <span>{formatTime(signature.signedAt)}</span>
            )}
          </div>
        </footer>
        <p className="passenger-paper-footnote">
          BẢN MÔ PHỎNG · Mã hợp đồng: {d.number}
          {signature?.hash && ` · Mã nội dung: ${signature.hash.slice(0, 12)}`}
        </p>
      </article>
    </div>
  );
}
