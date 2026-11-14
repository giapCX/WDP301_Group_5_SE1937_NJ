import SiteHeader from '../../../components/SiteHeader';
import SiteFooter from '../../../components/SiteFooter';
import BookingPanel from '../../renter/components/BookingPanel';
import { useEffect } from 'react';
import './VehicleDetailPage.css';

export default function VehicleDetailPage({ listingId }) {
  useEffect(() => {
    document.title = 'Chi tiết xe — XeDi';
    window.scrollTo(0, 0);
  }, [listingId]);
  return <div className="vehicle-detail-page">
    <SiteHeader onLogin={() => { window.location.hash = '#/login'; }} />
    <main className="vehicle-detail-main">
      <a className="vehicle-detail-back" href="#xe-noi-bat">← Quay lại danh sách xe</a>
      <BookingPanel key={listingId} listingId={listingId} />
    </main>
    <SiteFooter />
  </div>;
}
