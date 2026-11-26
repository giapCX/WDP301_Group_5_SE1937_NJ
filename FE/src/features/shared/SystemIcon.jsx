const iconArtwork = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  car: <><path d="m5 17-1 3M19 17l1 3M3 11l2-6h14l2 6M5 17h14l2-6H3l2 6Z"/><circle cx="7.5" cy="14.5" r=".8"/><circle cx="16.5" cy="14.5" r=".8"/></>,
  van: <><path d="M3 6h12l4 5h2v7H3zM15 6v5h4M7 18a2 2 0 1 0 0 .01M17 18a2 2 0 1 0 0 .01"/><path d="M3 11h12"/></>,
  route: <><path d="M6 3v11a4 4 0 0 0 8 0V9M3 6l3-3 3 3M11 12l3-3 3 3M18 3h3v3h-3z"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></>,
  wrench: <><path d="M14.7 6.3a5 5 0 0 0-6.4 6.4l-5.6 5.6a2 2 0 0 0 2.8 2.8l5.6-5.6a5 5 0 0 0 6.4-6.4l-3 3-3-3 3.2-2.8Z"/></>,
  list: <><path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/></>,
  pin: <><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3v2M12 17h.01"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  user: <><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  arrow: <><path d="M4 12h16M14 6l6 6-6 6"/></>,
  chevron: <path d="m9 5 7 7-7 7"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  checkCircle: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  chart: <><path d="M3 3v18h18M6 15l5-5 4 4 6-7"/></>,
  alert: <><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.6.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.6.7a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z"/></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  plusCircle: <><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></>,
  more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></>,
  swap: <><path d="m17 3 4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3"/></>,
  seat: <><path d="M7 3h5a3 3 0 0 1 3 3v6h3a3 3 0 0 1 3 3v2H9a3 3 0 0 1-3-3V6a3 3 0 0 1 1-3ZM9 17v4M19 17v4"/></>,
  receipt: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2zM8 8h8M8 12h8M8 16h4"/></>,
  headset: <><path d="M3 13v-1a9 9 0 0 1 18 0v1M3 13h4v7H5a2 2 0 0 1-2-2zM21 13h-4v7h2a2 2 0 0 0 2-2zM17 20a5 5 0 0 1-5 2"/></>,
  plane: <><path d="m3 11 18-7-7 18-3-8-8-3Z"/><path d="m11 14 5-5"/></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff: <><path d="m3 3 18 18M10.6 6.2A11 11 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-4 4.6M6.2 6.2C3.5 8 2 12 2 12s3.5 6 10 6a10 10 0 0 0 3-.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></>,
};

const iconAliases = Object.freeze({
  dashboard: 'grid', directions_car: 'car', verified_user: 'shield', verified: 'checkCircle',
  receipt_long: 'receipt', support_agent: 'headset', groups: 'users', calendar_month: 'calendar',
  location_on: 'pin', sync_alt: 'swap', airline_seat_recline_extra: 'seat', flight_land: 'plane',
  airport_shuttle: 'van', edit_road: 'route', add_circle: 'plusCircle', person: 'user',
  visibility: 'eye', visibility_off: 'eyeOff', arrow_forward: 'arrow', history: 'clock',
});

export default function SystemIcon({ name, size = 18, className, ...props }) {
  const iconName = iconAliases[name] || name;
  const artwork = iconArtwork[iconName] || iconArtwork.help;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      {artwork}
    </svg>
  );
}