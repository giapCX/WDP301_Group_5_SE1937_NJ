const { scryptSync } = require('node:crypto');
const date = (value) => new Date(value);
const password_hash = `scrypt$demo-rental-salt$${scryptSync('Demo@12345', 'demo-rental-salt', 64).toString('hex')}`;
const roles = ['admin', 'manager', 'operator', 'garage_staff', 'driver', 'renter'].map((role_name, i) => ({ role_id: i + 1, role_name }));
const names = ['Admin Demo', 'Manager Demo', 'Operator Demo', 'Garage Demo', 'Driver An', 'Driver Binh', 'Renter Chi', 'Renter Dung', 'Renter Ha'];
const users = names.map((full_name, i) => ({ user_id: i + 1, role_id: [1,2,3,4,5,5,6,6,6][i], full_name, email: `demo${i + 1}@example.com`, phone: `090000000${i + 1}`, password_hash, status: 'active', created_at: date('2026-11-01T00:00:00Z') }));
const driver_profiles = [5,6].map((user_id, i) => ({ driver_id: i + 1, user_id, license_number: `DEMO-LICENSE-${i + 1}`, license_expiry: date('2030-12-31T00:00:00Z'), availability_status: i ? 'busy' : 'available', approved_at: date('2026-11-02T00:00:00Z') }));
const vehicles = [['51A-DEMO01','Toyota','Vios',5,800000,'available'],['51A-DEMO02','Mitsubishi','Xpander',7,1100000,'in_use'],['51A-DEMO03','Ford','Transit',16,1800000,'available'],['51A-DEMO04','Hyundai','Solati',16,2000000,'maintenance'],['51A-DEMO05','Kia','Carnival',7,1600000,'available']].map(([plate_number,brand,model,seat_count,price_per_day,status], i) => ({ vehicle_id:i+1, plate_number,brand,model,seat_count,price_per_day,status }));
for (const vehicle of vehicles) {
  vehicle.schedule_version = 0;
}
const definitions = [
 [7,null,'2026-12-01',1,0,'pending',0],
 [8,1,'2026-12-03',2,1600000,'confirmed',0],
 [9,2,'2026-11-22',2,2200000,'in_progress',0],
 [7,3,'2026-11-10',2,3600000,'completed',200000],
 [8,5,'2026-11-12',1,1600000,'cancelled',0],
 [9,1,'2026-11-15',1,800000,'completed',0]
];
const bookings = definitions.map(([renter_id,vehicle_id,day,days,estimated_price,booking_status,additional_charge],i) => ({ booking_id:i+1,renter_id,vehicle_id,pickup_location:'Demo: Quan 1, TP.HCM',dropoff_location:'Demo: Vung Tau',pickup_time:date(`${day}T01:00:00Z`),estimated_end_time:new Date(date(`${day}T01:00:00Z`).getTime()+days*86400000),estimated_price,additional_charge,booking_status,created_at:date('2026-11-01T01:00:00Z') }));
for (const booking of bookings) {
  booking.reviewed_by = null;
  booking.reviewed_at = null;
  booking.rejection_reason = null;
}
const trip_stops = bookings.flatMap(b => [1,2].map(n => ({stop_id:(b.booking_id-1)*2+n,booking_id:b.booking_id,stop_order:n,location:n===1?'Demo: Tram dung Long Thanh':'Demo: Bai Sau, Vung Tau',note:'Du lieu gia lap'})));
const trip_assignments = [2,3,4,6].map((booking_id,i) => ({assignment_id:i+1,booking_id,driver_id:booking_id===3?2:1,assigned_by:3,assigned_at:date('2026-11-02T00:00:00Z'),assignment_status:booking_id>=4?'completed':'assigned'}));
const trip_status_updates = bookings.filter(b=>b.booking_id!==1).map((b,i) => ({update_id:i+1,booking_id:b.booking_id,updated_by:3,trip_status:b.booking_status,updated_at:b.booking_status==='completed'?b.estimated_end_time:b.pickup_time}));
const promotions = [{promotion_id:1,code:'DEMO10',discount_percent:10,valid_until:date('2027-12-31T23:59:59Z'),status:'active'},{promotion_id:2,code:'EXPIRED5',discount_percent:5,valid_until:date('2026-10-31T23:59:59Z'),status:'expired'}];
const booking_promotions = [{booking_id:2,promotion_id:1,discount_amount:160000},{booking_id:4,promotion_id:1,discount_amount:360000}];
const payments = [2,3,4,5,6].map((booking_id,i) => {const b=bookings[booking_id-1];const discount=booking_promotions.find(p=>p.booking_id===booking_id)?.discount_amount||0; return {payment_id:i+1,booking_id,amount:b.estimated_price+b.additional_charge-discount,payment_method:'bank_transfer',payment_status:booking_id===2?'pending':'paid',paid_at:booking_id===2?null:b.created_at};});
const refunds = [{refund_id:1,payment_id:4,amount:1600000,reason:'Demo: Khach huy chuyen trong thoi han mien phi',refund_status:'completed',approved_by:2}];
const vehicle_inspections = [3,4,6].map((booking_id,i)=>({inspection_id:i+1,vehicle_id:bookings[booking_id-1].vehicle_id,booking_id,staff_id:4,inspection_type:'pickup',condition_note:'Demo: Xe sach, du nhien lieu, khong hu hong',result:'passed',inspected_at:bookings[booking_id-1].pickup_time}));
vehicle_inspections.push({inspection_id:4,vehicle_id:4,booking_id:null,staff_id:4,inspection_type:'periodic',condition_note:'Demo: Can thay ma phanh',result:'failed',inspected_at:date('2026-11-20T02:00:00Z')});
const maintenance_records = [{maintenance_id:1,vehicle_id:4,reported_by:4,description:'Demo: Thay ma phanh va kiem tra he thong phanh',maintenance_status:'in_progress',started_at:date('2026-11-20T03:00:00Z'),completed_at:null}];
const incidents = [{incident_id:1,booking_id:4,reported_by:5,description:'Demo: Khach yeu cau doi lo trinh, phu thu 200000 VND',incident_status:'resolved',resolution_note:'Khach dong y phu thu; da tinh vao additional_charge',resolved_by:3},{incident_id:2,booking_id:3,reported_by:6,description:'Demo: Cham lich trinh do ket xe',incident_status:'open',resolution_note:null,resolved_by:null}];
const reviews = [4,6].map((booking_id,i)=>({review_id:i+1,booking_id,renter_id:bookings[booking_id-1].renter_id,driver_rating:5,service_rating:i?4:5,comment:'Demo: Tai xe dung gio, xe sach se',created_at:new Date(bookings[booking_id-1].estimated_end_time.getTime()+3600000)}));
const { createSampleChangeRequests } = require('./sample-booking-change-requests');
const booking_change_requests = createSampleChangeRequests(bookings, trip_stops);
for (const booking of bookings) {
  booking.additional_charges = [];
}
module.exports = {booking_change_requests,roles,users,driver_profiles,vehicles,bookings,trip_stops,trip_assignments,trip_status_updates,promotions,booking_promotions,payments,refunds,vehicle_inspections,maintenance_records,incidents,reviews};
