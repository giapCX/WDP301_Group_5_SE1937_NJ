import { createElement as h } from 'react';
import SystemIcon from '../../shared/SystemIcon.jsx';

export default function HomeIcon({ name }) {
  return h('span', { className: 'vt-h-icon', 'aria-hidden': true },
    h(SystemIcon, { name, size: 20 }));
}