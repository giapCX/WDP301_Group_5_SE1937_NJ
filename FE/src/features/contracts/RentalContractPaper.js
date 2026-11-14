import { useRef } from 'react';
import { Facts, Signature, printPaper } from './ManagementContractPaper';

export default function RentalContractPaper({ agreement }) {
  const paper = useRef(null), contract = agreement.document;
  return <div className="management-contract-view">
    <div className="management-paper-toolbar"><button className="contract-button contract-button--secondary" type="button" onClick={() => printPaper(paper.current, agreement.number)}>In / lưu PDF</button></div>
    <article ref={paper} className="management-contract-paper" lang="vi" aria-label="Bản hợp đồng thuê xe">
      <header className="management-paper-heading">
        <p>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p><p>Độc lập – Tự do – Hạnh phúc</p>
        <h2>{contract.title}</h2><p>Số {agreement.number}</p>
      </header>
      <p className="management-paper-intro">Lập ngày {new Date(contract.prepared_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}. Nội dung thỏa thuận thuê xe giữa khách thuê và nền tảng XeDi theo hồ sơ dưới đây.</p>
      <section className="management-paper-party"><h3>Thông tin các bên, phương tiện và chuyến thuê</h3><Facts values={contract.facts} /></section>
      <section className="management-paper-article"><h3>Điều khoản thuê xe</h3>{(contract.clauses || []).map((clause, index) => <p key={index}><span>{index + 1}. </span><span>{clause}</span></p>)}</section>
      <footer className="management-paper-signatures">
        <Signature heading="KHÁCH THUÊ" name={agreement.partyName} signedAt={agreement.partySignedAt} />
        <Signature heading="ĐẠI DIỆN NỀN TẢNG XEDI" name={agreement.platformName} signedAt={agreement.platformSignedAt} />
      </footer>
      <p className="management-paper-version">Phiên bản {contract.version} · Mã nội dung {contract.hash?.slice(0, 12)}</p>
      <p className="management-paper-version">Xác nhận điện tử theo tài khoản đăng nhập; chưa tích hợp chữ ký số có chứng thực. Ký hợp đồng chưa xác nhận đã thanh toán tiền thuê hoặc tiền cọc.</p>
    </article>
  </div>;
}
