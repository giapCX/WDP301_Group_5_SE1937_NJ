import { DispatchStats } from '../../shared/booking/BookingStats';
import { TASK_TYPES } from '../garageConstants';

const CARDS = [
  { type: 'HANDOVER_OUT', label: TASK_TYPES.HANDOVER_OUT, icon: 'list', tone: 'blue' },
  { type: 'RETURN_IN', label: TASK_TYPES.RETURN_IN, icon: 'car', tone: 'teal' },
  { type: 'MAINTENANCE', label: 'Phiếu bảo dưỡng', icon: 'wrench', tone: 'blue' },
];

export default function GarageTaskStats({ tasks }) {
  const cards = CARDS.map((card) => ({
    ...card,
    value: tasks?.filter((task) => card.type ? task.type === card.type : task.status === card.status).length,
  }));
  return <DispatchStats cards={cards} label="Thống kê nhiệm vụ Gara" />;
}
