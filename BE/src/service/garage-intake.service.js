import { Types } from 'mongoose';
import { httpError } from '../utils/http-error.js';

const { ObjectId } = Types;

const fields = ['exterior', 'interior', 'engine', 'tires'];
const vehicleFields = {
  condition_declaration: 1,
  owner_id: 1,
  brand: 1,
  model: 1,
  license_plate: 1,
  description: 1,
  daily_price: 1,
  mileage_policy: 1,
  photos: 1,
  publish_vehicle_photos: 1,
  manufacture_year: 1,
  onboarding_status: 1,
  physical_status: 1,
};
const agreementFields = {
  vehicle_id: 1,
  owner_id: 1,
  agreement_number: 1,
  status: 1,
  start_date: 1,
  end_date: 1,
  signature_info: 1,
  inspection_id: 1,
  inspection_version: 1,
  'authorization_scope.vehicle_custody': 1,
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isCompleted = (record) =>
  record && (record.status === 'completed' || record.status === undefined);
const sameId = (a, b) =>
  a instanceof ObjectId && b instanceof ObjectId && a.equals(b);

export function createVehicleIntakeService(repository) {
  const receipts = repository.intakes;
  let indexReady;
  async function ensureIndex() {
    if (!indexReady)
      indexReady = receipts
        .ensureIndexes()
        .catch((error) => {
          indexReady = null;
          throw httpError(
            503,
            'Chưa tạo được index chống tiếp nhận trùng. Kiểm tra dữ liệu vehicle_intakes trước khi thử lại.',
          );
        });
    await indexReady;
  }
  async function context(vehicleId, agreementId, session) {
    const options = session ? { session } : {};
    const vehicle = await repository.vehicles
      .findOne({ _id: vehicleId }, { ...options, projection: vehicleFields });
    if (!vehicle) throw httpError(404, 'Không tìm thấy xe.');
    const agreement = await repository.agreements
      .findOne(
        { _id: agreementId },
        { ...options, projection: agreementFields },
      );
    if (!agreement) throw httpError(404, 'Không tìm thấy hợp đồng quản lý.');
    if (
      !sameId(agreement.vehicle_id, vehicleId) ||
      !sameId(agreement.owner_id, vehicle.owner_id)
    )
      throw httpError(409, 'Hợp đồng không thuộc xe hoặc chủ xe này.');
    // Sequential reads also work inside transactions (no parallel session operations).
    const inspection = await repository.inspections
      .findOne(
        { vehicle_id: vehicleId, inspection_type: 'onboarding' },
        {
          ...options,
          sort: { created_at: -1, _id: -1 },
          projection: {
            approval_status: 1,
            recommendation: 1,
            inspected_at: 1,
            version: 1,
            'condition_report.odometer_km': 1,
          },
        },
      );
    const existing = await receipts.findOne(
      { management_agreement_id: agreementId },
      options,
    );
    const previous = await receipts.findOne(
      {
        vehicle_id: vehicleId,
        $or: [{ status: 'completed' }, { status: { $exists: false } }],
      },
      {
        ...options,
        sort: { received_at: -1, _id: -1 },
        projection: { odometer_km: 1 },
      },
    );
    const owner = await repository.users
      .findOne(
        { _id: vehicle.owner_id },
        { ...options, projection: { full_name: 1 } },
      );
    return {
      vehicle,
      agreement,
      inspection,
      existing,
      owner,
      baselineOdometerKm: Math.max(
        inspection?.condition_report?.odometer_km || 0,
        previous?.odometer_km || 0,
      ),
    };
  }
  function eligibility(data, now = new Date()) {
    const {
      vehicle,
      agreement,
      inspection,
      existing,
      baselineOdometerKm,
      owner,
    } = data;
    const blockers = [];
    const add = (code, message) => blockers.push({ code, message });
    if (vehicle.onboarding_status !== 'approved')
      add('VEHICLE_NOT_APPROVED', 'Xe chưa được phê duyệt.');
    if (!['with_owner', 'returned_to_owner'].includes(vehicle.physical_status))
      add(
        'INVALID_PHYSICAL_STATUS',
        'Xe không ở trạng thái có thể tiếp nhận từ chủ xe.',
      );
    if (
      !inspection ||
      inspection.approval_status !== 'approved' ||
      inspection.recommendation !== 'pass'
    )
      add(
        'INSPECTION_NOT_APPROVED',
        'Kiểm định đầu vào mới nhất chưa được duyệt đạt.',
      );
    if (agreement.status !== 'active')
      add('AGREEMENT_NOT_ACTIVE', 'Hợp đồng quản lý chưa có hiệu lực.');
    if (
      !(agreement.start_date instanceof Date) ||
      !(agreement.end_date instanceof Date) ||
      agreement.start_date > now ||
      agreement.end_date <= now
    )
      add('AGREEMENT_OUTSIDE_TERM', 'Hợp đồng chưa bắt đầu hoặc đã hết hạn.');
    if (
      !(agreement.signature_info?.owner_signed_at instanceof Date) ||
      !(agreement.signature_info?.platform_signed_at instanceof Date) ||
      agreement.signature_info.owner_signed_at > now ||
      agreement.signature_info.platform_signed_at > now
    )
      add('AGREEMENT_NOT_SIGNED', 'Hợp đồng chưa được cả hai bên ký.');
    if (agreement.authorization_scope?.vehicle_custody !== true)
      add(
        'CUSTODY_NOT_AUTHORIZED',
        'Hợp đồng chưa cho phép nền tảng tiếp nhận và giữ xe.',
      );
    if (isCompleted(existing))
      add('ALREADY_RECEIVED', 'Hợp đồng đã có biên bản tiếp nhận hoàn tất.');
    return {
      eligible: blockers.length === 0,
      blockers,
      baselineOdometerKm,
      vehicle,
      owner,
      agreement: {
        _id: agreement._id,
        agreement_number: agreement.agreement_number,
        status: agreement.status,
        start_date: agreement.start_date,
        end_date: agreement.end_date,
      },
      inspection: inspection || null,
      intakeId: existing?._id || null,
    };
  }
  async function get(id, session) {
    const item = await receipts.findOne(
      { _id: id },
      session ? { session } : {},
    );
    if (!item) throw httpError(404, 'Không tìm thấy biên bản tiếp nhận.');
    return { ...item, status: item.status || 'completed' };
  }
  function requireCreator(item, actor) {
    if (
      !sameId(
        item.created_by_garage_staff_id || item.received_by_garage_staff_id,
        actor._id,
      )
    )
      throw httpError(
        403,
        'Bạn chỉ được sửa hoặc xác nhận biên bản do mình tạo.',
      );
  }
  async function list(query, candidates = false) {
    const { page, limit, q, status } = query;
    if (candidates) {
      const filter = {
        physical_status: { $in: ['with_owner', 'returned_to_owner'] },
      };
      if (q)
        filter.$or = ['brand', 'model', 'license_plate'].map((field) => ({
          [field]: { $regex: escapeRegex(q), $options: 'i' },
        }));
      const total = await repository.vehicles
        .countDocuments(filter);
      const vehicles = await repository.vehicles
        .find(filter, { projection: vehicleFields })
        .sort({ _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec();
      const data = [];
      for (const vehicle of vehicles) {
        const agreement = await repository.agreements
          .findOne(
            { vehicle_id: vehicle._id, owner_id: vehicle.owner_id },
            { sort: { created_at: -1, _id: -1 }, projection: { _id: 1 } },
          );
        data.push(
          agreement
            ? eligibility(await context(vehicle._id, agreement._id))
            : {
                vehicle,
                eligible: false,
                blockers: [
                  {
                    code: 'NO_AGREEMENT',
                    message: 'Xe chưa có hợp đồng quản lý.',
                  },
                ],
                agreement: null,
              },
        );
      }
      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
    const match = {};
    if (status === 'draft') match.status = 'draft';
    if (status === 'completed')
      match.$or = [{ status: 'completed' }, { status: { $exists: false } }];
    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'vehicles',
          localField: 'vehicle_id',
          foreignField: '_id',
          pipeline: [{ $project: vehicleFields }],
          as: 'vehicle',
        },
      },
      { $unwind: { path: '$vehicle', preserveNullAndEmptyArrays: true } },
    ];
    if (q)
      pipeline.push({
        $match: {
          $or: ['vehicle.brand', 'vehicle.model', 'vehicle.license_plate'].map(
            (field) => ({ [field]: { $regex: escapeRegex(q), $options: 'i' } }),
          ),
        },
      });
    const [result] = await receipts
      .aggregate([
        ...pipeline,
        { $set: { status: { $ifNull: ['$status', 'completed'] } } },
        {
          $facet: {
            data: [
              { $sort: { created_at: -1, _id: -1 } },
              { $skip: (page - 1) * limit },
              { $limit: limit },
            ],
            count: [{ $count: 'total' }],
          },
        },
      ])
      .exec();
    const total = result.count[0]?.total || 0;
    return {
      data: result.data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
  async function create(draft, actor) {
    await ensureIndex();
    await context(draft.vehicle_id, draft.management_agreement_id);
    const now = new Date();
    const item = {
      ...draft,
      _id: new ObjectId(),
      status: 'draft',
      version: 0,
      created_by_garage_staff_id: actor._id,
      condition_snapshot: draft.condition_snapshot || {},
      created_at: now,
      updated_at: now,
    };
    try {
      await receipts.create(item);
    } catch (error) {
      if (error.code === 11000)
        throw httpError(
          409,
          'Hợp đồng đã có biên bản tiếp nhận. Mở biên bản hiện có thay vì tạo mới.',
        );
      throw error;
    }
    return item;
  }
  async function update(id, draft, actor) {
    const item = await get(id);
    requireCreator(item, actor);
    if (item.status !== 'draft')
      throw httpError(409, 'Biên bản hoàn tất không được chỉnh sửa.');
    const { version, ...changes } = draft;
    if (changes.condition_snapshot)
      changes.condition_snapshot = {
        ...item.condition_snapshot,
        ...changes.condition_snapshot,
      };
    const updated = await receipts.findOneAndUpdate(
      { _id: id, status: 'draft', version },
      { $set: { ...changes, updated_at: new Date() }, $unset: { owner_review: 1 }, $inc: { version: 1 } },
      { returnDocument: 'after' },
    );
    if (!updated)
      throw httpError(409, 'Biên bản đã thay đổi. Tải lại trước khi lưu.');
    return updated;
  }
  async function confirm(id, version, actor) {
    await ensureIndex();
    const hello = await repository.command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid')
      throw httpError(
        503,
        'Xác nhận tiếp nhận cần MongoDB replica set để cập nhật biên bản và xe trong cùng transaction.',
      );
    const session = await repository.startSession();
    try {
      return await session.withTransaction(
        async () => {
          const item = await get(id, session);
          requireCreator(item, actor);
          if (item.status === 'completed') {
            if (item.confirmed_from_version !== version)
              throw httpError(409, 'Biên bản đã hoàn tất.');
            return { data: item, replayed: true };
          }
          if (item.status !== 'draft' || item.version !== version)
            throw httpError(
              409,
              'Biên bản đã thay đổi. Tải lại trước khi xác nhận.',
            );
          const now = new Date();
          const data = await context(
            item.vehicle_id,
            item.management_agreement_id,
            session,
          );
          const ready = eligibility(data, now);
          if (!ready.eligible)
            throw httpError(409, 'Xe chưa đủ điều kiện tiếp nhận.', {
              blockers: ready.blockers,
            });
          if (data.agreement.inspection_id && (!sameId(data.agreement.inspection_id, data.inspection?._id)
            || data.agreement.inspection_version !== (data.inspection?.version ?? 0)))
            throw httpError(409, 'Báo cáo kiểm định hiện tại không khớp phiên bản trong hợp đồng.');
          if (data.vehicle.condition_declaration && item.owner_review?.status !== 'accepted')
            throw httpError(409, 'Chủ xe cần xác nhận đúng phiên bản biên bản tiếp nhận.');
          const condition = item.condition_snapshot || {};
          if (condition.defects?.some((defect) => !condition.photo_keys?.includes(defect.photo_key)))
            throw httpError(400, 'Ảnh của từng lỗi phải còn trong biên bản.');
          if (
            !Number.isSafeInteger(item.odometer_km) ||
            item.odometer_km < data.baselineOdometerKm
          )
            throw httpError(
              400,
              `Số km không được nhỏ hơn ${data.baselineOdometerKm} km đã ghi nhận.`,
            );
          if (
            !Number.isSafeInteger(item.fuel_level_pct) ||
            item.fuel_level_pct < 0 ||
            item.fuel_level_pct > 100
          )
            throw httpError(400, 'Cần ghi mức nhiên liệu / pin từ 0 đến 100%.');
          if (
            fields.some(
              (field) =>
                !['good', 'attention', 'damaged'].includes(condition[field]),
            )
          )
            throw httpError(
              400,
              'Cần đánh giá đủ ngoại thất, nội thất, động cơ và lốp.',
            );
          if (
            fields.some((field) => condition[field] !== 'good') &&
            !condition.note?.trim()
          )
            throw httpError(400, 'Cần mô tả hiện trạng bất thường.');
          const vehicle = await repository.vehicles
            .updateOne(
              {
                _id: item.vehicle_id,
                onboarding_status: 'approved',
                physical_status: data.vehicle.physical_status,
              },
              { $set: { physical_status: 'at_garage', updated_at: now } },
              { session },
            );
          if (vehicle.modifiedCount !== 1)
            throw httpError(409, 'Trạng thái xe đã thay đổi.');
          const completed = await receipts.findOneAndUpdate(
            { _id: id, status: 'draft', version },
            {
              $set: {
                status: 'completed',
                received_by_garage_staff_id: actor._id,
                received_at: now,
                owner_confirmed_at: item.owner_review?.reviewed_at || now,
                inspection_id: data.inspection?._id,
                'condition_snapshot.owner_signature_recorded': true,
                confirmed_from_version: version,
                updated_at: now,
              },
              $inc: { version: 1 },
            },
            { session, returnDocument: 'after' },
          );
          if (!completed) throw httpError(409, 'Biên bản đã thay đổi.');
          const listing = await repository.listings.findOne({ vehicle_id: item.vehicle_id, status: { $ne: 'archived' } }, { session });
          if (!listing) {
            const listingId = new ObjectId();
            await repository.listings.create({
              _id: listingId,
              vehicle_id: item.vehicle_id,
              title: [data.vehicle.brand, data.vehicle.model, data.vehicle.license_plate].filter(Boolean).join(' · '),
              description: data.vehicle.description,
              daily_price: data.vehicle.daily_price,
              mileage_policy: data.vehicle.mileage_policy,
              photos: data.vehicle.publish_vehicle_photos === true
                ? (data.vehicle.photos || []).map((_, index) => `/api/listings/${listingId}/photos/${index}`) : [],
              status: 'draft', created_at: now, updated_at: now,
            }, { session });
          }
          await repository.auditLogs
            .create(
              {
                _id: new ObjectId(),
                actor_user_id: actor._id,
                action: 'vehicle.intake.confirmed',
                entity_type: 'vehicle_intake',
                entity_id: id,
                sanitized_changes: {
                  vehicle_id: item.vehicle_id,
                  physical_status: {
                    from: data.vehicle.physical_status,
                    to: 'at_garage',
                  },
                },
                created_at: now,
              },
              { session },
            );
          return { data: completed, replayed: false };
        },
        {
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
          readPreference: 'primary',
        },
      );
    } finally {
      await session.endSession();
    }
  }
  return {
    list,
    create,
    update,
    confirm,
    get: async (id) => {
      const item = await get(id);
      return {
        ...item,
        eligibility: eligibility(
          await context(item.vehicle_id, item.management_agreement_id),
        ),
      };
    },
    eligibility: async (vehicleId, agreementId) =>
      eligibility(await context(vehicleId, agreementId)),
  };
}
