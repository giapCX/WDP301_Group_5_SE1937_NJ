export function createRenterController(service) {
  const data = handler => async (req, res) => res.json({
    data: await handler(req)
  });
  return {
    config: data(() => service.config()),
    challenge: data(req => service.challenge(req.user, req.body)),
    register: async (req, res) => res.status(201).json({
      data: await service.register(req.body)
    }),
    profile: data(req => service.profile(req.user)),
    updateProfile: data(req => service.updateProfile(req.user, req.body)),
    password: data(req => service.password(req.user, req.body)),
    upload: data(req => service.upload(req.user, req.body)),
    download: async (req, res) => {
      const {
        doc,
        bytes
      } = await service.download(req.user, req.params.id);
      res.set({
        'Content-Type': doc.content_type,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff'
      }).send(bytes);
    },
    create: async (req, res) => res.status(201).json({
      data: await service.createBooking(req.user, req.body)
    }),
    bookings: async (req, res) => res.json(await service.bookings(req.user, req.query)),
    detail: data(req => service.detail(req.user, req.params.id)),
    voucher: data(req => service.voucher(req.user, req.params.id, req.body)),
    sign: data(req => service.sign(req.user, req.params.id, req.body)),
    pay: data(req => service.pay(req.user, req.params.id, req.body)),
    preview: data(req => service.cancelPreview(req.user, req.params.id)),
    cancel: data(req => service.cancel(req.user, req.params.id, req.body)),
    incidents: data(req => service.incidents(req.user)),
    report: data(req => service.report(req.user, req.body))
  };
}
