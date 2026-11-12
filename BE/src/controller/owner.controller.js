export function createOwnerController(service) {
  return {
    dashboard: async (request, response) => {
      const data = await service.dashboard({ user: request.user, tokenPayload: request.tokenPayload });
      response.json({ data });
    },
    registerVehicle: async (request, response) => {
      const result = await service.registerVehicle(request.body, { user: request.user, tokenPayload: request.tokenPayload });
      response.status(201).json({ data: result, message: 'Đã gửi hồ sơ xe. Hợp đồng sẽ được lập và ký riêng sau khi xe được duyệt.' });
    },
    resubmitVehicleDocuments: async (request, response) => {
      const data = await service.resubmitVehicleDocuments(request.params.id, request.body, { user: request.user, tokenPayload: request.tokenPayload });
      response.json({ data, message: 'Đã gửi tài liệu bổ sung để Quản lý xét duyệt lại.' });
    },
    respondToInspection: async (request, response) => {
      await service.respondToInspection(request.params.id, request.params.inspectionId, request.body, { user: request.user, tokenPayload: request.tokenPayload });
      response.json({ data: null });
    },
    respondToIntake: async (request, response) => {
      await service.respondToIntake(request.params.id, request.params.intakeId, request.body, { user: request.user, tokenPayload: request.tokenPayload });
      response.json({ data: null });
    },
    agreementDetails: async (request, response) => {
      const data = await service.agreementDetails(request.params.id, { user: request.user, tokenPayload: request.tokenPayload });
      response.json({ data });
    },
    signAgreement: async (request, response) => {
      const data = await service.signAgreement(request.params.id, request.body, { user: request.user, tokenPayload: request.tokenPayload });
      response.json({ data, message: data.status === 'active' ? 'Hợp đồng đã đủ chữ ký và có hiệu lực.' : 'Đã ghi nhận chữ ký của bạn; hợp đồng đang chờ XeDi ký xác nhận.' });
    },
    requestPayout: async (request, response) => {
      const data = await service.requestPayout(request.body, { user: request.user, tokenPayload: request.tokenPayload });
      response.status(201).json({ data, message: 'Đã gửi yêu cầu chi trả để đội ngũ XeDi xác nhận.' });
    },
    confirmOwnerReturn: async (request, response) => {
      const data = await service.confirmOwnerReturn(request.params.id, request.body, { user: request.user, tokenPayload: request.tokenPayload });
      response.json({ data });
    },
    requestVehicleWithdrawal: async (request, response) => {
      const data = await service.requestVehicleWithdrawal(request.body, { user: request.user, tokenPayload: request.tokenPayload });
      response.status(201).json({ data, message: 'Đã gửi yêu cầu rút xe.' });
    },
    reportIncident: async (request, response) => {
      const data = await service.reportIncident(request.body, { user: request.user, tokenPayload: request.tokenPayload });
      response.status(201).json({ data, message: 'Đã gửi báo cáo sự cố đến đội ngũ vận hành.' });
    },
  };
}
