import { useOutletContext } from 'react-router-dom';
import { getSession } from '../../auth/api/authApi.js';
import useHomeResource from '../../home/hooks/useHomeResource.js';
import RenterLayout from '../../renter-dashboard/components/RenterLayout.jsx';
import '../styles/reservations.css';

function PublicReservationLayout({ children }) {
  const { data: user } = useHomeResource(getSession);

  return <RenterLayout user={user} mainClassName="rv-app">{children}</RenterLayout>;
}

export default function ReservationLayout({ children, publicPage = false }) {
  const user = useOutletContext();

  return publicPage
    ? <PublicReservationLayout>{children}</PublicReservationLayout>
    : <RenterLayout user={user} mainClassName="rv-app">{children}</RenterLayout>;
}
