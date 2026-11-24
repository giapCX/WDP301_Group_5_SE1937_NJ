import { useMemo, useState } from 'react';
import useHomeResource from '../../home/hooks/useHomeResource';
import { garageError, getGarageTask } from '../api/garageApi';

function loadTask({ taskId, vehicleId }, signal) {
  return getGarageTask(taskId, vehicleId, signal);
}

export default function useGarageTask(taskId, vehicleId) {
  const [revision, setRevision] = useState(0);
  const params = useMemo(() => ({ taskId, vehicleId, revision }), [taskId, vehicleId, revision]);
  const { data, loading, error } = useHomeResource(loadTask, params);
  return {
    task: data, loading, error: error && garageError(error),
    refresh: () => setRevision((value) => value + 1),
  };
}
