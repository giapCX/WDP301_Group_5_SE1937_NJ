import Icon from '../ui/Icon';
export default function Header({ onInfo }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <a href="#cars" className="brand" aria-label="XeDi - Trang chủ">
          <Icon name="car" size={25} />
          XeDi
        </a>
        <nav aria-label="Điều hướng chính">
          <a className="nav-active" href="#cars">
            Thuê xe
          </a>
          <button
            onClick={() =>
              onInfo(
                'Trở thành chủ xe',
                'Chương trình dành cho chủ xe sẽ được cập nhật khi hệ thống tiếp nhận xe được triển khai.',
              )
            }
          >
            Trở thành chủ xe
          </button>
          <a href="#rental-guide">Hướng dẫn</a>
          <a href="#about">Về chúng tôi</a>
        </nav>
        <div className="header-actions">
          <button
            className="outline-button owner-button"
            onClick={() =>
              onInfo(
                'Đăng xe cho thuê',
                'Tính năng đăng xe đang được phát triển. Đây là bản giao diện danh sách xe mẫu.',
              )
            }
          >
            Đăng xe cho thuê
          </button>
          <span className="language-icon">
            <Icon name="globe" />
          </span>
          <button
            className="account-button"
            onClick={() =>
              onInfo(
                'Đăng nhập',
                'Chức năng đăng nhập chưa được kết nối. Bạn vẫn có thể khám phá và lọc các xe trong bản xem trước.',
              )
            }
          >
            <Icon name="menu" size={16} />
            <Icon name="user" size={17} />
            <span>Đăng nhập</span>
          </button>
        </div>
      </div>
    </header>
  );
}
