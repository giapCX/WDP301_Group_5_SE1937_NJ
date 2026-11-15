export function createAuthController(service, emailOtp) {
  return {
    requestPasswordReset: async (request, response) => response.json({ data: await emailOtp.send(request.body || {}, 'reset') }),
    resetPassword: async (request, response) => response.json({ data: await emailOtp.reset(request.body || {}) }),
    login: async (request, response) => response.json(await service.login(request.body, { ip: request.ip })),
    me: async (request, response) => response.json(await service.getCurrentUser(request.headers.authorization)),
    logout: (_request, response) => response.json({
      message: 'Đăng xuất thành công.'
    })
  };
}
