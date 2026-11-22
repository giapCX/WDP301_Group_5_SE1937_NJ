export function createAuthController(service, emailOtp) {
  const login = (renterOnly) => async (request, response) => {
    response.json(await service.login(request.body, { ip: request.ip, renterOnly }));
  };
  const loginWithOtp = (renterOnly) => async (request, response) => {
    const consume = await emailOtp.verify(request.body || {}, 'login');
    const challenge = await consume();
    response.json(await service.loginWithOtp(challenge, { ip: request.ip, renterOnly }));
  };
  return {
    requestPasswordReset: async (request, response) => response.json({ data: await emailOtp.send(request.body || {}, 'reset') }),
    resetPassword: async (request, response) => response.json({ data: await emailOtp.reset(request.body || {}) }),
    login: login(false),
    renterLogin: login(true),
    requestLoginOtp: async (request, response) => response.json({ data: await emailOtp.send(request.body || {}, 'login') }),
    loginWithOtp: loginWithOtp(false),
    renterLoginWithOtp: loginWithOtp(true),
    me: async (request, response) => response.json(await service.getCurrentUser(request.headers.authorization)),
    logout: (_request, response) => response.json({
      message: 'Đăng xuất thành công.'
    })
  };
}
