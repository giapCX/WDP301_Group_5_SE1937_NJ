import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCurrentUser, clearSession } from '../../auth/session';
import Icon from '../../../components/Icon';
import {
  getOperationDashboard,
  getOperationDetail,
  getOperationResource,
} from '../api/operationApi';
import OperationDashboard from '../components/OperationDashboard';
import OperationDetailDialog from '../components/OperationDetailDialog';
import OperationActionDialog from '../components/OperationActionDialog';
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
  const roles = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    user?.role?.code,
  ].filter(Boolean);
  return roles.some((role) => ['OPERATION_STAFF', 'ADMIN'].includes(role));
}

function readSectionFromHash() {
  const section = window.location.hash.replace(/^#\/?operation\/?/, '');
  return operationSections.some(({ id }) => id === section) ? section : 'overview';
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
    const syncSection = () => setSection(readSectionFromHash());
    window.addEventListener('hashchange', syncSection);
    return () => window.removeEventListener('hashchange', syncSection);
  }, []);

  useEffect(() => {
    document.title = 'Operation Management — XeDi';
  }, []);

  // Load only the dashboard or the currently selected staff queue.
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
        const result = await getOperationResource(section, {
          page,
          limit: 10,
          status: status === 'all' ? '' : status,
          q: search,
          sort,
        }, { signal });
        setItems(result.data || []);
        setPagination(result.pagination || null);
      }
    } catch (reason) {
      if (reason.name !== 'AbortError') setError(reason.message || 'Không thể tải dữ liệu.');
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
  const perform = async (operation, successMessage) => {
    setBusy(true);
    setError('');
    try {
      await operation();
      setNotice(successMessage);
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
    if (section === 'overdue') return;
    try {
      const result = await getOperationDetail(section, item.id);
      setSelected(result.data);
    } catch (reason) {
      setError(reason.message || 'Không thể tải chi tiết hồ sơ.');
    }
  };

  const actions = useOperationActions({ section, currentUser, perform, setError });
  const rows = useMemo(() => createOperationRows(items, section), [items, section]);

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
        <div className="operation-brand">
          <span className="operation-brand-mark">X</span>
          <span><strong>XeDi</strong><small>OPERATION CENTER</small></span>
        </div>
        <div className="operation-user">
          <span className="operation-avatar">{(currentUser?.full_name || 'OS').slice(0, 1)}</span>
          <span><strong>{currentUser?.full_name || 'Operation Staff'}</strong><small>Nhân viên vận hành</small></span>
        </div>
        <nav aria-label="Điều hướng vận hành">
          {operationSections.map((item) => (
            <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => navigate(item.id)}>
              <Icon name={item.icon} size={18} />
              {item.label}
              {item.id === 'bookings' && dashboard?.metrics?.pendingBookings > 0 && <b>{dashboard.metrics.pendingBookings}</b>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="operation-main">
        <header className="operation-topbar">
          <div><p>TRUNG TÂM VẬN HÀNH</p><h1>{operationSectionTitles[section]}</h1></div>
          <div className="operation-top-actions">
            <span>{currentUser?.email || ''}</span>
            <button onClick={() => { clearSession(); window.location.hash = '#/login'; }}>Đăng xuất</button>
          </div>
        </header>

        {notice && <div className="operation-notice" role="status">{notice}<button aria-label="Đóng thông báo" onClick={() => setNotice('')}>×</button></div>}
        {error && <div className="operation-error" role="alert">{error}<button onClick={refresh}>Thử lại</button></div>}

        {section === 'overview'
          ? <OperationDashboard dashboard={dashboard} loading={loading} onNavigate={navigate} />
          : <OperationQueue
            section={section}
            title={operationSectionTitles[section]}
            items={items}
            rows={rows}
            pagination={pagination}
            loading={loading}
            status={status}
            query={query}
            sort={sort}
            page={page}
            onStatusChange={(value) => { setStatus(value); setPage(1); }}
            onQueryChange={setQuery}
            onSearch={(event) => { event.preventDefault(); setPage(1); setSearch(query.trim()); }}
            onSortChange={(value) => { setSort(value); setPage(1); }}
            onPageChange={setPage}
            onAction={actions.handleAction}
            onCreateCase={actions.createCase}
            onOpenDetail={openDetail}
          />}
      </main>

      {selected && <OperationDetailDialog
        item={selected}
        section={section}
        busy={busy}
        onClose={() => setSelected(null)}
        onUpdate={(action) => actions.updateCaseDetail(selected, action)}
        onPropose={(proposal) => actions.proposeCompensation(selected, proposal)}
      />}
      <OperationActionDialog
        dialog={actions.dialog}
        busy={busy}
        onClose={actions.closeDialog}
        onSubmit={actions.submitDialog}
      />
      {busy && <div className="operation-saving" role="status">Đang lưu thay đổi…</div>}
    </div>
  );
}
