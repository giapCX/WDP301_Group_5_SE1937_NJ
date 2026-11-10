import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

const STAFF_ROLES = ["MANAGER", "OPERATION_STAFF", "GARAGE_STAFF", "ADMIN"];
const MANAGED_STAFF_ROLES = ["OPERATION_STAFF", "GARAGE_STAFF"];
const OPEN_INCIDENT_STATUSES = [
  "reported",
  "open",
  "investigating",
  "pending_review",
  "awaiting_response",
];
const dayStart = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());
const toId = (value) => (ObjectId.isValid(value) ? new ObjectId(value) : null);
async function buildOperationsReport(repository, from, to) {
  const [bookings, incidents, fleetSize] = await Promise.all([
    repository
      .collection("bookings")
      .find({ start_at: { $gte: from, $lte: to } })
      .project({ status: 1, vehicle_id: 1, rental_fee_amount: 1 })
      .toArray(),
    repository
      .collection("incident_cases")
      .find({ created_at: { $gte: from, $lte: to } })
      .project({ status: 1 })
      .toArray(),
    repository
      .collection("vehicles")
      .countDocuments({ onboarding_status: "approved" }),
  ]);
  const byStatus = bookings.reduce((result, item) => {
    const key = item.status || "unknown";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
  const activeStatuses = new Set(["confirmed", "ongoing", "completed"]);
  const utilizedVehicles = new Set(
    bookings
      .filter((item) => activeStatuses.has(item.status))
      .map((item) => item.vehicle_id?.toString())
      .filter(Boolean),
  ).size;
  const openIncidents = incidents.filter((item) =>
    OPEN_INCIDENT_STATUSES.includes(item.status),
  ).length;
  return {
    from,
    to,
    bookings: {
      total: bookings.length,
      byStatus,
      rentalRevenue: bookings.reduce(
        (sum, item) => sum + (Number(item.rental_fee_amount) || 0),
        0,
      ),
    },
    fleet: {
      approvedVehicles: fleetSize,
      vehiclesWithBookings: utilizedVehicles,
      utilizationPct: fleetSize
        ? Math.round((utilizedVehicles / fleetSize) * 1000) / 10
        : 0,
    },
    incidents: {
      total: incidents.length,
      open: openIncidents,
      resolved: incidents.length - openIncidents,
    },
  };
}
function formatRequest(item, kind) {
  const createdAt = item.created_at || item.updated_at || new Date(0);
  const isVehicle = kind === "vehicle";
  return {
    id: item._id.toString(),
    code: isVehicle
      ? `XE-${item.license_plate || item._id.toString().slice(-6)}`
      : item.case_number,
    title: isVehicle
      ? `${item.brand || ""} ${item.model || ""} ${item.manufacture_year || ""}`.trim() ||
        "Hồ sơ xe mới"
      : `Yêu cầu sự cố ${item.case_number}`,
    type: isVehicle ? "Hồ sơ xe mới" : "Khiếu nại & sự cố",
    owner: item.owner_name || "Chưa cập nhật người gửi",
    createdAt,
    status: item.onboarding_status || item.status,
  };
}

export function createManagerController({ repository, service }) {
  return {
    accounts: async (request, response) => {
      const { q = "", status = "all", role = "all" } = request.query;
      const match = {};
      if (status !== "all") match.account_status = status;
      if (typeof q === "string" && q.trim()) {
        const safe = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        match.$or = [
          { full_name: { $regex: safe, $options: "i" } },
          { email: { $regex: safe, $options: "i" } },
          { phone: { $regex: safe, $options: "i" } },
        ];
      }
      const [users, roles] = await Promise.all([
        repository
          .collection("users")
          .find(match)
          .project({
            password_hash: 0,
            identity_kyc: 0,
            driver_license: 0,
            payout_profile: 0,
          })
          .sort({ created_at: -1 })
          .limit(300)
          .toArray(),
        repository.collection("roles").find({}).toArray(),
      ]);
      const roleMap = new Map(roles.map((item) => [item._id.toString(), item]));
      const data = users
        .map((user) => {
          const roleIds = [
            user.primary_role_id,
            ...(user.additional_role_ids || []),
          ].filter(Boolean);
          const userRoles = roleIds
            .map((id) => roleMap.get(id.toString()))
            .filter(Boolean);
          return {
            id: user._id.toString(),
            name: user.full_name,
            email: user.email,
            phone: user.phone,
            status: user.account_status,
            roles: userRoles.map((item) => item.code),
            roleNames: userRoles.map((item) => item.display_name),
            createdAt: user.created_at,
          };
        })
        .filter((item) => role === "all" || item.roles.includes(role));
      return response.json({ data });
    },
    createAccount: async (request, response) => {
      const {
        name,
        email,
        phone = "",
        password,
        roles: roleCodes = [],
        status = "active",
      } = request.body || {};
      if (
        typeof name !== "string" ||
        name.trim().length < 2 ||
        name.trim().length > 120 ||
        typeof email !== "string" ||
        email.trim().length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        typeof phone !== "string" ||
        phone.trim().length > 40 ||
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 128 ||
        !Array.isArray(roleCodes) ||
        !roleCodes.length ||
        roleCodes.some((code) => typeof code !== "string" || !code.trim()) ||
        !["active", "suspended"].includes(status)
      ) {
        return response
          .status(400)
          .json({
            error: {
              message:
                "Thông tin tài khoản không hợp lệ; mật khẩu phải có ít nhất 8 ký tự.",
            },
          });
      }
      const normalizedRoleCodes = [
        ...new Set(roleCodes.map((code) => code.trim().toUpperCase())),
      ];
      if (normalizedRoleCodes.includes("ADMIN"))
        return response.status(400).json({
          error: { message: "Không thể tạo tài khoản có quyền Admin." },
        });
      const normalizedEmail = email.trim().toLowerCase();
      const users = repository.collection("users");
      if (
        await users.findOne({
          email: {
            $regex: `^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            $options: "i",
          },
        })
      ) {
        return response
          .status(409)
          .json({ error: { message: "Email đã được sử dụng." } });
      }
      const roleRows = await repository
        .collection("roles")
        .find({ code: { $in: normalizedRoleCodes } })
        .toArray();
      if (roleRows.length !== normalizedRoleCodes.length)
        return response
          .status(400)
          .json({
            error: { message: "Một hoặc nhiều vai trò không tồn tại." },
          });
      const now = new Date();
      const inserted = await users.insertOne({
        full_name: name.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        password_hash: await bcrypt.hash(password, 12),
        primary_role_id: roleRows[0]._id,
        additional_role_ids: roleRows.slice(1).map((item) => item._id),
        account_status: status,
        created_at: now,
        updated_at: now,
      });
      await service.writeAudit(
        request,
        "account.create",
        "users",
        inserted.insertedId,
        { roles: roleRows.map((item) => item.code), status },
      );
      return response
        .status(201)
        .json({
          data: {
            id: inserted.insertedId.toString(),
            name: name.trim(),
            email: normalizedEmail,
            status,
            roles: roleRows.map((item) => item.code),
          },
        });
    },
    updateAccount: async (request, response) => {
      const id = toId(request.params.id);
      const { status, roles: roleCodes } = request.body || {};
      if (!id || (status === undefined && roleCodes === undefined))
        return response
          .status(400)
          .json({ error: { message: "Thông tin cập nhật không hợp lệ." } });
      if (status !== undefined && !["active", "suspended"].includes(status))
        return response
          .status(400)
          .json({ error: { message: "Trạng thái tài khoản không hợp lệ." } });
      const target = await repository.collection("users").findOne({ _id: id });
      if (!target)
        return response
          .status(404)
          .json({ error: { message: "Không tìm thấy tài khoản." } });
      const adminRole = await repository
        .collection("roles")
        .findOne({ code: "ADMIN" });
      const targetRoleIds = [
        target.primary_role_id,
        ...(target.additional_role_ids || []),
      ].filter(Boolean);
      const targetIsAdmin = Boolean(
        adminRole &&
        targetRoleIds.some((roleId) => roleId.equals(adminRole._id)),
      );
      if (
        id.equals(service.managerId(request)) &&
        (status === "suspended" || (roleCodes && !roleCodes.includes("ADMIN")))
      ) {
        return response
          .status(400)
          .json({
            error: {
              message:
                "Không thể khóa hoặc gỡ quyền Admin của tài khoản đang đăng nhập.",
            },
          });
      }
      const update = { updated_at: new Date() };
      if (status !== undefined) update.account_status = status;
      if (roleCodes !== undefined) {
        if (!Array.isArray(roleCodes) || !roleCodes.length)
          return response
            .status(400)
            .json({
              error: { message: "Tài khoản phải có ít nhất một vai trò." },
            });
        const roles = await repository
          .collection("roles")
          .find({ code: { $in: [...new Set(roleCodes)] } })
          .toArray();
        if (roles.length !== new Set(roleCodes).size)
          return response
            .status(400)
            .json({
              error: { message: "Một hoặc nhiều vai trò không tồn tại." },
            });
        if (!targetIsAdmin && roles.some((item) => item.code === "ADMIN"))
          return response.status(400).json({
            error: {
              message: "Không thể cấp quyền Admin qua chỉnh sửa tài khoản.",
            },
          });
        if (targetIsAdmin && !roles.some((item) => item.code === "ADMIN"))
          return response
            .status(400)
            .json({
              error: {
                message: "Không thể gỡ quyền Admin của một Admin khác.",
              },
            });
        update.primary_role_id = roles[0]._id;
        update.additional_role_ids = roles.slice(1).map((item) => item._id);
      }
      await repository
        .collection("users")
        .updateOne({ _id: id }, { $set: update });
      await service.writeAudit(request, "account.update", "users", id, {
        ...(status ? { status } : {}),
        ...(roleCodes ? { roles: roleCodes } : {}),
      });
      return response.json({
        data: {
          id: id.toString(),
          ...(status ? { status } : {}),
          ...(roleCodes ? { roles: roleCodes } : {}),
        },
      });
    },
    roles: async (_request, response) => {
      const rows = await repository
        .collection("roles")
        .find({})
        .sort({ code: 1 })
        .toArray();
      return response.json({
        data: rows.map((item) => ({
          id: item._id.toString(),
          code: item.code,
          name: item.display_name,
          description: item.description,
          permissions: item.permissions || [],
        })),
      });
    },
    createRole: async (request, response) => {
      const {
        code,
        name,
        description = "",
        permissions = [],
      } = request.body || {};
      if (
        typeof code !== "string" ||
        !/^[A-Z][A-Z0-9_]{1,49}$/.test(code) ||
        typeof name !== "string" ||
        !name.trim() ||
        name.length > 100 ||
        typeof description !== "string" ||
        description.length > 500 ||
        !Array.isArray(permissions) ||
        permissions.length > 200 ||
        permissions.some(
          (item) =>
            typeof item !== "string" || !/^[a-z][a-z0-9._:-]{1,79}$/.test(item),
        )
      ) {
        return response
          .status(400)
          .json({
            error: { message: "Thông tin vai trò hoặc quyền không hợp lệ." },
          });
      }
      if (await repository.collection("roles").findOne({ code }))
        return response
          .status(409)
          .json({ error: { message: "Mã vai trò đã tồn tại." } });
      const now = new Date();
      const role = {
        code,
        display_name: name.trim(),
        description: description.trim(),
        permissions: [...new Set(permissions)],
        created_at: now,
        updated_at: now,
      };
      const inserted = await repository.collection("roles").insertOne(role);
      await service.writeAudit(
        request,
        "role.create",
        "roles",
        inserted.insertedId,
        { code, name: role.display_name, permissions: role.permissions },
      );
      return response
        .status(201)
        .json({
          data: {
            id: inserted.insertedId.toString(),
            code,
            name: role.display_name,
            description: role.description,
            permissions: role.permissions,
          },
        });
    },
    updateRole: async (request, response) => {
      const id = toId(request.params.id);
      const { permissions, name, description } = request.body || {};
      if (
        !id ||
        (!Array.isArray(permissions) &&
          name === undefined &&
          description === undefined)
      )
        return response
          .status(400)
          .json({ error: { message: "Thông tin vai trò không hợp lệ." } });
      if (
        permissions !== undefined &&
        (!Array.isArray(permissions) ||
          permissions.some(
            (item) =>
              typeof item !== "string" ||
              !/^[a-z][a-z0-9._:-]{1,79}$/.test(item),
          ))
      )
        return response
          .status(400)
          .json({ error: { message: "Danh sách quyền không hợp lệ." } });
      if (
        name !== undefined &&
        (typeof name !== "string" || !name.trim() || name.length > 100)
      )
        return response
          .status(400)
          .json({ error: { message: "Tên vai trò không hợp lệ." } });
      if (
        description !== undefined &&
        (typeof description !== "string" || description.length > 500)
      )
        return response
          .status(400)
          .json({ error: { message: "Mô tả vai trò không hợp lệ." } });
      const set = { updated_at: new Date() };
      if (permissions !== undefined)
        set.permissions = [...new Set(permissions)];
      if (name !== undefined) set.display_name = name.trim();
      if (description !== undefined) set.description = description.trim();
      const result = await repository
        .collection("roles")
        .updateOne({ _id: id }, { $set: set });
      if (!result.matchedCount)
        return response
          .status(404)
          .json({ error: { message: "Không tìm thấy vai trò." } });
      await service.writeAudit(request, "role.update", "roles", id, set);
      return response.json({ data: { id: id.toString(), ...set } });
    },
    auditLogs: async (request, response) => {
      const page = Math.max(1, Number.parseInt(request.query.page, 10) || 1);
      const limit = Math.min(
        100,
        Math.max(1, Number.parseInt(request.query.limit, 10) || 25),
      );
      const match = {};
      for (const key of ["action", "entity_type"])
        if (typeof request.query[key] === "string" && request.query[key].trim())
          match[key] = request.query[key].trim();
      if (request.query.from || request.query.to) {
        match.created_at = {};
        if (request.query.from && !Number.isNaN(Date.parse(request.query.from)))
          match.created_at.$gte = new Date(request.query.from);
        if (request.query.to && !Number.isNaN(Date.parse(request.query.to))) {
          match.created_at.$lte = new Date(request.query.to);
          if (request.query.to.length === 10)
            match.created_at.$lte.setHours(23, 59, 59, 999);
        }
      }
      const logs = repository.collection("audit_logs");
      const [total, rows] = await Promise.all([
        logs.countDocuments(match),
        logs
          .find(match)
          .sort({ created_at: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .toArray(),
      ]);
      const actorIds = [
        ...new Map(
          rows
            .map((row) => row.actor_user_id)
            .filter(Boolean)
            .map((id) => [id.toString(), id]),
        ).values(),
      ];
      const actors = actorIds.length
        ? await repository
            .collection("users")
            .find({ _id: { $in: actorIds } })
            .project({ full_name: 1, email: 1 })
            .toArray()
        : [];
      const actorMap = new Map(
        actors.map((item) => [item._id.toString(), item]),
      );
      return response.json({
        data: rows.map((row) => ({
          id: row._id.toString(),
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id?.toString() || null,
          actor:
            actorMap.get(row.actor_user_id?.toString())?.full_name || "System",
          actorEmail:
            actorMap.get(row.actor_user_id?.toString())?.email || null,
          changes: row.sanitized_changes || {},
          ipAddressMasked: row.ip_address_masked || null,
          createdAt: row.created_at,
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    },
    systemReports: async (request, response) => {
      const filter = request.currentRoles?.includes("MANAGER")
        ? {}
        : { report_type: "finance" };
      const rows = await repository
        .collection("system_reports")
        .find(filter)
        .sort({ generated_at: -1 })
        .limit(100)
        .toArray();
      return response.json({
        data: rows.map((item) => ({
          id: item._id.toString(),
          type: item.report_type,
          title: item.title,
          from: item.period_from,
          to: item.period_to,
          generatedAt: item.generated_at,
        })),
      });
    },
    systemReport: async (request, response) => {
      const id = toId(request.params.id);
      if (!id)
        return response
          .status(400)
          .json({ error: { message: "Mã báo cáo không hợp lệ." } });
      const filter = request.currentRoles?.includes("MANAGER")
        ? { _id: id }
        : { _id: id, report_type: "finance" };
      const report = await repository
        .collection("system_reports")
        .findOne(filter);
      if (!report)
        return response
          .status(404)
          .json({ error: { message: "Không tìm thấy báo cáo." } });
      return response.json({
        data: {
          id: report._id.toString(),
          type: report.report_type,
          title: report.title,
          from: report.period_from,
          to: report.period_to,
          generatedAt: report.generated_at,
          report: report.report_data,
        },
      });
    },
    saveSystemReport: async (request, response) => {
      const { type, from: fromValue, to: toValue } = request.body || {};
      if (!["finance", "operations"].includes(type))
        return response
          .status(400)
          .json({ error: { message: "Loại báo cáo không hợp lệ." } });
      if (type === "operations" && !request.currentRoles?.includes("MANAGER"))
        return response
          .status(403)
          .json({
            error: { message: "Chỉ Manager được tạo báo cáo hoạt động." },
          });
      const from = fromValue
        ? new Date(fromValue)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const to = toValue ? new Date(toValue) : new Date();
      if (
        Number.isNaN(from.getTime()) ||
        Number.isNaN(to.getTime()) ||
        from > to
      )
        return response
          .status(400)
          .json({ error: { message: "Khoảng ngày báo cáo không hợp lệ." } });
      if (typeof toValue === "string" && toValue.length === 10)
        to.setUTCHours(23, 59, 59, 999);
      let data;
      if (type === "operations")
        data = await buildOperationsReport(repository, from, to);
      else {
        const rows = await repository
          .collection("owner_settlements")
          .find({ settled_at: { $gte: from, $lte: to }, payout_status: "paid" })
          .project({
            settled_at: 1,
            gross_rental_revenue: 1,
            platform_commission: 1,
            net_owner_payout: 1,
          })
          .sort({ settled_at: 1 })
          .toArray();
        data = {
          from,
          to,
          totals: rows.reduce(
            (sum, item) => ({
              grossRentalRevenue:
                sum.grossRentalRevenue +
                (Number(item.gross_rental_revenue) || 0),
              platformCommission:
                sum.platformCommission +
                (Number(item.platform_commission) || 0),
              ownerPayout:
                sum.ownerPayout + (Number(item.net_owner_payout) || 0),
            }),
            { grossRentalRevenue: 0, platformCommission: 0, ownerPayout: 0 },
          ),
          count: rows.length,
        };
      }
      const now = new Date();
      const inserted = await repository
        .collection("system_reports")
        .insertOne({
          report_type: type,
          title: type === "finance" ? "Báo cáo tài chính" : "Báo cáo hoạt động",
          period_from: from,
          period_to: to,
          report_data: data,
          generated_by: service.managerId(request),
          generated_at: now,
        });
      await service.writeAudit(
        request,
        "report.generated",
        "system_reports",
        inserted.insertedId,
        { report_type: type, period_from: from, period_to: to },
      );
      return response
        .status(201)
        .json({
          data: {
            id: inserted.insertedId.toString(),
            type,
            title:
              type === "finance" ? "Báo cáo tài chính" : "Báo cáo hoạt động",
            generatedAt: now,
          },
        });
    },
    dashboard: async (request, response) => {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const period = ["30d", "month"].includes(request.query.period)
        ? request.query.period
        : "7d";
      const numberOfDays =
        period === "month" ? today.getDate() : period === "30d" ? 30 : 7;
      const periodStart = period === "month" ? monthStart : dayStart(today);
      if (period !== "month")
        periodStart.setDate(periodStart.getDate() - numberOfDays + 1);
      const seriesStart = new Date(periodStart);

      const vehicles = repository.collection("vehicles");
      const listings = repository.collection("vehicle_listings");
      const incidents = repository.collection("incident_cases");
      const settlements = repository.collection("owner_settlements");
      const auditLogs = repository.collection("audit_logs");
      const users = repository.collection("users");
      const roles = repository.collection("roles");

      const [
        activeVehicles,
        pendingVehicleCount,
        openIncidents,
        approvedSettlements,
        monthSettlements,
        roleDocs,
        requestVehicles,
        requestIncidents,
        recentLogs,
      ] = await Promise.all([
        listings.countDocuments({ status: "published" }),
        vehicles.countDocuments({
          onboarding_status: { $in: ["submitted", "pending_review"] },
        }),
        incidents.countDocuments({ status: { $in: OPEN_INCIDENT_STATUSES } }),
        settlements
          .find({ settled_at: { $gte: seriesStart }, payout_status: "paid" })
          .project({ settled_at: 1, platform_commission: 1 })
          .toArray(),
        settlements
          .find({ settled_at: { $gte: monthStart }, payout_status: "paid" })
          .project({ platform_commission: 1 })
          .toArray(),
        roles
          .find({ code: { $in: STAFF_ROLES } })
          .project({ _id: 1 })
          .toArray(),
        vehicles
          .find({ onboarding_status: { $in: ["submitted", "pending_review"] } })
          .sort({ created_at: -1 })
          .limit(10)
          .toArray(),
        incidents
          .find({ status: { $in: OPEN_INCIDENT_STATUSES } })
          .sort({ updated_at: -1, created_at: -1 })
          .limit(10)
          .toArray(),
        auditLogs.find({}).sort({ created_at: -1 }).limit(6).toArray(),
      ]);

      const ownerIds = requestVehicles
        .map((vehicle) => vehicle.owner_id)
        .filter(Boolean);
      const reporterIds = requestIncidents
        .map((incident) => incident.reported_by_user_id)
        .filter(Boolean);
      const actorIds = recentLogs
        .map((log) => log.actor_user_id)
        .filter(Boolean);
      const peopleIds = [
        ...new Map(
          [...ownerIds, ...reporterIds, ...actorIds].map((id) => [
            id.toString(),
            id,
          ]),
        ).values(),
      ];
      const people = peopleIds.length
        ? await users
            .find({ _id: { $in: peopleIds } })
            .project({ full_name: 1 })
            .toArray()
        : [];
      const personNames = new Map(
        people.map((person) => [person._id.toString(), person.full_name]),
      );
      const pending = requestVehicles
        .map((vehicle) => ({
          ...vehicle,
          owner_name: personNames.get(vehicle.owner_id?.toString()),
        }))
        .map((vehicle) => formatRequest(vehicle, "vehicle"));
      const cases = requestIncidents
        .map((incident) => ({
          ...incident,
          owner_name: personNames.get(incident.reported_by_user_id?.toString()),
        }))
        .map((incident) => formatRequest(incident, "incident"));
      const dashboardRequests = [...pending, ...cases]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 8);

      const daily = Array.from({ length: numberOfDays }, (_, index) => {
        const date = new Date(seriesStart);
        date.setDate(date.getDate() + index);
        return { date: date.toISOString().slice(0, 10), amount: 0 };
      });
      const seriesByDate = new Map(daily.map((item) => [item.date, item]));
      for (const settlement of approvedSettlements) {
        if (!settlement.settled_at) continue;
        const key = dayStart(new Date(settlement.settled_at))
          .toISOString()
          .slice(0, 10);
        const point = seriesByDate.get(key);
        if (point) point.amount += Number(settlement.platform_commission) || 0;
      }

      const activities = recentLogs.map((log) => ({
        id: log._id.toString(),
        action: log.action || "system.activity",
        entityType: log.entity_type || "system",
        entityId: log.entity_id?.toString() || null,
        actor: personNames.get(log.actor_user_id?.toString()) || "Hệ thống",
        createdAt: log.created_at || null,
      }));

      const staffRoleIds = roleDocs.map((role) => role._id);
      const [staffCount, lastPeriodSettlements] = await Promise.all([
        staffRoleIds.length
          ? users.countDocuments({
              account_status: "active",
              $or: [
                { primary_role_id: { $in: staffRoleIds } },
                { additional_role_ids: { $in: staffRoleIds } },
              ],
            })
          : 0,
        settlements
          .find({
            settled_at: {
              $gte: new Date(
                monthStart.getFullYear(),
                monthStart.getMonth() - 1,
                1,
              ),
              $lt: monthStart,
            },
            payout_status: "paid",
          })
          .project({ platform_commission: 1 })
          .toArray(),
      ]);

      const monthRevenue = monthSettlements.reduce(
        (total, item) => total + (Number(item.platform_commission) || 0),
        0,
      );
      const previousRevenue = lastPeriodSettlements.reduce(
        (total, item) => total + (Number(item.platform_commission) || 0),
        0,
      );
      const changePercent = previousRevenue
        ? Math.round(
            ((monthRevenue - previousRevenue) / previousRevenue) * 1000,
          ) / 10
        : null;

      return response.json({
        data: {
          period,
          metrics: {
            activeVehicles,
            pendingVehicles: pendingVehicleCount,
            openIncidents,
            monthlyPlatformRevenue: monthRevenue,
            staffCount,
            revenueChangePercent: changePercent,
          },
          revenue: {
            total: daily.reduce((total, item) => total + item.amount, 0),
            series: daily,
          },
          requests: dashboardRequests,
          activities: request.currentRoles?.includes("ADMIN") ? activities : [],
        },
      });
    },
    vehicles: async (request, response) => {
      const status = request.query.status || "pending";
      const match =
        status === "all"
          ? {}
          : {
              onboarding_status:
                status === "pending"
                  ? { $in: ["submitted", "pending_review"] }
                  : status,
            };
      const items = await repository
        .collection("vehicles")
        .find(match)
        .sort({ updated_at: -1 })
        .limit(200)
        .toArray();
      const owners = [
        ...new Set(
          items.map((item) => item.owner_id?.toString()).filter(Boolean),
        ),
      ].map((id) => new ObjectId(id));
      const ownerRows = owners.length
        ? await repository
            .collection("users")
            .find({ _id: { $in: owners } })
            .project({ full_name: 1, email: 1 })
            .toArray()
        : [];
      const ownerMap = new Map(
        ownerRows.map((owner) => [owner._id.toString(), owner]),
      );
      const itemIds = items.map((item) => item._id);
      const inspections = itemIds.length
        ? await repository
            .collection("vehicle_inspections")
            .find({ vehicle_id: { $in: itemIds } })
            .sort({ inspected_at: -1 })
            .toArray()
        : [];
      const inspectionMap = new Map();
      for (const inspection of inspections)
        if (!inspectionMap.has(inspection.vehicle_id.toString()))
          inspectionMap.set(inspection.vehicle_id.toString(), inspection);
      return response.json({
        data: items.map((item) => ({
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
          reviewNote: item.review_note || "",
          documents: item.documents || {},
          inspection: inspectionMap.get(item._id.toString())
            ? {
                status: inspectionMap.get(item._id.toString()).approval_status,
                recommendation: inspectionMap.get(item._id.toString())
                  .recommendation,
                inspectedAt: inspectionMap.get(item._id.toString())
                  .inspected_at,
              }
            : null,
          owner: ownerMap.get(item.owner_id?.toString()) || null,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })),
      });
    },
    reviewVehicle: async (request, response) => {
      const id = toId(request.params.id);
      const { action, note = "" } = request.body || {};
      const statuses = {
        approve: "approved",
        reject: "rejected",
        revision: "revision_required",
      };
      if (
        !id ||
        !statuses[action] ||
        typeof note !== "string" ||
        note.trim().length > 1000 ||
        (["revision", "reject"].includes(action) && note.trim().length < 5)
      ) {
        return response
          .status(400)
          .json({
            error: {
              message: ["revision", "reject"].includes(action)
                ? "Yêu cầu bổ sung hoặc từ chối cần có nội dung giải thích từ 5 đến 1.000 ký tự."
                : "Thông tin duyệt xe không hợp lệ.",
            },
          });
      }
      if (action === "approve") {
        const approvalPolicy = await repository
          .collection("platform_policies")
          .findOne({ policy_type: "vehicle_approval", status: "active" });
        if (approvalPolicy?.config?.inspection_report_required) {
          const inspection = await repository
            .collection("vehicle_inspections")
            .findOne({
              vehicle_id: id,
              approval_status: "approved",
              recommendation: "pass",
            });
          if (!inspection)
            return response
              .status(409)
              .json({
                error: {
                  message:
                    "Cần có biên bản kiểm định đạt yêu cầu trước khi duyệt xe.",
                },
              });
        }
      }
      const result = await repository
        .collection("vehicles")
        .updateOne(
          {
            _id: id,
            onboarding_status: { $in: ["submitted", "pending_review"] },
          },
          {
            $set: {
              onboarding_status: statuses[action],
              updated_at: new Date(),
              reviewed_by_manager_id: service.managerId(request),
              review_note: note.trim(),
            },
            $push: {
              registration_history: {
                action: statuses[action],
                by_user_id: service.managerId(request),
                at: new Date(),
                note: note.trim(),
              },
            },
          },
        );
      if (!result.modifiedCount)
        return response
          .status(409)
          .json({
            error: { message: "Hồ sơ xe không còn ở trạng thái chờ duyệt." },
          });
      await service.writeAudit(request, `vehicle.${action}`, "vehicles", id, {
        status: statuses[action],
        note: note.trim(),
      });
      return response.json({
        data: { id: id.toString(), status: statuses[action] },
      });
    },
    incidents: async (request, response) => {
      const status = request.query.status || "open";
      const match =
        status === "all"
          ? {}
          : {
              status:
                status === "open" ? { $in: OPEN_INCIDENT_STATUSES } : status,
            };
      const items = await repository
        .collection("incident_cases")
        .find(match)
        .sort({ updated_at: -1 })
        .limit(200)
        .toArray();
      return response.json({
        data: items.map((item) => ({
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
          updatedAt: item.updated_at,
        })),
      });
    },
    reviewCompensation: async (request, response) => {
      const id = toId(request.params.id);
      const { decision, amount, note = "" } = request.body || {};
      if (
        !id ||
        !["approve", "reject"].includes(decision) ||
        typeof note !== "string" ||
        note.length > 1000 ||
        (decision === "approve" &&
          (!Number.isSafeInteger(amount) || amount < 0))
      ) {
        return response
          .status(400)
          .json({
            error: { message: "Thông tin xử lý bồi thường không hợp lệ." },
          });
      }
      const cases = repository.collection("incident_cases");
      const incident = await cases.findOne({
        _id: id,
        status: { $in: OPEN_INCIDENT_STATUSES },
      });
      if (!incident)
        return response
          .status(404)
          .json({ error: { message: "Không tìm thấy sự cố đang mở." } });
      const claims = incident.compensation_claims || [];
      const claimIndex = claims.findIndex(
        (claim) => !claim.decision || claim.decision === "pending",
      );
      if (claimIndex < 0)
        return response
          .status(409)
          .json({
            error: {
              message: "Sự cố này không có yêu cầu bồi thường đang chờ.",
            },
          });
      if (
        decision === "approve" &&
        Number.isFinite(Number(claims[claimIndex].requested_amount)) &&
        amount > claims[claimIndex].requested_amount
      ) {
        return response
          .status(400)
          .json({
            error: {
              message: "Số tiền duyệt không được vượt quá số tiền yêu cầu.",
            },
          });
      }
      const now = new Date();
      const nextClaim = {
        ...claims[claimIndex],
        decision: decision === "approve" ? "approved" : "rejected",
        approved_amount: decision === "approve" ? amount : 0,
        decision_at: now,
        reviewed_by_manager_id: service.managerId(request),
        manager_note: note.trim(),
      };
      claims[claimIndex] = nextClaim;
      const allDecided = claims.every(
        (claim) => claim.decision && claim.decision !== "pending",
      );
      let deposit = null;
      if (decision === "approve" && amount > 0) {
        if (!incident.booking_id)
          return response
            .status(409)
            .json({
              error: {
                message:
                  "Không thể trừ tiền bồi thường khi sự cố chưa liên kết booking.",
              },
            });
        const deposits = repository.collection("security_deposits");
        deposit = await deposits.findOne({ booking_id: incident.booking_id });
        if (
          !deposit ||
          !Number.isFinite(deposit.refundable_amount) ||
          deposit.refundable_amount < amount
        ) {
          return response
            .status(409)
            .json({
              error: {
                message:
                  "Tiền cọc có thể hoàn không đủ để khấu trừ khoản bồi thường.",
              },
            });
        }
        const deduction = {
          incident_case_id: id,
          amount,
          status: "approved_after_manager_review",
          approved_by_user_id: service.managerId(request),
          renter_response:
            claims[claimIndex].renter_response || "manager_arbitration",
          contract_basis: "manager_compensation_decision",
        };
        const deducted = await deposits.updateOne(
          {
            _id: deposit._id,
            refundable_amount: { $gte: amount },
            deduction_decisions: {
              $not: { $elemMatch: { incident_case_id: id } },
            },
            status: { $in: ["held", "pending_refund", "refunded"] },
          },
          {
            $inc: { deducted_amount: amount, refundable_amount: -amount },
            $push: {
              movements: {
                type: "deducted",
                amount,
                incident_case_id: id,
                at: now,
              },
              deduction_decisions: deduction,
            },
            $set: { updated_at: now },
          },
        );
        if (!deducted.modifiedCount)
          return response
            .status(409)
            .json({
              error: {
                message:
                  "Tiền cọc đã thay đổi hoặc khoản bồi thường đã được ghi nhận.",
              },
            });
      }
      const claimPath = `compensation_claims.${claimIndex}`;
      const update = {
        [claimPath]: nextClaim,
        reviewed_by_manager_id: service.managerId(request),
        updated_at: now,
        ...(allDecided
          ? {
              status: "resolved",
              resolution: {
                outcome:
                  decision === "approve"
                    ? "compensation_approved"
                    : "compensation_rejected",
                amount: decision === "approve" ? amount : 0,
                note: note.trim(),
                resolved_at: now,
              },
            }
          : {}),
      };
      const saved = await cases.updateOne(
        {
          _id: id,
          status: { $in: OPEN_INCIDENT_STATUSES },
          [`compensation_claims.${claimIndex}.decision`]: {
            $in: [null, "pending"],
          },
        },
        { $set: update },
      );
      if (!saved.modifiedCount) {
        if (deposit && decision === "approve" && amount > 0)
          await repository.collection("security_deposits").updateOne(
            { _id: deposit._id },
            {
              $inc: { deducted_amount: -amount, refundable_amount: amount },
              $pull: {
                movements: { incident_case_id: id, type: "deducted" },
                deduction_decisions: { incident_case_id: id },
              },
              $set: { updated_at: new Date() },
            },
          );
        return response
          .status(409)
          .json({
            error: {
              message: "Yêu cầu bồi thường đã được xử lý bởi một quản lý khác.",
            },
          });
      }
      await service.writeAudit(
        request,
        `compensation.${decision}`,
        "incident_cases",
        id,
        { amount: decision === "approve" ? amount : 0, note: note.trim() },
      );
      return response.json({
        data: {
          id: id.toString(),
          decision: nextClaim.decision,
          status: allDecided ? "resolved" : incident.status,
        },
      });
    },
    reviewIncident: async (request, response) => {
      const id = toId(request.params.id);
      const { action, note = "" } = request.body || {};
      if (
        !id ||
        action !== "resolve" ||
        typeof note !== "string" ||
        !note.trim() ||
        note.length > 1000
      ) {
        return response
          .status(400)
          .json({
            error: { message: "Vui lòng nhập ghi chú kết luận sự cố." },
          });
      }
      const result = await repository
        .collection("incident_cases")
        .updateOne(
          {
            _id: id,
            status: { $in: OPEN_INCIDENT_STATUSES },
            compensation_claims: {
              $not: { $elemMatch: { decision: { $in: ["pending", null] } } },
            },
          },
          {
            $set: {
              status: "resolved",
              reviewed_by_manager_id: service.managerId(request),
              updated_at: new Date(),
              resolution: {
                outcome: "manager_resolved",
                note: note.trim(),
                resolved_at: new Date(),
              },
            },
          },
        );
      if (!result.modifiedCount)
        return response
          .status(409)
          .json({
            error: {
              message:
                "Sự cố đã đóng hoặc còn yêu cầu bồi thường chờ quyết định.",
            },
          });
      await service.writeAudit(
        request,
        "incident.resolve",
        "incident_cases",
        id,
        { note: note.trim() },
      );
      return response.json({ data: { id: id.toString(), status: "resolved" } });
    },
    policies: async (_request, response) => {
      const data = await repository
        .collection("platform_policies")
        .find({ status: "active" })
        .sort({ policy_type: 1 })
        .toArray();
      return response.json({
        data: data.map((item) => ({
          id: item._id.toString(),
          type: item.policy_type,
          version: item.version,
          config: item.config,
          effectiveFrom: item.effective_from,
        })),
      });
    },
    updatePolicy: async (request, response) => {
      const type = request.params.type;
      const config = request.body?.config;
      const allowed = [
        "commission_default",
        "cancellation",
        "deposit_refund",
        "late_return",
        "mileage",
        "damage_handling",
        "traffic_violation",
        "withdrawal",
        "vehicle_approval",
        "listing_publication",
      ];
      if (
        !allowed.includes(type) ||
        !config ||
        typeof config !== "object" ||
        Array.isArray(config)
      ) {
        return response
          .status(400)
          .json({
            error: { message: "Loại hoặc cấu hình chính sách không hợp lệ." },
          });
      }
      const numericValues = Object.values(config).filter(
        (value) => typeof value === "number",
      );
      if (
        numericValues.some((value) => !Number.isFinite(value) || value < 0) ||
        (type === "commission_default" &&
          (config.default_commission_pct < 0 ||
            config.default_commission_pct > 100))
      ) {
        return response
          .status(400)
          .json({
            error: {
              message: "Giá trị chính sách nằm ngoài giới hạn cho phép.",
            },
          });
      }
      const policies = repository.collection("platform_policies");
      const now = new Date();
      const previous = await policies
        .find({ policy_type: type, status: "active" })
        .sort({ version: -1 })
        .limit(1)
        .next();
      const version = (previous?.version || 0) + 1;
      await policies.updateMany(
        { policy_type: type, status: "active" },
        { $set: { status: "superseded", effective_until: now } },
      );
      const inserted = await policies.insertOne({
        policy_type: type,
        version,
        config,
        effective_from: now,
        effective_until: null,
        updated_by_manager_id: service.managerId(request),
        status: "active",
        created_at: now,
      });
      await service.writeAudit(
        request,
        "policy.update",
        "platform_policies",
        inserted.insertedId,
        { policy_type: type, version },
      );
      return response
        .status(201)
        .json({
          data: {
            id: inserted.insertedId.toString(),
            type,
            version,
            config,
            effectiveFrom: now,
          },
        });
    },
    staff: async (_request, response) => {
      const roleRows = await repository
        .collection("roles")
        .find({ code: { $in: MANAGED_STAFF_ROLES } })
        .toArray();
      const privilegedRoles = await repository
        .collection("roles")
        .find({ code: { $in: ["MANAGER", "ADMIN"] } })
        .toArray();
      const roleById = new Map(
        roleRows.map((role) => [role._id.toString(), role]),
      );
      const roleIds = roleRows.map((role) => role._id);
      const privilegedRoleIds = privilegedRoles.map((role) => role._id);
      const staff = await repository
        .collection("users")
        .find({
          $and: [
            {
              $or: [
                { primary_role_id: { $in: roleIds } },
                { additional_role_ids: { $in: roleIds } },
              ],
            },
            {
              $nor: [
                { primary_role_id: { $in: privilegedRoleIds } },
                { additional_role_ids: { $in: privilegedRoleIds } },
              ],
            },
          ],
        })
        .project({
          full_name: 1,
          email: 1,
          phone: 1,
          account_status: 1,
          primary_role_id: 1,
          created_at: 1,
        })
        .sort({ full_name: 1 })
        .toArray();
      return response.json({
        data: staff.map((user) => ({
          id: user._id.toString(),
          name: user.full_name,
          email: user.email,
          phone: user.phone,
          department: user.department || "",
          jobTitle: user.job_title || "",
          workScope: user.work_scope || "",
          status: user.account_status,
          role: roleById.get(user.primary_role_id?.toString())?.code || "STAFF",
          createdAt: user.created_at,
        })),
      });
    },
    createStaff: async (request, response) => {
      const {
        name,
        email,
        phone = "",
        password,
        role,
        department = "",
        jobTitle = "",
        workScope = "",
      } = request.body || {};
      if (
        typeof name !== "string" ||
        name.trim().length < 2 ||
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        typeof phone !== "string" ||
        phone.length > 40 ||
        typeof password !== "string" ||
        password.length < 8 ||
        password.length > 128 ||
        !MANAGED_STAFF_ROLES.includes(role) ||
        [department, jobTitle, workScope].some(
          (value) => typeof value !== "string" || value.length > 1000,
        )
      ) {
        return response
          .status(400)
          .json({
            error: {
              message:
                "Thông tin nhân viên không hợp lệ; mật khẩu phải có ít nhất 8 ký tự.",
            },
          });
      }
      const normalizedEmail = email.trim().toLowerCase();
      const users = repository.collection("users");
      if (await users.findOne({ email: normalizedEmail }))
        return response
          .status(409)
          .json({ error: { message: "Email đã được sử dụng." } });
      const roleDoc = await repository
        .collection("roles")
        .findOne({ code: role });
      if (!roleDoc)
        return response
          .status(400)
          .json({ error: { message: "Không tìm thấy vai trò nhân viên." } });
      const now = new Date();
      const inserted = await users.insertOne({
        full_name: name.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        password_hash: await bcrypt.hash(password, 12),
        primary_role_id: roleDoc._id,
        additional_role_ids: [],
        account_status: "active",
        department: department.trim(),
        job_title: jobTitle.trim(),
        work_scope: workScope.trim(),
        created_at: now,
        updated_at: now,
      });
      await service.writeAudit(
        request,
        "staff.create",
        "users",
        inserted.insertedId,
        { role, department: department.trim(), job_title: jobTitle.trim() },
      );
      return response
        .status(201)
        .json({
          data: {
            id: inserted.insertedId.toString(),
            name: name.trim(),
            email: normalizedEmail,
            role,
            status: "active",
          },
        });
    },
    updateStaff: async (request, response) => {
      const id = toId(request.params.id);
      const { status, role } = request.body || {};
      const set = { updated_at: new Date() };
      if (status !== undefined) {
        if (!["active", "suspended"].includes(status))
          return response
            .status(400)
            .json({ error: { message: "Trạng thái nhân sự không hợp lệ." } });
        set.account_status = status;
      }
      if (role !== undefined) {
        if (!MANAGED_STAFF_ROLES.includes(role))
          return response
            .status(400)
            .json({ error: { message: "Vai trò nhân sự không hợp lệ." } });
        const roleDoc = await repository
          .collection("roles")
          .findOne({ code: role });
        if (!roleDoc)
          return response
            .status(400)
            .json({ error: { message: "Không tìm thấy vai trò được chọn." } });
        set.primary_role_id = roleDoc._id;
      }
      const profileFields = {
        name: "full_name",
        phone: "phone",
        department: "department",
        jobTitle: "job_title",
        workScope: "work_scope",
      };
      for (const [input, field] of Object.entries(profileFields)) {
        if (request.body?.[input] === undefined) continue;
        const value = request.body[input];
        if (
          typeof value !== "string" ||
          value.trim().length > (input === "workScope" ? 1000 : 120)
        )
          return response
            .status(400)
            .json({
              error: { message: "Thông tin hồ sơ nhân viên không hợp lệ." },
            });
        set[field] = value.trim();
      }
      if (!id || Object.keys(set).length === 1)
        return response
          .status(400)
          .json({
            error: { message: "Vui lòng cung cấp thông tin cần cập nhật." },
          });
      const managedRoleRows = await repository
        .collection("roles")
        .find({ code: { $in: MANAGED_STAFF_ROLES } })
        .toArray();
      const managedRoleIds = managedRoleRows.map((item) => item._id);
      const privilegedRoles = await repository
        .collection("roles")
        .find({ code: { $in: ["MANAGER", "ADMIN"] } })
        .toArray();
      const privilegedRoleIds = privilegedRoles.map((item) => item._id);
      const result = await repository.collection("users").updateOne(
        {
          $and: [
            { _id: id },
            {
              $or: [
                { primary_role_id: { $in: managedRoleIds } },
                { additional_role_ids: { $in: managedRoleIds } },
              ],
            },
            {
              $nor: [
                { primary_role_id: { $in: privilegedRoleIds } },
                { additional_role_ids: { $in: privilegedRoleIds } },
              ],
            },
          ],
        },
        { $set: set },
      );
      if (!result.matchedCount)
        return response
          .status(404)
          .json({ error: { message: "Không tìm thấy nhân sự." } });
      const { updated_at, primary_role_id, ...auditChanges } = set;
      await service.writeAudit(request, "staff.update", "users", id, {
        ...auditChanges,
        ...(role ? { role } : {}),
      });
      return response.json({
        data: {
          id: id.toString(),
          ...(status ? { status } : {}),
          ...(role ? { role } : {}),
          ...(auditChanges.full_name ? { name: auditChanges.full_name } : {}),
        },
      });
    },
    contracts: async (request, response) => {
      const type = request.query.type === "rental" ? "rental" : "management";
      const collectionName =
        type === "rental" ? "rental_agreements" : "management_agreements";
      const filter = {};
      if (request.query.status && request.query.status !== "all")
        filter.status = request.query.status;
      const rows = await repository
        .collection(collectionName)
        .find(filter)
        .sort({ updated_at: -1, created_at: -1 })
        .limit(200)
        .toArray();
      return response.json({
        data: rows.map((item) => ({
          id: item._id.toString(),
          type,
          number: item.agreement_number || item.contract_number,
          status: item.status,
          startDate: item.start_date || item.terms_snapshot?.start_at || null,
          endDate: item.end_date || item.terms_snapshot?.end_at || null,
          commissionRatePct: item.commission_rate_pct ?? null,
          terms: item.terms_snapshot || item.authorization_scope || {},
          signedAt:
            item.signed_at || item.signature_info?.owner_signed_at || null,
          managerReview: item.manager_review || null,
          amendments: item.amendments || [],
          updatedAt: item.updated_at || item.created_at,
        })),
      });
    },
    updateContract: async (request, response) => {
      const id = toId(request.params.id);
      const type = request.params.type;
      const { action, reason, proposedTerms, note } = request.body || {};
      if (
        !id ||
        !["management", "rental"].includes(type) ||
        typeof reason !== "string" ||
        !reason.trim() ||
        reason.length > 1000
      ) {
        return response
          .status(400)
          .json({
            error: { message: "Thông tin cập nhật hợp đồng không hợp lệ." },
          });
      }
      const collectionName =
        type === "rental" ? "rental_agreements" : "management_agreements";
      const contracts = repository.collection(collectionName);
      const contract = await contracts.findOne({ _id: id });
      if (!contract)
        return response
          .status(404)
          .json({ error: { message: "Không tìm thấy hợp đồng." } });
      const now = new Date();
      if (action === "amend") {
        if (
          !proposedTerms ||
          typeof proposedTerms !== "object" ||
          Array.isArray(proposedTerms) ||
          Object.keys(proposedTerms).length > 30
        ) {
          return response
            .status(400)
            .json({
              error: { message: "Nội dung điều chỉnh hợp đồng không hợp lệ." },
            });
        }
        const amendment = {
          proposed_terms: proposedTerms,
          reason: reason.trim(),
          status: "pending_signatures",
          created_by_manager_id: service.managerId(request),
          created_at: now,
        };
        await contracts.updateOne(
          { _id: id },
          { $push: { amendments: amendment }, $set: { updated_at: now } },
        );
        await service.writeAudit(
          request,
          "contract.amendment_requested",
          collectionName,
          id,
          { reason: reason.trim(), proposed_terms: proposedTerms },
        );
        return response
          .status(201)
          .json({
            data: {
              id: id.toString(),
              status: "pending_signatures",
              amendment,
            },
          });
      }
      if (action === "terminate" && type === "management") {
        if (!["active", "pending"].includes(contract.status))
          return response
            .status(409)
            .json({
              error: {
                message: "Chỉ có thể chấm dứt hợp đồng quản lý đang hiệu lực.",
              },
            });
        await contracts.updateOne(
          { _id: id, status: contract.status },
          {
            $set: {
              status: "terminated",
              termination_info: {
                reason: reason.trim(),
                terminated_at: now,
                terminated_by_manager_id: service.managerId(request),
              },
              updated_at: now,
            },
          },
        );
        await service.writeAudit(
          request,
          "contract.terminated",
          collectionName,
          id,
          { reason: reason.trim() },
        );
        return response.json({
          data: { id: id.toString(), status: "terminated" },
        });
      }
      if (
        action === "review" &&
        typeof note === "string" &&
        note.trim().length &&
        note.length <= 1000
      ) {
        const managerReview = {
          note: note.trim(),
          reason: reason.trim(),
          reviewed_by_manager_id: service.managerId(request),
          reviewed_at: now,
        };
        await contracts.updateOne(
          { _id: id },
          { $set: { manager_review: managerReview, updated_at: now } },
        );
        await service.writeAudit(
          request,
          "contract.reviewed",
          collectionName,
          id,
          { reason: reason.trim(), note: note.trim() },
        );
        return response.json({ data: { id: id.toString(), managerReview } });
      }
      return response
        .status(400)
        .json({ error: { message: "Hành động hợp đồng không được hỗ trợ." } });
    },
    inspectionReport: async (request, response) => {
      const filter = {};
      if (request.query.from || request.query.to) {
        filter.inspected_at = {};
        if (request.query.from && !Number.isNaN(Date.parse(request.query.from)))
          filter.inspected_at.$gte = new Date(request.query.from);
        if (request.query.to && !Number.isNaN(Date.parse(request.query.to))) {
          filter.inspected_at.$lte = new Date(request.query.to);
          if (request.query.to.length === 10)
            filter.inspected_at.$lte.setHours(23, 59, 59, 999);
        }
      }
      const data = await repository
        .collection("vehicle_inspections")
        .find(filter)
        .sort({ inspected_at: -1 })
        .limit(200)
        .toArray();
      const vehicleIds = [
        ...new Map(
          data
            .map((row) => row.vehicle_id)
            .filter(Boolean)
            .map((id) => [id.toString(), id]),
        ).values(),
      ];
      const vehicles = vehicleIds.length
        ? await repository
            .collection("vehicles")
            .find({ _id: { $in: vehicleIds } })
            .project({ brand: 1, model: 1, license_plate: 1 })
            .toArray()
        : [];
      const map = new Map(
        vehicles.map((vehicle) => [vehicle._id.toString(), vehicle]),
      );
      return response.json({
        data: data.map((row) => ({
          id: row._id.toString(),
          inspectedAt: row.inspected_at,
          result:
            row.approval_status ||
            row.result ||
            row.inspection_result ||
            row.status ||
            row.recommendation ||
            "completed",
          notes:
            row.decision_reason ||
            row.notes ||
            Object.values(row.condition_report || {})
              .filter((value) => typeof value === "string")
              .join(", "),
          vehicle: map.get(row.vehicle_id?.toString()) || null,
        })),
      });
    },
    financeReport: async (request, response) => {
      const from = request.query.from
        ? new Date(request.query.from)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const to = request.query.to ? new Date(request.query.to) : new Date();
      if (
        Number.isNaN(from.getTime()) ||
        Number.isNaN(to.getTime()) ||
        from > to
      ) {
        return response
          .status(400)
          .json({ error: { message: "Khoảng ngày báo cáo không hợp lệ." } });
      }
      if (request.query.to?.length === 10)
        to.setUTCHours(23, 59, 59, 999);
      const rows = await repository
        .collection("owner_settlements")
        .find({ settled_at: { $gte: from, $lte: to }, payout_status: "paid" })
        .project({
          settled_at: 1,
          gross_rental_revenue: 1,
          platform_commission: 1,
          net_owner_payout: 1,
        })
        .sort({ settled_at: 1 })
        .toArray();
      const totals = rows.reduce(
        (result, item) => ({
          grossRentalRevenue:
            result.grossRentalRevenue +
            (Number(item.gross_rental_revenue) || 0),
          platformCommission:
            result.platformCommission + (Number(item.platform_commission) || 0),
          ownerPayout:
            result.ownerPayout + (Number(item.net_owner_payout) || 0),
        }),
        { grossRentalRevenue: 0, platformCommission: 0, ownerPayout: 0 },
      );
      return response.json({
        data: {
          from,
          to,
          totals,
          settlements: rows.map((item) => ({
            date: item.settled_at,
            grossRentalRevenue: item.gross_rental_revenue || 0,
            platformCommission: item.platform_commission || 0,
            ownerPayout: item.net_owner_payout || 0,
          })),
        },
      });
    },
    operationsReport: async (request, response) => {
      const from = request.query.from
        ? new Date(request.query.from)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const to = request.query.to ? new Date(request.query.to) : new Date();
      if (
        Number.isNaN(from.getTime()) ||
        Number.isNaN(to.getTime()) ||
        from > to
      )
        return response
          .status(400)
          .json({ error: { message: "Khoảng ngày báo cáo không hợp lệ." } });
      if (request.query.to?.length === 10) to.setHours(23, 59, 59, 999);
      const [bookings, incidents, fleetSize] = await Promise.all([
        repository
          .collection("bookings")
          .find({ start_at: { $gte: from, $lte: to } })
          .project({ status: 1, vehicle_id: 1, rental_fee_amount: 1 })
          .toArray(),
        repository
          .collection("incident_cases")
          .find({ created_at: { $gte: from, $lte: to } })
          .project({ status: 1 })
          .toArray(),
        repository
          .collection("vehicles")
          .countDocuments({ onboarding_status: "approved" }),
      ]);
      const byStatus = bookings.reduce((result, item) => {
        const key = item.status || "unknown";
        result[key] = (result[key] || 0) + 1;
        return result;
      }, {});
      const activeStatuses = new Set(["confirmed", "ongoing", "completed"]);
      const activeBookings = bookings.filter((item) =>
        activeStatuses.has(item.status),
      );
      const utilizedVehicles = new Set(
        activeBookings
          .map((item) => item.vehicle_id?.toString())
          .filter(Boolean),
      ).size;
      const openIncidents = incidents.filter((item) =>
        OPEN_INCIDENT_STATUSES.includes(item.status),
      ).length;
      const report = {
        from,
        to,
        bookings: {
          total: bookings.length,
          byStatus,
          rentalRevenue: bookings.reduce(
            (sum, item) => sum + (Number(item.rental_fee_amount) || 0),
            0,
          ),
        },
        fleet: {
          approvedVehicles: fleetSize,
          vehiclesWithBookings: utilizedVehicles,
          utilizationPct: fleetSize
            ? Math.round((utilizedVehicles / fleetSize) * 1000) / 10
            : 0,
        },
        incidents: {
          total: incidents.length,
          open: openIncidents,
          resolved: incidents.length - openIncidents,
        },
      };
      return response.json({ data: report });
    },
  };
}
