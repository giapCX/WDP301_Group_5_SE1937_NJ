import { fireEvent, render, screen } from '@testing-library/react';
import OperationDetailDialog from './OperationDetailDialog';

test('submits an Operation proposal for Manager review without making a decision', () => {
  const onPropose = jest.fn();
  render(
    <OperationDetailDialog
      item={{ id: 'case-1', caseNumber: 'CASE-1', caseType: 'damage', status: 'in_progress' }}
      section="incidents"
      busy={false}
      onClose={jest.fn()}
      onUpdate={jest.fn()}
      onPropose={onPropose}
    />,
  );

  fireEvent.change(screen.getByRole('spinbutton', { name: 'Mức bồi thường đề xuất' }), {
    target: { value: '250000' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Trách nhiệm đề xuất' }), {
    target: { value: 'shared' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Căn cứ xác minh' }), {
    target: { value: 'Bằng chứng xác nhận có hư hỏng mới.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Gửi Manager xem xét' }));

  expect(onPropose).toHaveBeenCalledWith({
    amount: 250000,
    responsibility: 'shared',
    note: 'Bằng chứng xác nhận có hư hỏng mới.',
  });
});
