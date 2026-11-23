import { createElement as h, useState } from 'react';

import { services } from '../homeContent.js';
import Icon from './HomeIcon.js';

export default function BookingSearch({ mode, onModeChange, destination, onDestinationChange, onSearch }) {
  const [error, setError] = useState('');
  const tour = mode === 'tour';

  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const start = new Date(form.get('startAt') + '+07:00');
    const end = new Date(form.get('endAt') + '+07:00');
    if (!form.get('pickup').trim() || !form.get('destination').trim() ||
        !Number.isFinite(+start) || !Number.isFinite(+end) || start <= new Date() || end <= start) {
      setError('Nhập điểm đón, điểm đến và chọn giờ kết thúc sau giờ đón trong tương lai.');
      return;
    }
    setError('');
    onSearch({ startAt: start.toISOString(), endAt: end.toISOString(), minSeats: Number(form.get('minSeats')) });
  }

  return h('section', { className: 'vt-h-wrap vt-h-search', id: 'tim-xe', 'aria-label': 'Tìm xe du lịch' },
    h('div', { className: 'vt-h-tabs', role: 'group', 'aria-label': 'Dịch vụ' },
      services.map((service) => h('button', {
        type: 'button', key: service.id, 'aria-pressed': mode === service.id,
        onClick: () => { setError(''); onModeChange(service.id); },
      }, h(Icon, { name: service.icon }),
      h('span', null, h('strong', null, service.title), h('small', null, service.description)))),
    ),
    h('form', { className: 'vt-h-form', onSubmit: submit },
      h('div', { className: 'vt-h-fields' },
        h('label', null, 'Điểm đón', h('input', { name: 'pickup', placeholder: 'Địa chỉ hoặc sân bay', required: true, maxLength: 200 })),
        h('label', null, tour ? 'Lộ trình tour' : 'Điểm đến',
          h('input', {
            name: 'destination', placeholder: 'Thành phố hoặc điểm tham quan', required: true, maxLength: 200,
            value: destination, onChange: (event) => onDestinationChange(event.target.value),
          })),
        h('label', null, 'Giờ đón (giờ Việt Nam)', h('input', { name: 'startAt', type: 'datetime-local', required: true })),
        h('label', null, tour ? 'Giờ kết thúc tour' : 'Giờ đón về',
          h('input', { name: 'endAt', type: 'datetime-local', required: true })),
        h('label', null, 'Số chỗ tối thiểu', h('input', { name: 'minSeats', type: 'number', min: 7, max: 50, defaultValue: 7, required: true })),
      ),
      h('div', { className: 'vt-h-form-actions' },
        h('p', null, 'Kiểm tra xe theo khung giờ và số chỗ.'),
        h('button', { className: 'vt-h-button', type: 'submit' }, 'Tìm xe phù hợp'),
      ),
      error && h('p', { className: 'vt-h-error', role: 'alert' }, error),
    ),
  );
}
