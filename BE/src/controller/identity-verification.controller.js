export function createIdentityVerificationController(service) {
  return {
    mine: async (request, response) => response.json({ data: await service.mine({ user: request.user, tokenPayload: request.tokenPayload }) }),
    submit: async (request, response) => response.status(201).json({ data: await service.submit(request.body, { user: request.user, tokenPayload: request.tokenPayload }), message: 'Đã gửi hồ sơ eKYC để xét duyệt.' }),
    list: async (request, response) => response.json(await service.list(request.query)),
    precheck: async (request, response) => response.json({ data: await service.precheck(request.params.id, request.body, request.user._id) }),
    review: async (request, response) => response.json({ data: await service.review(request.params.id, request.body, request.user._id) }),
    download: async (request, response) => {
      const file = await service.download(request.params.id, request.params.kind);
      response.set({ 'Content-Type': file.contentType, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' }).send(file.bytes);
    },
  };
}
