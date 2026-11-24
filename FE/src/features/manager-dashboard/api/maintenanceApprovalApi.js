import api from '../../../api/client';

const resource = '/manager/maintenance-approvals';

export async function fetchMaintenanceApprovals(_revision, signal) {
  return (await api.get(resource, { signal })).data.data;
}

export async function decideMaintenanceApproval(id, input) {
  return (await api.patch(resource + '/' + id, input)).data.data;
}
