import { createElement as h, useEffect, useState } from 'react';
import { getApi } from '../../../api/client';
import { clearSession } from '../session';
import '../../renter/styles/viettour-dashboard.css';

const titles = {
  ADMIN: 'Quản trị hệ thống',
  MANAGER: 'Quản lý vận hành',
  OPERATION_STAFF: 'Nhân viên vận hành',
  GARAGE_STAFF: 'Nhân viên gara',
  DRIVER: 'Tài xế',
};
const dates = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
});
const statuses = {
  accepted: 'Đã nhận chuyến', assigned: 'Đã phân công', completed: 'Hoàn thành', cancelled: 'Đã hủy',
};

export default function RoleWorkspace({ role }) {
  const [view, setView] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    getApi('/workspaces/' + role, { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setView(data); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure); });
    return () => controller.abort();
  }, [role]);

  return h('div', { className: 'vt-dashboard' },
    h('header', { className: 'vt-dashboard-header' },
      h('a', { href: '/', className: 'vt-dashboard-brand' }, 'VietTour'),
      view && h('button', { type: 'button', onClick: () => { clearSession(); window.location.assign('/login'); } }, 'Đăng xuất'),
    ),
    h('main', { className: 'vt-dashboard-content' },
      h('section', { className: 'vt-dashboard-hero' },
        h('div', null,
          h('h1', null, titles[role]),
          view && h('p', null, 'Xin chào, ', view.name),
        ),
      ),
      error ? h('section', { className: 'vt-dashboard-panel' },
        h('p', { role: 'alert' }, error.message),
        error.status === 401 && h('a', { href: '/login' }, 'Đăng nhập'),
      ) : !view ? h('p', { role: 'status' }, 'Đang kiểm tra tài khoản…') : (
        role === 'DRIVER' ? h('section', { className: 'vt-dashboard-panel' },
          h('h2', null, 'Chuyến được phân công'),
          view.assignments.length ? h('ul', { className: 'vt-dashboard-history' }, view.assignments.map((item) =>
            h('li', { key: item._id },
              h('strong', null, 'Chuyến ', item._id.slice(-6).toUpperCase()),
              h('span', null, item.service_start_at ? dates.format(new Date(item.service_start_at)) : 'Chưa có giờ đón'),
              h('span', { className: 'vt-dashboard-pill' }, statuses[item.status] || item.status),
            ),
          )) : h('p', null, 'Chưa có chuyến được phân công.'),
        ) : h('div', { className: 'vt-dashboard-metrics' }, view.metrics.map(({ label, count }) =>
          h('article', { key: label }, h('div', null, h('span', null, label), h('strong', null, count))),
        ))
      ),
    ),
  );
}
