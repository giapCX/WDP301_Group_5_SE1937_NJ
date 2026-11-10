import { useEffect, useState } from 'react';

export default function usePagination(items = [], resetKey = '') {
  const [state, setState] = useState({ page: 1, pageSize: 10, key: resetKey });
  const pages = Math.max(1, Math.ceil(items.length / state.pageSize));
  const page = state.key === resetKey ? Math.min(state.page, pages) : 1;
  useEffect(() => {
    if (state.key !== resetKey || state.page !== page) setState((previous) => ({ ...previous, key: resetKey, page }));
  }, [state.key, state.page, resetKey, page]);
  return {
    items: items.slice((page - 1) * state.pageSize, page * state.pageSize),
    page, pageSize: state.pageSize, total: items.length,
    onPageChange: (value) => setState((previous) => ({ ...previous, key: resetKey, page: Math.min(Math.max(1, value), pages) })),
    onPageSizeChange: (pageSize) => setState({ page: 1, pageSize, key: resetKey }),
  };
}
