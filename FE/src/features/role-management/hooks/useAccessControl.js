import { useState } from 'react';
import { ACCESS_CONTROL_ROLES_STORAGE_KEY, ACCESS_CONTROL_STORAGE_KEY, createDefaultMatrix } from '../accessControlConfig';
import { DEMO_ACCOUNTS, DEMO_AUDIT_EVENTS, DEMO_ROLES } from '../data/accessControlDemoData';

function loadMatrix(roles) {
  const defaults = createDefaultMatrix(roles);
  try {
    const saved = JSON.parse(localStorage.getItem(ACCESS_CONTROL_STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return defaults;
    return Object.fromEntries(Object.entries(defaults).map(([permissionId, roleValues]) => [
      permissionId,
      { ...roleValues, ...(saved[permissionId] || {}) },
    ]));
  } catch {
    return defaults;
  }
}

function loadRoles() {
  try {
    const saved = JSON.parse(localStorage.getItem(ACCESS_CONTROL_ROLES_STORAGE_KEY) || 'null');
    return Array.isArray(saved) ? saved : DEMO_ROLES;
  } catch {
    return DEMO_ROLES;
  }
}

export default function useAccessControl() {
  const [roles, setRoles] = useState(loadRoles);
  const [accounts] = useState(DEMO_ACCOUNTS);
  const [auditEvents, setAuditEvents] = useState(DEMO_AUDIT_EVENTS);
  const [matrix, setMatrix] = useState(() => loadMatrix(roles));
  const [toast, setToast] = useState('');

  function togglePermission(permissionId, roleId) {
    setMatrix((current) => ({
      ...current,
      [permissionId]: {
        ...current[permissionId],
        [roleId]: !current[permissionId]?.[roleId],
      },
    }));
  }

  function addRole(name) {
    const normalizedName = name.trim();
    if (!normalizedName) return false;
    const id = `role-${Date.now()}`;
    const role = {
      id,
      name: normalizedName,
      short: normalizedName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      color: 'blue',
    };
    setRoles((current) => [...current, role]);
    setMatrix((current) => Object.fromEntries(Object.entries(current).map(([permissionId, values]) => [
      permissionId,
      { ...values, [id]: false },
    ])));
    setAuditEvents((current) => [{ id, title: `Tạo vai trò ${normalizedName}`, actor: 'Việt Anh', time: 'Vừa xong', type: 'info' }, ...current]);
    setToast(`Đã thêm vai trò “${normalizedName}”`);
    return true;
  }

  function saveMatrix() {
    try {
      localStorage.setItem(ACCESS_CONTROL_STORAGE_KEY, JSON.stringify(matrix));
      localStorage.setItem(ACCESS_CONTROL_ROLES_STORAGE_KEY, JSON.stringify(roles));
      setToast('Đã lưu thay đổi ma trận phân quyền trên thiết bị này');
    } catch {
      setToast('Không thể lưu thay đổi trong trình duyệt này');
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
  };
}
