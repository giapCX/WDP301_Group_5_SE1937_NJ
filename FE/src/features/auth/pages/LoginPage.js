import { postRenter } from '../../renter/api/renterApi';
import EmailOtp from './EmailOtp';
import { postApi } from '../../../services/httpClient';
import Icon from '../../../components/Icon';
import '../../renter/styles/renter.css';
import React, { useState } from 'react';
import './LoginPage.css';
import useLogin from '../hooks/useLogin';

const LoginPage = ({ staff = false }) => {
  const [registrationOtp,setRegistrationOtp]=useState({});
  const [resetOtp, setResetOtp] = useState({});
  const [resetData, setResetData] = useState({ email: '', password: '', confirm_password: '' });
  const [resetBusy, setResetBusy] = useState(false);
  const [registerBusy,setRegisterBusy]=useState(false);
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'register'
  const [loginMethod, setLoginMethod] = useState('password');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginOtp, setLoginOtp] = useState({});
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [formStatus, setFormStatus] = useState('');
  const [statusType, setStatusType] = useState('info'); // 'info' | 'success' | 'error'
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

  const useOtp = loginMethod === 'otp';
  const { isLoading, handleLoginSubmit } = useLogin({
    loginData,
    otpCredentials: useOtp ? { email: loginEmail, ...loginOtp } : null,
    renterOnly: !staff,
    setFormStatus,
    setStatusType,
  });

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if(registerBusy)return;
    setRegisterBusy(true);setFormStatus('');
    try {
      if (!registrationOtp.challenge_id || !/^\d{6}$/.test(registrationOtp.otp || '')) throw new Error('Vui lòng gửi và nhập mã OTP email gồm 6 số.');
      await postRenter('/register',{full_name:registerData.fullName,email:registerData.email,phone:registerData.phone,password:registerData.password,confirm_password:registerData.confirmPassword,agree_terms:registerData.agreeTerms,...registrationOtp});
      setStatusType('success');setFormStatus('Đăng ký thành công. Bạn có thể đăng nhập bằng tài khoản vừa tạo.');setAuthTab('login');
    }catch(error){setStatusType('error');setFormStatus(error.message);}finally{setRegisterBusy(false);}
  };

  const handleReset = async event => {
    event.preventDefault();
    if (resetBusy) return;
    setResetBusy(true); setFormStatus('');
    try {
      if (!resetOtp.challenge_id || !/^\d{6}$/.test(resetOtp.otp || '')) throw new Error('Vui lòng gửi và nhập mã OTP email gồm 6 số.');
      const result = await postApi('/auth/reset-password', { ...resetData, ...resetOtp });
      setStatusType('success'); setFormStatus(result.data.message);
      setLoginData(prev => ({ ...prev, account: resetData.email, password: '' }));
      setResetData({ email: '', password: '', confirm_password: '' }); setResetOtp({}); setAuthTab('login');
    } catch (error) { setStatusType('error'); setFormStatus(error.message); }
    finally { setResetBusy(false); }
  };

  return (
    <main className="xedi-login-card w-full overflow-hidden bg-background text-on-background">
      <aside className="xedi-login-visual" aria-label="Giới thiệu VietTour">
        <a className="xedi-auth-brand" href="/#trang-chu">
          <span className="material-symbols-outlined" aria-hidden="true">directions_car</span>
          VietTour
        </a>
        <div>
          <span className="xedi-auth-visual-badge">
            <span className="material-symbols-outlined" aria-hidden="true">verified</span>
            Dịch vụ VietTour
          </span>
          <h2 className="xedi-auth-visual-title">Khởi đầu hành trình tinh tế &amp; an tâm</h2>
          <p>Quản lý lịch đặt xe, theo dõi hành trình và xem lại thông tin chuyến đi trong tài khoản của bạn.</p>
        </div>
        <figure className="xedi-auth-photo">
          <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBMT-9LHyTi6sVXvZmQnX_bqW6DoG3ZksyEd8see0MeAVdHr9qEvWMk9e3LrMCFuVR0kXC_3y6D_ZV8ybxtIzDVqzB_6jNEoNC2m7idE2I89dW61ACjEAbqqy0eIGZE8-0-R2xs7Ybn-hWCrsTXV09im2o_M4KedTAFH75fcNYH3OEePgzYADj5SFFiza7uHbF5Voo0jx8Z491gklo-3W6A7BdjYUl2xIIgFeQWU34" alt="Xe du lịch đón khách trước khu nghỉ dưỡng" />
          <figcaption>
            <span className="material-symbols-outlined" aria-hidden="true">verified_user</span>
            Xe du lịch VietTour · Ảnh minh họa
          </figcaption>
        </figure>
        <ul className="xedi-auth-benefits">
          <li><span className="material-symbols-outlined" aria-hidden="true">fact_check</span>Kiểm tra xe</li>
          <li><span className="material-symbols-outlined" aria-hidden="true">receipt_long</span>Giá rõ ràng</li>
          <li><span className="material-symbols-outlined" aria-hidden="true">support_agent</span>Hỗ trợ thuê xe</li>
        </ul>
      </aside>

      <div className="xedi-login-panel flex flex-col bg-surface-container-lowest">
        {/* Top Segmented Auth Switcher & Support Info */}
        <div className="xedi-auth-toolbar">
          {/* Modern Pill Segmented Control */}
          <div className="xedi-auth-tabs bg-surface-container-low rounded-xl">
            <button
              className={`px-5 py-2 rounded-lg text-body-md font-headline-sm transition-all duration-200 ${
                authTab === 'login'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-secondary hover:text-on-surface'
              }`}
              aria-pressed={authTab === 'login'}
              onClick={() => {
                setAuthTab('login');
                setFormStatus('');
              }}
              type="button"
            >
              Đăng nhập
            </button>
            {!staff && <button
              className={`px-5 py-2 rounded-lg text-body-md font-headline-sm transition-all duration-200 ${
                authTab === 'register'
                  ? 'bg-surface-container-lowest text-primary shadow-sm'
                  : 'text-secondary hover:text-on-surface'
              }`}
              aria-pressed={authTab === 'register'}
              onClick={() => {
                setAuthTab('register');
                setFormStatus('');
              }}
              type="button"
            >
              Đăng ký
            </button>}
          </div>
          <div className="hidden sm:flex items-center space-x-2 text-secondary text-body-sm font-body-sm">
            <span className="material-symbols-outlined text-base" data-icon="headset_mic">
              headset_mic
            </span>
            <span>
              <a href="tel:19006886" className="text-on-surface font-semibold">1900 6886</a>
            </span>
          </div>
        </div>

        {/* Main Form Container */}
        <div className="xedi-auth-content">
          {formStatus && (
            <div
              role="status"
              className={`mb-4 rounded-xl p-4 text-body-sm flex items-start space-x-2 ${
                statusType === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : statusType === 'error'
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-surface-container-low text-primary'
              }`}
            >
              <Icon name={statusType === 'success' ? 'check' : 'info'} size={18} className="shrink-0 mt-0.5" />
              <span>{formStatus}</span>
            </div>
          )}
          {/* ======================= 1. LOGIN FORM PANEL ======================= */}
          {authTab === 'login' && (
            <div className="transition-all duration-300">
              <div className="mb-8">
                <h2 className="text-headline-xl font-headline-xl text-on-surface tracking-tight mb-2">
                  {staff ? 'Đăng nhập nhân viên' : 'Mừng bạn trở lại với VietTour'}
                </h2>
                <p className="text-body-md font-body-md text-secondary">
                  Đăng nhập để tiếp tục quản lý lịch đặt xe và hành trình của bạn.
                </p>
              </div>

              <div className="xedi-auth-methods" role="group" aria-label="Phương thức đăng nhập">
                <button type="button" aria-pressed={!useOtp} disabled={isLoading} onClick={() => { setLoginMethod('password'); setFormStatus(''); }}>Mật khẩu</button>
                <button type="button" aria-pressed={useOtp} disabled={isLoading} onClick={() => { setLoginMethod('otp'); setFormStatus(''); }}>Mã OTP</button>
              </div>

              <form className="space-y-4" onSubmit={handleLoginSubmit}>
                {useOtp ? (
                  <div>
                    <label className="renter-field">
                      Email đã đăng ký
                      <input type="email" autoComplete="email" required value={loginEmail}
                        onChange={(event) => setLoginEmail(event.target.value)} />
                    </label>
                    <EmailOtp email={loginEmail} login onChange={setLoginOtp} />
                  </div>
                ) : (
                <>
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
                      autoComplete="username"
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
                      href="#/login"
                      onClick={event => { event.preventDefault(); setAuthTab('forgot'); setFormStatus(''); }}
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
                      autoComplete="current-password"
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

                </>
                )}
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
                  disabled={isLoading || (useOtp && !/^\d{6}$/.test(loginOtp.otp || ''))}
                  className={`w-full mt-2 py-3.5 px-4 bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-body-lg rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] flex items-center justify-center space-x-2 ${
                    isLoading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                  type="submit"
                >
                  <span>{isLoading ? 'Đang xác thực...' : 'Đăng nhập'}</span>
                  <span className="material-symbols-outlined" aria-hidden="true" data-icon="arrow_forward">
                    arrow_forward
                  </span>
                </button>
              </form>

              <a className="xedi-auth-staff-link" href={staff ? '/login' : '/#/staff-login'}>
                {staff ? 'Đăng nhập người thuê' : 'Đăng nhập nhân viên'}
              </a>

            </div>
          )}

          {/* ======================= 2. REGISTER FORM PANEL ======================= */}
          {authTab === 'forgot' && <form onSubmit={handleReset} className="space-y-5">
            <h2 className="text-headline-md">Quên mật khẩu</h2>
            <p>Nhập email đã đăng ký để nhận mã OTP và tạo mật khẩu mới.</p>
            <label className="renter-field">Email đã đăng ký<input type="email" required autoComplete="email" value={resetData.email} onChange={e => setResetData(prev => ({ ...prev, email: e.target.value }))} /></label>
            <EmailOtp email={resetData.email} reset onChange={setResetOtp} />
            <label className="renter-field">Mật khẩu mới<input type="password" required minLength={8} maxLength={32} autoComplete="new-password" value={resetData.password} onChange={e => setResetData(prev => ({ ...prev, password: e.target.value }))} /></label>
            <label className="renter-field">Xác nhận mật khẩu mới<input type="password" required minLength={8} maxLength={32} autoComplete="new-password" value={resetData.confirm_password} onChange={e => setResetData(prev => ({ ...prev, confirm_password: e.target.value }))} /></label>
            <p>Mật khẩu 8–32 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt @$!%*?&.</p>
            <button className="w-full py-3 bg-primary-container text-on-primary rounded-xl" disabled={resetBusy || !resetOtp.challenge_id} type="submit">{resetBusy ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}</button>
            <button type="button" onClick={() => { setAuthTab('login'); setFormStatus(''); }}>Quay về đăng nhập</button>
          </form>}
          {authTab === 'register' && (
            <div className="transition-all duration-300">
              <div className="mb-6">
                <h2 className="text-headline-xl font-headline-xl text-on-surface tracking-tight mb-2">
                  Tạo tài khoản thành viên VietTour
                </h2>
                <p className="text-body-md font-body-md text-secondary">
                  Tài khoản người thuê dùng để đặt xe và quản lý chuyến đi.
                </p>
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
                  <EmailOtp email={registerData.email} onChange={setRegistrationOtp}>
                  <div className="relative flex-1 min-w-0">
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
                  </EmailOtp>
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
                      của VietTour.
                    </span>
                  </label>
                </div>

                {/* Register Submit Button */}
                <button
                  disabled={registerBusy || !registrationOtp.challenge_id}
                  className="w-full mt-2 py-3 px-4 bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-body-lg rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] flex items-center justify-center space-x-2"
                  type="submit"
                >
                  <span className="material-symbols-outlined" data-icon="person_add">
                    person_add
                  </span>
                  <span>Tạo tài khoản VietTour</span>
                </button>
              </form>
            </div>
          )}

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
            <span>© 2025 VietTour</span>
          </div>
        </div>
      </div>
      <ul className="xedi-auth-value-strip" aria-label="Thông tin dịch vụ">
        <li><span className="material-symbols-outlined" aria-hidden="true">route</span><strong>Lộ trình linh hoạt</strong></li>
        <li><span className="material-symbols-outlined" aria-hidden="true">directions_car</span><strong>Đội xe đa dạng</strong></li>
        <li><span className="material-symbols-outlined" aria-hidden="true">receipt_long</span><strong>Chi phí rõ ràng</strong></li>
        <li><span className="material-symbols-outlined" aria-hidden="true">support_agent</span><strong>Hỗ trợ hành trình</strong></li>
      </ul>
    </main>
  );
};

export default LoginPage;
