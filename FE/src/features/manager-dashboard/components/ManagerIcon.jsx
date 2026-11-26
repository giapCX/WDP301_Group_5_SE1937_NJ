import SystemIcon from '../../shared/SystemIcon.jsx';

export default function ManagerIcon({ name, size = 18, ...props }) {
  return <SystemIcon name={name} size={size} {...props}/>;
}