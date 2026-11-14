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
  const params = new URLSearchParams(window.location.hash.split('?')[1]);
  const dateInput = (value) => {
    const milliseconds = Date.parse(value);
    return Number.isFinite(milliseconds) ? new Date(milliseconds + 7 * 3600000).toISOString().slice(0, 16) : undefined;
  };
  return <div className="vehicle-detail-page">
    <SiteHeader onLogin={() => { window.location.hash = '#/login'; }} />
    <main className="vehicle-detail-main">
      <a className="vehicle-detail-back" href={params.get("from") === "renter" ? "#/renter" : "#xe-noi-bat"}>← Quay lại danh sách xe</a>
      <BookingPanel key={listingId} listingId={listingId} initialDates={{ start: dateInput(params.get("start")), end: dateInput(params.get("end")) }} />
    </main>
    <SiteFooter />
  </div>;
}
