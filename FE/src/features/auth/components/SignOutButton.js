import { createElement as h } from 'react';
import useSignOut from '../hooks/useSignOut.js';
import './signOutButton.css';

export default function SignOutButton({ redirectTo = '/login', onSuccess }) {
  const { error, signingOut, signOut } = useSignOut({ redirectTo, onSuccess });

  return h('span', { className: 'auth-signout-wrap' },
    h('button', {
      className: 'auth-signout-button',
      type: 'button',
      onClick: signOut,
      disabled: signingOut,
      'aria-label': signingOut ? 'Đang đăng xuất' : 'Đăng xuất',
      title: signingOut ? 'Đang đăng xuất' : 'Đăng xuất',
    },
    h('svg', { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    h('path', { d: 'M10 17l5-5-5-5M15 12H3' }),
    h('path', { d: 'M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6' })),
    h('span', null, signingOut ? 'Đang đăng xuất…' : 'Đăng xuất')),
    error && h('span', { className: 'auth-signout-error', role: 'alert' }, error),
  );
}
