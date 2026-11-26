import SystemIcon from '../SystemIcon.jsx';

export default function BookingIcon({ name, size = 18, ...props }) {
  return <SystemIcon name={name} size={size} {...props}/>;
}