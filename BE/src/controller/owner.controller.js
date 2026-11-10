export function createOwnerController(service) {
  return {
    dashboard: async (request, response) => {
      const data = await service.dashboard({ user: request.user, tokenPayload: request.tokenPayload });
      response.json({ data });
    },
    registerVehicle: async (request, response) => {
      const result = await service.registerVehicle(request.body, { user: request.user, tokenPayload: request.tokenPayload });
      response.status(201).json({ data: result, message: 'Đã ký thỏa thuận quản lý và gửi hồ sơ xe để xác minh.' });
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
