import api from '../../../api/client';
export const operationError = (error) => error.response?.data?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';
export async function loadOperations(path, params, signal) { return (await api.get(path, { params, signal })).data.data; }
export async function operationAction(path, body, method = 'post') { return (await api[method](path, body)).data.data; }
export const operatorBase = '/operator/operations';
export const managerBase = '/manager/operation-approvals';
