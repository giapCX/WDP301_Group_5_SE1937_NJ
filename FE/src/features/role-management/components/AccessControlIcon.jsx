import SystemIcon from '../../shared/SystemIcon.jsx';

export default function AccessControlIcon({ name, size = 18, ...props }) {
  return <SystemIcon name={name} size={size} {...props}/>;
}