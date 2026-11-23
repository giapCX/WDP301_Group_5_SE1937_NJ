import { createElement as h } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getSession } from '../api/authApi.js';
import { dashboardForRole } from '../dashboardRoutes.js';
import useHomeResource from '../../home/hooks/useHomeResource.js';

export default function RequireRole({ role }) {
  const session = useHomeResource(getSession);
  if (session.loading) return h('p', { className: 'container py-4', role: 'status' }, 'Đang kiểm tra phiên đăng nhập…');
  if (session.error) return h('p', { className: 'container py-4', role: 'alert' }, 'Chưa thể xác minh phiên đăng nhập. Vui lòng tải lại trang.');
  if (!session.data) return h(Navigate, { to: '/login', replace: true });
  if (session.data.role_name !== role) return h(Navigate, { to: dashboardForRole(session.data.role_name), replace: true });
  return h(Outlet, { context: session.data });
}
