export function createAuthController(service) {
  return {
    login: async (request, response) => response.json(await service.login(request.body)),
    me: async (request, response) => response.json(await service.getCurrentUser(request.headers.authorization)),
    logout: (_request, response) => response.json({
      message: 'Đăng xuất thành công.'
    })
  };
}
