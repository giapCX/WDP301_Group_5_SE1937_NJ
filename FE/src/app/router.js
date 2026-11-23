import { useEffect } from 'react';
import OperatorDashboard from '../pages/operator/OperatorDashboard';

export default function AppRouter() {
  useEffect(() => { document.title = 'Operator — Điều hành thuê xe'; }, []);
  return <OperatorDashboard />;
}
