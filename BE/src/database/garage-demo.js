import { Types } from 'mongoose';

const id = (prefix, number) => new Types.ObjectId(prefix + number.toString(16).padStart(22, '0'));
export const demoVehicleIds = [33, 34, 35, 36].map((number) => id('03', number));
export const obsoleteInspectionIds = ['6af2909365fcc71404e148a9', '6af290d265fcc71404e148ab', '6af2917965fcc71404e148ad', '6af291fe65fcc71404e148af'].map((value) => new Types.ObjectId(value));
const legacyReasons = {
  '10': 'Ngoại thất cần xử lý trầy xước; hệ thống truyền động cần kiểm tra lại trước khi phê duyệt.',
  '11': 'Cần khắc phục ngoại thất và kiểm tra lại động cơ; nộp biên bản kiểm định mới sau sửa chữa.',
  '12': 'Xe chưa đạt yêu cầu an toàn ở hạng mục động cơ và ngoại thất; từ chối hồ sơ hiện tại.',
};
const placeholder = (value) => typeof value === 'string' && /^(private\/)?demo\//.test(value);

// Remove references to inspection/intake/handover photos that were never supplied.
export function removePlaceholderPhotos(document) {
  function visit(value) {
    if (!value || typeof value !== 'object' || value instanceof Date || value instanceof Types.ObjectId) return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'photo_keys' && Array.isArray(child)) value[key] = child.filter((entry) => !placeholder(entry));
      else if (key === 'evidence' && Array.isArray(child)) value[key] = child.filter((entry) => !placeholder(entry.file_key));
      else if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  }
  visit(document);
  return document;
}

export function cleanLegacyDemoDocument(name, document) {
  removePlaceholderPhotos(document);
  if (name === 'vehicle_inspections' && /^0400000000000000000000(0[1-9a-f]|1[0-2])$/.test(String(document._id))) {
    const report = document.condition_report || {};
    const normalized = { clean: 'good', normal: 'good', needs_attention: 'attention', recheck_required: 'attention' };
    for (const field of ['exterior', 'interior', 'engine', 'tires']) report[field] = normalized[report[field]] || report[field];
    const reason = legacyReasons[String(document._id).slice(-2)];
    if (reason && document.decision_reason === 'Missing or unsuitable items in vehicle inspection') {
      document.decision_reason = reason;
      report.note = reason;
    }
  }
  if (name === 'vehicles' && /^03000000000000000000001[0-2]$/.test(String(document._id)) && !document.review_note && ['revision_required', 'rejected'].includes(document.onboarding_status)) {
    document.review_note = legacyReasons[String(document._id).slice(-2)];
  }
  return document;
}

