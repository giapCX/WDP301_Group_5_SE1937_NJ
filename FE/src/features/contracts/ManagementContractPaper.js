import { useRef } from 'react';
import './managementContractPaper.css';

function date(value) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
}

function Signature({ heading, name, signedAt, signed = Boolean(signedAt) }) {
  return <div className="management-paper-signature">
    <strong>{heading}</strong>
    <em>{signed ? 'Đã xác nhận điện tử' : 'Chờ xác nhận'}</em>
    {signed && <><b>{name || 'Đã xác nhận'}</b>{signedAt && <span>{date(signedAt)}</span>}</>}
  </div>;
}

function Facts({ values }) {
  return <dl className="management-paper-facts">{(values || []).map(({ label, value }) => <div key={label}>
    <dt>{label}</dt><dd>{value}</dd>
  </div>)}</dl>;
}

function printPaper(paper, number) {
  const frame = document.createElement('iframe');
  frame.title = 'Bản in hợp đồng';
  frame.setAttribute('aria-hidden', 'true');
  frame.className = 'management-print-frame';
  document.body.append(frame);
  const printDocument = frame.contentDocument;
  const printWindow = frame.contentWindow;
  printDocument.documentElement.lang = 'vi';
  printDocument.title = number;
  const printStyle = printDocument.createElement('style');
  printStyle.textContent = '@page { size: A4; margin: 18mm 20mm; } html, body { margin: 0; }';
  printDocument.head.append(printStyle);
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
  const ready = styles.map((style) => {
    const copy = printDocument.importNode(style, true);
    const loaded = copy.tagName === 'LINK'
      ? new Promise((resolve) => { copy.onload = resolve; copy.onerror = resolve; })
      : Promise.resolve();
    printDocument.head.append(copy);
    return loaded;
  });
  printDocument.body.className = 'management-print-document';
  printDocument.body.append(printDocument.importNode(paper, true));
  printWindow.addEventListener('afterprint', () => frame.remove(), { once: true });
  Promise.all(ready).then(() => {
    printWindow.focus();
    printWindow.print();
  });
}

export default function ManagementContractPaper({ agreement }) {
  const paper = useRef(null);
  const contract = agreement.document;
  const rental = agreement.type === 'rental';
  return <div className="management-contract-view">
    <div className="management-paper-toolbar">
      <button className="contract-button contract-button--secondary" type="button" onClick={() => printPaper(paper.current, agreement.number)}>In / lưu PDF</button>
    </div>
    <article ref={paper} className="management-contract-paper" lang="vi" aria-label={contract.title}>
      <header className="management-paper-heading">
        <p>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
        <p>Độc lập – Tự do – Hạnh phúc</p>
        <h2>{contract.title}</h2>
        <p>Số {agreement.number}</p>
      </header>
      {rental && <p>Căn cứ vào nhu cầu thuê xe và thỏa thuận của các bên.</p>}
      <p className="management-paper-intro">Lập ngày {date(contract.prepared_at)}, tại {contract.place}. Hai bên cùng thỏa thuận các nội dung dưới đây.</p>
      {(contract.parties || []).map((party) => <section key={party.heading} className="management-paper-party">
        <h3>{party.heading}</h3>
        <Facts values={party.facts} />
      </section>)}
      {contract.articles.map((article, index) => <section key={article.title} className="management-paper-article">
        <h3>Điều {index + 1}. {article.title}</h3>
        {index === 0 && <Facts values={contract.facts} />}
        {article.paragraphs.map((text) => <p key={text}>{text}</p>)}
      </section>)}
      {contract.appendices?.map((appendix) => <section key={appendix.title} className="management-paper-article">
        <h3>{appendix.title}</h3>
        <Facts values={appendix.facts} />
        {appendix.paragraphs.map((text) => <p key={text}>{text}</p>)}
      </section>)}
      <footer className="management-paper-signatures">
        {rental ? <>
          <Signature heading={contract.version === 'xedi-rental-representation-v1' ? 'XEDI KÝ ĐẠI DIỆN THEO ỦY QUYỀN CỦA BÊN CHO THUÊ' : 'BÊN CHO THUÊ · ĐẠI DIỆN XEDI'} name={agreement.platformName} signedAt={agreement.platformSignedAt} signed={agreement.platformSigned} />
          <Signature heading="BÊN THUÊ" name={agreement.partyName} signedAt={agreement.partySignedAt} signed={agreement.partySigned} />
        </> : <>
          <Signature heading="BÊN A · CHỦ XE" name={agreement.partyName} signedAt={agreement.partySignedAt} signed={agreement.partySigned} />
          <Signature heading="BÊN B · ĐẠI DIỆN NỀN TẢNG" name={agreement.platformName} signedAt={agreement.platformSignedAt} signed={agreement.platformSigned} />
        </>}
      </footer>
      <p className="management-paper-version">Phiên bản {contract.version} · Mã nội dung {contract.hash.slice(0, 12)}</p>
    </article>
  </div>;
}
