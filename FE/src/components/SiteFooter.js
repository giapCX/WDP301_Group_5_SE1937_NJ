import { Brand } from './SiteHeader';
import Icon from './Icon';

export default function SiteFooter({ onPolicy }) {
  return (
    <footer className="site-footer" id="lien-he">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Brand light />
            <p>
              XeDi kết nối chủ xe và khách thuê thông qua dịch vụ quản lý xe, hợp đồng rõ ràng và
              quy trình bàn giao tại gara.
            </p>
            <span className="footer-trust">
              <Icon name="shield" size={16} /> Minh bạch trong từng chuyến đi
            </span>
          </div>
          <div>
            <h3>Chính sách</h3>
            <button onClick={onPolicy}>Chính sách thuê và hoàn cọc</button>
            <a href="#an-tam">Quy trình xử lý sự cố</a>
            <a href="#chu-xe">Chính sách quản lý xe</a>
          </div>
          <div>
            <h3>Cẩm nang</h3>
            <a href="#huong-dan">Hướng dẫn thuê xe</a>
            <a href="#chu-xe">Dành cho chủ xe</a>
            <a href="#an-tam">Quy trình bàn giao xe</a>
          </div>
          <div>
            <h3>Đồng hành cùng bạn</h3>
            <a href="#cau-hoi">Câu hỏi thường gặp</a>
            <a href="#xe-noi-bat">Tìm chiếc xe phù hợp</a>
            <p>Hỗ trợ bởi đội ngũ vận hành và nhân viên gara của XeDi.</p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} XeDi. Nền tảng cho thuê xe tự lái.</span>
          <span>
            <span className="status-dot" /> Rõ chi phí · Đúng quy trình · An tâm di chuyển
          </span>
        </div>
      </div>
    </footer>
  );
}
