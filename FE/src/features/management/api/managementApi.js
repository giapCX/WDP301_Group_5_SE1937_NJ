import apiClient from '../../../api/client.js';

const endpoint = (actor, resource) => `/${actor}/management/${resource}`;

export async function listManagementResource(resource, signal, actor = 'admin') {
  const { data } = await apiClient.get(endpoint(actor, resource), { signal });
  return data.items;
}

export async function createManagementResource(resource, payload, actor = 'admin') {
  const { data } = await apiClient.post(endpoint(actor, resource), payload);
  return data.item;
}

export async function updateManagementResource(resource, id, payload, actor = 'admin') {
  return apiClient.patch(endpoint(actor, `${resource}/${id}`), payload);
}
