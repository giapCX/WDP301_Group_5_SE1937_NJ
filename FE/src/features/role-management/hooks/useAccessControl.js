import { useCallback, useEffect, useState } from 'react';
import { PERMISSION_GROUPS, createDefaultMatrix } from '../accessControlConfig';
import { createManagementResource, listManagementResource, updateManagementResource } from '../../management/api/managementApi.js';

const permissionIds = PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.id));
const displayName = (value = '') => value.split(/[_\s-]+/).filter(Boolean).map((part) => part[0].toLocaleUpperCase('vi') + part.slice(1)).join(' ');
const rolePresentation = (role) => ({ id: String(role.role_id), role_name: role.role_name, name: displayName(role.role_name), short: displayName(role.role_name).split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toLocaleUpperCase('vi'), color: role.role_name === 'admin' ? 'navy' : role.role_name === 'manager' ? 'violet' : 'blue', permissions: role.permissions || [] });

function makeMatrix(roles) {
  const defaults = createDefaultMatrix(roles);
  return Object.fromEntries(Object.entries(defaults).map(([permission, values]) => [permission,
    Object.fromEntries(roles.map((role) => [role.id, role.permissions.includes(permission)])),
  ]));
}

function accountPresentation(user) {
  const role = user.role?.role_name || '';
  const name = user.full_name || '';
  return { id: user.user_id, name, email: user.email, phone: user.phone, role: displayName(role), roleId: user.role_id,
    status: user.status === 'active' ? 'Hoạt động' : user.status === 'locked' ? 'Đã khóa' : 'Ngừng hoạt động',
    initials: name.split(/\s+/).map((part) => part[0]).slice(-2).join('').toLocaleUpperCase('vi'),
    createdAt: user.created_at ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(user.created_at)) : '—',
    tone: role === 'manager' ? 'avatar-violet' : role === 'admin' ? 'avatar-blue' : 'avatar-green' };
}

function auditPresentation(event) {
  return { id: String(event._id), title: event.summary || `${event.action} ${event.resource}`, actor: event.actor_role || 'Hệ thống',
    time: new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(event.created_at)),
    type: event.action === 'create' ? 'info' : event.action === 'update' ? 'success' : 'warning' };
}

export default function useAccessControl() {
  const [roles, setRoles] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [roleRows, userRows, auditRows] = await Promise.all([
        listManagementResource('roles'), listManagementResource('users'), listManagementResource('audit_logs'),
      ]);
      const nextRoles = roleRows.map(rolePresentation);
      setRoles(nextRoles);
      setMatrix(makeMatrix(nextRoles));
      setAccounts(userRows.map(accountPresentation));
      setAuditEvents(auditRows.map(auditPresentation));
    } catch (failure) {
      setError(failure.response?.data?.message || 'Không thể tải dữ liệu quản trị.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  function togglePermission(permissionId, roleId) {
    setMatrix((current) => ({
      ...current,
      [permissionId]: {
        ...current[permissionId],
        [roleId]: !current[permissionId]?.[roleId],
      },
    }));
  }

  async function addRole(name) {
    const normalizedName = name.trim();
    if (!normalizedName) return false;
    try {
      await createManagementResource('roles', { role_name: normalizedName, permissions: [] });
      await refresh();
      setToast(`Đã tạo vai trò “${normalizedName}”`);
      return true;
    } catch (failure) {
      setToast(failure.response?.data?.message || 'Không thể tạo vai trò.');
      return false;
    }
  }

  async function saveMatrix() {
    try {
      await Promise.all(roles.map((role) => updateManagementResource('roles', role.id,
        { permissions: permissionIds.filter((permission) => matrix[permission]?.[role.id]) })));
      await refresh();
      setToast('Đã lưu phân quyền lên hệ thống.');
    } catch (failure) {
      setToast(failure.response?.data?.message || 'Không thể lưu phân quyền.');
    }
  }

  async function toggleAccountStatus(account) {
    const status = account.status === 'Hoạt động' ? 'locked' : 'active';
    try {
      await updateManagementResource('users', account.id, { status });
      await refresh();
      setToast(status === 'locked' ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.');
    } catch (failure) {
      setToast(failure.response?.data?.message || 'Không thể cập nhật tài khoản.');
    }
  }

  async function createAccount(account) {
    try {
      await createManagementResource('users', account);
      await refresh();
      setToast('Đã tạo tài khoản nhân viên.');
      return true;
    } catch (failure) {
      setToast(failure.response?.data?.message || 'Không thể tạo tài khoản.');
      return false;
    }
  }

  return {
    accounts,
    auditEvents,
    matrix,
    roles,
    addRole,
    saveMatrix,
    setToast,
    toast,
    togglePermission,
    toggleAccountStatus,
    createAccount,
    loading,
    error,
    refresh,
  };
}
