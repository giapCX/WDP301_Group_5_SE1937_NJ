import { useCallback, useEffect, useRef, useState } from 'react';
import { clearSession } from '../../auth/session';
import { getGarageWorkspace, reportGarageIncident, saveGarageTask } from '../api/garageApi';

const empty = { tasks: [], incidents: [], history: [], vehicles: [], permissions: [] };
export default function useGarageWorkspace() {
  const [workspace, setWorkspace] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const tasks = useRef([]);
  const checkpoints = useRef(new Map());
  const request = useRef();
  const alive = useRef(true);
  const reload = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    try {
      const { data } = await getGarageWorkspace({ signal: controller.signal });
      if (!controller.signal.aborted && alive.current) {
        tasks.current = data.tasks;
        checkpoints.current.clear();
        setWorkspace(data);
      }
    } catch (failure) {
      if (!controller.signal.aborted && alive.current) {
        if (failure.status === 401) clearSession();
        setError(failure.message);
      }
    } finally {
      if (!controller.signal.aborted && alive.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    reload();
    return () => { alive.current = false; request.current?.abort(); };
  }, [reload]);
  async function saveReport(id, report, draft) {
    const task = tasks.current.find((item) => item.id === id);
    if (!task || task.readOnly) throw new Error('Không thể chỉnh sửa biên bản này.');
    await saveGarageTask({ ...task, ...checkpoints.current.get(id) }, report, draft, (value) => checkpoints.current.set(id, value));
    checkpoints.current.delete(id);
    await reload();
  }
  async function addIncident(incident, requestId) {
    await reportGarageIncident(incident, requestId);
    await reload();
  }
  return { workspace, loading, error, reload, saveReport, addIncident };
}
