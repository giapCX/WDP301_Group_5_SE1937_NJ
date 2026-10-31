import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { createAuthMiddleware } from './auth.js';

const STAFF_ROLES = ['MANAGER', 'OPERATION_STAFF', 'GARAGE_STAFF', 'ADMIN'];
const OPEN_INCIDENT_STATUSES = ['reported', 'open', 'investigating', 'pending_review', 'awaiting_response'];
const dayStart = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const toId = (value) => ObjectId.isValid(value) ? new ObjectId(value) : null;
const managerId = (request) => new ObjectId(request.tokenPayload.sub);

async function writeAudit(database, request, action, entityType, entityId, changes = {}) {
  await database.collection('audit_logs').insertOne({
    actor_user_id: managerId(request), action, entity_type: entityType, entity_id: entityId,
    sanitized_changes: changes, ip_address_masked: null, created_at: new Date(),
  });
}

function canViewDashboard(database) {
  return async (request, response, next) => {
    const roleIds = [request.user.primary_role_id, ...(request.user.additional_role_ids || [])].filter(Boolean);
    const currentRoles = roleIds.length
      ? await database.collection('roles').find({ _id: { $in: roleIds } }).project({ code: 1 }).toArray()
      : [];
    const roleCodes = currentRoles.map((role) => role.code);
    if (!roleCodes.includes('MANAGER') && !roleCodes.includes('ADMIN')) {
      return response.status(403).json({ error: { message: 'Bạn không có quyền xem trang quản lý.' } });
    }
    request.currentRoles = roleCodes;
    return next();
  };
}

function formatRequest(item, kind) {
  const createdAt = item.created_at || item.updated_at || new Date(0);
  const isVehicle = kind === 'vehicle';
  return {
    id: item._id.toString(),
    code: isVehicle ? `XE-${item.license_plate || item._id.toString().slice(-6)}` : item.case_number,
    title: isVehicle
      ? `${item.brand || ''} ${item.model || ''} ${item.manufacture_year || ''}`.trim() || 'Hồ sơ xe mới'
      : `Yêu cầu sự cố ${item.case_number}`,
    type: isVehicle ? 'Hồ sơ xe mới' : 'Khiếu nại & sự cố',
    owner: item.owner_name || 'Chưa cập nhật người gửi',
    createdAt,
    status: item.onboarding_status || item.status,
  };
}

