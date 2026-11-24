import { useMemo, useState } from 'react';
import useHomeResource from '../../home/hooks/useHomeResource';
import { garageError, getGarageTasks } from '../api/garageApi';

function loadTasks({ date }, signal) {
  return getGarageTasks(date, signal);
}

export default function useGarageTasks(date) {
  const [revision, setRevision] = useState(0);
  const params = useMemo(() => ({ date, revision }), [date, revision]);
  const { data, loading, error } = useHomeResource(loadTasks, params);
  return {
    tasks: data ?? [],
    loading,
    error: error && garageError(error),
    refresh: () => setRevision((value) => value + 1),
  };
}
