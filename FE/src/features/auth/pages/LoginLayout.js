import { createElement as h } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../home/components/HomeIcon.js';
import { hotline, services, standards } from '../../home/homeContent.js';
import { loginPhoto } from './loginPhoto.js';

const links = [
  ['Trang chủ', '/'],
  ['Đội xe cao cấp', '/#doi-xe'],
  ['Dịch vụ thuê xe', '/#dich-vu'],
  ['Bảng giá', '/#doi-xe'],
  ['Về chúng tôi', '/#cam-ket'],
];

const benefits = [
  ['route', 'Lộ trình tùy biến', services[1].description],
  ...standards.slice(1),
];

export function LoginHeader() {
  return h('header', { className: 'vt-h-header' },
    h('div', { className: 'vt-h-wrap vt-h-header-inner' },
      h(Link, { className: 'vt-h-brand', to: '/' }, h(Icon, { name: 'directions_car' }), 'VietTour'),
      h('nav', { 'aria-label': 'Điều hướng chính' },
        links.map(([label, to]) => h(Link, { key: label, to }, label))),
      h('div', { className: 'vt-h-header-actions' },
        h('div', { className: 'vt-h-auth-links' },
          h(Link, { to: '/login', className: 'vt-h-outline' }, 'Đăng nhập'),
          h(Link, { to: '/register', className: 'vt-h-outline' }, 'Đăng ký')),
        h(Link, { to: '/#tim-xe', className: 'vt-h-button' }, 'Tìm xe')),
    ),
  );
}

export function LoginIntro() {
  return h('aside', { className: 'vt-login-intro' },
    h('span', { className: 'vt-login-pill' }, h(Icon, { name: 'verified_user' }), 'VietTour Mobility'),
    h('h1', null, 'Khởi đầu hành trình tinh tế & an tâm'),
    h('p', null, 'Trải nghiệm dịch vụ xe riêng có tài xế, đón đúng giờ và xem giá trước khi đặt chuyến.'),
    h('figure', null,
      h('img', { src: loginPhoto, alt: 'Ảnh chụp xe SUV du lịch' }),
      h('figcaption', null, h(Icon, { name: 'verified_user' }), 'Xe riêng có tài xế'),
    ),
    h('div', { className: 'vt-login-intro-details' },
      benefits.slice(0, 3).map(([icon, title]) => h('span', { key: title }, h(Icon, { name: icon }), title)),
    ),
  );
}

export function LoginServices() {
  return h('section', { className: 'vt-h-wrap vt-login-benefits', 'aria-label': 'Dịch vụ VietTour' },
    benefits.map(([icon, title, description]) =>
      h('article', { key: title }, h(Icon, { name: icon }),
        h('div', null, h('h2', null, title), h('p', null, description)))),
  );
}

export function LoginFooter() {
  return h('footer', { className: 'vt-login-footer' },
    h('div', { className: 'vt-h-wrap vt-login-footer-grid' },
      h('div', null, h(Link, { to: '/', className: 'vt-h-brand' }, 'VietTour'),
        h('p', null, 'Dịch vụ thuê xe du lịch có tài xế theo lịch trình của bạn.')),
      h('div', null, h('h2', null, 'Dịch vụ cốt lõi'),
        services.map(({ id, title }) => h(Link, { key: id, to: '/#dich-vu' }, title))),
      h('div', null, h('h2', null, 'Đội ngũ & cam kết'),
        standards.map(([, title]) => h(Link, { key: title, to: '/#cam-ket' }, title))),
      h('div', null, h('h2', null, 'Liên hệ & tổng đài'),
        h('a', { href: hotline.href }, 'Hotline ', hotline.label)),
    ),
    h('p', { className: 'vt-h-wrap vt-login-copyright' }, '© VietTour Mobility'),
  );
}