export function createManagerRouter(database) {
  const router = Router();
  router.use(createAuthMiddleware(database), canViewDashboard(database));

  router.get('/dashboard', async (request, response) => {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const period = ['30d', 'month'].includes(request.query.period) ? request.query.period : '7d';
    const numberOfDays = period === 'month' ? today.getDate() : period === '30d' ? 30 : 7;
    const periodStart = period === 'month' ? monthStart : dayStart(today);
    if (period !== 'month') periodStart.setDate(periodStart.getDate() - numberOfDays + 1);
    const seriesStart = new Date(periodStart);

    const vehicles = database.collection('vehicles');
    const listings = database.collection('vehicle_listings');
    const incidents = database.collection('incident_cases');
    const settlements = database.collection('owner_settlements');
    const auditLogs = database.collection('audit_logs');
    const users = database.collection('users');
    const roles = database.collection('roles');

    const [activeVehicles, pendingVehicleCount, openIncidents, approvedSettlements, monthSettlements,
      roleDocs, requestVehicles, requestIncidents, recentLogs] = await Promise.all([
      listings.countDocuments({ status: 'published' }),
      vehicles.countDocuments({ onboarding_status: { $in: ['submitted', 'pending_review'] } }),
      incidents.countDocuments({ status: { $in: OPEN_INCIDENT_STATUSES } }),
      settlements.find({ settled_at: { $gte: seriesStart }, payout_status: 'paid' })
        .project({ settled_at: 1, platform_commission: 1 }).toArray(),
      settlements.find({ settled_at: { $gte: monthStart }, payout_status: 'paid' })
        .project({ platform_commission: 1 }).toArray(),
      roles.find({ code: { $in: STAFF_ROLES } }).project({ _id: 1 }).toArray(),
      vehicles.find({ onboarding_status: { $in: ['submitted', 'pending_review'] } })
        .sort({ created_at: -1 }).limit(10).toArray(),
      incidents.find({ status: { $in: OPEN_INCIDENT_STATUSES } })
        .sort({ updated_at: -1, created_at: -1 }).limit(10).toArray(),
      auditLogs.find({}).sort({ created_at: -1 }).limit(6).toArray(),
    ]);

    const ownerIds = requestVehicles.map((vehicle) => vehicle.owner_id).filter(Boolean);
    const reporterIds = requestIncidents.map((incident) => incident.reported_by_user_id).filter(Boolean);
    const actorIds = recentLogs.map((log) => log.actor_user_id).filter(Boolean);
    const peopleIds = [...new Map([...ownerIds, ...reporterIds, ...actorIds].map((id) => [id.toString(), id])).values()];
    const people = peopleIds.length
      ? await users.find({ _id: { $in: peopleIds } }).project({ full_name: 1 }).toArray()
      : [];
    const personNames = new Map(people.map((person) => [person._id.toString(), person.full_name]));
    const pending = requestVehicles.map((vehicle) => ({
      ...vehicle,
      owner_name: personNames.get(vehicle.owner_id?.toString()),
    })).map((vehicle) => formatRequest(vehicle, 'vehicle'));
    const cases = requestIncidents.map((incident) => ({
      ...incident,
      owner_name: personNames.get(incident.reported_by_user_id?.toString()),
    })).map((incident) => formatRequest(incident, 'incident'));
    const dashboardRequests = [...pending, ...cases]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);

    const daily = Array.from({ length: numberOfDays }, (_, index) => {
      const date = new Date(seriesStart);
      date.setDate(date.getDate() + index);
      return { date: date.toISOString().slice(0, 10), amount: 0 };
    });
    const seriesByDate = new Map(daily.map((item) => [item.date, item]));
    for (const settlement of approvedSettlements) {
      if (!settlement.settled_at) continue;
      const key = dayStart(new Date(settlement.settled_at)).toISOString().slice(0, 10);
      const point = seriesByDate.get(key);
      if (point) point.amount += Number(settlement.platform_commission) || 0;
    }

    const activities = recentLogs.map((log) => ({
      id: log._id.toString(),
      action: log.action || 'system.activity',
      entityType: log.entity_type || 'system',
      entityId: log.entity_id?.toString() || null,
      actor: personNames.get(log.actor_user_id?.toString()) || 'Hệ thống',
      createdAt: log.created_at || null,
    }));

    const staffRoleIds = roleDocs.map((role) => role._id);
    const [staffCount, lastPeriodSettlements] = await Promise.all([
      staffRoleIds.length
        ? users.countDocuments({ account_status: 'active', $or: [
            { primary_role_id: { $in: staffRoleIds } },
            { additional_role_ids: { $in: staffRoleIds } },
          ] })
        : 0,
      settlements.find({ settled_at: { $gte: new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1), $lt: monthStart }, payout_status: 'paid' })
        .project({ platform_commission: 1 }).toArray(),
    ]);

    const monthRevenue = monthSettlements.reduce((total, item) => total + (Number(item.platform_commission) || 0), 0);
    const previousRevenue = lastPeriodSettlements.reduce((total, item) => total + (Number(item.platform_commission) || 0), 0);
    const changePercent = previousRevenue ? Math.round(((monthRevenue - previousRevenue) / previousRevenue) * 1000) / 10 : null;

    return response.json({ data: {
      period,
      metrics: {
        activeVehicles,
        pendingVehicles: pendingVehicleCount,
        openIncidents,
        monthlyPlatformRevenue: monthRevenue,
        staffCount,
        revenueChangePercent: changePercent,
      },
      revenue: { total: daily.reduce((total, item) => total + item.amount, 0), series: daily },
      requests: dashboardRequests,
      activities,
    } });
  });

  router.get('/vehicles', async (request, response) => {
    const status = request.query.status || 'pending';
    const match = status === 'all' ? {} : { onboarding_status: status === 'pending' ? { $in: ['submitted', 'pending_review'] } : status };
    const items = await database.collection('vehicles').find(match).sort({ updated_at: -1 }).limit(200).toArray();
    const owners = [...new Set(items.map((item) => item.owner_id?.toString()).filter(Boolean))].map((id) => new ObjectId(id));
    const ownerRows = owners.length ? await database.collection('users').find({ _id: { $in: owners } }).project({ full_name: 1, email: 1 }).toArray() : [];
    const ownerMap = new Map(ownerRows.map((owner) => [owner._id.toString(), owner]));
    const itemIds = items.map((item) => item._id);
    const inspections = itemIds.length ? await database.collection('vehicle_inspections').find({ vehicle_id: { $in: itemIds } }).sort({ inspected_at: -1 }).toArray() : [];
    const inspectionMap = new Map();
    for (const inspection of inspections) if (!inspectionMap.has(inspection.vehicle_id.toString())) inspectionMap.set(inspection.vehicle_id.toString(), inspection);
    return response.json({ data: items.map((item) => ({
      id: item._id.toString(), licensePlate: item.license_plate, brand: item.brand, model: item.model,
      year: item.manufacture_year, seats: item.seats, fuelType: item.fuel_type, transmission: item.transmission,
      physicalStatus: item.physical_status, status: item.onboarding_status, documents: item.documents || {},
      inspection: inspectionMap.get(item._id.toString()) ? {
        status: inspectionMap.get(item._id.toString()).approval_status,
        recommendation: inspectionMap.get(item._id.toString()).recommendation,
        inspectedAt: inspectionMap.get(item._id.toString()).inspected_at,
      } : null,
      owner: ownerMap.get(item.owner_id?.toString()) || null, createdAt: item.created_at, updatedAt: item.updated_at,
    })) });
  });

  router.patch('/vehicles/:id/review', async (request, response) => {
    const id = toId(request.params.id);
    const { action, note = '' } = request.body || {};
    const statuses = { approve: 'approved', reject: 'rejected', revision: 'revision_required' };
    if (!id || !statuses[action] || typeof note !== 'string' || note.length > 1000) {
      return response.status(400).json({ error: { message: 'Thông tin duyệt xe không hợp lệ.' } });
    }
    if (action === 'approve') {
      const approvalPolicy = await database.collection('platform_policies').findOne({ policy_type: 'vehicle_approval', status: 'active' });
      if (approvalPolicy?.config?.inspection_report_required) {
        const inspection = await database.collection('vehicle_inspections').findOne({ vehicle_id: id, approval_status: 'approved', recommendation: 'pass' });
        if (!inspection) return response.status(409).json({ error: { message: 'Cần có biên bản kiểm định đạt yêu cầu trước khi duyệt xe.' } });
      }
    }
    const result = await database.collection('vehicles').updateOne(
      { _id: id, onboarding_status: { $in: ['submitted', 'pending_review'] } },
      { $set: { onboarding_status: statuses[action], updated_at: new Date(), reviewed_by_manager_id: managerId(request), review_note: note.trim() },
        $push: { registration_history: { action: statuses[action], by_user_id: managerId(request), at: new Date(), note: note.trim() } } },
    );
    if (!result.modifiedCount) return response.status(409).json({ error: { message: 'Hồ sơ xe không còn ở trạng thái chờ duyệt.' } });
    await writeAudit(database, request, `vehicle.${action}`, 'vehicles', id, { status: statuses[action], note: note.trim() });
    return response.json({ data: { id: id.toString(), status: statuses[action] } });
  });

  router.get('/incidents', async (request, response) => {
    const status = request.query.status || 'open';
    const match = status === 'all' ? {} : { status: status === 'open' ? { $in: OPEN_INCIDENT_STATUSES } : status };
    const items = await database.collection('incident_cases').find(match).sort({ updated_at: -1 }).limit(200).toArray();
    return response.json({ data: items.map((item) => ({
      id: item._id.toString(), caseNumber: item.case_number, caseType: item.case_type, status: item.status,
      description: item.description, investigation: item.investigation || {}, trafficViolation: item.traffic_violation_details || null,
      compensationClaims: item.compensation_claims || [], evidence: item.evidence || [], bookingId: item.booking_id?.toString(),
      vehicleId: item.vehicle_id?.toString(), createdAt: item.created_at, updatedAt: item.updated_at,
    })) });
  });

  router.patch('/incidents/:id/compensation', async (request, response) => {
    const id = toId(request.params.id);
    const { decision, amount, note = '' } = request.body || {};
    if (!id || !['approve', 'reject'].includes(decision) || typeof note !== 'string' || note.length > 1000 ||
      (decision === 'approve' && (!Number.isSafeInteger(amount) || amount < 0))) {
      return response.status(400).json({ error: { message: 'Thông tin xử lý bồi thường không hợp lệ.' } });
    }
    const cases = database.collection('incident_cases');
    const incident = await cases.findOne({ _id: id, status: { $in: OPEN_INCIDENT_STATUSES } });
    if (!incident) return response.status(404).json({ error: { message: 'Không tìm thấy sự cố đang mở.' } });
    const claims = incident.compensation_claims || [];
    const claimIndex = claims.findIndex((claim) => !claim.decision || claim.decision === 'pending');
    if (claimIndex < 0) return response.status(409).json({ error: { message: 'Sự cố này không có yêu cầu bồi thường đang chờ.' } });
    if (decision === 'approve' && Number.isFinite(Number(claims[claimIndex].requested_amount)) && amount > claims[claimIndex].requested_amount) {
      return response.status(400).json({ error: { message: 'Số tiền duyệt không được vượt quá số tiền yêu cầu.' } });
    }
    const now = new Date();
    const nextClaim = { ...claims[claimIndex], decision: decision === 'approve' ? 'approved' : 'rejected',
      approved_amount: decision === 'approve' ? amount : 0, decision_at: now, reviewed_by_manager_id: managerId(request), manager_note: note.trim() };
    claims[claimIndex] = nextClaim;
    const allDecided = claims.every((claim) => claim.decision && claim.decision !== 'pending');
    await cases.updateOne({ _id: id }, { $set: {
      compensation_claims: claims, reviewed_by_manager_id: managerId(request), updated_at: now,
      ...(allDecided ? { status: 'resolved', resolution: { outcome: decision === 'approve' ? 'compensation_approved' : 'compensation_rejected', amount: decision === 'approve' ? amount : 0, note: note.trim(), resolved_at: now } } : {}),
    } });
    await writeAudit(database, request, `compensation.${decision}`, 'incident_cases', id, { amount: decision === 'approve' ? amount : 0, note: note.trim() });
    return response.json({ data: { id: id.toString(), decision: nextClaim.decision, status: allDecided ? 'resolved' : incident.status } });
  });

  router.patch('/incidents/:id/review', async (request, response) => {
    const id = toId(request.params.id);
    const { action, note = '' } = request.body || {};
    if (!id || action !== 'resolve' || typeof note !== 'string' || !note.trim() || note.length > 1000) {
      return response.status(400).json({ error: { message: 'Vui lòng nhập ghi chú kết luận sự cố.' } });
    }
    const result = await database.collection('incident_cases').updateOne(
      { _id: id, status: { $in: OPEN_INCIDENT_STATUSES }, compensation_claims: { $not: { $elemMatch: { decision: { $in: ['pending', null] } } } } },
      { $set: { status: 'resolved', reviewed_by_manager_id: managerId(request), updated_at: new Date(),
        resolution: { outcome: 'manager_resolved', note: note.trim(), resolved_at: new Date() } } },
    );
    if (!result.modifiedCount) return response.status(409).json({ error: { message: 'Sự cố đã đóng hoặc còn yêu cầu bồi thường chờ quyết định.' } });
    await writeAudit(database, request, 'incident.resolve', 'incident_cases', id, { note: note.trim() });
    return response.json({ data: { id: id.toString(), status: 'resolved' } });
  });

  router.get('/policies', async (_request, response) => {
    const data = await database.collection('platform_policies').find({ status: 'active' }).sort({ policy_type: 1 }).toArray();
    return response.json({ data: data.map((item) => ({ id: item._id.toString(), type: item.policy_type, version: item.version, config: item.config, effectiveFrom: item.effective_from })) });
  });

  router.put('/policies/:type', async (request, response) => {
    const type = request.params.type;
    const config = request.body?.config;
    const allowed = ['commission_default', 'cancellation', 'deposit_refund', 'late_return', 'mileage', 'damage_handling', 'traffic_violation', 'withdrawal', 'vehicle_approval', 'listing_publication'];
    if (!allowed.includes(type) || !config || typeof config !== 'object' || Array.isArray(config)) {
      return response.status(400).json({ error: { message: 'Loại hoặc cấu hình chính sách không hợp lệ.' } });
    }
    const numericValues = Object.values(config).filter((value) => typeof value === 'number');
    if (numericValues.some((value) => !Number.isFinite(value) || value < 0) ||
      (type === 'commission_default' && (config.default_commission_pct < 0 || config.default_commission_pct > 100))) {
      return response.status(400).json({ error: { message: 'Giá trị chính sách nằm ngoài giới hạn cho phép.' } });
    }
    const policies = database.collection('platform_policies');
    const now = new Date();
    const previous = await policies.find({ policy_type: type, status: 'active' }).sort({ version: -1 }).limit(1).next();
    const version = (previous?.version || 0) + 1;
    await policies.updateMany({ policy_type: type, status: 'active' }, { $set: { status: 'superseded', effective_until: now } });
    const inserted = await policies.insertOne({ policy_type: type, version, config, effective_from: now, effective_until: null,
      updated_by_manager_id: managerId(request), status: 'active', created_at: now });
    await writeAudit(database, request, 'policy.update', 'platform_policies', inserted.insertedId, { policy_type: type, version });
    return response.status(201).json({ data: { id: inserted.insertedId.toString(), type, version, config, effectiveFrom: now } });
  });

  router.get('/staff', async (_request, response) => {
    const roleRows = await database.collection('roles').find({ code: { $in: STAFF_ROLES } }).toArray();
    const roleById = new Map(roleRows.map((role) => [role._id.toString(), role]));
    const roleIds = roleRows.map((role) => role._id);
    const staff = await database.collection('users').find({ $or: [
      { primary_role_id: { $in: roleIds } }, { additional_role_ids: { $in: roleIds } },
    ] }).project({ full_name: 1, email: 1, phone: 1, account_status: 1, primary_role_id: 1, created_at: 1 }).sort({ full_name: 1 }).toArray();
    return response.json({ data: staff.map((user) => ({ id: user._id.toString(), name: user.full_name, email: user.email,
      phone: user.phone, status: user.account_status, role: roleById.get(user.primary_role_id?.toString())?.code || 'STAFF', createdAt: user.created_at })) });
  });

  router.patch('/staff/:id', async (request, response) => {
    const id = toId(request.params.id);
    const { status, role } = request.body || {};
    const set = { updated_at: new Date() };
    if (status !== undefined) {
      if (!['active', 'suspended'].includes(status)) return response.status(400).json({ error: { message: 'Trạng thái nhân sự không hợp lệ.' } });
      if (id?.equals(managerId(request)) && status !== 'active') return response.status(400).json({ error: { message: 'Không thể tự khóa tài khoản đang đăng nhập.' } });
      set.account_status = status;
    }
    if (role !== undefined) {
      if (!STAFF_ROLES.includes(role) || role === 'ADMIN') return response.status(400).json({ error: { message: 'Vai trò nhân sự không hợp lệ.' } });
      if (id?.equals(managerId(request)) && role !== 'MANAGER') return response.status(400).json({ error: { message: 'Không thể tự hạ quyền tài khoản quản lý đang đăng nhập.' } });
      const roleDoc = await database.collection('roles').findOne({ code: role });
      if (!roleDoc) return response.status(400).json({ error: { message: 'Không tìm thấy vai trò được chọn.' } });
      set.primary_role_id = roleDoc._id;
    }
    if (!id || Object.keys(set).length === 1) return response.status(400).json({ error: { message: 'Vui lòng cung cấp thông tin cần cập nhật.' } });
    const result = await database.collection('users').updateOne({ _id: id }, { $set: set });
    if (!result.matchedCount) return response.status(404).json({ error: { message: 'Không tìm thấy nhân sự.' } });
    await writeAudit(database, request, 'staff.update', 'users', id, { ...(status ? { account_status: status } : {}), ...(role ? { role } : {}) });
    return response.json({ data: { id: id.toString(), ...(status ? { status } : {}), ...(role ? { role } : {}) } });
  });

  router.get('/reports/inspections', async (request, response) => {
    const filter = {};
    if (request.query.from || request.query.to) {
      filter.inspected_at = {};
      if (request.query.from && !Number.isNaN(Date.parse(request.query.from))) filter.inspected_at.$gte = new Date(request.query.from);
      if (request.query.to && !Number.isNaN(Date.parse(request.query.to))) {
        filter.inspected_at.$lte = new Date(request.query.to);
        if (request.query.to.length === 10) filter.inspected_at.$lte.setHours(23, 59, 59, 999);
      }
    }
    const data = await database.collection('vehicle_inspections').find(filter).sort({ inspected_at: -1 }).limit(200).toArray();
    const vehicleIds = [...new Map(data.map((row) => row.vehicle_id).filter(Boolean).map((id) => [id.toString(), id])).values()];
    const vehicles = vehicleIds.length ? await database.collection('vehicles').find({ _id: { $in: vehicleIds } }).project({ brand: 1, model: 1, license_plate: 1 }).toArray() : [];
    const map = new Map(vehicles.map((vehicle) => [vehicle._id.toString(), vehicle]));
    return response.json({ data: data.map((row) => ({ id: row._id.toString(), inspectedAt: row.inspected_at,
      result: row.approval_status || row.result || row.inspection_result || row.status || row.recommendation || 'completed',
      notes: row.decision_reason || row.notes || Object.values(row.condition_report || {}).filter((value) => typeof value === 'string').join(', '),
      vehicle: map.get(row.vehicle_id?.toString()) || null })) });
  });

  router.get('/reports/finance', async (request, response) => {
    const from = request.query.from ? new Date(request.query.from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = request.query.to ? new Date(request.query.to) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      return response.status(400).json({ error: { message: 'Khoảng ngày báo cáo không hợp lệ.' } });
    }
    if (request.query.to?.length === 10) to.setHours(23, 59, 59, 999);
    const rows = await database.collection('owner_settlements').find({ settled_at: { $gte: from, $lte: to }, payout_status: 'paid' })
      .project({ settled_at: 1, gross_rental_revenue: 1, platform_commission: 1, net_owner_payout: 1 }).sort({ settled_at: 1 }).toArray();
    const totals = rows.reduce((result, item) => ({
      grossRentalRevenue: result.grossRentalRevenue + (Number(item.gross_rental_revenue) || 0),
      platformCommission: result.platformCommission + (Number(item.platform_commission) || 0),
      ownerPayout: result.ownerPayout + (Number(item.net_owner_payout) || 0),
    }), { grossRentalRevenue: 0, platformCommission: 0, ownerPayout: 0 });
    return response.json({ data: { from, to, totals, settlements: rows.map((item) => ({
      date: item.settled_at, grossRentalRevenue: item.gross_rental_revenue || 0,
      platformCommission: item.platform_commission || 0, ownerPayout: item.net_owner_payout || 0,
    })) } });
  });

  return router;
}
