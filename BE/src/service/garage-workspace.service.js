const same = (a, b) => a && b && String(a) === String(b);
const iso = (value) => new Date(new Date(value || 0).getTime() + 7 * 3600000).toISOString().replace('Z', '+07:00');
const photo = (key) => ({ key, name: key.split('/').at(-1) });
const normalizeCondition = (value) => ['clean', 'normal', 'no_new_damage'].includes(value) ? 'good' : value || '';
const recommendation = { pass: 'pass', requires_repair: 'revision', fail: 'reject' };

export function createGarageWorkspaceService(repository, inspectionService, intakeService, handoverService) {
  return {
    async get(permissions, actor) {
      const data = await repository.snapshot(permissions, actor);
      const vehicles = new Map(data.vehicles.map((item) => [String(item._id), item]));
      const users = new Map(data.users.map((item) => [String(item._id), item.full_name]));
      const tasks = [];
      function task(kind, vehicleId, record, context = {}, booking, agreement) {
        const vehicle = vehicles.get(String(vehicleId)) || {};
        const report = record?.condition_report || record?.condition_snapshot || record?.vehicle_condition;
        const rawStatus = record?.approval_status || record?.status;
        const rejectedApplication = kind === 'inspection' && !record && vehicle.onboarding_status === 'rejected';
        const status = rejectedApplication ? 'rejected' : !record ? 'pending' : kind === 'inspection' ? (rawStatus === 'pending' ? 'submitted' : rawStatus) : rawStatus === 'draft' ? 'draft' : 'completed';
        const staffId = record?.garage_staff_id || record?.created_by_garage_staff_id || record?.received_by_garage_staff_id;
        const editable = !rejectedApplication && (!record || (rawStatus === 'draft' && same(staffId, actor._id)));
        const schedule = booking ? (kind === 'return' ? booking.end_at : booking.start_at) : record?.scheduled_for || record?.created_at || vehicle.created_at;
        tasks.push({
          id: `${kind}:${record?._id || booking?._id || vehicleId}`,
          kind, recordId: record?._id, version: record?.version, vehicleId, bookingId: booking?._id,
          agreementId: record?.management_agreement_id || agreement?._id,
          vehicle: [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'Xe chưa có thông tin', plate: vehicle.license_plate || '—',
          contact: users.get(String(booking?.renter_id || vehicle.owner_id)) || 'Chưa cập nhật', status,
          decisionReason: record?.decision_reason || '',
          vehicleReviewNote: vehicle.review_note || '',
          vehicleReviewStatus: vehicle.onboarding_status,
          scheduleNote: record?.schedule_note,
          arrivalReview: record?.arrival_review,
          vin: kind === 'inspection' && same(staffId, actor._id) ? vehicle.vin : undefined,
          conditionDeclaration: vehicle.condition_declaration || '',
          baselineCondition: context.baselineCondition,
          occurredAt: record?.occurred_at,
          damageChanges: record?.damage_changes,
          ownerReview: record?.owner_review,
          renterResponse: record?.renter_response,
          renterDisputeNote: record?.renter_dispute_note,
          odometer: context.baselineOdometerKm || record?.odometer_km || 0,
          fuel: context.baselineFuelPct ?? record?.fuel_level_pct ?? report?.fuel_level_pct ?? 0,
          schedule: iso(schedule), scheduled: Boolean(booking || record?.scheduled_for),
          reference: booking?.booking_code || agreement?.agreement_number || String(record?._id || vehicleId),
          location: booking?.pickup_location?.branch || 'Chưa có thông tin địa điểm', bay: 'Chưa có thông tin vị trí',
          requirements: {}, blockers: editable ? (context.blockers || []).map((item) => item.message) : [], readOnly: !editable,
          report: report ? {
            odometer: String(record?.odometer_km ?? report.odometer_km ?? ''), fuel: String(record?.fuel_level_pct ?? report.fuel_level_pct ?? ''),
            ...Object.fromEntries(['exterior', 'interior', 'engine', 'tires'].map((key) => [key, normalizeCondition(report[key])])),
            note: report.note || '', photos: (report.photo_keys || []).map(photo), accessories: report.accessories || [], recommendation: recommendation[record?.recommendation] || '',
            checklist: report.checklist, defects: report.defects,
            confirmed: Boolean(record?.owner_confirmed_at || record?.renter_confirmed_at),
          } : null,
        });
      }
      if (permissions.includes('vehicle.inspect')) {
        for (const record of data.inspections) {
          const context = record.approval_status === 'draft' && vehicles.has(String(record.vehicle_id)) ? await inspectionService.eligibility(record.vehicle_id) : {};
          // Eligibility for an existing draft must ignore that draft's own open-report lock.
          if (context.blockers) context.blockers = context.blockers.filter((item) => item.code !== 'OPEN_INSPECTION_EXISTS');
          task('inspection', record.vehicle_id, record, context);
        }
        for (const vehicle of data.vehicles.filter((item) => ['submitted', 'revision_required'].includes(item.onboarding_status) && ['with_owner', 'returned_to_owner'].includes(item.physical_status))) {
          if (!data.inspections.some((item) => same(item.vehicle_id, vehicle._id) && ['draft', 'pending'].includes(item.approval_status))) task('inspection', vehicle._id, null, await inspectionService.eligibility(vehicle._id));
        }
        for (const vehicle of data.vehicles.filter((item) => item.onboarding_status === 'rejected')) {
          if (!data.inspections.some((item) => same(item.vehicle_id, vehicle._id))) task('inspection', vehicle._id, null);
        }
      }
      if (permissions.includes('vehicle.intake')) {
        for (const record of data.intakes) {
          const agreement = data.agreements.find((item) => same(item._id, record.management_agreement_id));
          const context = record.status === 'draft' && vehicles.has(String(record.vehicle_id)) ? await intakeService.eligibility(record.vehicle_id, record.management_agreement_id) : {};
          task('intake', record.vehicle_id, record, context, null, agreement);
        }
        for (const vehicle of data.vehicles.filter((item) => ['with_owner', 'returned_to_owner'].includes(item.physical_status))) {
          const agreement = data.agreements.find((item) => same(item.vehicle_id, vehicle._id) && same(item.owner_id, vehicle.owner_id));
          if (agreement && data.intakes.some((item) => same(item.management_agreement_id, agreement._id))) continue;
          const context = agreement ? await intakeService.eligibility(vehicle._id, agreement._id) : { blockers: [{ message: 'Chưa có hợp đồng quản lý cho xe này.' }] };
          task('intake', vehicle._id, null, context, null, agreement);
        }
      }
      if (permissions.includes('handover.record')) {
        for (const withdrawal of data.withdrawals) {
          const vehicle = vehicles.get(String(withdrawal.vehicle_id));
          const intake = [...data.intakes, ...data.returnIntakes].find((item) =>
            same(item.management_agreement_id, withdrawal.management_agreement_id) && item.status === 'completed');
          if (!vehicle || !intake) continue;
          const report = withdrawal.owner_return_handover;
          const saved = report ? {
            ...report, _id: withdrawal._id, condition_snapshot: report.condition, occurred_at: report.returned_at,
            status: withdrawal.status === 'withdrawn' ? 'completed' : 'draft',
          } : null;
          const blockers = ['at_garage', 'maintenance'].includes(vehicle.physical_status) ? [] : [{ message: 'Xe chưa có mặt tại gara để trả chủ.' }];
          task('owner-return', withdrawal.vehicle_id, saved, {
            blockers, baselineOdometerKm: intake.odometer_km, baselineFuelPct: intake.fuel_level_pct,
            baselineCondition: intake.condition_snapshot,
          });
          const item = tasks.at(-1);
          item.id = `owner-return:${withdrawal._id}`;
          item.withdrawalId = withdrawal._id;
          item.reference = String(withdrawal._id);
          if (withdrawal.requested_return_at) {
            item.schedule = iso(withdrawal.requested_return_at);
            item.scheduled = true;
          }
        }
        for (const record of data.handovers) {
          const booking = data.bookings.find((item) => same(item._id, record.booking_id));
          const context = booking ? await handoverService.context(booking._id, record.handover_type) : {};
          task(record.handover_type === 'pickup' ? 'handover' : 'return', record.vehicle_id, record, context, booking);
        }
        for (const booking of data.bookings.filter((item) => ['confirmed', 'ongoing'].includes(item.status))) {
          const type = booking.status === 'confirmed' ? 'pickup' : 'return';
          if (!data.handovers.some((item) => same(item.booking_id, booking._id) && item.handover_type === type)) task(type === 'pickup' ? 'handover' : 'return', booking.vehicle_id, null, await handoverService.context(booking._id, type), booking);
        }
      }
      const incidents = data.incidents.map((record) => ({
        id: record.case_number, recordId: record._id, vehicleId: record.vehicle_id, bookingId: record.booking_id,
        vehicle: [vehicles.get(String(record.vehicle_id))?.brand, vehicles.get(String(record.vehicle_id))?.model].filter(Boolean).join(' ') || 'Xe chưa có thông tin',
        plate: vehicles.get(String(record.vehicle_id))?.license_plate || '—', description: record.description, severity: record.severity || 'medium',
        time: record.created_at, status: record.status, photos: (record.evidence || []).filter((item) => item.kind === 'image').map((item) => photo(item.file_key)),
      }));
      const titles = { 'vehicle.inspection.submitted': 'Gửi đề xuất kiểm định', 'vehicle.intake.confirmed': 'Xác nhận tiếp nhận xe', 'garage.pickup.confirmed': 'Xác nhận bàn giao xe', 'garage.return.confirmed': 'Xác nhận nhận trả xe', 'garage.incident.reported': 'Gửi báo cáo sự cố' };
      const history = data.history.map((event) => ({ id: event._id, time: event.created_at, title: titles[event.action] || event.action, detail: tasks.find((item) => same(item.recordId, event.entity_id))?.vehicle || String(event.entity_id), type: 'completed' }));
      for (const item of tasks.filter((item) => item.status === 'draft' && !item.readOnly)) {
        const record = [...data.inspections, ...data.intakes, ...data.handovers].find((record) => same(record._id, item.recordId));
        history.push({ id: `draft:${item.recordId}`, time: record.updated_at || record.created_at, title: 'Bản nháp được cập nhật gần nhất', detail: `${item.vehicle} · ${item.plate}`, type: 'draft' });
      }
      history.sort((a, b) => new Date(b.time) - new Date(a.time));
      return { tasks, incidents, history, permissions, vehicles: permissions.includes('case.report') ? data.vehicles.map((item) => ({ id: item._id, vehicle: `${item.brand || ''} ${item.model || ''}`.trim(), plate: item.license_plate })) : [] };
    },
  };
}
