import { useEffect, useState } from 'react';

export default function useHomeResource(load, params) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true });
    load(params, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setState({ data }); })
      .catch((error) => { if (!controller.signal.aborted) setState({ error }); });
    return () => controller.abort();
  }, [load, params]);
  return state;
}
