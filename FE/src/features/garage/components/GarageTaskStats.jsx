import { DispatchStats } from '../../bookings/components/BookingStats';
import { TASK_STATUSES } from '../garageConstants';

export default function GarageTaskStats({ tasks }) {
  const cards = [
    { label: 'Tổng nhiệm vụ', icon: 'list', tone: 'blue', value: tasks.length },
    ...Object.entries(TASK_STATUSES).map(([status, card]) => ({
      ...card,
      value: tasks.filter((task) => task.status === status).length,
    })),
  ];
  return <DispatchStats cards={cards} label="Thống kê nhiệm vụ Gara" />;
}
