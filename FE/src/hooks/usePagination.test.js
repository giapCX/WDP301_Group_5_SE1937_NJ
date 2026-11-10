import { fireEvent, render, screen } from '@testing-library/react';
import Pagination from '../components/ui/Pagination';
import usePagination from './usePagination';

function List({ items, filter = '' }) {
  const paging = usePagination(items, filter);
  return <><ul>{paging.items.map((item) => <li key={item}>{item}</li>)}</ul><Pagination {...paging} /></>;
}

test('pages rows, selects page size, and disables navigation at boundaries', () => {
  render(<List items={Array.from({ length: 25 }, (_, i) => `Row ${i + 1}`)} />);
  expect(screen.getAllByRole('listitem')).toHaveLength(10);
  expect(screen.getByLabelText('Trang trước')).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Trang sau'));
  expect(screen.getByText('Row 11')).toBeInTheDocument();
  expect(screen.queryByText('Row 1')).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Trang cuối'));
  expect(screen.getAllByRole('listitem')).toHaveLength(5);
  expect(screen.getByLabelText('Trang sau')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Số dòng mỗi trang'), { target: { value: '20' } });
  expect(screen.getAllByRole('listitem')).toHaveLength(20);
  expect(screen.getByText('Row 1')).toBeInTheDocument();
});

test('resets after filtering and clamps after deleting the last page', () => {
  const items = Array.from({ length: 21 }, (_, i) => `Row ${i + 1}`);
  const { rerender } = render(<List items={items} />);
  fireEvent.click(screen.getByLabelText('Trang cuối'));
  rerender(<List items={items.slice(0, 20)} />);
  expect(screen.getByText('Row 11')).toBeInTheDocument();
  rerender(<List items={items} filter="changed" />);
  expect(screen.getByText('Row 1')).toBeInTheDocument();
  expect(screen.getByLabelText('Trang trước')).toBeDisabled();
  rerender(<List items={[]} filter="empty" />);
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
