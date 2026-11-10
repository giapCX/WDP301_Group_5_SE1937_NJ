import { useCallback, useEffect, useState } from 'react';
import { getCurrentUser } from '../../auth/session';
import Icon from '../../../components/Icon';
import { getOperationDashboard, getOperationDetail, getOperationResource } from '../api/operationApi';
import OperationDashboard from '../components/OperationDashboard';
import OperationDetailDialog from '../components/OperationDetailDialog';
import OperationQueue from '../components/OperationQueue';
import { useOperationActions } from '../hooks/useOperationActions';
import {
  operationSectionTitles,
  operationSections,
} from '../operationConfig';
import { createOperationRows } from '../operationViewModel';
import './OperationPage.css';

function currentUserCanOperate() {
  const user = getCurrentUser();
  const roles = user?.roles || [user?.role?.code].filter(Boolean);
  return roles.some((role) => ['OPERATION_STAFF', 'ADMIN'].includes(role));
}

function readSectionFromHash() {
  const section = window.location.hash.replace(/^#\/?operation\/?/, '');
  return operationSections.some(({ id }) => id === section) ? section : 'overview';
}

function clearSessionAndLogout() {
  ['xedi_token', 'xedi_user'].forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
  window.location.hash = '#/login';
}

export default function OperationPage() {
  const [section, setSection] = useState(readSectionFromHash);
  const [dashboard, setDashboard] = useState(null);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('newest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const currentUser = getCurrentUser();

  useEffect(() => {
    const syncSectionFromHash = () => setSection(readSectionFromHash());
    window.addEventListener('hashchange', syncSectionFromHash);
    return () => window.removeEventListener('hashchange', syncSectionFromHash);
  }, []);

  useEffect(() => {
    document.title = 'Operation Management — XeDi';
  }, []);

  // Load the dashboard summary or the active Operation Staff work queue.
  const load = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      if (section === 'overview') {
        const result = await getOperationDashboard({ signal });
        setDashboard(result.data);
        setItems([]);
        setPagination(null);
      } else {
        const result = await getOperationResource(
          section,
          {
            page,
            limit: 10,
            status: status === 'all' ? '' : status,
            q: search,
            sort,
          },
          { signal },
        );
        setItems(result.data || []);
        setPagination(result.pagination || null);
      }
    } catch (reason) {
      if (reason.name !== 'AbortError') {
        setError(reason.message || 'Không thể tải dữ liệu.');
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [page, search, section, sort, status]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const navigate = (nextSection) => {
    setSection(nextSection);
    setStatus(nextSection === 'overdue' ? 'ongoing' : 'all');
    setQuery('');
    setSearch('');
    setPage(1);
    setSelected(null);
    window.location.hash = `#/operation/${nextSection}`;
  };

  const refresh = () => load(new AbortController().signal);

  // Keep API mutation feedback and queue refresh behavior consistent across workflows.
  const perform = async (operation, message) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      setNotice(message);
      setSelected(null);
      await refresh();
    } catch (reason) {
      setError(reason.message || 'Không thể cập nhật dữ liệu.');
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (item) => {
    setSelected(item);
    if (!['vehicles', 'bookings', 'listings', 'incidents', 'violations', 'disputes', 'complaints'].includes(section)) {
      return;
    }
    try {
      const result = await getOperationDetail(section, item.id);
      setSelected(result.data);
    } catch (reason) {
      setError(reason.message);
    }
  };

  const actions = useOperationActions({ section, currentUser, perform, setError });
  const rows = createOperationRows(items, section);

  // Enforce the Operation Staff/Admin UI boundary independently of API authorization.
  if (!currentUserCanOperate()) {
    return (
      <main className="operation-denied">
        <h1>Cần đăng nhập bằng tài khoản vận hành</h1>
        <p>Trang này chỉ dành cho Operation Staff và Admin.</p>
        <a href="#/login">Đến trang đăng nhập</a>
      </main>
    );
  }

  return (
    <div className="operation-app">
      <aside className="operation-sidebar">
        <a href="#trang-chu" className="operation-brand">
          <span className="operation-brand-mark">X</span>
          <span><strong>XeDi</strong><small>OPERATION CENTER</small></span>
        </a>
        <div className="operation-user">
          <span className="operation-avatar">{(currentUser?.full_name || 'OS').slice(0, 1)}</span>
          <span>
            <strong>{currentUser?.full_name || 'Operation Staff'}</strong>
            <small>Nhân viên vận hành</small>
          </span>
        </div>
        {/* Links map directly to the operational queues and dashboard. */}
        <nav aria-label="Điều hướng vận hành">
          {operationSections.map((item) => (
            <button
              key={item.id}
              className={section === item.id ? 'active' : ''}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} size={18} />
              {item.label}
              {item.id === 'bookings' && dashboard?.metrics?.pendingBookings > 0 && (
                <b>{dashboard.metrics.pendingBookings}</b>
              )}
            </button>
          ))}
        </nav>
        <a href="#trang-chu" className="operation-back">← Về trang XeDi</a>
      </aside>

      <main className="operation-main">
        <header className="operation-topbar">
          <div>
            <p>TRUNG TÂM VẬN HÀNH</p>
            <h1>{operationSectionTitles[section]}</h1>
          </div>
          <div className="operation-top-actions">
            <span>{currentUser?.email || ''}</span>
            <button onClick={clearSessionAndLogout}>Đăng xuất</button>
          </div>
        </header>

        {notice && (
          <div className="operation-notice" role="status">
            {notice}
            <button aria-label="Đóng thông báo" onClick={() => setNotice('')}>×</button>
          </div>
        )}
        {error && (
          <div className="operation-error" role="alert">
            {error}
            <button onClick={refresh}>Thử lại</button>
          </div>
        )}

        {/* Overview exposes workload only; decisions are made in their dedicated queues. */}
        {section === 'overview' ? (
          <OperationDashboard
            dashboard={dashboard}
            loading={loading}
            onNavigate={navigate}
          />
        ) : (
          <OperationQueue
            section={section}
            items={items}
            rows={rows}
            pagination={pagination}
            status={status}
            query={query}
            sort={sort}
            page={page}
            loading={loading}
            actions={actions}
            onStatusChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            onQueryChange={setQuery}
            onSearch={(event) => {
              event.preventDefault();
              setPage(1);
              setSearch(query.trim());
            }}
            onSortChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
            onPageChange={setPage}
            onOpenDetail={openDetail}
          />
        )}

        {selected && (
          <OperationDetailDialog
            item={selected}
            section={section}
            busy={busy}
            onClose={() => setSelected(null)}
            perform={perform}
          />
        )}
        {busy && <div className="operation-saving" role="status">Đang lưu thay đổi…</div>}
      </main>
    </div>
  );
}
