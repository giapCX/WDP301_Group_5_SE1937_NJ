import React, { useState } from 'react';
import './Login.css';

const Login = () => {
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'register'
  const [userRole, setUserRole] = useState('renter'); // 'renter' | 'host'
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [formStatus, setFormStatus] = useState('');

  // Form states
  const [loginData, setLoginData] = useState({
    account: '',
    password: '',
    rememberMe: true,
  });

  const [registerData, setRegisterData] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  });

  const handleLoginChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLoginData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleRegisterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setRegisterData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setFormStatus('Đăng nhập hiện chưa khả dụng. Vui lòng thử lại sau.');
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    setFormStatus('Đăng ký hiện chưa khả dụng. Vui lòng thử lại sau.');
  };

  return (
    <main className="min-h-screen w-full flex flex-col lg:flex-row overflow-x-hidden bg-background text-on-background selection:bg-primary-container selection:text-on-primary">
      {/* LEFT COLUMN: Brand Storytelling & Atmospheric Scenic Banner (48% on large screens) */}
      <div className="relative w-full lg:w-[46%] xl:w-[48%] flex-shrink-0 min-h-[460px] lg:min-h-screen bg-inverse-surface flex flex-col justify-between p-6 sm:p-10 xl:p-14 overflow-hidden text-surface-bright">
        {/* Scenic Background Image */}
        <img
          alt="Chuyến đi khám phá cung đường ven biển Việt Nam cùng ô tô điện hiện đại XeDi"
          className="absolute inset-0 w-full h-full object-cover object-center z-0 scale-105 transition-transform duration-1000 ease-out hover:scale-100"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAvjaFpfAC5bI13Nt6zDkT0tGEDSiujaPtFENrwD54o8AbMKymcbeUBl8b4h3X99cJnA39ajnDrBF0ySkNtyIf6HmNXQChu_L7w-r1TosMjXtiYKdZ2suNYs25Tx1aBgQjOnfXti6hdGMBKSJh3HDxssHnQ3rC-sGduETryAKn3UoUKyyIJ7bqVYt9wxruqw2MjaULRWQIlpfmYcc79dT3ySeRgrdmPqVXQZPDhvPbEQyPgHVaeM_CSZA"
        />
        {/* Multilayered Ambient Gradient Overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface via-inverse-surface/65 to-inverse-surface/40 z-10 backdrop-blur-[1px]"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-inverse-surface/80 via-transparent to-transparent z-10"></div>

        {/* Top Section: Brand Bar & Back Navigation */}
        <div className="relative z-20 flex items-center justify-between w-full">
          <div className="flex items-center space-x-3">
            <a className="flex items-center space-x-2.5 group focus:outline-none" href="#trang-chu">
              <span className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <span
                  className="material-symbols-outlined"
                  data-icon="electric_car"
                  style={{ fontSize: '24px' }}
                >
                  electric_car
                </span>
              </span>
              <span className="text-headline-md font-headline-md font-extrabold text-surface-bright tracking-tight">
                XeDi
              </span>
            </a>
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full bg-surface-container-lowest/15 backdrop-blur-md border border-surface-container-lowest/20 text-label-tag font-label-tag text-surface-bright">
              P2P Car Rental
            </span>
          </div>
          <a
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-surface-container-lowest/20 hover:bg-surface-container-lowest/30 backdrop-blur-md border border-surface-container-lowest/25 text-body-sm font-body-sm text-surface-bright transition-all active:scale-95"
            href="#trang-chu"
          >
            <span className="material-symbols-outlined" data-icon="arrow_back">
              arrow_back
            </span>
            <span>Về trang chủ</span>
          </a>
        </div>

        {/* Middle Section: Hero Value Proposition */}
        <div className="relative z-20 my-auto py-10 lg:py-16 max-w-xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary-container/90 text-on-primary text-label-tag font-label-tag uppercase tracking-wider mb-5 shadow-sm">
            <span
              className="material-symbols-outlined"
              data-icon="verified_user"
              style={{ fontSize: '14px' }}
            >
              verified_user
            </span>
            <span>Nền tảng thuê xe tự lái P2P hàng đầu</span>
          </div>
          <h1 className="text-display-hero-mobile lg:text-display-hero font-display-hero text-surface-bright tracking-tight leading-tight mb-4">
            Thuê xe dễ dàng — Trải nghiệm mọi cung đường.
          </h1>
          <p className="text-body-lg font-body-lg text-outline-variant/90 leading-relaxed max-w-lg mb-8">
            Khám phá hơn{' '}
            <strong className="text-surface-bright font-semibold">5.000+ xe đời mới</strong> sẵn
            sàng phục vụ tại TP.HCM, Hà Nội, Đà Nẵng và toàn quốc với gói bảo hiểm vật chất đối tác
            MIC toàn diện.
          </p>

          {/* Feature bullet points for Host & Renter Confidence */}
          <div className="grid grid-cols-2 gap-3.5 text-body-sm font-body-sm text-surface-bright/90">
            <div className="flex items-center space-x-2 bg-surface-container-lowest/10 backdrop-blur-md rounded-xl p-2.5 border border-surface-container-lowest/10">
              <span
                className="material-symbols-outlined text-tertiary-fixed"
                data-icon="lock_open_right"
              >
                lock_open_right
              </span>
              <span>Không giữ giấy tờ tuỳ thân gốc</span>
            </div>
            <div className="flex items-center space-x-2 bg-surface-container-lowest/10 backdrop-blur-md rounded-xl p-2.5 border border-surface-container-lowest/10">
              <span className="material-symbols-outlined text-tertiary-fixed" data-icon="security">
                security
              </span>
              <span>Bảo hiểm bảo trợ MIC tới 2 tỷ</span>
            </div>
            <div className="flex items-center space-x-2 bg-surface-container-lowest/10 backdrop-blur-md rounded-xl p-2.5 border border-surface-container-lowest/10">
              <span className="material-symbols-outlined text-tertiary-fixed" data-icon="bolt">
                bolt
              </span>
              <span>Đặt xe duyệt ngay chỉ 3 phút</span>
            </div>
            <div className="flex items-center space-x-2 bg-surface-container-lowest/10 backdrop-blur-md rounded-xl p-2.5 border border-surface-container-lowest/10">
              <span
                className="material-symbols-outlined text-tertiary-fixed"
                data-icon="ev_station"
              >
                ev_station
              </span>
              <span>Miễn phí sạc xe điện VinFast</span>
            </div>
          </div>
        </div>

        {/* Bottom Floating Social Proof Card */}
        <div className="relative z-20 w-full">
          <div className="bg-surface-container-lowest/15 backdrop-blur-xl border border-surface-container-lowest/25 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xl">
            <div className="flex items-center space-x-3.5">
              <div className="flex -space-x-2.5 overflow-hidden">
                <span className="inline-block h-9 w-9 rounded-full ring-2 ring-surface-container-lowest bg-surface-variant flex items-center justify-center text-primary font-bold text-body-sm">
                  VN
                </span>
                <span className="inline-block h-9 w-9 rounded-full ring-2 ring-surface-container-lowest bg-tertiary text-on-tertiary flex items-center justify-center text-body-sm font-bold">
                  KH
                </span>
                <span className="inline-block h-9 w-9 rounded-full ring-2 ring-surface-container-lowest bg-secondary text-on-secondary flex items-center justify-center text-body-sm font-bold">
                  TM
                </span>
                <div className="h-9 w-9 rounded-full ring-2 ring-surface-container-lowest bg-primary-container text-on-primary flex items-center justify-center text-body-sm font-bold">
                  +12k
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-1 text-tertiary-fixed">
                  {[...Array(5)].map((_, i) => (
                    <span
                      key={i}
                      className="material-symbols-outlined text-sm"
                      data-icon="star"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      star
                    </span>
                  ))}
                  <span className="text-surface-bright font-bold text-body-sm ml-1">4.96/5</span>
                </div>
                <p className="text-body-sm font-body-sm text-outline-variant">
                  120.000+ chuyến đi an toàn &amp; 98.6% khách hàng hài lòng
                </p>
              </div>
            </div>
            <div className="hidden xl:flex items-center text-tertiary-fixed text-label-tag font-label-tag bg-tertiary-container/50 px-3 py-1.5 rounded-full">
              <span className="material-symbols-outlined text-sm mr-1" data-icon="verified">
                verified
              </span>
              Đối tác xác thực
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Authentication Canvas & Interactive Form Flow (54% - 52%) */}
      <div className="w-full lg:w-[54%] xl:w-[52%] flex flex-col justify-between p-6 sm:p-10 xl:p-16 bg-surface-container-lowest custom-scroll overflow-y-auto">
        {/* Top Segmented Auth Switcher & Support Info */}
        <div className="flex items-center justify-between pb-6 border-b border-outline-variant/30">
          {/* Modern Pill Segmented Control */}
          <div className="bg-surface-container-low p-1.5 rounded-xl flex items-center space-x-1 border border-outline-variant/30">
            <button
              className={`px-5 py-2 rounded-lg text-body-md font-headline-sm transition-all duration-200 ${
                authTab === 'login'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-secondary hover:text-on-surface'
              }`}
              onClick={() => {
                setAuthTab('login');
                setFormStatus('');
              }}
              type="button"
            >
              Đăng nhập
            </button>
            <button
              className={`px-5 py-2 rounded-lg text-body-md font-headline-sm transition-all duration-200 ${
                authTab === 'register'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-secondary hover:text-on-surface'
              }`}
              onClick={() => {
                setAuthTab('register');
                setFormStatus('');
              }}
              type="button"
            >
              Đăng ký
            </button>
          </div>
          <div className="hidden sm:flex items-center space-x-2 text-secondary text-body-sm font-body-sm">
            <span className="material-symbols-outlined text-base" data-icon="headset_mic">
              headset_mic
            </span>
            <span>
              Hotline: <strong className="text-on-surface font-semibold">1900 6868</strong>
            </span>
          </div>
        </div>

        {/* Main Form Container */}
        <div className="my-auto py-8 max-w-lg w-full mx-auto">
          {formStatus && (
            <p
              role="status"
              className="mb-4 rounded-xl bg-surface-container-low p-4 text-body-sm text-primary"
            >
              {formStatus}
            </p>
          )}
          {/* ======================= 1. LOGIN FORM PANEL ======================= */}
          {authTab === 'login' && (
            <div className="transition-all duration-300">
              <div className="mb-8">
                <h2 className="text-headline-xl font-headline-xl text-on-surface tracking-tight mb-2">
                  Chào mừng bạn trở lại!
                </h2>
                <p className="text-body-md font-body-md text-secondary">
                  Đăng nhập để tiếp tục quản lý hành trình, lịch đặt xe và ưu đãi thành viên XeDi.
                </p>
              </div>

              <form className="space-y-4" onSubmit={handleLoginSubmit}>
                {/* Email / Phone Input */}
                <div>
                  <label
                    className="block text-body-sm font-body-sm font-medium text-on-surface-variant mb-1.5"
                    htmlFor="login-account"
                  >
                    Số điện thoại hoặc Email
                  </label>
                  <div className="relative rounded-xl border border-outline-variant/60 focus-within:border-primary-container focus-within:ring-2 focus-within:ring-primary-container/20 transition-all bg-surface-container-lowest">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-secondary">
                      <span className="material-symbols-outlined" data-icon="account_circle">
                        account_circle
                      </span>
                    </div>
                    <input
                      className="block w-full pl-10 pr-4 py-3 text-body-md font-body-md text-on-surface placeholder-outline/60 bg-transparent rounded-xl border-0 focus:ring-0 outline-none"
                      id="login-account"
                      name="account"
                      value={loginData.account}
                      onChange={handleLoginChange}
                      placeholder="Ví dụ: 0912 345 678 hoặc ban@email.com"
                      type="text"
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      className="block text-body-sm font-body-sm font-medium text-on-surface-variant"
                      htmlFor="login-password"
                    >
                      Mật khẩu
                    </label>
                    <a
                      className="text-body-sm font-body-sm font-medium text-primary-container hover:underline"
                      href="#/login/forgot-password"
                    >
                      Quên mật khẩu?
                    </a>
                  </div>
                  <div className="relative rounded-xl border border-outline-variant/60 focus-within:border-primary-container focus-within:ring-2 focus-within:ring-primary-container/20 transition-all bg-surface-container-lowest">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-secondary">
                      <span className="material-symbols-outlined" data-icon="lock">
                        lock
                      </span>
                    </div>
                    <input
                      className="block w-full pl-10 pr-11 py-3 text-body-md font-body-md text-on-surface placeholder-outline/60 bg-transparent rounded-xl border-0 focus:ring-0 outline-none"
                      id="login-password"
                      name="password"
                      value={loginData.password}
                      onChange={handleLoginChange}
                      placeholder="Nhập mật khẩu của bạn"
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                    />
                    <button
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-secondary hover:text-on-surface focus:outline-none"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      type="button"
                      aria-label={showLoginPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      <span className="material-symbols-outlined" data-icon="visibility">
                        {showLoginPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Remember me checkbox */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      checked={loginData.rememberMe}
                      onChange={handleLoginChange}
                      name="rememberMe"
                      className="h-4 w-4 rounded text-primary-container border-outline-variant focus:ring-primary-container"
                      type="checkbox"
                    />
                    <span className="text-body-sm font-body-sm text-secondary">
                      Ghi nhớ đăng nhập trên thiết bị này
                    </span>
                  </label>
                </div>

                {/* Primary Action Button */}
                <button
                  className="w-full mt-2 py-3.5 px-4 bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-body-lg rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] flex items-center justify-center space-x-2"
                  type="submit"
                >
                  <span>Đăng nhập</span>
                  <span className="material-symbols-outlined" data-icon="arrow_forward">
                    arrow_forward
                  </span>
                </button>
              </form>
            </div>
          )}

          {/* ======================= 2. REGISTER FORM PANEL ======================= */}
          {authTab === 'register' && (
            <div className="transition-all duration-300">
              <div className="mb-6">
                <h2 className="text-headline-xl font-headline-xl text-on-surface tracking-tight mb-2">
                  Đăng ký tài khoản XeDi
                </h2>
                <p className="text-body-md font-body-md text-secondary">
                  Gia nhập cộng đồng xe tự lái văn minh và chủ động hàng đầu Việt Nam.
                </p>
              </div>

              {/* User Intent / Role Selector */}
              <div className="mb-5">
                <label className="block text-body-sm font-body-sm font-medium text-on-surface-variant mb-2">
                  Mục đích chính của bạn:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Option 1: Renter */}
                  <label
                    onClick={() => setUserRole('renter')}
                    className={`relative flex flex-col p-3.5 rounded-xl cursor-pointer transition-all ${
                      userRole === 'renter'
                        ? 'border-2 border-primary-container bg-surface-container-low/50'
                        : 'border border-outline-variant/60 bg-surface-container-lowest hover:border-outline-variant'
                    }`}
                  >
                    <input
                      checked={userRole === 'renter'}
                      onChange={() => setUserRole('renter')}
                      className="sr-only"
                      name="user_role"
                      type="radio"
                      value="renter"
                    />
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`material-symbols-outlined ${
                          userRole === 'renter' ? 'text-primary-container' : 'text-secondary'
                        }`}
                        data-icon="commute"
                      >
                        commute
                      </span>
                      {userRole === 'renter' && (
                        <span
                          className="material-symbols-outlined text-primary-container text-base"
                          data-icon="check_circle"
                        >
                          check_circle
                        </span>
                      )}
                    </div>
                    <span className="font-headline-sm text-body-md text-on-surface">
                      Tôi muốn thuê xe
                    </span>
                    <span className="text-body-sm font-body-sm text-secondary">
                      Tìm và lái xe mọi lúc
                    </span>
                  </label>

                  {/* Option 2: Host */}
                  <label
                    onClick={() => setUserRole('host')}
                    className={`relative flex flex-col p-3.5 rounded-xl cursor-pointer transition-all ${
                      userRole === 'host'
                        ? 'border-2 border-primary-container bg-surface-container-low/50'
                        : 'border border-outline-variant/60 bg-surface-container-lowest hover:border-outline-variant'
                    }`}
                  >
                    <input
                      checked={userRole === 'host'}
                      onChange={() => setUserRole('host')}
                      className="sr-only"
                      name="user_role"
                      type="radio"
                      value="host"
                    />
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`material-symbols-outlined ${
                          userRole === 'host' ? 'text-primary-container' : 'text-secondary'
                        }`}
                        data-icon="garage"
                      >
                        garage
                      </span>
                      {userRole === 'host' && (
                        <span
                          className="material-symbols-outlined text-primary-container text-base"
                          data-icon="check_circle"
                        >
                          check_circle
                        </span>
                      )}
                    </div>
                    <span className="font-headline-sm text-body-md text-on-surface">
                      Cho thuê xe
                    </span>
                    <span className="text-body-sm font-body-sm text-secondary">
                      Tăng thu nhập 15tr+/tháng
                    </span>
                  </label>
                </div>
              </div>

              <form className="space-y-3.5" onSubmit={handleRegisterSubmit}>
                {/* Full Name */}
                <div>
                  <label
                    className="block text-body-sm font-body-sm font-medium text-on-surface-variant mb-1"
                    htmlFor="reg-name"
                  >
                    Họ và tên (theo CCCD)
                  </label>
                  <div className="relative rounded-xl border border-outline-variant/60 focus-within:border-primary-container focus-within:ring-2 focus-within:ring-primary-container/20 transition-all bg-surface-container-lowest">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-secondary">
                      <span className="material-symbols-outlined" data-icon="badge">
                        badge
                      </span>
                    </div>
                    <input
                      className="block w-full pl-10 pr-4 py-2.5 text-body-md font-body-md text-on-surface placeholder-outline/60 bg-transparent rounded-xl border-0 focus:ring-0 outline-none"
                      id="reg-name"
                      name="fullName"
                      value={registerData.fullName}
                      onChange={handleRegisterChange}
                      placeholder="Nguyễn Văn A"
                      type="text"
                      required
                    />
                  </div>
                </div>

                {/* Phone Number with Inline OTP Button */}
                <div>
                  <label
                    className="block text-body-sm font-body-sm font-medium text-on-surface-variant mb-1"
                    htmlFor="reg-phone"
                  >
                    Số điện thoại liên hệ
                  </label>
                  <div className="relative flex items-center rounded-xl border border-outline-variant/60 focus-within:border-primary-container focus-within:ring-2 focus-within:ring-primary-container/20 transition-all bg-surface-container-lowest">
                    <div className="pl-3.5 flex items-center pointer-events-none text-secondary">
                      <span className="material-symbols-outlined" data-icon="call">
                        call
                      </span>
                    </div>
                    <input
                      className="block w-full pl-3 pr-28 py-2.5 text-body-md font-body-md text-on-surface placeholder-outline/60 bg-transparent rounded-xl border-0 focus:ring-0 outline-none"
                      id="reg-phone"
                      name="phone"
                      value={registerData.phone}
                      onChange={handleRegisterChange}
                      placeholder="09xx xxx xxx"
                      type="tel"
                      required
                    />
                    <button
                      className="absolute right-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-headline-sm text-body-sm transition-colors"
                      type="button"
                    >
                      Gửi OTP
                    </button>
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label
                    className="block text-body-sm font-body-sm font-medium text-on-surface-variant mb-1"
                    htmlFor="reg-email"
                  >
                    Địa chỉ Email
                  </label>
                  <div className="relative rounded-xl border border-outline-variant/60 focus-within:border-primary-container focus-within:ring-2 focus-within:ring-primary-container/20 transition-all bg-surface-container-lowest">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-secondary">
                      <span className="material-symbols-outlined" data-icon="mail">
                        mail
                      </span>
                    </div>
                    <input
                      className="block w-full pl-10 pr-4 py-2.5 text-body-md font-body-md text-on-surface placeholder-outline/60 bg-transparent rounded-xl border-0 focus:ring-0 outline-none"
                      id="reg-email"
                      name="email"
                      value={registerData.email}
                      onChange={handleRegisterChange}
                      placeholder="example@email.com"
                      type="email"
                      required
                    />
                  </div>
                </div>

                {/* Password Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      className="block text-body-sm font-body-sm font-medium text-on-surface-variant mb-1"
                      htmlFor="reg-password"
                    >
                      Mật khẩu
                    </label>
                    <div className="relative rounded-xl border border-outline-variant/60 focus-within:border-primary-container focus-within:ring-2 focus-within:ring-primary-container/20 transition-all bg-surface-container-lowest">
                      <input
                        className="block w-full pl-3.5 pr-9 py-2.5 text-body-md font-body-md text-on-surface placeholder-outline/60 bg-transparent rounded-xl border-0 focus:ring-0 outline-none"
                        id="reg-password"
                        name="password"
                        value={registerData.password}
                        onChange={handleRegisterChange}
                        placeholder="Tối thiểu 8 ký tự"
                        type={showRegPassword ? 'text' : 'password'}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface focus:outline-none"
                      >
                        <span className="material-symbols-outlined text-sm">
                          {showRegPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label
                      className="block text-body-sm font-body-sm font-medium text-on-surface-variant mb-1"
                      htmlFor="reg-confirm-password"
                    >
                      Xác nhận lại
                    </label>
                    <div className="relative rounded-xl border border-outline-variant/60 focus-within:border-primary-container focus-within:ring-2 focus-within:ring-primary-container/20 transition-all bg-surface-container-lowest">
                      <input
                        className="block w-full pl-3.5 pr-9 py-2.5 text-body-md font-body-md text-on-surface placeholder-outline/60 bg-transparent rounded-xl border-0 focus:ring-0 outline-none"
                        id="reg-confirm-password"
                        name="confirmPassword"
                        value={registerData.confirmPassword}
                        onChange={handleRegisterChange}
                        placeholder="Khớp mật khẩu"
                        type={showRegConfirmPassword ? 'text' : 'password'}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface focus:outline-none"
                      >
                        <span className="material-symbols-outlined text-sm">
                          {showRegConfirmPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Visual Password Strength Meter */}
                <div className="pt-0.5">
                  <div className="flex items-center justify-between text-body-sm font-body-sm text-secondary mb-1">
                    <span>Độ mạnh mật khẩu:</span>
                    <span className="text-tertiary font-semibold">Mạnh</span>
                  </div>
                  <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden flex space-x-1">
                    <div className="bg-tertiary-fixed-dim h-full w-1/3 rounded-full"></div>
                    <div className="bg-tertiary-fixed-dim h-full w-1/3 rounded-full"></div>
                    <div className="bg-tertiary-fixed-dim h-full w-1/3 rounded-full"></div>
                  </div>
                </div>

                {/* Consent Checkbox */}
                <div className="pt-1">
                  <label className="flex items-start space-x-2.5 cursor-pointer">
                    <input
                      name="agreeTerms"
                      checked={registerData.agreeTerms}
                      onChange={handleRegisterChange}
                      className="mt-0.5 h-4 w-4 rounded text-primary-container border-outline-variant focus:ring-primary-container"
                      required
                      type="checkbox"
                    />
                    <span className="text-body-sm font-body-sm text-secondary leading-tight">
                      Tôi đồng ý với{' '}
                      <a className="text-primary-container hover:underline" href="#/login/rules">
                        Quy chế hoạt động
                      </a>{' '}
                      và{' '}
                      <a className="text-primary-container hover:underline" href="#/login/privacy">
                        Chính sách bảo mật
                      </a>{' '}
                      của XeDi Việt Nam.
                    </span>
                  </label>
                </div>

                {/* Register Submit Button */}
                <button
                  className="w-full mt-2 py-3 px-4 bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-body-lg rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] flex items-center justify-center space-x-2"
                  type="submit"
                >
                  <span className="material-symbols-outlined" data-icon="person_add">
                    person_add
                  </span>
                  <span>Tạo tài khoản XeDi</span>
                </button>
              </form>
            </div>
          )}

          {/* ======================= SOCIAL LOGINS & INTEGRATIONS ======================= */}
          <div className="mt-8">
            <div className="relative flex items-center justify-center">
              <div className="border-t border-outline-variant/40 w-full"></div>
              <div className="bg-surface-container-lowest px-4 text-body-sm font-body-sm text-secondary uppercase tracking-wider relative whitespace-nowrap">
                Hoặc tiếp tục với
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {/* Google Social Login */}
              <button
                className="flex items-center justify-center space-x-2.5 px-4 py-2.5 border border-outline-variant/70 hover:border-outline hover:bg-surface-container-low/50 rounded-xl transition-all duration-150 active:scale-95 bg-surface-container-lowest text-on-surface"
                type="button"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  ></path>
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  ></path>
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  ></path>
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  ></path>
                </svg>
                <span className="text-body-md font-headline-sm font-medium text-on-surface">
                  Google
                </span>
              </button>

              {/* Facebook Social Login */}
              <button
                className="flex items-center justify-center space-x-2.5 px-4 py-2.5 border border-outline-variant/70 hover:border-outline hover:bg-surface-container-low/50 rounded-xl transition-all duration-150 active:scale-95 bg-surface-container-lowest text-on-surface"
                type="button"
              >
                <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"></path>
                </svg>
                <span className="text-body-md font-headline-sm font-medium text-on-surface">
                  Facebook
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Compliance, Trust & Security Badges */}
        <div className="pt-6 border-t border-outline-variant/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-secondary">
          <div className="flex items-center space-x-2 text-body-sm font-body-sm">
            <span className="material-symbols-outlined text-tertiary" data-icon="lock">
              lock
            </span>
            <span>Mã hóa SSL 256-bit • Nghị định 13/2023/NĐ-CP</span>
          </div>
          <div className="flex items-center space-x-4 text-body-sm font-body-sm">
            <a className="hover:text-primary transition-colors" href="#/login/terms">
              Điều khoản
            </a>
            <span>•</span>
            <a className="hover:text-primary transition-colors" href="#/login/mic-insurance">
              Bảo mật MIC
            </a>
            <span>•</span>
            <span>© 2025 XeDi</span>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Login;
