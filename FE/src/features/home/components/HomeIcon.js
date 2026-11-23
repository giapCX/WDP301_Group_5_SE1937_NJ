import { createElement as h } from 'react';

export default function HomeIcon({ name }) {
  return h('span', { className: 'vt-h-icon', 'aria-hidden': true }, name);
}
