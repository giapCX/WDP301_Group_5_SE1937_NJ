import Icon from '../ui/Icon';
export default function Footer({ onInfo }) {
  const info = (title) =>
    onInfo(
      title,
      'Nội dung này đang được hoàn thiện cho phiên bản chính thức của XeDi.',
    );
  return (
    <footer className="site-footer" id="about">
      <div className="footer-inner">
        <div className="footer-top">
          <a className="brand" href="#cars">
            <Icon name="car" size={25} />
            XeDi
          </a>
          <p>
            Nền tảng chia sẻ và cho thuê xe tự lái kết nối chủ xe và khách thuê
            thông qua hợp đồng điện tử thông minh và bảo hiểm toàn diện MIC.
          </p>
        </div>
        <div className="footer-links">
          {[
            'Quy chế hoạt động',
            'Chính sách bảo mật',
            'Giải quyết tranh chấp',
            'Bảo hiểm đối tác MIC',
          ].map((title) => (
            <button key={title} onClick={() => info(title)}>
              {title}
            </button>
          ))}
          <button
            id="rental-guide"
            onClick={() =>
              onInfo(
                'Hướng dẫn thuê xe',
                '1. Chọn thời gian và tìm xe phù hợp.\n2. Xem thông tin xe, giá thuê và tiện nghi.\n3. Tính năng gửi yêu cầu đặt xe sẽ có trong phiên bản tiếp theo.',
              )
            }
          >
            Hướng dẫn thuê xe
          </button>
          <button onClick={() => info('Cẩm nang chủ xe')}>
            Cẩm nang chủ xe
          </button>
          <span>Hotline 24/7: 1900 6868</span>
          <button onClick={() => info('Liên hệ hợp tác')}>
            Liên hệ hợp tác
          </button>
        </div>
        <div className="footer-bottom">
          <span>
            © 2025 XeDi Vietnam Inc. Nền tảng chia sẻ và cho thuê xe tự lái hàng
            đầu Việt Nam. Bảo lưu mọi quyền.
          </span>
          <span className="system-status">
            <i />
            Giao diện xem trước
          </span>
        </div>
      </div>
    </footer>
  );
}
