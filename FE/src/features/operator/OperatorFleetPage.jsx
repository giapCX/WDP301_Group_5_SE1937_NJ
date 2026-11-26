import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import BookingSidebar from '../shared/booking/BookingSidebar';
import ResourceWorkspace from '../management/components/ResourceWorkspace';
import OperatorTopbar from './OperatorTopbar';
import '../shared/booking/bookings.css';

export default function OperatorFleetPage() {
  const user = useOutletContext();
  const [notice, setNotice] = useState('');

  return (
    <div className="dispatch-app">
      <BookingSidebar />
      <div className="dispatch-workspace">
        <OperatorTopbar title="Hồ sơ xe và tài xế" user={user} />
        <main className="dispatch-content">
          <section className="dispatch-page-heading">
            <div>
              <div className="heading-kicker"><span>ĐIỀU HÀNH TÀI NGUYÊN</span><i /> Hồ sơ và xét duyệt</div>
              <h1>Hồ sơ xe và tài xế</h1>
              <p>Quản lý hồ sơ sẵn sàng cho điều phối. Xe và tài xế chỉ được sử dụng sau khi hồ sơ được xét duyệt.</p>
            </div>
          </section>
          {notice && <div className="dispatch-alert" role="status">{notice}<button type="button" onClick={() => setNotice('')}>Đóng</button></div>}
          <ResourceWorkspace workspace="vehicles" actor="operator" onNotice={setNotice} />
          <ResourceWorkspace workspace="driver_profiles" actor="operator" onNotice={setNotice} />
        </main>
      </div>
    </div>
  );
}
