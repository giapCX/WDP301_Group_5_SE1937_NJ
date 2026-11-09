import { httpError } from '../utils/http-error.js';
import { Types } from 'mongoose';
const {
  ObjectId
} = Types;
const STAFF_ROLES = ['MANAGER', 'OPERATION_STAFF', 'GARAGE_STAFF', 'ADMIN'];
const OPEN_INCIDENT_STATUSES = ['reported', 'open', 'investigating', 'pending_review', 'awaiting_response'];
const dayStart = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const toId = value => ObjectId.isValid(value) ? new ObjectId(value) : null;
function formatRequest(item, kind) {
  const createdAt = item.created_at || item.updated_at || new Date(0);
  const isVehicle = kind === 'vehicle';
  return {
    id: item._id.toString(),
    code: isVehicle ? `XE-${item.license_plate || item._id.toString().slice(-6)}` : item.case_number,
    title: isVehicle ? `${item.brand || ''} ${item.model || ''} ${item.manufacture_year || ''}`.trim() || 'Hồ sơ xe mới' : `Yêu cầu sự cố ${item.case_number}`,
    type: isVehicle ? 'Hồ sơ xe mới' : 'Khiếu nại & sự cố',
    owner: item.owner_name || 'Chưa cập nhật người gửi',
    createdAt,
    status: item.onboarding_status || item.status
  };
}
export function createManagerService(repository) {
  async function writeAudit(actorId, action, entityType, entityId, changes = {}) {
    await repository.auditLogs.create({
      actor_user_id: actorId, action, entity_type: entityType, entity_id: entityId,
      sanitized_changes: changes, ip_address_masked: null, created_at: new Date(),
    });
  }
  return {
    async authorizeDashboard(user) {
      const roleIds = [user.primary_role_id, ...(user.additional_role_ids || [])].filter(Boolean);
      const rows = roleIds.length
        ? await repository.roles.find({ _id: { $in: roleIds } }).select({ code: 1 }).exec()
        : [];
      const codes = rows.map(({ code }) => code);
      if (!codes.includes('MANAGER') && !codes.includes('ADMIN')) {
        throw httpError(403, 'Bạn không có quyền xem trang quản lý.');
      }
      return codes;
    },
    dashboard: async input => {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const period = ['30d', 'month'].includes(input.query.period) ? input.query.period : '7d';
      const numberOfDays = period === 'month' ? today.getDate() : period === '30d' ? 30 : 7;
      const periodStart = period === 'month' ? monthStart : dayStart(today);
      if (period !== 'month') periodStart.setDate(periodStart.getDate() - numberOfDays + 1);
      const seriesStart = new Date(periodStart);
      const vehicles = repository.vehicles;
      const listings = repository.listings;
      const incidents = repository.incidents;
      const settlements = repository.settlements;
      const auditLogs = repository.auditLogs;
      const users = repository.users;
      const roles = repository.roles;
      const [activeVehicles, pendingVehicleCount, openIncidents, approvedSettlements, monthSettlements, roleDocs, requestVehicles, requestIncidents, recentLogs] = await Promise.all([listings.countDocuments({
        status: 'published'
      }), vehicles.countDocuments({
        onboarding_status: {
          $in: ['submitted', 'pending_review']
        }
      }), incidents.countDocuments({
        status: {
          $in: OPEN_INCIDENT_STATUSES
        }
      }), settlements.find({
        settled_at: {
          $gte: seriesStart
        },
        payout_status: 'paid'
      }).select({
        settled_at: 1,
        platform_commission: 1
      }).exec(), settlements.find({
        settled_at: {
          $gte: monthStart
        },
        payout_status: 'paid'
      }).select({
        platform_commission: 1
      }).exec(), roles.find({
        code: {
          $in: STAFF_ROLES
        }
      }).select({
        _id: 1
      }).exec(), vehicles.find({
        onboarding_status: {
          $in: ['submitted', 'pending_review']
        }
      }).sort({
        created_at: -1
      }).limit(10).exec(), incidents.find({
        status: {
          $in: OPEN_INCIDENT_STATUSES
        }
      }).sort({
        updated_at: -1,
        created_at: -1
      }).limit(10).exec(), auditLogs.find({}).sort({
        created_at: -1
      }).limit(6).exec()]);
      const ownerIds = requestVehicles.map(vehicle => vehicle.owner_id).filter(Boolean);
      const reporterIds = requestIncidents.map(incident => incident.reported_by_user_id).filter(Boolean);
      const actorIds = recentLogs.map(log => log.actor_user_id).filter(Boolean);
      const peopleIds = [...new Map([...ownerIds, ...reporterIds, ...actorIds].map(id => [id.toString(), id])).values()];
      const people = peopleIds.length ? await users.find({
        _id: {
          $in: peopleIds
        }
      }).select({
        full_name: 1
      }).exec() : [];
      const personNames = new Map(people.map(person => [person._id.toString(), person.full_name]));
      const pending = requestVehicles.map(vehicle => ({
        ...vehicle,
        owner_name: personNames.get(vehicle.owner_id?.toString())
      })).map(vehicle => formatRequest(vehicle, 'vehicle'));
      const cases = requestIncidents.map(incident => ({
        ...incident,
        owner_name: personNames.get(incident.reported_by_user_id?.toString())
      })).map(incident => formatRequest(incident, 'incident'));
      const dashboardRequests = [...pending, ...cases].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
      const daily = Array.from({
        length: numberOfDays
      }, (_, index) => {
        const date = new Date(seriesStart);
        date.setDate(date.getDate() + index);
        return {
          date: date.toISOString().slice(0, 10),
          amount: 0
        };
      });
      const seriesByDate = new Map(daily.map(item => [item.date, item]));
      for (const settlement of approvedSettlements) {
        if (!settlement.settled_at) continue;
        const key = dayStart(new Date(settlement.settled_at)).toISOString().slice(0, 10);
        const point = seriesByDate.get(key);
        if (point) point.amount += Number(settlement.platform_commission) || 0;
      }
      const activities = recentLogs.map(log => ({
        id: log._id.toString(),
        action: log.action || 'system.activity',
        entityType: log.entity_type || 'system',
        entityId: log.entity_id?.toString() || null,
        actor: personNames.get(log.actor_user_id?.toString()) || 'Hệ thống',
        createdAt: log.created_at || null
      }));
      const staffRoleIds = roleDocs.map(role => role._id);
      const [staffCount, lastPeriodSettlements] = await Promise.all([staffRoleIds.length ? users.countDocuments({
        account_status: 'active',
        $or: [{
          primary_role_id: {
            $in: staffRoleIds
          }
        }, {
          additional_role_ids: {
            $in: staffRoleIds
          }
        }]
      }) : 0, settlements.find({
        settled_at: {
          $gte: new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1),
          $lt: monthStart
        },
        payout_status: 'paid'
      }).select({
        platform_commission: 1
      }).exec()]);
      const monthRevenue = monthSettlements.reduce((total, item) => total + (Number(item.platform_commission) || 0), 0);
      const previousRevenue = lastPeriodSettlements.reduce((total, item) => total + (Number(item.platform_commission) || 0), 0);
      const changePercent = previousRevenue ? Math.round((monthRevenue - previousRevenue) / previousRevenue * 1000) / 10 : null;
      return {
        data: {
          period,
          metrics: {
            activeVehicles,
            pendingVehicles: pendingVehicleCount,
            openIncidents,
            monthlyPlatformRevenue: monthRevenue,
            staffCount,
            revenueChangePercent: changePercent
          },
          revenue: {
            total: daily.reduce((total, item) => total + item.amount, 0),
            series: daily
          },
          requests: dashboardRequests,
          activities
        }
      };
    },
    vehicles: async input => {
      const status = input.query.status || 'pending';
      const match = status === 'all' ? {} : {
        onboarding_status: status === 'pending' ? {
          $in: ['submitted', 'pending_review']
        } : status
      };
      const items = await repository.vehicles.find(match).sort({
        updated_at: -1
      }).limit(200).exec();
      const owners = [...new Set(items.map(item => item.owner_id?.toString()).filter(Boolean))].map(id => new ObjectId(id));
      const ownerRows = owners.length ? await repository.users.find({
        _id: {
          $in: owners
        }
      }).select({
        full_name: 1,
        email: 1
      }).exec() : [];
      const ownerMap = new Map(ownerRows.map(owner => [owner._id.toString(), owner]));
      const itemIds = items.map(item => item._id);
      const inspections = itemIds.length ? await repository.inspections.find({
        vehicle_id: {
          $in: itemIds
        }
      }).sort({
        inspected_at: -1
      }).exec() : [];
      const inspectionMap = new Map();
      for (const inspection of inspections) if (!inspectionMap.has(inspection.vehicle_id.toString())) inspectionMap.set(inspection.vehicle_id.toString(), inspection);
      return {
        data: items.map(item => ({
          id: item._id.toString(),
          licensePlate: item.license_plate,
          brand: item.brand,
          model: item.model,
          year: item.manufacture_year,
          seats: item.seats,
          fuelType: item.fuel_type,
          transmission: item.transmission,
          physicalStatus: item.physical_status,
          status: item.onboarding_status,
          documents: item.documents || {},
          inspection: inspectionMap.get(item._id.toString()) ? {
            status: inspectionMap.get(item._id.toString()).approval_status,
            recommendation: inspectionMap.get(item._id.toString()).recommendation,
            inspectedAt: inspectionMap.get(item._id.toString()).inspected_at
          } : null,
          owner: ownerMap.get(item.owner_id?.toString()) || null,
          createdAt: item.created_at,
          updatedAt: item.updated_at
        }))
      };
    },
    reviewVehicle: async input => {
      const id = toId(input.id);
      const {
        action,
        note = ''
      } = input.body || {};
      const statuses = {
        approve: 'approved',
        reject: 'rejected',
        revision: 'revision_required'
      };
      if (!id || !statuses[action] || typeof note !== 'string' || note.length > 1000) {
        throw httpError(400, 'Thông tin duyệt xe không hợp lệ.');
      }
      if (action === 'approve') {
        const approvalPolicy = await repository.policies.findOne({
          policy_type: 'vehicle_approval',
          status: 'active'
        });
        if (approvalPolicy?.config?.inspection_report_required) {
          const inspection = await repository.inspections.findOne({
            vehicle_id: id,
            approval_status: 'approved',
            recommendation: 'pass'
          });
          if (!inspection) throw httpError(409, 'Cần có biên bản kiểm định đạt yêu cầu trước khi duyệt xe.');
        }
      }
      const result = await repository.vehicles.updateOne({
        _id: id,
        onboarding_status: {
          $in: ['submitted', 'pending_review']
        }
      }, {
        $set: {
          onboarding_status: statuses[action],
          updated_at: new Date(),
          reviewed_by_manager_id: input.actorId,
          review_note: note.trim()
        },
        $push: {
          registration_history: {
            action: statuses[action],
            by_user_id: input.actorId,
            at: new Date(),
            note: note.trim()
          }
        }
      });
      if (!result.modifiedCount) throw httpError(409, 'Hồ sơ xe không còn ở trạng thái chờ duyệt.');
      await writeAudit(input.actorId, `vehicle.${action}`, 'vehicles', id, {
        status: statuses[action],
        note: note.trim()
      });
      return {
        data: {
          id: id.toString(),
          status: statuses[action]
        }
      };
    },
    incidents: async input => {
      const status = input.query.status || 'open';
      const match = status === 'all' ? {} : {
        status: status === 'open' ? {
          $in: OPEN_INCIDENT_STATUSES
        } : status
      };
      const items = await repository.incidents.find(match).sort({
        updated_at: -1
      }).limit(200).exec();
      return {
        data: items.map(item => ({
          id: item._id.toString(),
          caseNumber: item.case_number,
          caseType: item.case_type,
          status: item.status,
          description: item.description,
          investigation: item.investigation || {},
          trafficViolation: item.traffic_violation_details || null,
          compensationClaims: item.compensation_claims || [],
          evidence: item.evidence || [],
          bookingId: item.booking_id?.toString(),
          vehicleId: item.vehicle_id?.toString(),
          createdAt: item.created_at,
          updatedAt: item.updated_at
        }))
      };
    },
    reviewCompensation: async input => {
      const id = toId(input.id);
      const {
        decision,
        amount,
        note = ''
      } = input.body || {};
      if (!id || !['approve', 'reject'].includes(decision) || typeof note !== 'string' || note.length > 1000 || decision === 'approve' && (!Number.isSafeInteger(amount) || amount < 0)) {
        throw httpError(400, 'Thông tin xử lý bồi thường không hợp lệ.');
      }
      const cases = repository.incidents;
      const incident = await cases.findOne({
        _id: id,
        status: {
          $in: OPEN_INCIDENT_STATUSES
        }
      });
      if (!incident) throw httpError(404, 'Không tìm thấy sự cố đang mở.');
      const claims = incident.compensation_claims || [];
      const claimIndex = claims.findIndex(claim => !claim.decision || claim.decision === 'pending');
      if (claimIndex < 0) throw httpError(409, 'Sự cố này không có yêu cầu bồi thường đang chờ.');
      if (decision === 'approve' && Number.isFinite(Number(claims[claimIndex].requested_amount)) && amount > claims[claimIndex].requested_amount) {
        throw httpError(400, 'Số tiền duyệt không được vượt quá số tiền yêu cầu.');
      }
      const now = new Date();
      const nextClaim = {
        ...claims[claimIndex],
        decision: decision === 'approve' ? 'approved' : 'rejected',
        approved_amount: decision === 'approve' ? amount : 0,
        decision_at: now,
        reviewed_by_manager_id: input.actorId,
        manager_note: note.trim()
      };
      claims[claimIndex] = nextClaim;
      const allDecided = claims.every(claim => claim.decision && claim.decision !== 'pending');
      await cases.updateOne({
        _id: id
      }, {
        $set: {
          compensation_claims: claims,
          reviewed_by_manager_id: input.actorId,
          updated_at: now,
          ...(allDecided ? {
            status: 'resolved',
            resolution: {
              outcome: decision === 'approve' ? 'compensation_approved' : 'compensation_rejected',
              amount: decision === 'approve' ? amount : 0,
              note: note.trim(),
              resolved_at: now
            }
          } : {})
        }
      });
      await writeAudit(input.actorId, `compensation.${decision}`, 'incident_cases', id, {
        amount: decision === 'approve' ? amount : 0,
        note: note.trim()
      });
      return {
        data: {
          id: id.toString(),
          decision: nextClaim.decision,
          status: allDecided ? 'resolved' : incident.status
        }
      };
    },
    reviewIncident: async input => {
      const id = toId(input.id);
      const {
        action,
        note = ''
      } = input.body || {};
      if (!id || action !== 'resolve' || typeof note !== 'string' || !note.trim() || note.length > 1000) {
        throw httpError(400, 'Vui lòng nhập ghi chú kết luận sự cố.');
      }
      const result = await repository.incidents.updateOne({
        _id: id,
        status: {
          $in: OPEN_INCIDENT_STATUSES
        },
        compensation_claims: {
          $not: {
            $elemMatch: {
              decision: {
                $in: ['pending', null]
              }
            }
          }
        }
      }, {
        $set: {
          status: 'resolved',
          reviewed_by_manager_id: input.actorId,
          updated_at: new Date(),
          resolution: {
            outcome: 'manager_resolved',
            note: note.trim(),
            resolved_at: new Date()
          }
        }
      });
      if (!result.modifiedCount) throw httpError(409, 'Sự cố đã đóng hoặc còn yêu cầu bồi thường chờ quyết định.');
      await writeAudit(input.actorId, 'incident.resolve', 'incident_cases', id, {
        note: note.trim()
      });
      return {
        data: {
          id: id.toString(),
          status: 'resolved'
        }
      };
    },
    policies: async input => {
      const data = await repository.policies.find({
        status: 'active'
      }).sort({
        policy_type: 1
      }).exec();
      return {
        data: data.map(item => ({
          id: item._id.toString(),
          type: item.policy_type,
          version: item.version,
          config: item.config,
          effectiveFrom: item.effective_from
        }))
      };
    },
    updatePolicy: async input => {
      const type = input.type;
      const config = input.body?.config;
      const allowed = ['commission_default', 'cancellation', 'deposit_refund', 'late_return', 'mileage', 'damage_handling', 'traffic_violation', 'withdrawal', 'vehicle_approval', 'listing_publication'];
      if (!allowed.includes(type) || !config || typeof config !== 'object' || Array.isArray(config)) {
        throw httpError(400, 'Loại hoặc cấu hình chính sách không hợp lệ.');
      }
      const numericValues = Object.values(config).filter(value => typeof value === 'number');
      if (numericValues.some(value => !Number.isFinite(value) || value < 0) || type === 'commission_default' && (config.default_commission_pct < 0 || config.default_commission_pct > 100)) {
        throw httpError(400, 'Giá trị chính sách nằm ngoài giới hạn cho phép.');
      }
      const policies = repository.policies;
      const now = new Date();
      const previous = await policies.findOne({
        policy_type: type,
        status: 'active'
      }, {
        sort: {
          version: -1
        }
      });
      const version = (previous?.version || 0) + 1;
      await policies.updateMany({
        policy_type: type,
        status: 'active'
      }, {
        $set: {
          status: 'superseded',
          effective_until: now
        }
      });
      const inserted = await policies.create({
        policy_type: type,
        version,
        config,
        effective_from: now,
        effective_until: null,
        updated_by_manager_id: input.actorId,
        status: 'active',
        created_at: now
      });
      await writeAudit(input.actorId, 'policy.update', 'platform_policies', inserted._id, {
        policy_type: type,
        version
      });
      return {
        data: {
          id: inserted._id.toString(),
          type,
          version,
          config,
          effectiveFrom: now
        }
      };
    },
    staff: async input => {
      const roleRows = await repository.roles.find({
        code: {
          $in: STAFF_ROLES
        }
      }).exec();
      const roleById = new Map(roleRows.map(role => [role._id.toString(), role]));
      const roleIds = roleRows.map(role => role._id);
      const staff = await repository.users.find({
        $or: [{
          primary_role_id: {
            $in: roleIds
          }
        }, {
          additional_role_ids: {
            $in: roleIds
          }
        }]
      }).select({
        full_name: 1,
        email: 1,
        phone: 1,
        account_status: 1,
        primary_role_id: 1,
        created_at: 1
      }).sort({
        full_name: 1
      }).exec();
      return {
        data: staff.map(user => ({
          id: user._id.toString(),
          name: user.full_name,
          email: user.email,
          phone: user.phone,
          status: user.account_status,
          role: roleById.get(user.primary_role_id?.toString())?.code || 'STAFF',
          createdAt: user.created_at
        }))
      };
    },
    updateStaff: async input => {
      const id = toId(input.id);
      const {
        status,
        role
      } = input.body || {};
      const set = {
        updated_at: new Date()
      };
      if (status !== undefined) {
        if (!['active', 'suspended'].includes(status)) throw httpError(400, 'Trạng thái nhân sự không hợp lệ.');
        if (id?.equals(input.actorId) && status !== 'active') throw httpError(400, 'Không thể tự khóa tài khoản đang đăng nhập.');
        set.account_status = status;
      }
      if (role !== undefined) {
        if (!STAFF_ROLES.includes(role) || role === 'ADMIN') throw httpError(400, 'Vai trò nhân sự không hợp lệ.');
        if (id?.equals(input.actorId) && role !== 'MANAGER') throw httpError(400, 'Không thể tự hạ quyền tài khoản quản lý đang đăng nhập.');
        const roleDoc = await repository.roles.findOne({
          code: role
        });
        if (!roleDoc) throw httpError(400, 'Không tìm thấy vai trò được chọn.');
        set.primary_role_id = roleDoc._id;
      }
      if (!id || Object.keys(set).length === 1) throw httpError(400, 'Vui lòng cung cấp thông tin cần cập nhật.');
      const result = await repository.users.updateOne({
        _id: id
      }, {
        $set: set
      });
      if (!result.matchedCount) throw httpError(404, 'Không tìm thấy nhân sự.');
      await writeAudit(input.actorId, 'staff.update', 'users', id, {
        ...(status ? {
          account_status: status
        } : {}),
        ...(role ? {
          role
        } : {})
      });
      return {
        data: {
          id: id.toString(),
          ...(status ? {
            status
          } : {}),
          ...(role ? {
            role
          } : {})
        }
      };
    },
    inspectionReport: async input => {
      const filter = {};
      if (input.query.from || input.query.to) {
        filter.inspected_at = {};
        if (input.query.from && !Number.isNaN(Date.parse(input.query.from))) filter.inspected_at.$gte = new Date(input.query.from);
        if (input.query.to && !Number.isNaN(Date.parse(input.query.to))) {
          filter.inspected_at.$lte = new Date(input.query.to);
          if (input.query.to.length === 10) filter.inspected_at.$lte.setHours(23, 59, 59, 999);
        }
      }
      const data = await repository.inspections.find(filter).sort({
        inspected_at: -1
      }).limit(200).exec();
      const vehicleIds = [...new Map(data.map(row => row.vehicle_id).filter(Boolean).map(id => [id.toString(), id])).values()];
      const vehicles = vehicleIds.length ? await repository.vehicles.find({
        _id: {
          $in: vehicleIds
        }
      }).select({
        brand: 1,
        model: 1,
        license_plate: 1
      }).exec() : [];
      const map = new Map(vehicles.map(vehicle => [vehicle._id.toString(), vehicle]));
      return {
        data: data.map(row => ({
          id: row._id.toString(),
          inspectedAt: row.inspected_at,
          result: row.approval_status || row.result || row.inspection_result || row.status || row.recommendation || 'completed',
          notes: row.decision_reason || row.notes || Object.values(row.condition_report || {}).filter(value => typeof value === 'string').join(', '),
          vehicle: map.get(row.vehicle_id?.toString()) || null
        }))
      };
    },
    financeReport: async input => {
      const from = input.query.from ? new Date(input.query.from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const to = input.query.to ? new Date(input.query.to) : new Date();
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
        throw httpError(400, 'Khoảng ngày báo cáo không hợp lệ.');
      }
      if (input.query.to?.length === 10) to.setHours(23, 59, 59, 999);
      const rows = await repository.settlements.find({
        settled_at: {
          $gte: from,
          $lte: to
        },
        payout_status: 'paid'
      }).select({
        settled_at: 1,
        gross_rental_revenue: 1,
        platform_commission: 1,
        net_owner_payout: 1
      }).sort({
        settled_at: 1
      }).exec();
      const totals = rows.reduce((result, item) => ({
        grossRentalRevenue: result.grossRentalRevenue + (Number(item.gross_rental_revenue) || 0),
        platformCommission: result.platformCommission + (Number(item.platform_commission) || 0),
        ownerPayout: result.ownerPayout + (Number(item.net_owner_payout) || 0)
      }), {
        grossRentalRevenue: 0,
        platformCommission: 0,
        ownerPayout: 0
      });
      return {
        data: {
          from,
          to,
          totals,
          settlements: rows.map(item => ({
            date: item.settled_at,
            grossRentalRevenue: item.gross_rental_revenue || 0,
            platformCommission: item.platform_commission || 0,
            ownerPayout: item.net_owner_payout || 0
          }))
        }
      };
    }
  };
}
