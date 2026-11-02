import { useEffect, useState } from 'react';
import { createGarageDemo, taskKinds } from '../data/garage';

export const GARAGE_STORAGE_KEY = 'xedi.garage.preview.v1';
function loadWorkspace() {
  try {
    const saved = JSON.parse(localStorage.getItem(GARAGE_STORAGE_KEY));
    if (
      saved?.version === 1 &&
      Array.isArray(saved.tasks) &&
      Array.isArray(saved.incidents) &&
      Array.isArray(saved.history) &&
      saved.tasks.every((task) => task.id && task.kind && task.requirements)
    )
      return saved;
  } catch {
    /* Start fresh when storage is unavailable or contains an invalid draft. */
  }
  return createGarageDemo();
}
export default function useGarageWorkspace() {
  const [workspace, setWorkspace] = useState(loadWorkspace);
  const [storageError, setStorageError] = useState('');
  useEffect(() => {
    try {
      localStorage.setItem(GARAGE_STORAGE_KEY, JSON.stringify(workspace));
      setStorageError('');
    } catch {
      setStorageError(
        'Trình duyệt chưa lưu được thay đổi. Hãy giảm số ảnh đính kèm; dữ liệu hiện chỉ được giữ trong trang đang mở.',
      );
    }
  }, [workspace]);
  function saveReport(id, report, draft) {
    setWorkspace((previous) => {
      const task = previous.tasks.find((item) => item.id === id);
      if (!task || ['submitted', 'completed'].includes(task.status))
        return previous;
      const time = new Date().toISOString();
      const status = draft
        ? 'draft'
        : task.kind === 'inspection'
          ? 'submitted'
          : 'completed';
      const damage =
        !draft &&
        task.kind === 'return' &&
        ['exterior', 'interior', 'engine', 'tires'].some(
          (key) => report[key] !== 'good',
        );
      const incident = damage
        ? {
            id: `SC-${Date.now()}`,
            taskId: id,
            vehicle: task.vehicle,
            plate: task.plate,
            description: report.note,
            severity: 'medium',
            photos: report.photos,
            time,
            status: 'submitted',
          }
        : null;
      return {
        ...previous,
        tasks: previous.tasks.map((item) =>
          item.id === id ? { ...item, status, report, updatedAt: time } : item,
        ),
        incidents: incident
          ? [incident, ...previous.incidents]
          : previous.incidents,
        history: [
          {
            id: `LOG-${Date.now()}`,
            time,
            title: `${draft ? 'Lưu nháp' : task.kind === 'inspection' ? 'Gửi đề xuất' : 'Hoàn tất'} ${taskKinds[task.kind].toLowerCase()}`,
            detail: `${task.id} · ${task.vehicle} · ${task.plate}${damage ? ' · Đã chuyển báo cáo sự cố cho vận hành' : ''}`,
            type: status,
          },
          ...previous.history,
        ],
      };
    });
  }
  function addIncident(incident) {
    const time = new Date().toISOString();
    setWorkspace((previous) => ({
      ...previous,
      incidents: [
        { ...incident, id: `SC-${Date.now()}`, time, status: 'submitted' },
        ...previous.incidents,
      ],
      history: [
        {
          id: `LOG-${Date.now()}`,
          time,
          title: 'Gửi báo cáo sự cố',
          detail: `${incident.vehicle} · ${incident.plate}`,
          type: 'submitted',
        },
        ...previous.history,
      ],
    }));
  }
  return {
    workspace,
    storageError,
    saveReport,
    addIncident,
    reset: () => setWorkspace(createGarageDemo()),
  };
}
