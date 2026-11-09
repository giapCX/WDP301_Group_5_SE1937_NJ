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
  };
}
