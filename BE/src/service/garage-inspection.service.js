import { Types } from 'mongoose';
import { httpError } from '../utils/http-error.js';

const { ObjectId } = Types;

const conditionFields = ['exterior', 'interior', 'engine', 'tires'];
const vehicleFields = {
  owner_id: 1,
  brand: 1,
  model: 1,
  license_plate: 1,
  manufacture_year: 1,
  onboarding_status: 1,
  physical_status: 1,
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const vehicleQuery = (q) => ({
  $or: ['brand', 'model', 'license_plate'].map((field) => ({
    [field]: { $regex: escapeRegex(q), $options: 'i' },
  })),
});
const pagination = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});
const openStatus = { $in: ['draft', 'pending'] };

export function createVehicleInspectionService(repository) {
  const inspections = repository.inspections;
  const vehicles = repository.vehicles;
  let indexReady;
  async function ensureIndex() {
    if (!indexReady)
      indexReady = inspections
        .ensureIndexes()
        .catch(() => {
          indexReady = undefined;
          throw httpError(
            503,
            'Chưa tạo được index chống kiểm định trùng. Cần MongoDB 6.0+ và kiểm tra các biên bản đang mở.',
          );
        });
    await indexReady;
  }
  async function context(vehicleId, session) {
    const options = session ? { session } : {};
    const vehicle = await vehicles.findOne(
      { _id: vehicleId },
      { ...options, projection: vehicleFields },
    );
    if (!vehicle) throw httpError(404, 'Không tìm thấy xe.');
    const open = await inspections.findOne(
      {
        vehicle_id: vehicleId,
        inspection_type: 'onboarding',
        approval_status: openStatus,
      },
      { ...options, projection: { garage_staff_id: 1, approval_status: 1 } },
    );
    const previous = await inspections.findOne(
      {
        vehicle_id: vehicleId,
        inspection_type: 'onboarding',
        approval_status: { $in: ['approved', 'revision_required', 'rejected'] },
      },
      {
        ...options,
        sort: { 'condition_report.odometer_km': -1, _id: -1 },
        projection: { 'condition_report.odometer_km': 1 },
      },
    );
    const intake = await repository.intakes
      .findOne(
        {
          vehicle_id: vehicleId,
          $or: [{ status: 'completed' }, { status: { $exists: false } }],
        },
        {
          ...options,
          sort: { odometer_km: -1, _id: -1 },
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
      owner,
      open,
      baselineOdometerKm: Math.max(
        previous?.condition_report?.odometer_km || 0,
        intake?.odometer_km || 0,
      ),
    };
  }
  function eligibility(data, currentId) {
    const blockers = [];
    if (
      !['submitted', 'revision_required'].includes(
        data.vehicle.onboarding_status,
      )
    )
      blockers.push({
        code: 'INVALID_ONBOARDING_STATUS',
        message: 'Xe phải đang chờ kiểm định hoặc đã gửi bổ sung hồ sơ.',
      });
    if (
      !['with_owner', 'returned_to_owner'].includes(
        data.vehicle.physical_status,
      )
    )
      blockers.push({
        code: 'INVALID_PHYSICAL_STATUS',
        message: 'Kiểm định đầu vào chỉ áp dụng khi xe đang ở chủ xe.',
      });
    if (data.open && (!currentId || !data.open._id.equals(currentId)))
      blockers.push({
        code: 'OPEN_INSPECTION_EXISTS',
        message: 'Xe đã có biên bản nháp hoặc đang chờ Manager duyệt.',
      });
    return {
      eligible: blockers.length === 0,
      blockers,
      vehicle: data.vehicle,
      owner: data.owner,
      baselineOdometerKm: data.baselineOdometerKm,
      openInspection: data.open,
    };
  }
  async function get(id, session) {
    const record = await inspections.findOne(
      { _id: id, inspection_type: 'onboarding' },
      session ? { session } : {},
    );
    if (!record) throw httpError(404, 'Không tìm thấy biên bản kiểm định.');
    return record;
  }
  function requireOwner(record, actor) {
    if (
      !(record.garage_staff_id instanceof ObjectId) ||
      !record.garage_staff_id.equals(actor._id)
    )
      throw httpError(
        403,
        'Bạn chỉ được sửa hoặc gửi biên bản kiểm định của mình.',
      );
  }
  function requireEligible(result) {
    if (!result.eligible)
      throw httpError(409, 'Xe chưa đủ điều kiện kiểm định.', {
        blockers: result.blockers,
      });
  }
  async function list(query, actor, candidates = false) {
    const { page, limit, q, status, mine } = query;
    if (candidates) {
      const filter = {
        onboarding_status: { $in: ['submitted', 'revision_required'] },
        physical_status: { $in: ['with_owner', 'returned_to_owner'] },
        ...(q ? vehicleQuery(q) : {}),
      };
      const [result] = await vehicles
        .aggregate([
          { $match: filter },
          {
            $facet: {
              data: [
                { $sort: { _id: -1 } },
                { $skip: (page - 1) * limit },
                { $limit: limit },
                { $project: { _id: 1 } },
              ],
              count: [{ $count: 'total' }],
            },
          },
        ])
        .exec();
      const data = [];
      for (const item of result.data)
        data.push(eligibility(await context(item._id)));
      return {
        data,
        pagination: pagination(page, limit, result.count[0]?.total || 0),
      };
    }
    const match = { inspection_type: 'onboarding' };
    if (status !== 'all') match.approval_status = status;
    if (mine) match.garage_staff_id = actor._id;
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
    const [result] = await inspections
      .aggregate([
        ...pipeline,
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
    return {
      data: result.data,
      pagination: pagination(page, limit, result.count[0]?.total || 0),
    };
  }
  async function create(draft, actor) {
    await ensureIndex();
    requireEligible(eligibility(await context(draft.vehicle_id)));
    const now = new Date();
    const record = {
      ...draft,
      _id: new ObjectId(),
      inspection_type: 'onboarding',
      garage_staff_id: actor._id,
      approval_status: 'draft',
      version: 0,
      condition_report: draft.condition_report || {},
      created_at: now,
      updated_at: now,
    };
    try {
      await inspections.create(record);
    } catch (error) {
      if (error.code === 11000)
        throw httpError(409, 'Xe đã có biên bản nháp hoặc chờ duyệt.');
      throw error;
    }
    return record;
  }
  async function update(id, draft, actor) {
    const record = await get(id);
    requireOwner(record, actor);
    if (record.approval_status !== 'draft')
      throw httpError(409, 'Chỉ được chỉnh sửa bản nháp kiểm định.');
    const { version, ...changes } = draft;
    if (changes.condition_report)
      changes.condition_report = {
        ...record.condition_report,
        ...changes.condition_report,
      };
    const updated = await inspections.findOneAndUpdate(
      { _id: id, approval_status: 'draft', version },
      { $set: { ...changes, updated_at: new Date() }, $inc: { version: 1 } },
      { returnDocument: 'after' },
    );
    if (!updated)
      throw httpError(409, 'Biên bản đã thay đổi. Tải lại trước khi lưu.');
    return updated;
  }
  async function submit(id, version, actor) {
    await ensureIndex();
    const hello = await repository.command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid')
      throw httpError(
        503,
        'Gửi đề xuất kiểm định cần MongoDB replica set hoặc Atlas để ghi transaction.',
      );
    const session = await repository.startSession();
    try {
      return await session.withTransaction(
        async () => {
          const record = await get(id, session);
          requireOwner(record, actor);
          if (record.approval_status !== 'draft') {
            if (record.submitted_from_version === version)
              return { data: record, replayed: true };
            throw httpError(409, 'Biên bản đã gửi hoặc đã được Manager xử lý.');
          }
          if (record.version !== version)
            throw httpError(
              409,
              'Biên bản đã thay đổi. Tải lại trước khi gửi.',
            );
          const data = await context(record.vehicle_id, session);
          requireEligible(eligibility(data, record._id));
          const report = record.condition_report || {};
          if (
            !Number.isSafeInteger(report.odometer_km) ||
            report.odometer_km < data.baselineOdometerKm ||
            report.odometer_km > 10000000
          )
            throw httpError(
              400,
              `Số km phải là số nguyên, không nhỏ hơn ${data.baselineOdometerKm} km đã ghi nhận.`,
            );
          if (
            !Number.isSafeInteger(report.fuel_level_pct) ||
            report.fuel_level_pct < 0 ||
            report.fuel_level_pct > 100
          )
            throw httpError(400, 'Cần mức nhiên liệu / pin từ 0 đến 100%.');
          if (
            conditionFields.some(
              (field) =>
                !['good', 'attention', 'damaged'].includes(report[field]),
            )
          )
            throw httpError(
              400,
              'Cần đánh giá đầy đủ ngoại thất, nội thất, động cơ và lốp.',
            );
          const abnormal = conditionFields.some(
            (field) => report[field] !== 'good',
          );
          if (abnormal && !report.note?.trim())
            throw httpError(400, 'Cần mô tả hạng mục bất thường.');
          if (
            !['pass', 'requires_repair', 'fail'].includes(record.recommendation)
          )
            throw httpError(400, 'Cần chọn đề xuất kiểm định.');
          if (record.recommendation === 'pass' && abnormal)
            throw httpError(
              400,
              'Xe có hạng mục bất thường không được đề xuất đạt.',
            );
          if (record.recommendation !== 'pass' && !report.note?.trim())
            throw httpError(
              400,
              'Cần ghi rõ lý do yêu cầu sửa chữa hoặc không đạt.',
            );
          const now = new Date();
          // Touch the vehicle to detect concurrent changes to its onboarding/physical state.
          const changed = await vehicles.updateOne(
            {
              _id: record.vehicle_id,
              onboarding_status: data.vehicle.onboarding_status,
              physical_status: data.vehicle.physical_status,
            },
            {
              $inc: { inspection_workflow_version: 1 },
              $set: { updated_at: now },
            },
            { session },
          );
          if (changed.modifiedCount !== 1)
            throw httpError(409, 'Trạng thái xe đã thay đổi.');
          const submitted = await inspections.findOneAndUpdate(
            { _id: id, approval_status: 'draft', version },
            {
              $set: {
                approval_status: 'pending',
                inspected_at: now,
                submitted_at: now,
                submitted_from_version: version,
                updated_at: now,
              },
              $inc: { version: 1 },
            },
            { session, returnDocument: 'after' },
          );
          if (!submitted) throw httpError(409, 'Biên bản đã thay đổi.');
          await repository.auditLogs
            .create(
              {
                _id: new ObjectId(),
                actor_user_id: actor._id,
                action: 'vehicle.inspection.submitted',
                entity_type: 'vehicle_inspection',
                entity_id: id,
                sanitized_changes: {
                  vehicle_id: record.vehicle_id,
                  recommendation: record.recommendation,
                  approval_status: { from: 'draft', to: 'pending' },
                },
                created_at: now,
              },
              { session },
            );
          return { data: submitted, replayed: false };
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
    submit,
    eligibility: async (vehicleId) => eligibility(await context(vehicleId)),
    get: async (id) => {
      const record = await get(id);
      return {
        ...record,
        eligibility: eligibility(
          await context(record.vehicle_id),
          record.approval_status === 'draft' ? record._id : undefined,
        ),
      };
    },
  };
}