export function curateGarageDemo(datasets) {
  const byName = Object.fromEntries(datasets.map((set) => [set.name, set.documents]));
  for (const set of datasets) set.documents.forEach((document) => cleanLegacyDemoDocument(set.name, document));
  byName.incident_cases = byName.incident_cases.filter((item) => !/^Demo .+ report, pending verification$/.test(item.description || ''));
  byName.notifications = byName.notifications.filter((item) => !item.content?.startsWith('Thông báo dữ liệu mẫu #'));
  const garage = id('02', 16), manager = id('02', 19);
  const created = new Date('2026-11-10T01:00:00Z');
  const submitted = new Date('2026-11-10T02:00:00Z');
  const decided = new Date('2026-11-10T03:00:00Z');
  const scenarios = [
    { brand: 'Toyota', model: 'Veloz Cross', seats: 7, status: 'submitted', report: 'draft', recommendation: 'pass', note: 'Đang kiểm tra nội thất và đối chiếu số khung; chưa gửi Manager.' },
    { brand: 'Hyundai', model: 'Stargazer', seats: 7, status: 'pending_review', report: 'pending', recommendation: 'pass', note: 'Động cơ, phanh, lốp và nội thất hoạt động bình thường. Chờ Manager duyệt biên bản.' },
    { brand: 'Kia', model: 'Carens', seats: 7, status: 'revision_required', report: 'revision_required', recommendation: 'requires_repair', note: 'Lốp trước bên phải mòn không đều. Yêu cầu thay lốp, kiểm tra góc đặt bánh và kiểm định lại.' },
    { brand: 'Honda', model: 'BR-V', seats: 7, status: 'approved', report: 'approved', recommendation: 'pass', note: 'Đã đối chiếu hồ sơ và biên bản kiểm định, xe đạt yêu cầu. Chờ chủ xe bàn giao tại gara.' },
  ];
  function add(name, document) {
    const rows = byName[name];
    if (!rows.some((item) => item._id.equals(document._id))) rows.push(document);
  }
  scenarios.forEach((scenario, index) => {
    const vehicleId = demoVehicleIds[index], ownerId = id('02', index + 1), inspectionId = id('04', index + 33);
    const finished = ['approved', 'revision_required'].includes(scenario.report);
    add('vehicles', {
      _id: vehicleId, owner_id: ownerId, license_plate: `30K-9100${index + 1}`,
      brand: scenario.brand, model: scenario.model, manufacture_year: 2024, seats: scenario.seats,
      fuel_type: 'gasoline', transmission: 'automatic', vehicle_type: 'MPV',
      daily_price: 900000, photos: [], description: 'Xe mẫu cho luồng Garage và Manager; chưa có ảnh hay giấy tờ tải lên.',
      onboarding_status: scenario.status, physical_status: 'with_owner',
      ...(finished ? { review_note: scenario.note, reviewed_by_manager_id: manager } : {}),
      registration_history: [{ action: 'submitted', by_user_id: ownerId, at: created },
        ...(finished ? [{ action: scenario.report === 'approved' ? 'approved' : 'revision_required', by_user_id: manager, at: decided, note: scenario.note }] : [])],
      created_at: created, updated_at: finished ? decided : submitted,
    });
    add('vehicle_inspections', {
      _id: inspectionId, vehicle_id: vehicleId, garage_staff_id: garage,
      inspection_type: 'onboarding', approval_status: scenario.report, recommendation: scenario.recommendation,
      condition_report: { exterior: 'good', interior: 'good', engine: 'good', tires: index === 2 ? 'attention' : 'good', odometer_km: 12000 + index * 2000, fuel_level_pct: 70, photo_keys: [], note: scenario.note },
      inspected_at: submitted, created_at: created, updated_at: finished ? decided : submitted,
      version: scenario.report === 'draft' ? 0 : finished ? 2 : 1,
      ...(scenario.report !== 'draft' ? { submitted_at: submitted, submitted_from_version: 0 } : {}),
      ...(finished ? { decision_reason: scenario.note, reviewed_by_manager_id: manager, decided_at: decided } : {}),
    });
    if (index === 3) add('management_agreements', {
      _id: id('05', 36), vehicle_id: vehicleId, owner_id: ownerId, platform_signer_id: manager,
      agreement_number: 'MGMT-GM-2026-0004', status: 'active', commission_rate_pct: 10,
      start_date: decided, end_date: new Date('2027-11-11T03:00:00Z'),
      authorization_scope: { vehicle_custody: true, rental_contract_signing: true, listing_management: true, booking_management: true, owner_confirmation_per_booking: false, commission_basis: 'rental_fee_excluding_security_deposit' },
      signature_info: { method: 'offline_paper', owner_signed_at: decided, platform_signed_at: decided },
      created_at: decided, updated_at: decided,
    });
    if (scenario.report !== 'draft') add('audit_logs', {
      _id: id('12', 33 + index), actor_user_id: garage, action: 'vehicle.inspection.submitted',
      entity_type: 'vehicle_inspection', entity_id: inspectionId,
      sanitized_changes: { vehicle_id: String(vehicleId), recommendation: scenario.recommendation }, created_at: submitted,
    });
    if (finished) add('audit_logs', {
      _id: id('12', 49 + index), actor_user_id: manager,
      action: `vehicle.inspection.${index === 2 ? 'revision' : 'approve'}`, entity_type: 'vehicle_inspection', entity_id: inspectionId,
      sanitized_changes: { vehicle_id: String(vehicleId), note: scenario.note }, created_at: decided,
    });
  });
  return datasets.map((set) => ({ ...set, documents: byName[set.name] }));
}
