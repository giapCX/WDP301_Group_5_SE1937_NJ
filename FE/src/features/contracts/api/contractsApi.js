import { getApi, postApi } from '../../../services/httpClient';

const agreementPath = (type, id) => `/contracts/${type}/${encodeURIComponent(id)}`;

export const getContracts = (type, params, options) => getApi(`/contracts/${type}?${params}`, options);
export const getContract = (type, id, view, options) => getApi(`${agreementPath(type, id)}?view=${view}`, options);
export const getContractCandidates = (type, page, options) => getApi(`/contracts/${type}/candidates?page=${page}&limit=10`, options);
export const prepareContract = (type, id, body) => postApi(`/contracts/${type}/prepare/${encodeURIComponent(id)}`, body);
export const signContract = (type, id, view, body) => postApi(`${agreementPath(type, id)}/sign?view=${view}`, body);
export const confirmContractIntake = (type, id) => postApi(`${agreementPath(type, id)}/operator-intake?view=staff`, {});
export const reviewManagementContract = (id, body) => postApi(`${agreementPath('management', id)}/manager-review?view=staff`, body);

export async function getContractTemplate(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Không thể tải mẫu hợp đồng Word.');
  return response.arrayBuffer();
}
