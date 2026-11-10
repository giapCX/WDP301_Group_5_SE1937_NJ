import { act, renderHook, waitFor } from '@testing-library/react';
import useManagerCollection from './useManagerCollection';
import { getManagerResource } from '../api/managerApi';

jest.mock('../api/managerApi', () => ({ getManagerResource: jest.fn() }));
beforeEach(() => {
  getManagerResource.mockReset();
  getManagerResource.mockImplementation(async (_resource, query) => ({
    data: [{ id: `row-${query.page}` }],
    pagination: { page: query.page, total: 25 },
  }));
});

test('requests pages from the API and resets when filters or page size change', async () => {
  const { result, rerender } = renderHook(({ q }) => useManagerCollection('accounts', { q }), { initialProps: { q: '' } });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(getManagerResource).toHaveBeenLastCalledWith('accounts', expect.objectContaining({ page: 1, limit: 10 }));
  act(() => result.current.paging.onPageChange(2));
  await waitFor(() => expect(result.current.data[0].id).toBe('row-2'));
  expect(result.current.paging.total).toBe(25);
  rerender({ q: 'filtered' });
  await waitFor(() => expect(result.current.data[0].id).toBe('row-1'));
  expect(getManagerResource).toHaveBeenLastCalledWith('accounts', expect.objectContaining({ page: 1, q: 'filtered' }));
  act(() => result.current.paging.onPageSizeChange(20));
  await waitFor(() => expect(getManagerResource).toHaveBeenLastCalledWith('accounts', expect.objectContaining({ page: 1, limit: 20 })));
});

test('option lists opt out of pagination and stale requests cannot overwrite new pages', async () => {
  const options = renderHook(() => useManagerCollection('roles', {}, { paginate: false }));
  await waitFor(() => expect(options.result.current.loading).toBe(false));
  expect(getManagerResource.mock.calls[0][1].page).toBeUndefined();
  expect(options.result.current.paging).toBeUndefined();
  options.unmount();
  let resolveOld;
  getManagerResource.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  const { result } = renderHook(() => useManagerCollection('vehicles'));
  act(() => result.current.paging.onPageChange(2));
  await waitFor(() => expect(result.current.data[0].id).toBe('row-2'));
  await act(async () => resolveOld({ data: [{ id: 'stale' }], pagination: { page: 1, total: 25 } }));
  expect(result.current.data[0].id).toBe('row-2');
});
